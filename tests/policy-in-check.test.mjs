import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createDefaultProjectConfig } from "../bin/commands/create-project.mjs";
import { evaluatePolicy } from "../bin/core/policy-evaluate.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

const LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];

// A structurally valid project: every layer exists, plus a package.json,
// so `fsd check` passes on structure and only the policy can fail it.
function fixture(t, files = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-policy-check-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify(createDefaultProjectConfig("react-vite")),
  );
  fs.writeFileSync(
    path.join(cwd, "package.json"),
    JSON.stringify({ name: "fixture", version: "0.0.0" }),
  );
  for (const layer of LAYERS) {
    fs.mkdirSync(path.join(cwd, "src", layer), { recursive: true });
  }
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(cwd, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return cwd;
}

function writePolicy(cwd, policyJs) {
  fs.writeFileSync(
    path.join(cwd, "fsd.policy.mjs"),
    `export default ${policyJs};\n`,
  );
}

function runCheck(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "check", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
  });
}

const cleanFiles = {
  "src/features/auth/index.ts":
    `export { apiClient } from "@/shared/api";\n`,
  "src/features/cart/index.ts":
    `import { apiClient } from "@/shared/api";\nexport { apiClient };\n`,
  "src/entities/product/index.ts":
    `import { apiClient } from "@/shared/api";\nexport { apiClient };\n`,
  "src/shared/api/index.ts": `export const apiClient = {};\n`,
  "src/widgets/header/index.ts":
    `import { apiClient } from "@/features/auth";\nexport { apiClient };\n`,
  "src/pages/home/index.ts":
    `import { apiClient } from "@/features/cart";\nexport { apiClient };\n`,
};

const strictPolicy = `{
  version: 1,
  rules: [
    { id: "layer-boundaries", severity: "error" },
    { id: "no-slice-cross-imports", severity: "error" },
    { id: "no-public-api-bypass", severity: "error" },
  ],
}`;

test("evaluatePolicy passes a clean project under a strict policy", (t) => {
  const cwd = fixture(t, cleanFiles);
  const result = evaluatePolicy(
    {
      version: 1,
      rules: [
        { id: "layer-boundaries" },
        { id: "no-slice-cross-imports" },
        { id: "no-public-api-bypass" },
      ],
    },
    cwd,
    path.join(cwd, "src"),
  );
  assert.equal(result.filesScanned, Object.keys(cleanFiles).length);
  assert.ok(result.importsChecked > 0);
  assert.deepEqual(result.violations, []);
});

test("evaluatePolicy flags an entities -> features layer-boundary violation", (t) => {
  const cwd = fixture(t, {
    ...cleanFiles,
    "src/entities/product/model.ts":
      `import { apiClient } from "../../features/cart";\nexport { apiClient };\n`,
  });
  const { violations } = evaluatePolicy(
    { version: 1, rules: [{ id: "layer-boundaries" }] },
    cwd,
    path.join(cwd, "src"),
  );
  assert.equal(violations.length, 1);
  assert.equal(violations[0].ruleId, "layer-boundaries");
  assert.equal(violations[0].severity, "error");
  assert.match(violations[0].message, /entities.*features|features.*entities/);
});

test("evaluatePolicy honours an explicit allow map over the default order", (t) => {
  const cwd = fixture(t, {
    ...cleanFiles,
    "src/entities/product/model.ts":
      `import { apiClient } from "../../features/cart";\nexport { apiClient };\n`,
  });
  const { violations } = evaluatePolicy(
    {
      version: 1,
      rules: [
        {
          id: "layer-boundaries",
          allow: { entities: ["features", "shared"] },
        },
      ],
    },
    cwd,
    path.join(cwd, "src"),
  );
  assert.deepEqual(violations, []);
});

