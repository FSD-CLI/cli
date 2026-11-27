/**
 * nextjs contract tests (CORE-21).
 *
 * The shared harness in `tests/adapter-contract-harness.mjs` runs the full
 * v2 contract set for this adapter (conformance, targets, capability
 * matrix, config round-trip, generator coverage, template identity,
 * detection). This file adds the checks only nextjs can carry: generated
 * client modules carry the `"use client"` directive the adapter declares.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getFrameworkAdapter } from "../bin/core/frameworks/index.mjs";
import { configureProject } from "../bin/project-config.mjs";
import { runAdapterContractTests, scaffoldTemplateProject } from "./adapter-contract-harness.mjs";

runAdapterContractTests("nextjs", { detectDependencies: { next: "^15.0.0" } });

test('nextjs generated client modules start with the "use client" directive', () => {
  const adapter = getFrameworkAdapter("nextjs");
  assert.equal(adapter.clientDirective, '"use client";\n\n');
  const { root, config } = scaffoldTemplateProject(adapter);
  try {
    configureProject(root, config);
    const providers = fs.readFileSync(
      path.join(root, "src/app/providers/AppProviders.tsx"),
      "utf8"
    );
    assert.ok(providers.startsWith('"use client"'), "providers carry the client directive");
    assert.equal(
      adapter.publicApiBaseUrlExpression,
      'process.env.NEXT_PUBLIC_API_URL ?? "/api"'
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
