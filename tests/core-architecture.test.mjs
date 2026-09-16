import assert from "node:assert/strict";
import test from "node:test";
import {
  assertGeneratorSupported,
  assertSupportedProjectConfig,
  getCapabilities,
  getCapabilityChoices,
  getDefaultStack,
} from "../bin/core/capability-matrix.mjs";
import {
  getFrameworkAdapter,
  listFrameworkAdapters,
} from "../bin/core/frameworks/index.mjs";
import {
  getAvailableTemplate,
  getTemplate,
  listTemplates,
} from "../bin/core/template-registry.mjs";
import { normalizeProjectConfig } from "../bin/project-config.mjs";
import { resolveProjectPath } from "../bin/core/project-path.mjs";

test("template registry exposes stable and planned frameworks", () => {
  const templates = listTemplates();
  assert.deepEqual(
    templates.map(({ value, status }) => [value, status]),
    [
      ["react-vite", "stable"],
      ["nextjs", "stable"],
      ["vue-vite", "planned"],
      ["nuxt", "planned"],
      ["sveltekit", "planned"],
    ]
  );
  assert.equal(listTemplates({ includePlanned: false }).length, 2);
  assert.equal(getAvailableTemplate("nextjs").repo, "FSD-CLI/FSD-NEXTJS");
  assert.equal(getTemplate("vue-vite").available, false);
  assert.throws(() => getAvailableTemplate("vue-vite"), /planned but not available/);
  assert.throws(() => getAvailableTemplate("unknown"), /Unknown framework/);
});

test("capability matrix owns framework-specific stack choices", () => {
  assert.deepEqual(getCapabilities("react-vite").clientState, [
    "zustand",
    "redux",
    "none",
  ]);
  assert.deepEqual(getCapabilities("vue-vite").clientState, ["pinia", "none"]);
  assert.deepEqual(getCapabilityChoices("nextjs", "apiClient"), [
    { title: "Axios", value: "axios" },
    { title: "Native Fetch", value: "fetch" },
  ]);
  assert.equal(assertGeneratorSupported("nextjs", "feature"), "feature");
  assert.throws(() => assertGeneratorSupported("nextjs", "unknown"), /not supported/);
  assert.deepEqual(getDefaultStack("vue-vite"), {
    apiClient: "axios",
    serverState: "vue-query",
    clientState: "pinia",
    forms: "vee-validate-zod",
    packageManager: "npm",
  });
});

test("configuration validation rejects cross-framework stack values", () => {
  const reactConfig = normalizeProjectConfig("react-vite");
  assert.equal(assertSupportedProjectConfig(reactConfig), reactConfig);
  assert.throws(
    () => normalizeProjectConfig("react-vite", { clientState: "pinia" }),
    /Unsupported clientState/
  );
  assert.equal(normalizeProjectConfig("vue-vite").clientState, "pinia");
});

test("framework adapters isolate runtime-specific source generation", () => {
  const vite = getFrameworkAdapter("react-vite");
  const next = getFrameworkAdapter("nextjs");
  assert.match(vite.publicApiBaseUrlExpression, /VITE_API_URL/);
  assert.equal(vite.clientDirective, "");
  assert.match(next.publicApiBaseUrlExpression, /NEXT_PUBLIC_API_URL/);
  assert.equal(next.clientDirective, '"use client";\n\n');
  assert.deepEqual(
    listFrameworkAdapters().map(({ id }) => id),
    ["react-vite", "nextjs"]
  );
  assert.throws(() => getFrameworkAdapter("vue-vite"), /does not have an implementation adapter/);
});

test("project paths cannot escape the working directory", () => {
  assert.equal(resolveProjectPath("/workspace", "apps/store"), "/workspace/apps/store");
  assert.throws(() => resolveProjectPath("/workspace", "../outside"), /inside the current directory/);
  assert.throws(() => resolveProjectPath("/workspace", "/tmp/outside"), /inside the current directory/);
});
