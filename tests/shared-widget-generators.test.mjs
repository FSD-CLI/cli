import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

const FRAMEWORKS = {
  "react-vite": { source: "src", ext: ".tsx", widget: "navbar.tsx", ui: "button.tsx" },
  nextjs: { source: "src", ext: ".tsx", widget: "navbar.tsx", ui: "button.tsx" },
  "vue-vite": { source: "src", ext: ".vue", widget: "AppNavbar.vue", ui: "AppButton.vue" },
  nuxt: { source: "app", ext: ".vue", widget: "AppNavbar.vue", ui: "AppButton.vue" },
  sveltekit: { source: "src", ext: ".svelte", widget: "Navbar.svelte", ui: "AppButton.svelte" },
};

function fixture(t, framework, overrides = {}) {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fsd-shared-")));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const defaults = {
    "react-vite": ["axios", "react-query", "zustand", "react-hook-form-zod"],
    nextjs: ["axios", "react-query", "zustand", "react-hook-form-zod"],
    "vue-vite": ["axios", "vue-query", "pinia", "vee-validate-zod"],
    nuxt: ["fetch", "vue-query", "pinia", "vee-validate-zod"],
    sveltekit: ["fetch", "svelte-query", "svelte-store", "sveltekit-superforms-zod"],
  }[framework];
  const [apiClient, serverState, clientState, forms] = defaults;
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      framework,
      apiClient,
      serverState,
      clientState,
      forms,
      ui: "shared-ui",
      packageManager: "npm",
      ...overrides,
    })}\n`
  );
  fs.mkdirSync(path.join(cwd, FRAMEWORKS[framework].source), { recursive: true });
  return {
    cwd,
    source: path.join(cwd, FRAMEWORKS[framework].source),
    run: (...args) => spawnSync(process.execPath, [entry, ...args], { cwd, encoding: "utf8" }),
  };
}

for (const [framework, expected] of Object.entries(FRAMEWORKS)) {
  test(`${framework}: widget presets generate accessible layout widgets`, (t) => {
    const { source, run } = fixture(t, framework);
    const result = run("-g", "widget", "navbar", "sidebar", "footer", "bottom-bar");
    assert.equal(result.status, 0, result.stderr);

    const navbar = fs.readFileSync(path.join(source, "widgets/navbar/ui", expected.widget), "utf8");
    assert.match(navbar, /<header>/);
    assert.match(navbar, /aria-label="Main navigation"/);
    assert.match(navbar, /brand/);
    const bottomBar = fs.readdirSync(path.join(source, "widgets/bottom-bar/ui"));
    assert.equal(bottomBar.length, 1);
    assert.match(
      fs.readFileSync(path.join(source, "widgets/bottom-bar/ui", bottomBar[0]), "utf8"),
      /aria-label="Bottom navigation"/
    );
    assert.match(
      fs.readFileSync(path.join(source, "widgets/navbar/index.ts"), "utf8"),
      /navbar|Navbar/
    );
  });

  test(`${framework}: shared ui and api generate primitives and a client`, (t) => {
    const { source, run } = fixture(t, framework);
    assert.equal(run("-g", "shared", "ui", "button", "input").status, 0);
    assert(fs.existsSync(path.join(source, "shared/ui", expected.ui)));
    assert.equal(fs.readdirSync(path.join(source, "shared/ui")).length, 3);

    const api = run("-g", "shared", "api");
    assert.equal(api.status, 0, api.stderr);
    const client = fs.readFileSync(path.join(source, "shared/api/client.ts"), "utf8");
    assert.match(client, /export const apiClient/);
    assert.equal(
      fs.readFileSync(path.join(source, "shared/api/index.ts"), "utf8"),
      'export { apiClient } from "./client";\n'
    );
  });
}

test("generic widget names keep the placeholder", (t) => {
  const { source, run } = fixture(t, "react-vite");
  assert.equal(run("-g", "widget", "cart-summary").status, 0);
  const content = fs.readFileSync(path.join(source, "widgets/cart-summary/ui/cart-summary.tsx"), "utf8");
  assert.match(content, /Cart Summary widget/);
  assert.doesNotMatch(content, /<nav/);
});

test("Next.js presets use next/link and SvelteKit presets resolve typed pathnames", (t) => {
  const next = fixture(t, "nextjs");
  assert.equal(next.run("-g", "widget", "footer").status, 0);
  const footer = fs.readFileSync(path.join(next.source, "widgets/footer/ui/footer.tsx"), "utf8");
  assert.match(footer, /import Link from "next\/link";/);
  assert.match(footer, /new Date\(\)\.getFullYear\(\)/);

  const svelte = fixture(t, "sveltekit");
  assert.equal(svelte.run("-g", "widget", "sidebar").status, 0);
  const sidebar = fs.readFileSync(path.join(svelte.source, "widgets/sidebar/ui/Sidebar.svelte"), "utf8");
  assert.match(sidebar, /import \{ resolve \} from "\$app\/paths";/);
  assert.match(sidebar, /href: Pathname/);
});

test("shared api follows the configured client and framework base URL", (t) => {
  const react = fixture(t, "react-vite", { apiClient: "fetch" });
  assert.equal(react.run("-g", "shared", "api").status, 0);
  const fetchClient = fs.readFileSync(path.join(react.source, "shared/api/client.ts"), "utf8");
  assert.match(fetchClient, /import\.meta\.env\.VITE_API_URL/);
  assert.doesNotMatch(fetchClient, /axios/);

  const next = fixture(t, "nextjs");
  assert.equal(next.run("-g", "shared", "api").status, 0);
  const axiosClient = fs.readFileSync(path.join(next.source, "shared/api/client.ts"), "utf8");
  assert.match(axiosClient, /axios\.create/);
  assert.match(axiosClient, /NEXT_PUBLIC_API_URL/);

  const nuxt = fixture(t, "nuxt");
  assert.equal(nuxt.run("-g", "shared", "api").status, 0);
  assert.match(
    fs.readFileSync(path.join(nuxt.source, "shared/api/client.ts"), "utf8"),
    /runtimeConfig\.public\.apiBase/
  );

  const svelte = fixture(t, "sveltekit");
  assert.equal(svelte.run("-g", "shared", "api").status, 0);
  assert.match(
    fs.readFileSync(path.join(svelte.source, "shared/api/client.ts"), "utf8"),
    /\$env\/dynamic\/public/
  );
});

test("shared generation preserves existing files and merges index exports", (t) => {
  const { source, run } = fixture(t, "nextjs");
  const ui = path.join(source, "shared/ui");
  fs.mkdirSync(path.join(ui, "Card"), { recursive: true });
  fs.writeFileSync(path.join(ui, "input.tsx"), "export const Input = 1;\n");
  fs.writeFileSync(
    path.join(ui, "index.ts"),
    "export { Card } from './Card';\nexport { Input } from './input';\n"
  );

  const result = run("-g", "shared", "ui");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /KEEP\s+src[\\/]shared[\\/]ui[\\/]input\.tsx/);
  assert.match(result.stdout, /KEEP\s+src[\\/]shared[\\/]ui[\\/]card\.tsx/);
  assert.equal(fs.readFileSync(path.join(ui, "input.tsx"), "utf8"), "export const Input = 1;\n");
  assert(!fs.existsSync(path.join(ui, "card.tsx")));
  assert.equal(
    fs.readFileSync(path.join(ui, "index.ts"), "utf8"),
    [
      "export { Card } from './Card';",
      'export { Button } from "./button";',
      "export { Input } from './input';",
      'export { Label } from "./label";',
      "",
    ].join("\n")
  );

  const rerun = run("-g", "shared", "ui");
  assert.equal(rerun.status, 0);
  assert.match(rerun.stdout, /Nothing to generate/);
});

test("shared api keeps an existing client exported with another quote style", (t) => {
  const { source, run } = fixture(t, "vue-vite");
  const api = path.join(source, "shared/api");
  fs.mkdirSync(api, { recursive: true });
  fs.writeFileSync(path.join(api, "index.ts"), "export { apiClient } from './client'\n");
  fs.writeFileSync(path.join(api, "client.ts"), "export const apiClient = {};\n");

  const result = run("-g", "shared", "api");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /KEEP/);
  assert.equal(fs.readFileSync(path.join(api, "index.ts"), "utf8"), "export { apiClient } from './client'\n");
});

test("shared generation validates input and supports dry runs", (t) => {
  const { source, run } = fixture(t, "react-vite");
  const dryRun = run("-g", "shared", "ui", "--dry-run");
  assert.equal(dryRun.status, 0);
  assert.match(dryRun.stdout, /CREATE\s+src[\\/]shared[\\/]ui[\\/]button\.tsx/);
  assert(!fs.existsSync(path.join(source, "shared")));

  assert.match(run("-g", "shared", "ui", "modal").stderr, /Unknown shared ui component "modal"/);
  assert.match(run("-g", "shared", "lib").stderr, /supports ui and api/);
  assert.match(run("-g", "shared", "api", "extra").stderr, /does not take extra names/);
  assert.match(run("-g", "shared", "ui", "--force").stderr, /never overwrites files/);
  assert.match(run("-g", "shared").stderr, /Usage: .*shared <ui\|api>/);
});
