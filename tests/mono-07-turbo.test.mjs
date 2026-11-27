import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CliUsageError, parseCliArgs } from "../bin/cli/args.mjs";
import {
  TURBO_JSON_FILE,
  TURBO_SCHEMA_URL,
  TURBO_TASK_NAMES,
  buildTurboConfig,
  discoverWorkspaceMembers,
  readTurboConfig,
  renderTurboJson,
  validateTurboConfig,
  writeTurboConfig,
} from "../bin/core/turbo-config.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

// A workspace following the MONO-01 layout: two apps (one Next.js, one
// React + Vite), two packages, and one directory under apps/ that is not a
// member because it has no package.json.
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-turbo-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const members = [
    ["apps", "web", { framework: "nextjs" }],
    ["apps", "admin", { framework: "react-vite" }],
    ["packages", "shared-ui", null],
    ["packages", "entities-product", null],
  ];
  for (const [base, name, config] of members) {
    const dir = path.join(cwd, base, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: `@my-workspace/${name}`, version: "0.1.0" }),
    );
    if (config) {
      fs.writeFileSync(
        path.join(dir, "fsd.config.json"),
        JSON.stringify({ schemaVersion: 1, ...config }),
      );
    }
  }
  fs.mkdirSync(path.join(cwd, "apps", "empty"), { recursive: true });
  return cwd;
}

function runTurbo(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "turbo", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
  });
}

test("buildTurboConfig has build/lint/test/typecheck pipelines with ^build and inputs", () => {
  const config = buildTurboConfig([]);
  assert.equal(config.$schema, TURBO_SCHEMA_URL);
  assert.deepEqual(Object.keys(config.tasks), TURBO_TASK_NAMES);
  for (const name of ["build", "lint", "test", "typecheck"]) {
    const task = config.tasks[name];
    assert.deepEqual(task.dependsOn, ["^build"], `${name} must wait for ^build`);
    assert.ok(task.inputs.includes("$TURBO_DEFAULT$"), `${name} must include $TURBO_DEFAULT$`);
  }
  assert.deepEqual(config.tasks.build.outputs, ["dist/**", ".next/**"]);
  assert.deepEqual(config.tasks.dev, { cache: false, persistent: true });
  assert.deepEqual(config.tasks.clean, { cache: false });
});

test("build outputs follow the members' frameworks", () => {
  const viteOnly = buildTurboConfig([
    { kind: "app", name: "web", dir: "apps/web", framework: "react-vite" },
    { kind: "package", name: "shared-ui", dir: "packages/shared-ui" },
  ]);
  assert.deepEqual(viteOnly.tasks.build.outputs, ["dist/**"]);

  const mixed = buildTurboConfig([
    { kind: "app", name: "web", dir: "apps/web", framework: "nextjs" },
    { kind: "app", name: "shop", dir: "apps/shop", framework: "nuxt" },
  ]);
  assert.deepEqual(mixed.tasks.build.outputs, [
    ".next/**",
    ".output/**",
    "dist/**",
  ]);
});

test("renderTurboJson is deterministic: same members, same bytes", (t) => {
  const members = discoverWorkspaceMembers(fixture(t));
  const first = renderTurboJson(buildTurboConfig(members));
  const second = renderTurboJson(buildTurboConfig(members));
  assert.equal(first, second);
  assert.ok(first.endsWith("\n"));
  assert.equal(JSON.parse(first).tasks.build.dependsOn[0], "^build");
  // The task order is fixed, not discovery order.
  assert.ok(first.indexOf('"build"') < first.indexOf('"lint"'));
  assert.ok(first.indexOf('"lint"') < first.indexOf('"test"'));
});

test("discoverWorkspaceMembers finds apps/* and packages/* and skips non-members", (t) => {
  const cwd = fixture(t);
  assert.deepEqual(discoverWorkspaceMembers(cwd), [
    { kind: "app", name: "admin", dir: "apps/admin", framework: "react-vite" },
    { kind: "app", name: "web", dir: "apps/web", framework: "nextjs" },
    { kind: "package", name: "entities-product", dir: "packages/entities-product" },
    { kind: "package", name: "shared-ui", dir: "packages/shared-ui" },
  ]);
});

