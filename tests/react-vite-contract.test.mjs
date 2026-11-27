/**
 * react-vite contract tests (CORE-21).
 *
 * The shared harness in `tests/adapter-contract-harness.mjs` runs the full
 * v2 contract set for this adapter (conformance, targets, capability
 * matrix, config round-trip, generator coverage, template identity,
 * detection). This file adds the checks only react-vite can carry: page
 * generation registers a route in the template's routing entry.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getFrameworkAdapter } from "../bin/core/frameworks/index.mjs";
import { generateSlice } from "../bin/generator.mjs";
import {
  planPage,
  runAdapterContractTests,
  scaffoldTemplateProject,
} from "./adapter-contract-harness.mjs";

runAdapterContractTests("react-vite", { detectDependencies: { react: "^19.0.0" } });

test("react-vite page generation registers a route in the routing entry", () => {
  const { root, config } = scaffoldTemplateProject(getFrameworkAdapter("react-vite"));
  try {
    // A template project carries the routing entry; planning a page
    // scaffolds it, then generating registers the route in it.
    planPage(root, config);
    generateSlice({ cwd: root, type: "page", name: "about", config });
    const routing = fs.readFileSync(path.join(root, "src/app/routing/index.tsx"), "utf8");
    assert.match(routing, /import \{ AboutPage \} from "@\/pages\/about";/);
    assert.match(routing, /\{ path: "\/about", element: <AboutPage \/> \},/);
    assert.equal(fs.existsSync(path.join(root, "src/pages/about/ui/about-page.tsx")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
