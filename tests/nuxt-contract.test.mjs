/**
 * nuxt contract tests (CORE-21).
 *
 * The shared harness in `tests/adapter-contract-harness.mjs` runs the full
 * v2 contract set for this adapter (conformance, targets, capability
 * matrix, config round-trip, generator coverage, template identity,
 * detection). This file adds the checks only nuxt can carry: the FSD tree
 * lives under `app`, not `src`; configuration registers the framework
 * modules in `nuxt.config.ts`; pages use file-based routes.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getFrameworkAdapter } from "../bin/core/frameworks/index.mjs";
import { generateSlice } from "../bin/generator.mjs";
import { configureProject } from "../bin/project-config.mjs";
import { runAdapterContractTests, scaffoldTemplateProject } from "./adapter-contract-harness.mjs";

runAdapterContractTests("nuxt", { detectDependencies: { nuxt: "^3.0.0" } });

test("nuxt config registers framework modules and pages use file-based routes", () => {
  const adapter = getFrameworkAdapter("nuxt");
  assert.equal(adapter.sourceDirectory, "app");
  assert.equal(adapter.runtime, "nuxt");
  const { root, config } = scaffoldTemplateProject(adapter);
  try {
    configureProject(root, config);
    const nuxtConfig = fs.readFileSync(path.join(root, "nuxt.config.ts"), "utf8");
    assert.match(nuxtConfig, /'@pinia\/nuxt'/);
    assert.match(nuxtConfig, /'@vee-validate\/nuxt'/);
    assert.equal(fs.existsSync(path.join(root, "app/plugins/vue-query.ts")), true);

    const files = generateSlice({ cwd: root, type: "page", name: "account", config });
    assert.ok(files.includes("app/pages/account/ui/AccountPage.vue"));
    assert.ok(files.includes("app/app/routes/account.vue"));
    assert.equal(fs.existsSync(path.join(root, "app/app/routes/account.vue")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
