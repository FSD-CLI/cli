import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { buildGraph, defaultLayerAllow } from "../bin/core/graph.mjs";
import {
  HEALTH_SCORE_DIMENSIONS,
  HEALTH_SCORE_MAX_ISSUES,
  computeHealthScore,
  gradeForScore,
} from "../bin/core/health-score.mjs";
import { inspectProject } from "../bin/commands/inspect-project.mjs";

// INT-02 — architecture health score. Pinned against the analysis
// fixtures (see tests/fixtures/analysis/README.md): minimal is a clean
// project (99/A — only shared/api is orphaned), with-violations carries
// the 3 deliberate upward imports (76/B), cyclic is the smallest slice
// cycle (59/D), empty has no source files (0/F).

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));
const fixturesDir = fileURLToPath(
  new URL("fixtures/analysis", import.meta.url),
);

function fixturePath(fixture) {
  return path.join(fixturesDir, fixture);
}

function dimensionScores(result) {
  return result.dimensions.map(({ id, score }) => [id, score]);
}

function runCli(cwd, args = []) {
  // 15s, not 5s: a `doctor` spawn takes ~2.3s unloaded but up to ~5s
  // under full-suite parallel load (the same flake hits the pre-existing
  // doctor-metrics tests at their 5s timeout).
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 15000,
  });
}

test("gradeForScore: grade bands", () => {
  assert.equal(gradeForScore(100), "A");
  assert.equal(gradeForScore(90), "A");
  assert.equal(gradeForScore(89), "B");
  assert.equal(gradeForScore(75), "B");
  assert.equal(gradeForScore(74), "C");
  assert.equal(gradeForScore(60), "C");
  assert.equal(gradeForScore(59), "D");
  assert.equal(gradeForScore(40), "D");
  assert.equal(gradeForScore(39), "F");
  assert.equal(gradeForScore(0), "F");
});

test("weights sum to 100 and cover the five spec dimensions", () => {
  assert.deepEqual(
    HEALTH_SCORE_DIMENSIONS.map(({ id }) => id),
    [
      "layer-boundaries",
      "slice-isolation",
      "slice-cycles",
      "orphans",
      "layer-coverage",
    ],
  );
  assert.equal(
    HEALTH_SCORE_DIMENSIONS.reduce((sum, { weight }) => sum + weight, 0),
    100,
  );
});

test("minimal fixture: 99/A — only shared/api is orphaned", () => {
  const result = computeHealthScore(buildGraph(fixturePath("minimal")));
  assert.equal(result.score, 99);
  assert.equal(result.grade, "A");
  assert.deepEqual(dimensionScores(result), [
    ["layer-boundaries", 100],
    ["slice-isolation", 100],
    ["slice-cycles", 100],
    ["orphans", 89],
    ["layer-coverage", 100],
  ]);
  assert.deepEqual(result.totals, {
    nodes: 11,
    edges: 11,
    resolvedEdges: 11,
    slices: 9,
    violations: 0,
    crossSliceImports: 0,
    cycles: 0,
    orphans: 1,
    layersPresent: 6,
    issues: 1,
  });
  assert.deepEqual(result.issues, [
    {
      severity: "low",
      dimension: "orphans",
      message: "Slice shared/api has no imports to or from any other slice",
    },
  ]);
});

test("with-violations fixture: 76/B — 3 violations, 4 cycles", () => {
  const result = computeHealthScore(
    buildGraph(fixturePath("with-violations")),
  );
  assert.equal(result.score, 76);
  assert.equal(result.grade, "B");
  assert.deepEqual(dimensionScores(result), [
    ["layer-boundaries", 79],
    ["slice-isolation", 100],
    ["slice-cycles", 0],
    ["orphans", 89],
    ["layer-coverage", 100],
  ]);
  assert.equal(result.totals.violations, 3);
  assert.equal(result.totals.cycles, 4);
  assert.equal(result.totals.issues, 8);
  // Worst first: the 3 violations, then the 4 cycles, then the orphan.
  assert.deepEqual(
    result.issues.map(({ severity, dimension }) => [severity, dimension]),
    [
      ["high", "layer-boundaries"],
      ["high", "layer-boundaries"],
      ["high", "layer-boundaries"],
      ["high", "slice-cycles"],
      ["high", "slice-cycles"],
      ["high", "slice-cycles"],
      ["high", "slice-cycles"],
      ["low", "orphans"],
    ],
  );
  assert.equal(
    result.issues[0].message,
    "entities must not import from features (layer-boundaries)",
  );
});

test("cyclic fixture: 59/D — cross-slice imports and one cycle", () => {
  const result = computeHealthScore(buildGraph(fixturePath("cyclic")));
  assert.equal(result.score, 59);
  assert.equal(result.grade, "D");
  assert.deepEqual(dimensionScores(result), [
    ["layer-boundaries", 100],
    ["slice-isolation", 0],
    ["slice-cycles", 50],
    ["orphans", 100],
    ["layer-coverage", 17],
  ]);
  assert.equal(result.totals.crossSliceImports, 2);
  assert.equal(result.totals.cycles, 1);
  assert.equal(result.totals.issues, 8);
  assert.equal(
    result.issues[0].message,
    "Slice cycle: features/a → features/b → features/a",
  );
  assert.deepEqual(
    result.issues
      .filter(({ dimension }) => dimension === "slice-isolation")
      .map(({ severity, message }) => [severity, message]),
    [
      [
        "medium",
        "features/a imports features/b in the same layer (features)",
      ],
      [
        "medium",
        "features/b imports features/a in the same layer (features)",
      ],
    ],
  );
});

