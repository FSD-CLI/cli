import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildGraph } from "../bin/core/graph.mjs";

// INT-01 slice 1 — file discovery + node model. Tests the node inventory
// against the INT-04 analysis fixtures (tests/fixtures/analysis/); no
// import parsing happens in this slice, so edges are always empty.

const fixturesDir = fileURLToPath(new URL("fixtures/analysis", import.meta.url));

function fixturePath(fixture) {
  return path.join(fixturesDir, fixture);
}

function nodeById(graph, id) {
  return graph.nodes.find((node) => node.id === id);
}

function assertSortedUniqueIds(graph) {
  const ids = graph.nodes.map((node) => node.id);
  assert.deepEqual(ids, [...ids].sort(), "node ids should be sorted");
  assert.equal(new Set(ids).size, ids.length, "node ids should be unique");
}

function assertEveryFileExists(fixture, graph) {
  for (const node of graph.nodes) {
    assert.ok(
      fs.existsSync(path.join(fixturePath(fixture), node.file)),
      `${node.file} should exist on disk`,
    );
  }
}

test("minimal fixture: 11 nodes, one per source file, edges empty", () => {
  const graph = buildGraph(fixturePath("minimal"));
  assert.equal(graph.nodes.length, 11);
  assert.deepEqual(graph.edges, []);
  assertSortedUniqueIds(graph);
  assertEveryFileExists("minimal", graph);

  assert.deepEqual(nodeById(graph, "app/providers/index"), {
    id: "app/providers/index",
    file: "src/app/providers/index.ts",
    layer: "app",
    slice: "providers",
  });
  assert.deepEqual(nodeById(graph, "pages/home/ui/home-page"), {
    id: "pages/home/ui/home-page",
    file: "src/pages/home/ui/home-page.tsx",
    layer: "pages",
    slice: "home",
  });
  assert.deepEqual(nodeById(graph, "widgets/header/ui/header"), {
    id: "widgets/header/ui/header",
    file: "src/widgets/header/ui/header.tsx",
    layer: "widgets",
    slice: "header",
  });
  assert.deepEqual(nodeById(graph, "features/auth/model/auth"), {
    id: "features/auth/model/auth",
    file: "src/features/auth/model/auth.ts",
    layer: "features",
    slice: "auth",
  });
  assert.deepEqual(nodeById(graph, "features/cart/model/cart"), {
    id: "features/cart/model/cart",
    file: "src/features/cart/model/cart.ts",
    layer: "features",
    slice: "cart",
  });
  assert.deepEqual(nodeById(graph, "entities/product/ui/product-card"), {
    id: "entities/product/ui/product-card",
    file: "src/entities/product/ui/product-card.tsx",
    layer: "entities",
    slice: "product",
  });
  assert.deepEqual(nodeById(graph, "entities/user/model/user.types"), {
    id: "entities/user/model/user.types",
    file: "src/entities/user/model/user.types.ts",
    layer: "entities",
    slice: "user",
  });
  assert.deepEqual(nodeById(graph, "shared/api/http"), {
    id: "shared/api/http",
    file: "src/shared/api/http.ts",
    layer: "shared",
    slice: "api",
  });
  assert.deepEqual(nodeById(graph, "shared/ui/button"), {
    id: "shared/ui/button",
    file: "src/shared/ui/button.tsx",
    layer: "shared",
    slice: "ui",
  });
});

test("with-violations fixture: same 11 nodes, edges empty", () => {
  const graph = buildGraph(fixturePath("with-violations"));
  assert.equal(graph.nodes.length, 11);
  assert.deepEqual(graph.edges, []);
  assertSortedUniqueIds(graph);
  assertEveryFileExists("with-violations", graph);
  // Same node inventory as minimal — the fixtures differ only in imports,
  // which slice 1 does not parse.
  assert.deepEqual(
    graph.nodes.map(({ id, layer, slice }) => ({ id, layer, slice })),
    buildGraph(fixturePath("minimal")).nodes.map(
      ({ id, layer, slice }) => ({ id, layer, slice }),
    ),
  );
});

test("empty fixture: zero nodes, edges empty", () => {
  const graph = buildGraph(fixturePath("empty"));
  assert.deepEqual(graph.nodes, []);
  assert.deepEqual(graph.edges, []);
});
