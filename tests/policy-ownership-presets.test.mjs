import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CODEOWNERS_HEADER,
  CODEOWNERS_PATH,
  POLICY_PRESETS,
  isGeneratedCodeowners,
  renderCodeowners,
  resolvePolicyPreset,
  validatePolicy,
  writeCodeowners,
} from "../bin/core/policy.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

const policyWithOwners = {
  version: 1,
  rules: [],
  owners: {
    shared: "@team-platform",
    features: ["@team-frontend", "lead@example.com"],
    "features/auth": "@team-auth",
    "entities/user": ["@team-frontend", "@team-data"],
  },
};

function fixture(t, files = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-policy-owners-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
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

function severityOf(policy, ruleId) {
  return policy.rules.find((rule) => rule.id === ruleId)?.severity;
}

function allowOf(policy, layer) {
  return policy.rules.find((rule) => rule.id === "layer-boundaries")?.allow?.[layer];
}

test("validatePolicy accepts owners by layer and by layer/slice", () => {
  assert.deepEqual(validatePolicy(policyWithOwners), []);
  assert.deepEqual(validatePolicy({ version: 1, rules: [], owners: {} }), []);
});

test("validatePolicy rejects bad owner keys", () => {
  assert.deepEqual(
    validatePolicy({ version: 1, rules: [], owners: { "nope/auth": "@team" } }),
    [
      'Owners "nope/auth" must start with a layer (app, pages, widgets, features, entities, shared), optionally followed by "/slice".',
    ],
  );
  assert.deepEqual(
    validatePolicy({
      version: 1,
      rules: [],
      owners: { "features/Auth": "@team" },
    }),
    [
      'Owners "features/Auth": slice names use lowercase letters, digits and dashes (received "Auth").',
    ],
  );
  assert.deepEqual(
    validatePolicy({
      version: 1,
      rules: [],
      owners: { "features/auth/extra": "@team" },
    }),
    [
      'Owners "features/auth/extra" must start with a layer (app, pages, widgets, features, entities, shared), optionally followed by "/slice".',
    ],
  );
  assert.deepEqual(
    validatePolicy({ version: 1, rules: [], owners: "team" }),
    ['Policy "owners" must map a layer or "layer/slice" to owner(s).'],
  );
});

test("validatePolicy rejects bad owner values", () => {
  assert.deepEqual(
    validatePolicy({
      version: 1,
      rules: [],
      owners: { features: "team-frontend" },
    }),
    [
      'Owners "features" must be an owner handle ("@team" or "@org/team") or an email, or a non-empty list of them.',
    ],
  );
  assert.deepEqual(
    validatePolicy({
      version: 1,
      rules: [],
      owners: { features: ["@team", "not-an-email"] },
    }),
    [
      'Owners "features" must be an owner handle ("@team" or "@org/team") or an email, or a non-empty list of them.',
    ],
  );
  assert.deepEqual(
    validatePolicy({ version: 1, rules: [], owners: { features: [] } }),
    [
      'Owners "features" must be an owner handle ("@team" or "@org/team") or an email, or a non-empty list of them.',
    ],
  );
  assert.deepEqual(
    validatePolicy({ version: 1, rules: [], owners: { features: 42 } }),
    [
      'Owners "features" must be an owner handle ("@team" or "@org/team") or an email, or a non-empty list of them.',
    ],
  );
});

test("validatePolicy rejects unknown presets and accepts known ones", () => {
  assert.deepEqual(
    validatePolicy({ version: 1, rules: [], preset: "maximal" }),
    ['Policy "preset": unknown preset "maximal" (supported: recommended, strict).'],
  );
  assert.deepEqual(
    validatePolicy({ version: 1, rules: [], preset: "recommended" }),
    [],
  );
  assert.deepEqual(
    validatePolicy({ version: 1, rules: [], preset: "strict" }),
    [],
  );
});

test("resolvePolicyPreset expands recommended and strict with different severities", () => {
  const recommended = resolvePolicyPreset({
    version: 1,
    preset: "recommended",
    rules: [],
  });
  const strict = resolvePolicyPreset({
    version: 1,
    preset: "strict",
    rules: [],
  });
  assert.equal(severityOf(recommended, "no-public-api-bypass"), "warn");
  assert.equal(severityOf(strict, "no-public-api-bypass"), "error");
  assert.equal(severityOf(recommended, "layer-boundaries"), "error");
  assert.equal(severityOf(strict, "layer-boundaries"), "error");
  // Strict additionally forbids widgets from importing features.
  assert.deepEqual(allowOf(recommended, "widgets"), [
    "features",
    "entities",
    "shared",
  ]);
  assert.deepEqual(allowOf(strict, "widgets"), ["entities", "shared"]);
  // Presets only cover severities and allow-lists.
  assert.deepEqual(Object.keys(POLICY_PRESETS), ["recommended", "strict"]);
  for (const preset of Object.values(POLICY_PRESETS)) {
    assert.ok(
      preset.rules.every((rule) => Object.keys(rule).every((key) => ["id", "severity", "allow"].includes(key))),
    );
  }
});

test("resolvePolicyPreset lets explicit rules override the preset field by field", () => {
  const resolved = resolvePolicyPreset({
    version: 1,
    preset: "recommended",
    rules: [
      { id: "no-public-api-bypass", severity: "error" },
      { id: "no-slice-cross-imports", severity: "warn" },
    ],
  });
  assert.equal(severityOf(resolved, "no-public-api-bypass"), "error");
  assert.equal(severityOf(resolved, "no-slice-cross-imports"), "warn");
  // The preset still supplies the unmentioned rule.
  assert.equal(severityOf(resolved, "layer-boundaries"), "error");
  assert.deepEqual(allowOf(resolved, "features"), ["entities", "shared"]);
});

test("resolvePolicyPreset leaves a policy without a preset unchanged", () => {
  const policy = { version: 1, rules: [{ id: "no-slice-cross-imports" }] };
  assert.equal(resolvePolicyPreset(policy), policy);
});

test("renderCodeowners maps owned layers and slices to paths", () => {
  const rendered = renderCodeowners(policyWithOwners);
  assert.match(rendered, new RegExp(`^${CODEOWNERS_HEADER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"));
  assert.match(rendered, /src\/features\/ @team-frontend lead@example\.com/);
  assert.match(rendered, /src\/features\/auth\/ @team-auth/);
  assert.match(rendered, /src\/entities\/user\/ @team-frontend @team-data/);
  assert.match(rendered, /src\/shared\/ @team-platform/);
  // Layers in FSD order (features before entities before shared), and a
  // bare layer before its slices.
  const lines = rendered.split("\n").filter((line) => line.startsWith("src/"));
  assert.deepEqual(lines, [
    "src/features/ @team-frontend lead@example.com",
    "src/features/auth/ @team-auth",
    "src/entities/user/ @team-frontend @team-data",
    "src/shared/ @team-platform",
  ]);
});

test("renderCodeowners returns null when the policy declares no owners", () => {
  assert.equal(renderCodeowners({ version: 1, rules: [] }), null);
  assert.equal(renderCodeowners({ version: 1, rules: [], owners: {} }), null);
});

test("writeCodeowners creates, updates and guards hand-written files", (t) => {
  const cwd = fixture(t);
  const created = writeCodeowners(cwd, policyWithOwners);
  assert.equal(created.status, "created");
  assert.equal(created.path, path.join(cwd, CODEOWNERS_PATH));
  const content = fs.readFileSync(path.join(cwd, CODEOWNERS_PATH), "utf8");
  assert.ok(isGeneratedCodeowners(content));
  assert.match(content, /src\/features\/auth\/ @team-auth/);

  // Regenerating a generated file overwrites it.
  const updated = writeCodeowners(cwd, {
    version: 1,
    rules: [],
    owners: { shared: "@team-other" },
  });
  assert.equal(updated.status, "updated");
  assert.match(
    fs.readFileSync(path.join(cwd, CODEOWNERS_PATH), "utf8"),
    /src\/shared\/ @team-other/,
  );

  // A hand-written file is refused without --force and kept intact.
  const handwritten = "# Our owners\nsrc/ @boss\n";
  fs.writeFileSync(path.join(cwd, CODEOWNERS_PATH), handwritten);
  const refused = writeCodeowners(cwd, policyWithOwners);
  assert.equal(refused.status, "refused");
  assert.match(refused.reason, /was not generated/);
  assert.equal(fs.readFileSync(path.join(cwd, CODEOWNERS_PATH), "utf8"), handwritten);

  // --force replaces a hand-written file.
  const forced = writeCodeowners(cwd, policyWithOwners, { force: true });
  assert.equal(forced.status, "updated");
  assert.ok(isGeneratedCodeowners(fs.readFileSync(path.join(cwd, CODEOWNERS_PATH), "utf8")));
});

test("writeCodeowners refuses a policy without owners", (t) => {
  const cwd = fixture(t);
  const result = writeCodeowners(cwd, { version: 1, rules: [] });
  assert.equal(result.status, "refused");
  assert.match(result.reason, /declares no owners/);
  assert.equal(fs.existsSync(path.join(cwd, CODEOWNERS_PATH)), false);
});

test("policy prints preset and owners from the command line", (t) => {
  const cwd = fixture(t, {
    "fsd.policy.mjs": `export default ${JSON.stringify({
      version: 1,
      preset: "recommended",
      rules: [{ id: "no-public-api-bypass", severity: "error" }],
      owners: { "features/auth": "@team-auth", shared: "@team-platform" },
    })};\n`,
  });
  const result = runPolicy(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Preset: recommended/);
  assert.match(result.stdout, /Rules: 3/);
  assert.match(result.stdout, /no-public-api-bypass \(error\)/);
  assert.match(result.stdout, /Owners: 2/);
  assert.match(result.stdout, /features\/auth: @team-auth/);
  assert.match(result.stdout, /shared: @team-platform/);
});

test("policy codeowners writes .github/CODEOWNERS from the policy", (t) => {
  const cwd = fixture(t, {
    "fsd.policy.mjs": `export default ${JSON.stringify(policyWithOwners)};\n`,
  });
  const result = runPolicy(cwd, ["codeowners"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Created \.github\/CODEOWNERS/);
  const content = fs.readFileSync(path.join(cwd, CODEOWNERS_PATH), "utf8");
  assert.match(content, /src\/features\/auth\/ @team-auth/);
  assert.match(content, /src\/shared\/ @team-platform/);
});

test("policy codeowners refuses a hand-written CODEOWNERS without --force", (t) => {
  const cwd = fixture(t, {
    "fsd.policy.mjs": `export default ${JSON.stringify(policyWithOwners)};\n`,
    ".github/CODEOWNERS": "# Our owners\nsrc/ @boss\n",
  });
  const refused = runPolicy(cwd, ["codeowners"]);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /was not generated/);
  assert.equal(
    fs.readFileSync(path.join(cwd, CODEOWNERS_PATH), "utf8"),
    "# Our owners\nsrc/ @boss\n",
  );
  const forced = runPolicy(cwd, ["codeowners", "--force"]);
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, /Updated \.github\/CODEOWNERS/);
});

test("policy codeowners fails when the policy declares no owners", (t) => {
  const cwd = fixture(t, {
    "fsd.policy.mjs": `export default ${JSON.stringify({ version: 1, rules: [] })};\n`,
  });
  const result = runPolicy(cwd, ["codeowners"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /declares no owners/);
});

test("policy --preset scaffolds a starter policy file", (t) => {
  const cwd = fixture(t);
  const result = runPolicy(cwd, ["--preset", "recommended"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Created fsd\.policy\.mjs from the "recommended" preset/);
  const created = fs.readFileSync(path.join(cwd, "fsd.policy.mjs"), "utf8");
  assert.match(created, /preset: "recommended"/);
  // The scaffolded file loads and resolves to the preset rules.
  const printed = runPolicy(cwd);
  assert.equal(printed.status, 0, printed.stderr);
  assert.match(printed.stdout, /Preset: recommended/);
  assert.match(printed.stdout, /Rules: 3/);
});

test("policy --preset refuses to overwrite an existing policy without --force", (t) => {
  const cwd = fixture(t, {
    "fsd.policy.mjs": `export default ${JSON.stringify({ version: 1, rules: [] })};\n`,
  });
  const refused = runPolicy(cwd, ["--preset", "strict"]);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /already exists/);
  const forced = runPolicy(cwd, ["--preset", "strict", "--force"]);
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(
    fs.readFileSync(path.join(cwd, "fsd.policy.mjs"), "utf8"),
    /preset: "strict"/,
  );
});

test("policy rejects an unknown preset and combining codeowners with --preset", (t) => {
  const cwd = fixture(t);
  const unknown = runPolicy(cwd, ["--preset", "maximal"]);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /--preset requires a preset name/);
  const combined = runPolicy(cwd, ["codeowners", "--preset", "recommended"]);
  assert.equal(combined.status, 1);
  assert.match(combined.stderr, /cannot be combined/);
});