test("validateTurboConfig accepts the generated config and reports gaps", () => {
  assert.deepEqual(validateTurboConfig(buildTurboConfig([])), []);
  assert.deepEqual(validateTurboConfig({}), [
    'turbo.json must contain a "tasks" object.',
  ]);
  const missingTest = buildTurboConfig([]);
  delete missingTest.tasks.test;
  assert.ok(
    validateTurboConfig(missingTest).some((issue) => issue.includes('"test"')),
  );
  const cachedDev = buildTurboConfig([]);
  cachedDev.tasks.dev = { cache: true, persistent: true };
  assert.ok(
    validateTurboConfig(cachedDev).some((issue) => issue.includes('"dev"')),
  );
  const noOutputs = buildTurboConfig([]);
  delete noOutputs.tasks.build.outputs;
  assert.ok(
    validateTurboConfig(noOutputs).some((issue) => issue.includes('"build"')),
  );
});

test("writeTurboConfig writes a valid turbo.json covering the workspace members", (t) => {
  const cwd = fixture(t);
  const { path: file, config, members } = writeTurboConfig(cwd);
  assert.equal(file, path.join(cwd, TURBO_JSON_FILE));
  assert.equal(members.length, 4);
  const written = fs.readFileSync(file, "utf8");
  assert.equal(written, renderTurboJson(config));
  assert.deepEqual(JSON.parse(written).tasks.build.outputs, [
    ".next/**",
    "dist/**",
  ]);
  assert.deepEqual(readTurboConfig(cwd).issues, []);
});

test("writeTurboConfig refuses to overwrite without --force and regenerates with it", (t) => {
  const cwd = fixture(t);
  writeTurboConfig(cwd);
  assert.throws(() => writeTurboConfig(cwd), /already exists.*--force/);
  assert.doesNotThrow(() => writeTurboConfig(cwd, { force: true }));
  const { issues } = readTurboConfig(cwd);
  assert.deepEqual(issues, []);
});

test("writeTurboConfig refuses a non-workspace root and a workspace that chose Nx", (t) => {
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-turbo-plain-"));
  t.after(() => fs.rmSync(plain, { recursive: true, force: true }));
  assert.throws(() => writeTurboConfig(plain), /not a monorepo workspace root/);

  const nx = fixture(t);
  fs.writeFileSync(path.join(nx, "nx.json"), "{}\n");
  assert.throws(() => writeTurboConfig(nx), /nx\.json already exists/);
  assert.throws(() => writeTurboConfig(nx, { force: true }), /nx\.json already exists/);
  assert.ok(!fs.existsSync(path.join(nx, TURBO_JSON_FILE)));
});

test("readTurboConfig throws on a missing file and on invalid JSON", (t) => {
  const cwd = fixture(t);
  assert.throws(() => readTurboConfig(cwd), /No turbo\.json found/);
  fs.writeFileSync(path.join(cwd, TURBO_JSON_FILE), "{not json");
  assert.throws(() => readTurboConfig(cwd), /not valid JSON/);
});

test("parseCliArgs parses turbo with --force only", () => {
  assert.deepEqual(parseCliArgs(["turbo"]), { command: "turbo", force: false });
  assert.deepEqual(parseCliArgs(["turbo", "--force"]), {
    command: "turbo",
    force: true,
  });
  assert.throws(() => parseCliArgs(["turbo", "--dry-run"]), CliUsageError);
});

test("fsd turbo writes turbo.json, refuses a second run, and regenerates with --force", (t) => {
  const cwd = fixture(t);
  const first = runTurbo(cwd);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /Wrote turbo\.json/);
  assert.match(first.stdout, /2 apps and 2 packages/);
  const written = JSON.parse(fs.readFileSync(path.join(cwd, TURBO_JSON_FILE), "utf8"));
  assert.deepEqual(written.tasks.build.dependsOn, ["^build"]);

  const second = runTurbo(cwd);
  assert.equal(second.status, 1);
  assert.match(second.stderr, /turbo\.json already exists/);
  assert.equal(
    fs.readFileSync(path.join(cwd, TURBO_JSON_FILE), "utf8"),
    renderTurboJson(written),
  );

  const forced = runTurbo(cwd, ["--force"]);
  assert.equal(forced.status, 0, forced.stderr);
  assert.deepEqual(readTurboConfig(cwd).issues, []);
});

test("fsd turbo refuses a non-workspace directory", (t) => {
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-turbo-plain-"));
  t.after(() => fs.rmSync(plain, { recursive: true, force: true }));
  const result = runTurbo(plain);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not a monorepo workspace root/);
});
