/**
 * sveltekit contract tests (CORE-21).
 *
 * The shared harness in `tests/adapter-contract-harness.mjs` runs the full
 * v2 contract set for this adapter (conformance, targets, capability
 * matrix, config round-trip, generator coverage, template identity,
 * detection). This file adds the checks only sveltekit can carry: the
 * Svelte runtime flavour, the dependency-free `svelte-store` client state,
 * and the Svelte query provider artifact.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { getFrameworkAdapter } from "../bin/core/frameworks/index.mjs";
import { getManagedProjectArtifacts, normalizeProjectConfig } from "../bin/project-config.mjs";
import { runAdapterContractTests } from "./adapter-contract-harness.mjs";

runAdapterContractTests("sveltekit", { detectDependencies: { "@sveltejs/kit": "^2.0.0" } });

test("sveltekit uses the svelte runtime, dependency-free stores and a Svelte query provider", () => {
  const adapter = getFrameworkAdapter("sveltekit");
  assert.equal(adapter.runtime, "sveltekit");
  assert.deepEqual(adapter.dependencies.clientState["svelte-store"], []);
  assert.equal(adapter.capabilities.defaults.clientState, "svelte-store");
  assert.equal(adapter.publicApiBaseUrlExpression, 'env.PUBLIC_API_BASE || "/api"');
  const { files } = getManagedProjectArtifacts(normalizeProjectConfig("sveltekit"));
  assert.ok("src/app/providers/query/QueryProvider.svelte" in files);
  assert.match(
    files["src/app/providers/query/QueryProvider.svelte"],
    /QueryClientProvider|queryClient/
  );
});
