import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validatePolicy, loadPolicy } from "../bin/core/policy.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

const validPolicy = {
  version: 1,
  rules: [
    {
      id: "layer-boundaries",
      severity: "error",
      allow: { features: ["entities", "shared"], entities: ["shared"] },
    },
    { id: "no-slice-cross-imports" },
    { id: "no-public-api-bypass", severity: "warn" },
  ],
};

function fixture(t, files = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-policy-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(cwd, name), content);
  }
  return cwd;
}

function runPolicy(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "policy", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
  });
}

test("validatePolicy accepts a minimal valid policy", () => {
  assert.deepEqual(validatePolicy(validPolicy), []);
  assert.deepEqual(validatePolicy({ version: 1, rules: [] }), []);
});

test("validatePolicy rejects a non-object policy and a wrong version", () => {
  assert.deepEqual(validatePolicy("nope"), [
    "Policy must export a default object.",
  ]);
  assert.deepEqual(validatePolicy({ version: 2, rules: [] }), [
    "Policy version must be 1 (received 2).",
  ]);
  assert.deepEqual(validatePolicy({ version: 1 }), [
    'Policy "rules" must be an array.',
  ]);
});

test("validatePolicy rejects unknown keys, rule ids and severities", () => {
  assert.deepEqual(
    validatePolicy({ version: 1, rules: [], strict: true }),
    ['Unknown policy key "strict".'],
  );
  assert.deepEqual(
    validatePolicy({ version: 1, rules: [{ id: "no-magic", severity: "error" }] }),
    [
      'Rule 1: unknown rule id "no-magic" (supported: layer-boundaries, no-slice-cross-imports, no-public-api-bypass).',
    ],
  );
  assert.deepEqual(
    validatePolicy({
      version: 1,
      rules: [{ id: "no-slice-cross-imports", severity: "fatal" }],
    }),
    [
      'Rule 1 ("no-slice-cross-imports"): severity must be "error" or "warn" (received "fatal").',
    ],
  );
  assert.deepEqual(
    validatePolicy({
      version: 1,
      rules: [
        { id: "no-slice-cross-imports" },
        { id: "no-slice-cross-imports" },
      ],
    }),
    ['Rule 2: duplicate rule id "no-slice-cross-imports".'],
  );
});

test("validatePolicy checks layer-boundaries allow maps", () => {
  assert.deepEqual(
    validatePolicy({
      version: 1,
      rules: [{ id: "layer-boundaries", allow: { features: ["nope"] } }],
    }),
    [
      'Rule 1 ("layer-boundaries"): "features" may only allow layers (app, pages, widgets, features, entities, shared).',
    ],
  );
  assert.deepEqual(
    validatePolicy({
      version: 1,
      rules: [{ id: "layer-boundaries", allow: { features: ["features"] } }],
    }),
    [
      'Rule 1 ("layer-boundaries"): "features" cannot allow itself.',
    ],
  );
  assert.deepEqual(
    validatePolicy({
      version: 1,
      rules: [{ id: "no-slice-cross-imports", allow: { features: ["shared"] } }],
    }),
    [
      'Rule 1 ("no-slice-cross-imports"): "allow" only applies to "layer-boundaries".',
    ],
  );
});

test("loadPolicy reports a missing policy file as not found", async (t) => {
  const cwd = fixture(t);
  assert.deepEqual(await loadPolicy(cwd), {
    found: false,
    path: null,
    policy: null,
    errors: [],
  });
});

test("loadPolicy loads and validates a .mjs policy file", async (t) => {
  const cwd = fixture(t, {
    "fsd.policy.mjs": `export default ${JSON.stringify(validPolicy)};\n`,
  });
  const result = await loadPolicy(cwd);
  assert.equal(result.found, true);
  assert.equal(result.path, path.join(cwd, "fsd.policy.mjs"));
  assert.deepEqual(result.policy, validPolicy);
  assert.deepEqual(result.errors, []);
});

test("loadPolicy loads a .ts policy file on a runtime with type stripping", async (t) => {
  const cwd = fixture(t, {
    "fsd.policy.ts": `export default ${JSON.stringify(validPolicy)};\n`,
  });
  const result = await loadPolicy(cwd);
  assert.equal(result.found, true);
  assert.deepEqual(result.policy, validPolicy);
  assert.deepEqual(result.errors, []);
});

test("loadPolicy surfaces validation errors from the file", async (t) => {
  const cwd = fixture(t, {
    "fsd.policy.mjs":
      "export default { version: 1, rules: [{ id: 'no-magic' }] };\n",
  });
  const result = await loadPolicy(cwd);
  assert.equal(result.found, true);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /unknown rule id "no-magic"/);
});

test("policy reports no policy file and exits successfully", (t) => {
  const cwd = fixture(t);
  const result = runPolicy(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No policy file found/);
  assert.match(result.stdout, /fsd\.policy\.ts/);
});

test("policy prints a valid policy with its rules and severities", (t) => {
  const cwd = fixture(t, {
    "fsd.policy.mjs": `export default ${JSON.stringify(validPolicy)};\n`,
  });
  const result = runPolicy(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /File: fsd\.policy\.mjs/);
  assert.match(result.stdout, /Version: 1/);
  assert.match(result.stdout, /Rules: 3/);
  assert.match(result.stdout, /layer-boundaries \(error\)/);
  assert.match(result.stdout, /features → entities, shared/);
  assert.match(result.stdout, /no-slice-cross-imports \(error\)/);
  assert.match(result.stdout, /no-public-api-bypass \(warn\)/);
  assert.match(result.stdout, /not evaluated yet/);
});

test("policy accepts a .ts policy file from the command line", (t) => {
  const cwd = fixture(t, {
    "fsd.policy.ts": `export default ${JSON.stringify(validPolicy)};\n`,
  });
  const result = runPolicy(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /File: fsd\.policy\.ts/);
  assert.match(result.stdout, /Rules: 3/);
});

test("policy fails on an invalid policy file", (t) => {
  const cwd = fixture(t, {
    "fsd.policy.mjs":
      "export default { version: 1, rules: [{ id: 'no-magic' }] };\n",
  });
  const result = runPolicy(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid policy in fsd\.policy\.mjs/);
  assert.match(result.stderr, /unknown rule id "no-magic"/);
});

test("policy rejects unexpected arguments", (t) => {
  const cwd = fixture(t);
  const result = runPolicy(cwd, ["--bogus"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unexpected argument "--bogus"/);
});
