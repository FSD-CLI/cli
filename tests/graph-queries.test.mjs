import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  buildGraph,
  dependenciesOf,
  dependentsOf,
  findSliceCycles,
  sliceKeyOf,
} from "../bin/core/graph.mjs";

// INT-01 slice 4 — graph queries (reverse lookup + cycles), at slice
// granularity. Internal API only — no command yet; `fsd impact` (INT-25)
// will call these. Self-imports are not dependencies and not cycles.

const fixturesDir = fileURLToPath(new URL("fixtures/analysis", import.meta.url));

function fixturePath(fixture) {
  return path.join(fixturesDir, fixture);
}

test("dependenciesOf on minimal: slices a slice imports from, sorted", () => {
  const graph = buildGraph(fixturePath("minimal"));
  assert.deepEqual(dependenciesOf(graph, "pages/home"), [
    "features/auth",
    "widgets/header",
  ]);
  assert.deepEqual(dependenciesOf(graph, "features/auth"), [
    "entities/user",
    "shared/ui",
  ]);
  assert.deepEqual(dependenciesOf(graph, "shared/ui"), []);
  assert.deepEqual(dependenciesOf(graph, "features/nope"), []);
});

test("dependentsOf on minimal: slices that import a slice, sorted", () => {
  const graph = buildGraph(fixturePath("minimal"));
  assert.deepEqual(dependentsOf(graph, "shared/ui"), [
    "app/providers",
    "entities/product",
    "features/auth",
    "widgets/header",
  ]);
  assert.deepEqual(dependentsOf(graph, "entities/user"), ["features/auth"]);
  assert.deepEqual(dependentsOf(graph, "pages/home"), []);
  assert.deepEqual(dependentsOf(graph, "features/nope"), []);
});

test("a slice importing itself is neither a dependency nor a cycle", () => {
  const graph = buildGraph(fixturePath("minimal"));
  // features/auth/ui/login-form imports features/auth/model/auth.
  assert.ok(!dependenciesOf(graph, "features/auth").includes("features/auth"));
  assert.ok(!dependentsOf(graph, "features/auth").includes("features/auth"));
  assert.deepEqual(findSliceCycles(graph), []);
});

test("findSliceCycles on minimal: no cycles", () => {
  const graph = buildGraph(fixturePath("minimal"));
  assert.deepEqual(findSliceCycles(graph), []);
});

test("findSliceCycles on cyclic: exactly the one 2-slice cycle", () => {
  const graph = buildGraph(fixturePath("cyclic"));
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 2);
  assert.deepEqual(findSliceCycles(graph), [["features/a", "features/b"]]);
  assert.deepEqual(dependenciesOf(graph, "features/a"), ["features/b"]);
  assert.deepEqual(dependentsOf(graph, "features/a"), ["features/b"]);
});

test("findSliceCycles on with-violations: finds the auth/pages cycle, every cycle valid", () => {
  const graph = buildGraph(fixturePath("with-violations"));
  const cycles = findSliceCycles(graph);
  assert.ok(
    cycles.some(
      (cycle) =>
        cycle.length === 2 &&
        cycle[0] === "features/auth" &&
        cycle[1] === "pages/home",
    ),
    `expected the features/auth <-> pages/home cycle in ${JSON.stringify(cycles)}`,
  );
  // Every returned cycle must be real: each slice imports the next, and
  // the last imports the first. (The tangled fixture has several
  // overlapping simple cycles, so the full set is asserted loosely.)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const sliceEdges = new Set(
    graph.edges
      .filter((edge) => edge.resolved)
      .map(
        (edge) =>
          `${sliceKeyOf(nodeById.get(edge.from))}>${sliceKeyOf(nodeById.get(edge.to))}`,
      ),
  );
  for (const cycle of cycles) {
    assert.ok(cycle.length >= 2, "a cycle has at least two slices");
    assert.equal(
      new Set(cycle).size,
      cycle.length,
      "a cycle never repeats a slice",
    );
    for (let i = 0; i < cycle.length; i++) {
      const from = cycle[i];
      const to = cycle[(i + 1) % cycle.length];
      assert.ok(
        sliceEdges.has(`${from}>${to}`),
        `expected a real slice edge ${from} -> ${to}`,
      );
    }
  }
});

test("findSliceCycles on empty: no cycles", () => {
  const graph = buildGraph(fixturePath("empty"));
  assert.deepEqual(findSliceCycles(graph), []);
});
