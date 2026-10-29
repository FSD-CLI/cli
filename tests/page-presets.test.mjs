import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

function fixture(t, framework, routing) {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fsd-pages-")));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const defaults = {
    "react-vite": ["axios", "react-query", "zustand", "react-hook-form-zod"],
    nextjs: ["axios", "react-query", "zustand", "react-hook-form-zod"],
    "vue-vite": ["axios", "vue-query", "pinia", "vee-validate-zod"],
    sveltekit: ["fetch", "svelte-query", "svelte-store", "sveltekit-superforms-zod"],
  }[framework];
  const [apiClient, serverState, clientState, forms] = defaults;
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify({ schemaVersion: 1, framework, apiClient, serverState, clientState, forms, ui: "shared-ui", packageManager: "npm" })
  );
  fs.mkdirSync(path.join(cwd, "src"), { recursive: true });
  if (routing) {
    fs.mkdirSync(path.join(cwd, "src/app/routing"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, "src/app/routing", routing),
      "// fsd-cli:route-imports:start\n// fsd-cli:route-imports:end\nexport const routes = [\n  // fsd-cli:routes:start\n  // fsd-cli:routes:end\n];\n"
    );
  }
  return {
    cwd,
    run: (...args) => spawnSync(process.execPath, [entry, ...args], { cwd, encoding: "utf8" }),
  };
}

test("react page presets generate content and register routes", (t) => {
  const { cwd, run } = fixture(t, "react-vite", "index.tsx");
  const result = run("-g", "page", "home", "about", "consult");
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(path.join(cwd, "src/pages/home/ui/home-page.tsx"), "utf8"), /<h1>Build something people love<\/h1>/);
  assert.match(fs.readFileSync(path.join(cwd, "src/pages/about/ui/about-page.tsx"), "utf8"), /Our values/);
  const consult = fs.readFileSync(path.join(cwd, "src/pages/consult/ui/consult-page.tsx"), "utf8");
  assert.match(consult, /export type ConsultRequest/);
  assert.match(consult, /<form onSubmit=\{handleSubmit\}>/);
  assert.doesNotMatch(consult, /"use client"/);
  const routes = fs.readFileSync(path.join(cwd, "src/app/routing/index.tsx"), "utf8");
  for (const page of ["Home", "About", "Consult"]) assert.match(routes, new RegExp(`<${page}Page />`));
});

test("Next.js consult page is a client component", (t) => {
  const { cwd, run } = fixture(t, "nextjs");
  assert.equal(run("-g", "page", "consult").status, 0);
  assert.match(fs.readFileSync(path.join(cwd, "src/pages/consult/ui/consult-page.tsx"), "utf8"), /^"use client";/);
  assert(fs.existsSync(path.join(cwd, "src/app/consult/page.route.tsx")));
});

test("Vue and SvelteKit page presets use framework-native forms", (t) => {
  const vue = fixture(t, "vue-vite", "index.ts");
  assert.equal(vue.run("-g", "page", "consult").status, 0);
  const vuePage = fs.readFileSync(path.join(vue.cwd, "src/pages/consult/ui/ConsultPage.vue"), "utf8");
  assert.match(vuePage, /defineEmits<\{ submit: \[request: ConsultRequest\] \}>/);
  assert.match(vuePage, /@submit\.prevent="handleSubmit"/);

  const svelte = fixture(t, "sveltekit");
  assert.equal(svelte.run("-g", "page", "consult", "about").status, 0);
  const sveltePage = fs.readFileSync(path.join(svelte.cwd, "src/pages/consult/ui/ConsultPage.svelte"), "utf8");
  assert.match(sveltePage, /bind:value=\{form\.email\}/);
  assert(fs.existsSync(path.join(svelte.cwd, "src/routes/about/+page.svelte")));
});

test("custom page names keep the placeholder and are routed", (t) => {
  const { cwd, run } = fixture(t, "react-vite", "index.tsx");
  assert.equal(run("-g", "page", "pricing").status, 0);
  assert.match(fs.readFileSync(path.join(cwd, "src/pages/pricing/ui/pricing-page.tsx"), "utf8"), /Pricing page/);
  assert.match(fs.readFileSync(path.join(cwd, "src/app/routing/index.tsx"), "utf8"), /path: "\/pricing"/);
});
