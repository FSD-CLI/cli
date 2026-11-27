import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  buildGraph,
  defaultLayerAllow,
  findViolations,
} from "../bin/core/graph.mjs";

// INT-01 slice 3 — layer-boundary violation detection. Applies the FSD
// layer order (app -> pages -> widgets -> features -> entities -> shared)
// to the slice-2 edges: a layer may import layers below it, never above.
// Pinned to the 3 deliberate upward imports in the with-violations
// fixture; 0 violations in minimal and empty.

const fixturesDir = fileURLToPath(new URL("fixtures/analysis", import.meta.url));

function fixturePath(fixture) {
  return path.join(fixturesDir, fixture);
}

function violation(from, to, fromLayer, toLayer, specifier) {
  return {
    rule: "layer-boundaries",
    from,
    to,
    fromLayer,
    toLayer,
    specifier,
    message: `${fromLayer} must not import from ${toLayer} (layer-boundaries)`,
  };
}

test("minimal fixture: 0 violations", () => {
  const graph = buildGraph(fixturePath("minimal"));
  assert.deepEqual(graph.violations, []);
  assert.deepEqual(findViolations(graph), []);
});

test("with-violations fixture: exactly the 3 deliberate upward imports", () => {
  const graph = buildGraph(fixturePath("with-violations"));
  assert.deepEqual(graph.violations, [
    violation(
      "entities/product/model/product.types",
      "features/auth/model/auth",
      "entities",
      "features",
      "../../../features/auth/model/auth",
    ),
    violation(
      "features/auth/model/auth",
      "pages/home/ui/home-page",
      "features",
      "pages",
      "../../../pages/home/ui/home-page",
    ),
    violation(
      "shared/ui/button",
      "features/cart/model/cart",
      "shared",
      "features",
      "../../features/cart/model/cart",
    ),
  ]);
});

test("empty fixture: 0 violations", () => {
  const graph = buildGraph(fixturePath("empty"));
  assert.deepEqual(graph.violations, []);
});

test("defaultLayerAllow: a layer may import only the layers below it", () => {
  assert.deepEqual(defaultLayerAllow(), {
    app: ["pages", "widgets", "features", "entities", "shared"],
    pages: ["widgets", "features", "entities", "shared"],
    widgets: ["features", "entities", "shared"],
    features: ["entities", "shared"],
    entities: ["shared"],
    shared: [],
  });
});

test("findViolations: a project allow list (INT-36 seam) can permit an edge", () => {
  const graph = buildGraph(fixturePath("with-violations"));
  const allow = defaultLayerAllow();
  // The project explicitly allows features to import from pages.
  allow.features = [...allow.features, "pages"];
  assert.deepEqual(findViolations(graph, allow), [
    violation(
      "entities/product/model/product.types",
      "features/auth/model/auth",
      "entities",
      "features",
      "../../../features/auth/model/auth",
    ),
    violation(
      "shared/ui/button",
      "features/cart/model/cart",
      "shared",
      "features",
      "../../features/cart/model/cart",
    ),
  ]);
});

test("findViolations: same-layer and unresolved edges are not violations", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-graph-violations-"));
  try {
    fs.writeFileSync(
      path.join(dir, "fsd.config.json"),
      JSON.stringify({
        $schema:
          "https://raw.githubusercontent.com/FSD-CLI/cli/main/schema/fsd.config.schema.json",
        framework: "react-vite",
        packageManager: "npm",
        schemaVersion: 1,
      }),
    );
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "graph-violations-tmp", private: true }),
    );
    const write = (rel, content) => {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    };
    // features/auth imports features/cart (same layer: not a
    // layer-boundaries violation) and a bare package (unresolved: skipped).
    write(
      "src/features/auth/model/auth.ts",
      [
        `import { cartTotal } from "../../cart/model/cart";`,
        `import { something } from "some-package";`,
      ].join("\n"),
    );
    write(
      "src/features/cart/model/cart.ts",
      `export function cartTotal() { return 0; }\n`,
    );

    const graph = buildGraph(dir);
    assert.equal(graph.edges.length, 2);
    assert.deepEqual(graph.violations, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
