import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CliUsageError, parseCliArgs } from "../bin/cli/args.mjs";
import { buildGraph } from "../bin/core/graph.mjs";
import { renderGraphHtml, writeGraphHtml } from "../bin/core/graph-html.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));
const fixturesDir = fileURLToPath(new URL("fixtures/analysis", import.meta.url));

// `--html` writes into the project, so the CLI tests run on a disposable
// copy of a fixture, never on the fixture itself.
function fixtureCopy(t, fixture) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `fsd-graph-html-${fixture}-`));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.cpSync(path.join(fixturesDir, fixture), cwd, { recursive: true });
  return cwd;
}

function runGraph(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "graph", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
  });
}

function embeddedGraph(html) {
  const match = html.match(
    /<script id="graph-data" type="application\/json">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, "graph data script is present");
  return JSON.parse(match[1]);
}

// The page embeds the graph sorted (deterministic output); compare
// order-insensitively against the graph buildGraph returns.
function assertSameGraph(embedded, graph) {
  const byId = (a, b) => a.id.localeCompare(b.id);
  const byEdge = (a, b) =>
    a.from.localeCompare(b.from) ||
    String(a.to).localeCompare(String(b.to)) ||
    a.specifier.localeCompare(b.specifier);
  assert.deepEqual([...embedded.nodes].sort(byId), [...graph.nodes].sort(byId));
  assert.deepEqual([...embedded.edges].sort(byEdge), [...graph.edges].sort(byEdge));
  assert.deepEqual(embedded.violations, graph.violations);
}

test("parseCliArgs: graph accepts --html and --html=<file>, rejects --json with --html", () => {
  assert.deepEqual(parseCliArgs(["graph", "--html"]), {
    command: "graph",
    json: false,
    html: "fsd-graph.html",
  });
  assert.deepEqual(parseCliArgs(["graph", "--html=custom.html"]), {
    command: "graph",
    json: false,
    html: "custom.html",
  });
  assert.deepEqual(parseCliArgs(["graph"]), {
    command: "graph",
    json: false,
    html: null,
  });
  assert.throws(
    () => parseCliArgs(["graph", "--json", "--html"]),
    (error) =>
      error instanceof CliUsageError &&
      /cannot combine --json with --html/.test(error.message),
  );
  assert.throws(
    () => parseCliArgs(["graph", "--html="]),
    (error) => error instanceof CliUsageError && /--html requires a file path/.test(error.message),
  );
});

test("renderGraphHtml embeds the built graph and is deterministic", () => {
  const graph = buildGraph(path.join(fixturesDir, "minimal"));
  const html = renderGraphHtml(graph);
  assert.match(html, /<!doctype html>/);
  assertSameGraph(embeddedGraph(html), graph);
  assert.match(html, /features\/auth\/model\/auth/);
  assert.match(html, /data-layer="features"/);
  assert.equal(renderGraphHtml(graph), html);
});

test("renderGraphHtml never lets a hostile id break out of the data script", () => {
  const hostile = {
    nodes: [
      {
        id: 'features/x"><script>alert(1)</script>',
        file: "src/features/x.ts",
        layer: "features",
        slice: "x",
      },
    ],
    edges: [],
    violations: [],
  };
  const html = renderGraphHtml(hostile);
  const data = html.match(
    /<script id="graph-data" type="application\/json">([\s\S]*?)<\/script>/,
  )[1];
  assert.equal(data.includes("</script>"), false);
  assert.match(data, /\\u003cscript/);
  assert.match(html, /&lt;script&gt;/);
});

test("writeGraphHtml writes fsd-graph.html with the fixture counts", (t) => {
  const cwd = fixtureCopy(t, "minimal");
  const written = writeGraphHtml(cwd);
  assert.equal(written.path, path.join(cwd, "fsd-graph.html"));
  assert.deepEqual(
    { nodes: written.nodes, edges: written.edges, violations: written.violations },
    { nodes: 11, edges: 11, violations: 0 },
  );
  assert.ok(fs.existsSync(written.path));
});

test("fsd graph --html writes the page and names the file", (t) => {
  const cwd = fixtureCopy(t, "minimal");
  const result = runGraph(cwd, ["--html"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Wrote fsd-graph\.html/);
  const html = fs.readFileSync(path.join(cwd, "fsd-graph.html"), "utf8");
  assert.match(html, /11 nodes, 11 edges, 0 layer-boundary violations/);
  assertSameGraph(embeddedGraph(html), buildGraph(cwd));
});

test("fsd graph --html=<file> writes the custom path", (t) => {
  const cwd = fixtureCopy(t, "minimal");
  const result = runGraph(cwd, ["--html=custom.html"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Wrote custom\.html/);
  assert.ok(fs.existsSync(path.join(cwd, "custom.html")));
  assert.equal(fs.existsSync(path.join(cwd, "fsd-graph.html")), false);
});

test("fsd graph --json --html is a usage error", (t) => {
  const cwd = fixtureCopy(t, "minimal");
  const result = runGraph(cwd, ["--json", "--html"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot combine --json with --html/);
});

test("fsd graph --html on the empty fixture writes a valid empty page", (t) => {
  const cwd = fixtureCopy(t, "empty");
  const result = runGraph(cwd, ["--html"]);
  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(path.join(cwd, "fsd-graph.html"), "utf8");
  assert.match(html, /0 nodes, 0 edges, 0 layer-boundary violations/);
  assert.deepEqual(embeddedGraph(html).nodes, []);
});

test("fsd graph --html on the with-violations fixture lists the violations", (t) => {
  const cwd = fixtureCopy(t, "with-violations");
  const result = runGraph(cwd, ["--html"]);
  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(path.join(cwd, "fsd-graph.html"), "utf8");
  const embedded = embeddedGraph(html);
  assert.equal(embedded.violations.length, 3);
  assert.equal(buildGraph(cwd).violations.length, 3);
  assert.match(html, /Layer-boundary violations \(3\)/);
  assert.match(html, /class="violation-item"/);
});
