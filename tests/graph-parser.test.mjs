import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildGraph, parseImports } from "../bin/core/graph.mjs";

// INT-01 slice 2 — import parser (zero dependencies). Tests the edge lists
// against the INT-04 analysis fixtures (tests/fixtures/analysis/), the
// parser itself against synthetic source, and the unresolved-but-recorded
// contract against a synthetic temp project. No judgement happens here —
// the 3 violation edges in with-violations are plain edges until slice 3.

const fixturesDir = fileURLToPath(new URL("fixtures/analysis", import.meta.url));

function fixturePath(fixture) {
  return path.join(fixturesDir, fixture);
}

function edge(from, to, specifier) {
  return { from, to, specifier, resolved: to !== null };
}

test("minimal fixture: 11 edges, all resolved, sorted", () => {
  const graph = buildGraph(fixturePath("minimal"));
  assert.equal(graph.nodes.length, 11);
  assert.deepEqual(graph.edges, [
    edge("app/providers/index", "shared/ui/button", "../../shared/ui/button"),
    edge(
      "entities/product/ui/product-card",
      "entities/product/model/product.types",
      "../model/product.types",
    ),
    edge(
      "entities/product/ui/product-card",
      "shared/ui/button",
      "../../../shared/ui/button",
    ),
    edge(
      "features/auth/model/auth",
      "entities/user/model/user.types",
      "../../../entities/user/model/user.types",
    ),
    edge(
      "features/auth/ui/login-form",
      "entities/user/model/user.types",
      "../../../entities/user/model/user.types",
    ),
    edge(
      "features/auth/ui/login-form",
      "features/auth/model/auth",
      "../model/auth",
    ),
    edge(
      "features/auth/ui/login-form",
      "shared/ui/button",
      "../../../shared/ui/button",
    ),
    edge(
      "features/cart/model/cart",
      "entities/product/model/product.types",
      "../../../entities/product/model/product.types",
    ),
    edge(
      "pages/home/ui/home-page",
      "features/auth/ui/login-form",
      "../../../features/auth/ui/login-form",
    ),
    edge(
      "pages/home/ui/home-page",
      "widgets/header/ui/header",
      "../../../widgets/header/ui/header",
    ),
    edge(
      "widgets/header/ui/header",
      "shared/ui/button",
      "../../../shared/ui/button",
    ),
  ]);
});

test("with-violations fixture: 14 edges, including the 3 violation edges as plain edges", () => {
  const graph = buildGraph(fixturePath("with-violations"));
  assert.equal(graph.nodes.length, 11);
  assert.equal(graph.edges.length, 14);
  assert.ok(
    graph.edges.every((e) => e.resolved),
    "every fixture edge should resolve to a node",
  );
  // The 3 deliberate upward imports from the INT-04 fixture are recorded
  // here as ordinary edges — slice 3 judges them, slice 2 only reports.
  assert.deepEqual(
    graph.edges.filter(
      (e) =>
        (e.from === "entities/product/model/product.types" &&
          e.to === "features/auth/model/auth") ||
        (e.from === "features/auth/model/auth" &&
          e.to === "pages/home/ui/home-page") ||
        (e.from === "shared/ui/button" &&
          e.to === "features/cart/model/cart"),
    ),
    [
      edge(
        "entities/product/model/product.types",
        "features/auth/model/auth",
        "../../../features/auth/model/auth",
      ),
      edge(
        "features/auth/model/auth",
        "pages/home/ui/home-page",
        "../../../pages/home/ui/home-page",
      ),
      edge(
        "shared/ui/button",
        "features/cart/model/cart",
        "../../features/cart/model/cart",
      ),
    ],
  );
});

test("empty fixture: 0 nodes, 0 edges, 0 violations", () => {
  const graph = buildGraph(fixturePath("empty"));
  assert.deepEqual(graph, { nodes: [], edges: [], violations: [] });
});

test("parseImports: every import form, in source order", () => {
  assert.deepEqual(
    parseImports(
      [
        `import { Button } from "./button";`,
        `import type { User } from "./user.types";`,
        `import "./side-effect";`,
        `export { Demo } from "./demo";`,
        `export * from "./all";`,
        `const helper = require("./helper");`,
        `const lazy = await import("./lazy");`,
        `import react from "react";`,
      ].join("\n"),
    ),
    [
      "./button",
      "./user.types",
      "./side-effect",
      "./demo",
      "./all",
      "./helper",
      "./lazy",
      "react",
    ],
  );
});

test("parseImports: fake imports inside comments and strings are ignored", () => {
  assert.deepEqual(
    parseImports(
      [
        `// import { Fake } from "./fake-line";`,
        `/* import { Fake } from "./fake-block"; */`,
        `const text = "import { Fake } from './fake-string'";`,
        `import { Real } from "./real";`,
      ].join("\n"),
    ),
    ["./real"],
  );
});

test("parseImports: duplicate specifiers are kept (one entry per statement)", () => {
  assert.deepEqual(
    parseImports(
      `import type { Session } from "./auth";\nimport { isAuthenticated } from "./auth";`,
    ),
    ["./auth", "./auth"],
  );
});

test("buildGraph: unresolved specifiers are recorded, not dropped", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-graph-parser-"));
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
      JSON.stringify({ name: "graph-parser-tmp", private: true }),
    );
    const write = (rel, content) => {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    };
    write(
      "src/features/demo/model/demo.ts",
      [
        `import { helper } from "./helper";`,
        `import { helperTs } from "./helper.ts";`,
        `import { DemoView } from "../ui/demo";`,
        `const lazy = await import("../ui/demo");`,
        `import { sub } from "./sub";`,
        `import react from "react";`,
        `import { x } from "@/shared/ui/button";`,
        `import { nope } from "../missing";`,
      ].join("\n"),
    );
    write(
      "src/features/demo/model/helper.ts",
      `export { DemoView } from "../ui/demo";\n\nexport function helper() { return 1; }\n`,
    );
    write(
      "src/features/demo/model/sub/index.ts",
      `export function sub() { return 1; }\n`,
    );
    write(
      "src/features/demo/ui/demo.tsx",
      `const req = require("../model/helper");\n\nexport function DemoView() { return null; }\n`,
    );
    write(
      "src/shared/ui/button.tsx",
      `export function Button() { return null; }\n`,
    );

    const graph = buildGraph(dir);
    assert.equal(graph.nodes.length, 5);
    assert.deepEqual(graph.edges, [
      edge("features/demo/model/demo", null, "../missing"),
      edge("features/demo/model/demo", null, "@/shared/ui/button"),
      edge("features/demo/model/demo", null, "react"),
      edge(
        "features/demo/model/demo",
        "features/demo/model/helper",
        "./helper",
      ),
      edge(
        "features/demo/model/demo",
        "features/demo/model/helper",
        "./helper.ts",
      ),
      edge(
        "features/demo/model/demo",
        "features/demo/model/sub/index",
        "./sub",
      ),
      edge(
        "features/demo/model/demo",
        "features/demo/ui/demo",
        "../ui/demo",
      ),
      edge(
        "features/demo/model/helper",
        "features/demo/ui/demo",
        "../ui/demo",
      ),
      edge(
        "features/demo/ui/demo",
        "features/demo/model/helper",
        "../model/helper",
      ),
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