test("evaluatePolicy flags cross-slice imports but exempts app and shared", (t) => {
  const cwd = fixture(t, {
    ...cleanFiles,
    "src/features/cart/ui.ts":
      `import { apiClient } from "../auth";\nexport { apiClient };\n`,
    "src/shared/ui/index.ts":
      `import { apiClient } from "../api";\nexport { apiClient };\n`,
    "src/app/providers/index.ts":
      `import { apiClient } from "../routes";\nexport { apiClient };\n`,
    "src/app/routes/index.ts": `export const routes = [];\n`,
  });
  const { violations } = evaluatePolicy(
    { version: 1, rules: [{ id: "no-slice-cross-imports" }] },
    cwd,
    path.join(cwd, "src"),
  );
  assert.equal(violations.length, 1);
  assert.equal(violations[0].ruleId, "no-slice-cross-imports");
  assert.match(violations[0].message, /features\/cart.*features\/auth/);
});

test("evaluatePolicy flags deep imports but allows the slice public API", (t) => {
  const cwd = fixture(t, {
    ...cleanFiles,
    "src/features/auth/model/store.ts": `export const store = {};\n`,
    "src/features/cart/ui.ts":
      `import { store } from "../auth/model/store";\nexport { store };\n`,
    "src/features/cart/api.ts":
      `import { apiClient } from "../auth";\nexport { apiClient };\n`,
  });
  const { violations } = evaluatePolicy(
    { version: 1, rules: [{ id: "no-public-api-bypass" }] },
    cwd,
    path.join(cwd, "src"),
  );
  assert.equal(violations.length, 1);
  assert.equal(violations[0].ruleId, "no-public-api-bypass");
  assert.match(violations[0].message, /features\/auth\/model\/store/);
});

test("fsd check without a policy file behaves exactly as before", (t) => {
  const cwd = fixture(t, cleanFiles);
  const result = runCheck(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Policy/);
});

test("fsd check passes and reports a clean policy", (t) => {
  const cwd = fixture(t, cleanFiles);
  writePolicy(cwd, strictPolicy);
  const result = runCheck(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS\s+Policy/);
  assert.match(result.stdout, /3 rules evaluated/);
});

test("fsd check fails on error-severity policy violations", (t) => {
  const cwd = fixture(t, {
    ...cleanFiles,
    "src/entities/product/model.ts":
      `import { apiClient } from "../../features/cart";\nexport { apiClient };\n`,
    "src/features/cart/ui.ts":
      `import { apiClient } from "../auth";\nexport { apiClient };\n`,
  });
  writePolicy(cwd, strictPolicy);
  const result = runCheck(cwd);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /FAIL\s+Policy: layer-boundaries/);
  assert.match(result.stdout, /FAIL\s+Policy: no-slice-cross-imports/);
  assert.match(result.stderr, /2 check checks failed/);
});

test("fsd check reports warn-severity violations but still passes", (t) => {
  const cwd = fixture(t, {
    ...cleanFiles,
    "src/features/auth/model/store.ts": `export const store = {};\n`,
    "src/features/cart/ui.ts":
      `import { store } from "../auth/model/store";\nexport { store };\n`,
  });
  writePolicy(
    cwd,
    `{
      version: 1,
      rules: [{ id: "no-public-api-bypass", severity: "warn" }],
    }`,
  );
  const result = runCheck(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /WARN\s+Policy: no-public-api-bypass/);
  assert.match(result.stdout, /PASS\s+Policy/);
  assert.match(result.stdout, /1 warning/);
});

test("fsd check fails when the policy file is invalid", (t) => {
  const cwd = fixture(t, cleanFiles);
  writePolicy(cwd, `{ version: 2, rules: [] }`);
  const result = runCheck(cwd);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /FAIL\s+Policy: fsd\.policy\.mjs/);
  assert.match(result.stdout, /Policy version must be 1/);
});

test("fsd policy points at fsd check for enforcement", (t) => {
  const cwd = fixture(t, cleanFiles);
  writePolicy(cwd, strictPolicy);
  const result = spawnSync(process.execPath, [cli, "policy"], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /evaluated against these rules by `fsd check`/);
});
