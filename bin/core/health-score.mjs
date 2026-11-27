// Architecture health score (INT-02) — a 0-100 score for a project,
// computed from the import graph INT-01 builds (`bin/core/graph.mjs`).
//
// The score is a weighted sum of five dimensions; each dimension scores
// 0-100 and is computed from graph facts only, so the score is
// deterministic for a given project. The full formula, grade bands and
// issue rules are specified in docs/HEALTH-SCORE.md — this module is the
// implementation of that spec, and `fsd doctor` is its only surface (no
// `fsd score` command: that is the separate future task INT-54).
//
// The engine is pure: it takes a graph object ({ nodes, edges }) and
// returns a plain result — no file reads, no console output — so it is
// unit-testable without a fixture project on disk.

import {
  findSliceCycles,
  findViolations,
  sliceKeyOf,
} from "./graph.mjs";
import { POLICY_LAYERS } from "./policy.mjs";

// Dimension weights, in score points out of 100. They sum to 100, so the
// total score is the weighted sum of the dimension scores.
export const HEALTH_SCORE_DIMENSIONS = [
  { id: "layer-boundaries", label: "Layer boundaries", weight: 40 },
  { id: "slice-isolation", label: "Slice isolation", weight: 25 },
  { id: "slice-cycles", label: "Slice cycles", weight: 15 },
  { id: "orphans", label: "Orphan slices", weight: 10 },
  { id: "layer-coverage", label: "Layer coverage", weight: 10 },
];

// Grade bands (see docs/HEALTH-SCORE.md).
export function gradeForScore(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

// Worst issues shown in `fsd doctor` output. The full count is kept in
// `totals.issues` so the cap is visible, not silent.
export const HEALTH_SCORE_MAX_ISSUES = 10;

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

// Resolved edges only: an unresolved edge (bare package, alias import)
// cannot be judged against the architecture, so it scores nothing and
// is never an issue. Same-layer edges are the only ones that can be
// cross-slice imports.
function analyzeEdges(graph) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const resolved = [];
  const sameLayer = [];
  const crossSlice = [];
  for (const edge of graph.edges) {
    if (!edge.resolved) continue;
    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    if (!fromNode || !toNode) continue;
    resolved.push({ edge, fromNode, toNode });
    if (fromNode.layer !== toNode.layer) continue;
    sameLayer.push({ edge, fromNode, toNode });
    if (fromNode.slice !== toNode.slice) {
      crossSlice.push({ edge, fromNode, toNode });
    }
  }
  return { resolved, sameLayer, crossSlice };
}

// A slice is orphaned when none of its nodes has a resolved edge to or
// from a node of a *different* slice: nothing uses it and it uses
// nothing. Same-slice edges do not count — a slice that only imports
// itself is still unreachable from the rest of the project. A slice
// with no nodes cannot exist (slices come from the nodes), so every
// slice in the map has at least one node.
function findOrphanSlices(graph) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const connected = new Set();
  for (const edge of graph.edges) {
    if (!edge.resolved) continue;
    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    if (!fromNode || !toNode) continue;
    if (sliceKeyOf(fromNode) === sliceKeyOf(toNode)) continue;
    connected.add(sliceKeyOf(fromNode));
    connected.add(sliceKeyOf(toNode));
  }
  const orphans = [];
  for (const node of graph.nodes) {
    const key = sliceKeyOf(node);
    if (!connected.has(key) && !orphans.includes(key)) orphans.push(key);
  }
  return orphans.sort();
}

function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}

