import chalk from "chalk";
import path from "node:path";
import { buildGraph } from "../core/graph.mjs";
import { writeGraphHtml } from "../core/graph-html.mjs";
import { POLICY_LAYERS } from "../core/policy.mjs";

// `fsd graph` (INT-01, slice 5) — the thin public surface of the project
// graph engine. Prints the import graph of the current project: nodes
// (source files mapped to layer/slice), edges (import specifiers resolved
// to nodes), and layer-boundary violations. `--json` prints the same data
// as JSON for tooling. `--html` (PLAT-03) writes the same graph as a
// self-contained interactive page instead; that is the only mode that
// writes a file. It does NOT enforce the policy — enforcement inside
// `fsd check` is INT-36's job.

function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}

function printSummary(graph) {
  const { nodes, edges, violations } = graph;
  console.log(chalk.bold("\n  FSD graph\n"));
  console.log(
    `  ${nodes.length} ${plural(nodes.length, "node", "nodes")}, ` +
      `${edges.length} ${plural(edges.length, "edge", "edges")}, ` +
      `${violations.length} layer-boundary ${plural(violations.length, "violation", "violations")}`,
  );
  console.log();
  console.log("  Nodes per layer:");
  for (const layer of POLICY_LAYERS) {
    const count = nodes.filter((node) => node.layer === layer).length;
    console.log(`  ${layer}: ${count}`);
  }
  console.log();
  if (!violations.length) {
    console.log("  No layer-boundary violations.\n");
    return;
  }
  console.log("  Layer-boundary violations:");
  for (const violation of violations) {
    console.log(`  ${violation.from} -> ${violation.to}`);
    console.log(`    ${violation.message}`);
  }
  console.log();
}

export async function runGraphProject(
  command,
  cwd = process.cwd(),
  { json = false, html = null } = {},
) {
  if (html) {
    const written = writeGraphHtml(cwd, { out: html });
    console.log(`  Wrote ${path.relative(cwd, written.path)}`);
    console.log(
      chalk.dim(
        `  ${written.nodes} nodes, ${written.edges} edges, ${written.violations} layer-boundary violations — open the file in a browser to explore the graph.`,
      ),
    );
    return;
  }
  const graph = buildGraph(cwd);
  if (json) {
    console.log(JSON.stringify(graph, null, 2));
    return;
  }
  printSummary(graph);
}
