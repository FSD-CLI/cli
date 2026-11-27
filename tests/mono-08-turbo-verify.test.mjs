import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CliUsageError, parseCliArgs } from "../bin/cli/args.mjs";
import { writeTurboConfig } from "../bin/core/turbo-config.mjs";
import {
  findTurboBinary,
  runTurboDryRun,
  verifyTurboSetup,
} from "../bin/core/turbo-verify.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

// A workspace following the MONO-01 layout: two apps (one Next.js, one
// React + Vite) and two packages. Every member gets a `build` script unless
// `productScripts` says otherwise — a member without one is the warning
// case (turbo build skips it, so nothing is ever cached for it).
function fixture(t, { productScripts = null } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-turbo-verify-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const members = [
    ["apps", "web", { framework: "nextjs" }, { build: "echo build web" }],
    ["apps", "admin", { framework: "react-vite" }, { build: "echo build admin" }],
    ["packages", "shared-ui", null, { build: "echo build ui" }],
    ["packages", "entities-product", null, productScripts],
  ];
  for (const [base, name, config, scripts] of members) {
    const dir = path.join(cwd, base, name);
    fs.mkdirSync(dir, { recursive: true });
    const pkg = { name: `@my-workspace/${name}`, version: "0.1.0" };
    if (scripts) pkg.scripts = scripts;
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg));
    if (config) {
      fs.writeFileSync(
        path.join(dir, "fsd.config.json"),
        JSON.stringify({ schemaVersion: 1, ...config }),
      );
    }
  }
  return cwd;
}

function writeConfig(cwd, mutate) {
  const config = JSON.parse(
    fs.readFileSync(path.join(cwd, "turbo.json"), "utf8"),
  );
  mutate(config);
  fs.writeFileSync(path.join(cwd, "turbo.json"), JSON.stringify(config, null, 2));
}

function runTurbo(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "turbo", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
  });
}

test("verifyTurboSetup passes a generated config with build scripts everywhere", (t) => {
  const cwd = fixture(t, { productScripts: { build: "echo build product" } });
  writeTurboConfig(cwd);
  const result = verifyTurboSetup(cwd);
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.members.length, 4);
  assert.equal(result.config.tasks.build.outputs.includes(".next/**"), true);
});

test("verifyTurboSetup reports a missing turbo.json as an issue, not a throw", (t) => {
  const cwd = fixture(t);
  const result = verifyTurboSetup(cwd);
  assert.equal(result.ok, false);
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0], /No turbo\.json/);
  assert.equal(result.config, null);
});

test("verifyTurboSetup reports invalid JSON as an issue", (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, "turbo.json"), "{not json");
  const result = verifyTurboSetup(cwd);
  assert.equal(result.ok, false);
  assert.match(result.issues[0], /not valid JSON/);
});

test("verifyTurboSetup flags a hand-edited config that drops a framework output", (t) => {
  const cwd = fixture(t, { productScripts: { build: "echo build product" } });
  writeTurboConfig(cwd);
  writeConfig(cwd, (config) => {
    config.tasks.build.outputs = config.tasks.build.outputs.filter(
      (output) => output !== ".next/**",
    );
  });
  const result = verifyTurboSetup(cwd);
  assert.equal(result.ok, false);
  assert.match(
    result.issues.join(" "),
    /\.next\/\*\*.*apps\/web|apps\/web.*\.next\/\*\*/,
  );
});

test("verifyTurboSetup flags a build task with caching disabled", (t) => {
  const cwd = fixture(t, { productScripts: { build: "echo build product" } });
  writeTurboConfig(cwd);
  writeConfig(cwd, (config) => {
    config.tasks.build.cache = false;
  });
  const result = verifyTurboSetup(cwd);
  assert.equal(result.ok, false);
  assert.match(result.issues.join(" "), /"build" task sets "cache" to false/);
});

test("verifyTurboSetup flags a workspace that also carries nx.json", (t) => {
  const cwd = fixture(t, { productScripts: { build: "echo build product" } });
  writeTurboConfig(cwd);
  fs.writeFileSync(path.join(cwd, "nx.json"), "{}\n");
  const result = verifyTurboSetup(cwd);
  assert.equal(result.ok, false);
  assert.match(result.issues.join(" "), /nx\.json exists/);
});

test("verifyTurboSetup warns about a member without a build script", (t) => {
  const cwd = fixture(t);
  writeTurboConfig(cwd);
  const result = verifyTurboSetup(cwd);
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /packages\/entities-product.*no "build" script/);
});

test("runTurboDryRun reports unavailable without a binary and throws for a bogus one", (t) => {
  const cwd = fixture(t);
  writeTurboConfig(cwd);
  assert.deepEqual(runTurboDryRun(cwd, { turboBin: null }), {
    available: false,
    reason: "no turbo binary found on PATH",
  });
  assert.throws(
    () => runTurboDryRun(cwd, { turboBin: "definitely-not-a-turbo-binary" }),
    /Could not run/,
  );
});

test("live dry run resolves the workspace packages and tasks", { skip: findTurboBinary() === null }, (t) => {
  const cwd = fixture(t, { productScripts: { build: "echo build product" } });
  writeTurboConfig(cwd);
  const dryRun = runTurboDryRun(cwd);
  assert.equal(dryRun.available, true);
  assert.ok(dryRun.packages >= 4, `expected >= 4 packages, got ${dryRun.packages}`);
  assert.ok(dryRun.tasks >= 1, `expected >= 1 task, got ${dryRun.tasks}`);
});

test("parseCliArgs accepts --verify and rejects --force with --verify", () => {
  assert.deepEqual(parseCliArgs(["turbo", "--verify"]), {
    command: "turbo",
    force: false,
    verify: true,
  });
  assert.throws(
    () => parseCliArgs(["turbo", "--force", "--verify"]),
    (error) =>
      error instanceof CliUsageError && /cannot combine --force with --verify/.test(error.message),
  );
});

test("fsd turbo --verify passes a generated workspace", (t) => {
  const cwd = fixture(t, { productScripts: { build: "echo build product" } });
  runTurbo(cwd);
  const result = runTurbo(cwd, ["--verify"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /turbo\.json verified/);
});

test("fsd turbo --verify fails on a config with its outputs removed", (t) => {
  const cwd = fixture(t, { productScripts: { build: "echo build product" } });
  runTurbo(cwd);
  writeConfig(cwd, (config) => {
    config.tasks.build.outputs = [];
  });
  const result = runTurbo(cwd, ["--verify"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /verification failed/);
});

test("fsd turbo --verify fails without turbo.json", (t) => {
  const cwd = fixture(t);
  const result = runTurbo(cwd, ["--verify"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /No turbo\.json/);
  assert.match(result.stderr, /verification failed/);
});

test("E2E: generate, verify, break the config, verify fails", (t) => {
  const cwd = fixture(t, { productScripts: { build: "echo build product" } });
  const generated = runTurbo(cwd);
  assert.equal(generated.status, 0, generated.stderr);
  assert.ok(fs.existsSync(path.join(cwd, "turbo.json")));
  const verified = runTurbo(cwd, ["--verify"]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.match(verified.stdout, /turbo\.json verified/);
  writeConfig(cwd, (config) => {
    delete config.tasks.build;
  });
  const broken = runTurbo(cwd, ["--verify"]);
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /verification failed/);
});