export function computeHealthScore(graph, { allow } = {}) {
  const nodes = graph.nodes ?? [];
  const totals = {
    nodes: nodes.length,
    edges: (graph.edges ?? []).length,
    resolvedEdges: 0,
    slices: 0,
    violations: 0,
    crossSliceImports: 0,
    cycles: 0,
    orphans: 0,
    layersPresent: 0,
    issues: 0,
  };

  // A project with no source files in its layers has no architecture to
  // score: 0/F, not a vacuous near-perfect score. Every dimension reads
  // 0 with the same explanation, and the single issue says why.
  if (nodes.length === 0) {
    return {
      score: 0,
      grade: "F",
      dimensions: HEALTH_SCORE_DIMENSIONS.map(({ id, label, weight }) => ({
        id,
        label,
        weight,
        score: 0,
        detail: "No source files in the project layers",
      })),
      issues: [
        {
          severity: "high",
          dimension: "layer-coverage",
          message:
            "No source files found in the project layers — nothing to score.",
        },
      ],
      totals: { ...totals, issues: 1 },
    };
  }

  const violations = findViolations(graph, allow);
  const { resolved, sameLayer, crossSlice } = analyzeEdges(graph);
  const cycles = findSliceCycles(graph);
  const orphans = findOrphanSlices(graph);
  const layersPresent = new Set(nodes.map((node) => node.layer));
  const slices = new Set(nodes.map((node) => sliceKeyOf(node)));

  totals.resolvedEdges = resolved.length;
  totals.slices = slices.size;
  totals.violations = violations.length;
  totals.crossSliceImports = crossSlice.length;
  totals.cycles = cycles.length;
  totals.orphans = orphans.length;
  totals.layersPresent = layersPresent.size;

  const dimensions = [
    {
      id: "layer-boundaries",
      score:
        resolved.length === 0
          ? 100
          : Math.round(100 * (1 - violations.length / resolved.length)),
      detail:
        `${violations.length} ${plural(violations.length, "violation", "violations")} ` +
        `in ${resolved.length} resolved ${plural(resolved.length, "edge", "edges")}`,
    },
    {
      id: "slice-isolation",
      score:
        sameLayer.length === 0
          ? 100
          : Math.round(100 * (1 - crossSlice.length / sameLayer.length)),
      detail:
        `${crossSlice.length} cross-slice ${plural(crossSlice.length, "import", "imports")} ` +
        `in ${sameLayer.length} same-layer resolved ${plural(sameLayer.length, "edge", "edges")}`,
    },
    {
      id: "slice-cycles",
      score: Math.max(0, 100 - 50 * cycles.length),
      detail: `${cycles.length} ${plural(cycles.length, "cycle", "cycles")}`,
    },
    {
      id: "orphans",
      score:
        slices.size === 0
          ? 100
          : Math.round(100 * (1 - orphans.length / slices.size)),
      detail:
        `${orphans.length} orphan ${plural(orphans.length, "slice", "slices")} ` +
        `of ${slices.size}`,
    },
    {
      id: "layer-coverage",
      score: Math.round((100 * layersPresent.size) / POLICY_LAYERS.length),
      detail: `${layersPresent.size} of ${POLICY_LAYERS.length} layers have source files`,
    },
  ].map((dimension) => {
    const { label, weight } = HEALTH_SCORE_DIMENSIONS.find(
      ({ id }) => id === dimension.id,
    );
    return { id: dimension.id, label, weight, score: dimension.score, detail: dimension.detail };
  });

  const score = Math.round(
    dimensions.reduce(
      (total, dimension) => total + (dimension.weight * dimension.score) / 100,
      0,
    ),
  );

  const issues = [];
  for (const violation of violations) {
    issues.push({
      severity: "high",
      dimension: "layer-boundaries",
      message: violation.message,
      from: violation.from,
      to: violation.to,
    });
  }
  for (const cycle of cycles) {
    issues.push({
      severity: "high",
      dimension: "slice-cycles",
      message: `Slice cycle: ${[...cycle, cycle[0]].join(" → ")}`,
    });
  }
  for (const { fromNode, toNode } of crossSlice) {
    issues.push({
      severity: "medium",
      dimension: "slice-isolation",
      message:
        `${sliceKeyOf(fromNode)} imports ${sliceKeyOf(toNode)} in the same layer (${fromNode.layer})`,
      from: fromNode.id,
      to: toNode.id,
    });
  }
  for (const key of orphans) {
    issues.push({
      severity: "low",
      dimension: "orphans",
      message: `Slice ${key} has no imports to or from any other slice`,
    });
  }
  for (const layer of POLICY_LAYERS) {
    if (!layersPresent.has(layer)) {
      issues.push({
        severity: "low",
        dimension: "layer-coverage",
        message: `Layer ${layer} has no source files`,
      });
    }
  }
  // Worst first: severity, then dimension weight (layer-boundaries
  // before slice-isolation before cycles…), then message for stability.
  const dimensionOrder = new Map(
    HEALTH_SCORE_DIMENSIONS.map(({ id }, index) => [id, index]),
  );
  issues.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      dimensionOrder.get(a.dimension) - dimensionOrder.get(b.dimension) ||
      (a.message < b.message ? -1 : a.message > b.message ? 1 : 0),
  );
  totals.issues = issues.length;

  return {
    score,
    grade: gradeForScore(score),
    dimensions,
    issues: issues.slice(0, HEALTH_SCORE_MAX_ISSUES),
    totals,
  };
}
