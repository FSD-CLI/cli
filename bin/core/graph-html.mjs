// Interactive dependency graph (PLAT-03).
//
// `fsd graph --html` renders the INT-01 import graph as a self-contained
// HTML page: one SVG with a column per FSD layer, one node per source file,
// one path per resolved import edge. No dependencies, no server — open the
// file in a browser. Clicking a node highlights its dependencies and
// dependents; the layer checkboxes filter layers; the violations panel lists
// every layer-boundary violation and highlights its edge on click; the
// search box dims nodes whose id does not match.
//
// The graph data is embedded as JSON in a script tag. `<`, `>` and `&` are
// escaped to \uXXXX sequences inside the JSON so a hostile file name can
// never break out of the script tag. The output is deterministic: nodes
// and edges are sorted before rendering, so the same project always
// produces the same bytes.

import fs from "node:fs";
import path from "node:path";
import { buildGraph } from "./graph.mjs";
import { POLICY_LAYERS } from "./policy.mjs";

export const GRAPH_HTML_FILE = "fsd-graph.html";

// One column per layer, in FSD order (app on the left, shared on the right).
const COLUMN_WIDTH = 230;
const COLUMN_GAP = 40;
const MARGIN = 20;
const NODE_HEIGHT = 36;
const NODE_GAP = 10;
const HEADER_HEIGHT = 60;