test("empty fixture: 0/F — no source files, nothing to score", () => {
  const result = computeHealthScore(buildGraph(fixturePath("empty")));
  assert.equal(result.score, 0);
  assert.equal(result.grade, "F");
  assert.deepEqual(
    result.dimensions.map(({ score }) => score),
    [0, 0, 0, 0, 0],
  );
  assert.deepEqual(result.issues, [
    {
      severity: "high",
      dimension: "layer-coverage",
      message:
        "No source files found in the project layers — nothing to score.",
    },
  ]);
  assert.equal(result.totals.issues, 1);
});

test("computeHealthScore is deterministic", () => {
  const graph = buildGraph(fixturePath("with-violations"));
  assert.deepEqual(computeHealthScore(graph), computeHealthScore(graph));
});

test("allow list (INT-36 seam): a permitted edge is not a violation", () => {
  const graph = buildGraph(fixturePath("with-violations"));
  const allow = defaultLayerAllow();
  allow.features = [...allow.features, "pages"];
  const result = computeHealthScore(graph, { allow });
  assert.equal(result.totals.violations, 2);
  // Layer boundaries rise 79 -> 86; cycles are computed from the edges
  // regardless of the allow list, so they still score 0.
  assert.equal(result.score, 78);
});

test("unresolved edges are ignored, not scored", () => {
  // One clean resolved edge plus one bare-package import: the bare
  // import must not count as an edge, a violation or a cross-slice
  // import anywhere in the result.
  const graph = {
    nodes: [
      { id: "features/a/model/a", file: "src/features/a/model/a.ts", layer: "features", slice: "a" },
      { id: "shared/ui/button", file: "src/shared/ui/button.tsx", layer: "shared", slice: "ui" },
    ],
    edges: [
      { from: "features/a/model/a", to: "shared/ui/button", specifier: "../../../shared/ui/button", resolved: true },
      { from: "features/a/model/a", to: null, specifier: "react", resolved: false },
    ],
  };
  const result = computeHealthScore(graph);
  assert.equal(result.totals.edges, 2);
  assert.equal(result.totals.resolvedEdges, 1);
  assert.equal(result.totals.violations, 0);
  assert.deepEqual(dimensionScores(result), [
    ["layer-boundaries", 100],
    ["slice-isolation", 100],
    ["slice-cycles", 100],
    ["orphans", 100],
    ["layer-coverage", 33],
  ]);
  assert.equal(result.score, 93);
});

test("issues are capped at 10, worst first, with the full count kept", () => {
  // 12 upward imports (entities -> features) plus 4 missing layers.
  const nodes = [];
  const edges = [];
  for (let i = 1; i <= 12; i++) {
    nodes.push({
      id: `entities/s${i}/model/m${i}`,
      file: `src/entities/s${i}/model/m${i}.ts`,
      layer: "entities",
      slice: `s${i}`,
    });
    edges.push({
      from: `entities/s${i}/model/m${i}`,
      to: "features/y/model/n",
      specifier: `../../../features/y/model/n`,
      resolved: true,
    });
  }
  nodes.push({
    id: "features/y/model/n",
    file: "src/features/y/model/n.ts",
    layer: "features",
    slice: "y",
  });
  const result = computeHealthScore({ nodes, edges });
  assert.equal(result.totals.issues, 16);
  assert.equal(result.issues.length, HEALTH_SCORE_MAX_ISSUES);
  assert.equal(
    result.issues.every(({ severity }) => severity === "high"),
    true,
  );
});

test("doctor prints the health score with breakdown and worst issues", () => {
  const result = runCli(fixturePath("minimal"), ["doctor"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Architecture health score/);
  assert.match(result.stdout, /99\/100 \(A\)/);
  assert.match(
    result.stdout,
    /Layer boundaries: 100\/100 — 0 violations in 11 resolved edges/,
  );
  assert.match(
    result.stdout,
    /Slice isolation: 100\/100 — 0 cross-slice imports in 2 same-layer resolved edges/,
  );
  assert.match(result.stdout, /Slice cycles: 100\/100 — 0 cycles/);
  assert.match(result.stdout, /Orphan slices: 89\/100 — 1 orphan slice of 9/);
  assert.match(
    result.stdout,
    /Layer coverage: 100\/100 — 6 of 6 layers have source files/,
  );
  assert.match(
    result.stdout,
    /\[low\] Slice shared\/api has no imports to or from any other slice/,
  );
  // The score comes after the project metrics.
  assert.ok(
    result.stdout.indexOf("Project metrics") <
      result.stdout.indexOf("Architecture health score"),
  );
});

test("doctor on a project with violations prints the lower score", () => {
  const result = runCli(fixturePath("with-violations"), ["doctor"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /76\/100 \(B\)/);
  assert.match(
    result.stdout,
    /\[high\] entities must not import from features \(layer-boundaries\)/,
  );
  assert.match(result.stdout, /Slice cycle: features\/auth → pages\/home → features\/auth/);
});

test("check does not print the health score", () => {
  const result = runCli(fixturePath("minimal"), ["check"]);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Architecture health score/);
  assert.doesNotMatch(result.stdout, /\/100 \([A-F]\)/);
});

test("inspectProject includes the health score for doctor and not for check", () => {
  const doctor = inspectProject(fixturePath("minimal"), {
    includeToolchain: true,
  });
  assert.equal(doctor.healthScore.error, null);
  assert.equal(doctor.healthScore.result.score, 99);
  assert.equal(doctor.healthScore.result.grade, "A");
  const check = inspectProject(fixturePath("minimal"));
  assert.equal(check.healthScore, null);
});
