import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildGraph } from "../bin/core/graph.mjs";
import { CliUsageError, parseCliArgs } from "../bin/cli/args.mjs";

// INT-01 slice 5 — `fsd graph` command + docs. Command-level tests on the
// INT-04 analysis fixtures: the real CLI is spawned, like
// tests/history.test.mjs does. The command is read-only and never writes
// files; it does not enforce the policy (that is INT-36).

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));
const fixturesDir = fileURLToPath(new URL("fixtures/analysis", import.meta.url));

function runGraph(fixture, args = []) {
  return spawnSync(process.execPath, [cli, "graph", ...args], {
    cwd: path.join(fixturesDir, fixture),
    encoding: "utf8",
    timeout: 10000,
  });
}

test("parseCliArgs: graph accepts --json only", () => {
  assert.deepEqual(parseCliArgs(["graph"]), { command: "graph", json: false });
  assert.deepEqual(parseCliArgs(["graph", "--json"]), {
    command: "graph",
    json: true,
  });
  assert.throws(() => parseCliArgs(["graph", "--bogus"]), CliUsageError);
});

test("fsd graph on minimal: 11 nodes, 11 edges, no violations", () => {
  const result = runGraph("minimal");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /11 nodes, 11 edges, 0 layer-boundary violations/);
  assert.match(result.stdout, /No layer-boundary violations\./);
  assert.match(result.stdout, /features: 3/);
});

test("fsd graph --json on minimal: parses to the built graph", () => {
  const result = runGraph("minimal", ["--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    JSON.parse(result.stdout),
    buildGraph(path.join(fixturesDir, "minimal")),
  );
});

test("fsd graph on with-violations: 3 violations listed", () => {
  const result = runGraph("with-violations");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /11 nodes, 14 edges, 3 layer-boundary violations/);
  assert.match(
    result.stdout,
    /entities\/product\/model\/product\.types -> features\/auth\/model\/auth/,
  );
  assert.match(
    result.stdout,
    /features\/auth\/model\/auth -> pages\/home\/ui\/home-page/,
  );
  assert.match(
    result.stdout,
    /shared\/ui\/button -> features\/cart\/model\/cart/,
  );
  assert.match(result.stdout, /must not import from \w+ \(layer-boundaries\)/);
});

test("fsd graph on empty: 0 nodes, 0 edges, no violations", () => {
  const result = runGraph("empty");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0 nodes, 0 edges, 0 layer-boundary violations/);
  assert.match(result.stdout, /No layer-boundary violations\./);
});

test("fsd --help lists the graph command", () => {
  const result = spawnSync(process.execPath, [cli, "--help"], {
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fsd graph \[--json\]/);
});