const LAYER_COLORS = {
  app: "#dbeafe",
  pages: "#dcfce7",
  widgets: "#fef9c3",
  features: "#fee2e2",
  entities: "#ede9fe",
  shared: "#f3f4f6",
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shortLabel(id, layer) {
  const label = id.startsWith(`${layer}/`) ? id.slice(layer.length + 1) : id;
  return label.length > 30 ? `${label.slice(0, 27)}…` : label;
}

function sortedGraph(graph) {
  const layerIndex = new Map(POLICY_LAYERS.map((layer, index) => [layer, index]));
  const nodes = [...graph.nodes].sort(
    (a, b) =>
      (layerIndex.get(a.layer) ?? 99) - (layerIndex.get(b.layer) ?? 99) ||
      a.slice.localeCompare(b.slice) ||
      a.id.localeCompare(b.id),
  );
  const edges = [...graph.edges].sort(
    (a, b) =>
      a.from.localeCompare(b.from) ||
      String(a.to).localeCompare(String(b.to)) ||
      a.specifier.localeCompare(b.specifier),
  );
  return { nodes, edges, violations: graph.violations ?? [] };
}

// Positions, computed once and shared by the SVG and the edge paths.
function layout(nodes) {
  const perLayer = new Map(POLICY_LAYERS.map((layer) => [layer, []]));
  for (const node of nodes) {
    (perLayer.get(node.layer) ?? perLayer.get("shared")).push(node);
  }
  const positions = new Map();
  let maxRows = 0;
  for (const [index, layer] of POLICY_LAYERS.entries()) {
    const column = perLayer.get(layer);
    maxRows = Math.max(maxRows, column.length);
    const x = MARGIN + index * (COLUMN_WIDTH + COLUMN_GAP);
    column.forEach((node, row) => {
      positions.set(node.id, {
        x,
        y: HEADER_HEIGHT + row * (NODE_HEIGHT + NODE_GAP),
        layer,
      });
    });
  }
  const width =
    MARGIN * 2 + POLICY_LAYERS.length * COLUMN_WIDTH + (POLICY_LAYERS.length - 1) * COLUMN_GAP;
  const height =
    HEADER_HEIGHT + Math.max(maxRows, 1) * (NODE_HEIGHT + NODE_GAP) + MARGIN;
  return { positions, width, height };
}

function edgePath(from, to) {
  const x1 = from.x + COLUMN_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;
  if (from.layer === to.layer) {
    // Same-layer edges bulge right, into the column gap, instead of
    // running backwards through the column.
    return (
      `M ${x1} ${from.y + NODE_HEIGHT - 6} ` +
      `C ${x1 + 32} ${from.y + NODE_HEIGHT - 6}, ${x2 + 32} ${to.y + 6}, ${x2} ${to.y + 6}`
    );
  }
  return `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`;
}

const STYLE = `
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: #111827; }
  header { padding: 16px 20px 0; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 12px; color: #4b5563; }
  .filters { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; padding: 0 20px 12px; }
  .filters label { font-size: 14px; cursor: pointer; }
  .filters input[type="search"] { font: inherit; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 6px; }
  .filters button { font: inherit; padding: 4px 10px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; }
  svg { display: block; }
  .node { cursor: pointer; }
  .node rect { stroke: #9ca3af; stroke-width: 1; }
  .node text { font-size: 12px; fill: #111827; pointer-events: none; }
  .edge { fill: none; stroke: #94a3b8; stroke-width: 1.5; }
  .edge.violation { stroke: #dc2626; stroke-width: 2; }
  .dimmed { opacity: 0.12; }
  .node.selected rect { stroke: #111827; stroke-width: 2.5; }
  .hidden { display: none; }
  section { padding: 0 20px 20px; }
  section h2 { font-size: 16px; margin: 8px 0; }
  section ul { margin: 0; padding-left: 20px; }
  section li { cursor: pointer; margin: 2px 0; }
  section li:hover { text-decoration: underline; }
  section li.violation-item { color: #b91c1c; }
`;

const SCRIPT = `
const data = JSON.parse(document.getElementById("graph-data").textContent);
const nodesById = new Map(data.nodes.map((n) => [n.id, n]));
const outgoing = new Map(data.nodes.map((n) => [n.id, new Set()]));
const incoming = new Map(data.nodes.map((n) => [n.id, new Set()]));
for (const edge of data.edges) {
  if (!edge.resolved) continue;
  if (outgoing.has(edge.from) && incoming.has(edge.to)) {
    outgoing.get(edge.from).add(edge.to);
    incoming.get(edge.to).add(edge.from);
  }
}
function clearSelection() {
  document.querySelectorAll(".dimmed").forEach((el) => el.classList.remove("dimmed"));
  document.querySelectorAll(".node.selected").forEach((el) => el.classList.remove("selected"));
}
function selectNode(id) {
  clearSelection();
  const keep = new Set([id, ...outgoing.get(id), ...incoming.get(id)]);
  document.querySelectorAll(".node").forEach((el) => {
    const nodeId = el.getAttribute("data-id");
    if (nodeId === id) el.classList.add("selected");
    else if (!keep.has(nodeId)) el.classList.add("dimmed");
  });
  document.querySelectorAll(".edge").forEach((el) => {
    const from = el.getAttribute("data-from");
    const to = el.getAttribute("data-to");
    if (!((from === id && keep.has(to)) || (to === id && keep.has(from)))) el.classList.add("dimmed");
  });
}
document.querySelectorAll(".node").forEach((el) => {
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    const id = el.getAttribute("data-id");
    if (el.classList.contains("selected")) clearSelection();
    else selectNode(id);
  });
});
document.querySelector("svg").addEventListener("click", clearSelection);
function applyLayerFilters() {
  const visible = new Map(
    [...document.querySelectorAll('input[data-layer]')].map((box) => [
      box.getAttribute("data-layer"),
      box.checked,
    ]),
  );
  document.querySelectorAll(".node").forEach((el) => {
    el.classList.toggle("hidden", !visible.get(el.getAttribute("data-layer")));
  });
  document.querySelectorAll(".edge").forEach((el) => {
    const fromLayer = nodesById.get(el.getAttribute("data-from"))?.layer;
    const toLayer = nodesById.get(el.getAttribute("data-to"))?.layer;
    el.classList.toggle("hidden", !visible.get(fromLayer) || !visible.get(toLayer));
  });
}
document.querySelectorAll('input[data-layer]').forEach((box) => {
  box.addEventListener("change", applyLayerFilters);
});
document.querySelectorAll(".violation-item").forEach((item) => {
  item.addEventListener("click", () => {
    const from = item.getAttribute("data-from");
    const to = item.getAttribute("data-to");
    clearSelection();
    document.querySelectorAll(".node").forEach((el) => {
      const nodeId = el.getAttribute("data-id");
      if (nodeId !== from && nodeId !== to) el.classList.add("dimmed");
    });
    document.querySelectorAll(".edge").forEach((el) => {
      if (!(el.getAttribute("data-from") === from && el.getAttribute("data-to") === to)) el.classList.add("dimmed");
    });
  });
});
document.getElementById("search").addEventListener("input", (event) => {
  const query = event.target.value.trim();
  document.querySelectorAll(".node").forEach((el) => {
    el.classList.toggle("dimmed", query !== "" && !el.getAttribute("data-id").includes(query));
  });
});
document.getElementById("clear").addEventListener("click", () => {
  document.getElementById("search").value = "";
  clearSelection();
});
`;

/**
 * Renders the graph as a self-contained interactive HTML page.
 *
 * @param {{nodes: {id: string, file: string, layer: string, slice: string}[], edges: {from: string, to: string|null, specifier: string, resolved: boolean}[], violations: {rule: string, from: string, to: string, message: string}[]}} graph
 * @returns {string} the full HTML document
 */
export function renderGraphHtml(graph) {
  const { nodes, edges, violations } = sortedGraph(graph);
  const { positions, width, height } = layout(nodes);
  const violationEdges = new Set(violations.map((v) => `${v.from}\0${v.to}`));

  const nodeSvg = nodes
    .map((node) => {
      const pos = positions.get(node.id);
      const color = LAYER_COLORS[node.layer] ?? "#f3f4f6";
      return (
        `<g class="node" data-id="${escapeHtml(node.id)}" data-layer="${escapeHtml(node.layer)}" ` +
        `data-slice="${escapeHtml(node.slice)}">` +
        `<title>${escapeHtml(node.id)} — ${escapeHtml(node.file)}</title>` +
        `<rect x="${pos.x}" y="${pos.y}" width="${COLUMN_WIDTH}" height="${NODE_HEIGHT}" rx="6" fill="${color}"/>` +
        `<text x="${pos.x + 10}" y="${pos.y + 22}">${escapeHtml(shortLabel(node.id, node.layer))}</text>` +
        `</g>`
      );
    })
    .join("\n");

  const edgeSvg = edges
    .filter((edge) => edge.resolved && positions.has(edge.from) && positions.has(edge.to))
    .map((edge) => {
      const violation = violationEdges.has(`${edge.from}\0${edge.to}`);
      return (
        `<path class="edge${violation ? " violation" : ""}" ` +
        `data-from="${escapeHtml(edge.from)}" data-to="${escapeHtml(edge.to)}" ` +
        `data-layer="${escapeHtml(positions.get(edge.from).layer)}" ` +
        `d="${edgePath(positions.get(edge.from), positions.get(edge.to))}">` +
        `<title>${escapeHtml(edge.from)} → ${escapeHtml(edge.to)} (${escapeHtml(edge.specifier)})</title>` +
        `</path>`
      );
    })
    .join("\n");

  const layerLabels = POLICY_LAYERS.map((layer, index) => {
    const x = MARGIN + index * (COLUMN_WIDTH + COLUMN_GAP);
    const count = nodes.filter((node) => node.layer === layer).length;
    return `<text x="${x}" y="36" font-size="14" font-weight="bold">${escapeHtml(layer)} (${count})</text>`;
  }).join("\n");

  const filters = POLICY_LAYERS.map(
    (layer) =>
      `<label><input type="checkbox" data-layer="${escapeHtml(layer)}" checked> ${escapeHtml(layer)}</label>`,
  ).join("\n");

  const violationsHtml =
    violations.length === 0
      ? `<p>No layer-boundary violations.</p>`
      : `<ul>${violations
          .map(
            (v) =>
              `<li class="violation-item" data-from="${escapeHtml(v.from)}" data-to="${escapeHtml(v.to)}">` +
              `${escapeHtml(v.from)} → ${escapeHtml(v.to)} — ${escapeHtml(v.message)}</li>`,
          )
          .join("\n")}</ul>`;

  // \u-escaping inside the JSON keeps a hostile id from closing the script tag.
  const dataJson = JSON.stringify({ nodes, edges, violations })
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FSD graph</title>
<style>${STYLE}</style>
</head>
<body>
<header>
<h1>FSD graph</h1>
<p>${nodes.length} nodes, ${edges.length} edges, ${violations.length} layer-boundary violation${violations.length === 1 ? "" : "s"}. Click a node to highlight its dependencies and dependents; click empty space to clear.</p>
</header>
<div class="filters">
${filters}
<input id="search" type="search" placeholder="Filter nodes by id…" aria-label="Filter nodes by id">
<button id="clear" type="button">Clear</button>
</div>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Project import graph">
${layerLabels}
${edgeSvg}
${nodeSvg}
</svg>
<section>
<h2>Layer-boundary violations (${violations.length})</h2>
${violationsHtml}
</section>
<script id="graph-data" type="application/json">${dataJson}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

/**
 * Builds the graph for a project root and writes the interactive page.
 *
 * @param {string} root project root
 * @param {{out?: string}} options output file, relative to root by default
 * @returns {{path: string, nodes: number, edges: number, violations: number}}
 */
export function writeGraphHtml(root, { out = GRAPH_HTML_FILE } = {}) {
  const graph = buildGraph(root);
  const file = path.resolve(root, out);
  fs.writeFileSync(file, renderGraphHtml(graph), "utf8");
  return {
    path: file,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    violations: graph.violations.length,
  };
}
