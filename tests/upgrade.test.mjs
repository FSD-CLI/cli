import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseCliArgs, CliUsageError } from "../bin/cli/args.mjs";
import {
  applyUpgradePlan,
  buildUpgradePlan,
  runUpgradeProject,
  UPGRADE_CHECK_EXIT_CODES,
} from "../bin/commands/upgrade-project.mjs";
import {
  createHuskyHooks,
  ensureCommitlintConfig,
  ensureCommitlintDependencies,
} from "../bin/core/project-lifecycle.mjs";
import { configureProject, normalizeProjectConfig } from "../bin/project-config.mjs";
import { readManifest, writeInitialManifest } from "../bin/upgrade/manifest.mjs";
import { selectMigrationPath, validateMigrationGraph } from "../bin/upgrade/migrations/index.mjs";
import { findProjectRoot } from "../bin/upgrade/project-root.mjs";
import { UpgradeTransaction } from "../bin/upgrade/transaction.mjs";

const CLI_VERSION = "2.5.1";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function oldHuskyHooks(packageManager) {
  const run = (script) =>
    packageManager === "npm" || packageManager === "bun"
      ? `${packageManager} run ${script}`
      : `${packageManager} ${script}`;
  const commitlint = {
    npm: './node_modules/.bin/commitlint --edit "$1"',
    pnpm: 'pnpm exec commitlint --edit "$1"',
    yarn: 'yarn exec commitlint --edit "$1"',
    bun: 'bunx commitlint --edit "$1"',
  }[packageManager];
  return {
    "pre-commit": `${run("lint")}\ngit diff --check\n${run("build")}\n`,
    "commit-msg": `#!/bin/sh\n${commitlint}\n`,
    "pre-push": `${run("build")}\n`,
  };
}

function createFixture(
  framework,
  { packageManager = "npm", manifest = false, legacyHooks = true } = {}
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `fsd-cli-upgrade-${framework}-`));
  const sourceDirectory = framework === "nuxt" ? "app" : "src";
  for (const layer of ["app", "pages", "widgets", "features", "entities", "shared"]) {
    fs.mkdirSync(path.join(root, sourceDirectory, layer), { recursive: true });
  }
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({
      name: "upgrade-fixture",
      scripts: {},
      dependencies:
        framework === "nuxt"
          ? { nuxt: "^4.5.2", vue: "^3.5.42" }
          : framework === "sveltekit"
          ? { "@sveltejs/kit": "^2.70.3", svelte: "^5.57.1" }
          : framework === "vue-vite"
          ? { vue: "^3.5.42" }
          : { react: "^19.0.0" },
    })}\n`
  );
  if (framework === "nuxt") {
    fs.writeFileSync(
      path.join(root, "nuxt.config.ts"),
      `export default defineNuxtConfig({\n  modules: [\n    // fsd-cli:modules:start\n    // fsd-cli:modules:end\n  ],\n});\n`
    );
  }

  const config = normalizeProjectConfig(framework, { packageManager });
  configureProject(root, config);
  ensureCommitlintDependencies(root);
  ensureCommitlintConfig(root);
  const hooks = legacyHooks ? oldHuskyHooks(packageManager) : createHuskyHooks(packageManager);
  fs.mkdirSync(path.join(root, ".husky"), { recursive: true });
  for (const [name, content] of Object.entries(hooks)) {
    fs.writeFileSync(path.join(root, ".husky", name), content, { mode: 0o755 });
  }
  if (manifest) writeInitialManifest(root, config, CLI_VERSION);
  return { root, config };
}

function removeFixture(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("upgrade parser is isolated from create and generate flags", () => {
  assert.deepEqual(parseCliArgs(["upgrade", "--no-install", "--yes", "--dry-run"]), {
    command: "upgrade",
    dryRun: true,
    check: false,
    yes: true,
    noInstall: true,
    allowDirty: false,
  });
  assert.throws(() => parseCliArgs(["upgrade", "--force"]), CliUsageError);
  assert.throws(() => parseCliArgs(["upgrade", "extra"]), CliUsageError);
  assert.throws(() => parseCliArgs(["upgrade", "--check", "--yes"]), CliUsageError);
  assert.equal(parseCliArgs(["shop", "--force"]).command, "create");
  assert.equal(parseCliArgs(["--generate", "feature", "auth", "--force"]).command, "generate");
});

test("CLI routes upgrade without leaking flags into project creation", () => {
  const { root } = createFixture("react-vite");
  try {
    const result = spawnSync(
      process.execPath,
      [path.join(repoRoot, "bin", "index.mjs"), "upgrade", "--check"],
      { cwd: root, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } }
    );
    assert.equal(result.status, UPGRADE_CHECK_EXIT_CODES.AVAILABLE);
    assert.match(result.stdout, /FSD project upgrade/);
    assert.equal(fs.existsSync(path.join(root, ".fsd", "manifest.json")), false);
  } finally {
    removeFixture(root);
  }
});

test("root discovery works from nested directories and rejects nested projects", () => {
  const { root } = createFixture("react-vite");
  try {
    const nested = path.join(root, "src", "features", "account");
    fs.mkdirSync(nested, { recursive: true });
    assert.equal(findProjectRoot(nested), fs.realpathSync(root));
    fs.writeFileSync(path.join(nested, "fsd.config.json"), "{}\n");
    fs.writeFileSync(path.join(nested, "package.json"), "{}\n");
    assert.throws(() => findProjectRoot(nested), /Conflicting nested FSD project roots/);
  } finally {
    removeFixture(root);
  }
});

test("all supported framework and package-manager legacy fixtures have a deterministic plan", () => {
  for (const framework of ["react-vite", "nextjs", "vue-vite", "nuxt", "sveltekit"]) {
    const { root } = createFixture(framework);
    try {
      const plan = buildUpgradePlan(root, CLI_VERSION);
      assert.equal(plan.legacy, true);
      assert.equal(plan.conflicts.length, 0, framework);
      assert.equal(plan.manual.length, 0, framework);
      assert.ok(plan.operations.some((operation) => operation.path === ".fsd/manifest.json"));
    } finally {
      removeFixture(root);
    }
  }

  for (const packageManager of ["npm", "pnpm", "yarn", "bun"]) {
    const { root } = createFixture("react-vite", { packageManager });
    try {
      const plan = buildUpgradePlan(root, CLI_VERSION);
      assert.equal(plan.conflicts.length, 0, packageManager);
      assert.equal(plan.manual.length, 0, packageManager);
    } finally {
      removeFixture(root);
    }
  }
});

test("dry-run and check are read-only, then a clean legacy upgrade is idempotent", async () => {
  const { root } = createFixture("react-vite");
  try {
    const before = fs.readFileSync(path.join(root, ".husky", "pre-commit"), "utf8");
    const dryRun = await runUpgradeProject(
      { dryRun: true, check: false, yes: false, noInstall: false, allowDirty: false },
      { cwd: root, cliVersion: CLI_VERSION }
    );
    assert.equal(dryRun.exitCode, 0);
    assert.equal(fs.existsSync(path.join(root, ".fsd")), false);
    assert.equal(fs.readFileSync(path.join(root, ".husky", "pre-commit"), "utf8"), before);

    const checked = await runUpgradeProject(
      { dryRun: false, check: true, yes: false, noInstall: false, allowDirty: false },
      { cwd: root, cliVersion: CLI_VERSION }
    );
    assert.equal(checked.exitCode, UPGRADE_CHECK_EXIT_CODES.AVAILABLE);
    assert.equal(fs.existsSync(path.join(root, ".fsd")), false);

    const plan = buildUpgradePlan(root, CLI_VERSION);
    applyUpgradePlan(plan, { noInstall: true });
    const manifest = readManifest(root);
    assert.equal(manifest.stateVersion, 2);
    assert.deepEqual(manifest.appliedMigrations, ["managed-state-v1", "tooling-hardening-v1"]);
    assert.match(fs.readFileSync(path.join(root, ".husky", "pre-commit"), "utf8"), /^#!\/bin\/sh\nset -e/m);

    const secondPlan = buildUpgradePlan(root, CLI_VERSION);
    assert.equal(secondPlan.writes.length, 0);
    const current = await runUpgradeProject(
      { dryRun: false, check: true, yes: false, noInstall: false, allowDirty: false },
      { cwd: root, cliVersion: CLI_VERSION }
    );
    assert.equal(current.exitCode, UPGRADE_CHECK_EXIT_CODES.CURRENT);
  } finally {
    removeFixture(root);
  }
});

test("business code is preserved while modified managed code blocks upgrade", async () => {
  const safe = createFixture("nextjs");
  try {
    const businessPath = path.join(safe.root, "src", "features", "auth", "model", "auth.store.ts");
    fs.mkdirSync(path.dirname(businessPath), { recursive: true });
    fs.writeFileSync(businessPath, "export const userBusinessCode = true;\n");
    const original = fs.readFileSync(businessPath);
    applyUpgradePlan(buildUpgradePlan(safe.root, CLI_VERSION), { noInstall: true });
    assert.deepEqual(fs.readFileSync(businessPath), original);
  } finally {
    removeFixture(safe.root);
  }

  const conflicted = createFixture("vue-vite");
  try {
    const client = path.join(conflicted.root, "src", "shared", "api", "client.ts");
    const original = fs.readFileSync(client, "utf8");
    fs.writeFileSync(client, `${original}// user customization\n`);
    const plan = buildUpgradePlan(conflicted.root, CLI_VERSION);
    assert.ok(plan.conflicts.some((operation) => operation.path === "src/shared/api/client.ts"));
    await assert.rejects(
      () =>
        runUpgradeProject(
          { dryRun: false, check: false, yes: true, noInstall: true, allowDirty: false },
          { cwd: conflicted.root, cliVersion: CLI_VERSION }
        ),
      /unresolved conflicts or manual actions/
    );
    assert.equal(fs.existsSync(path.join(conflicted.root, ".fsd")), false);
    assert.equal(fs.readFileSync(client, "utf8"), `${original}// user customization\n`);
  } finally {
    removeFixture(conflicted.root);
  }
});

test("managed manifests detect edits, malformed input, future schemas, and missing markers", async () => {
  const managed = createFixture("react-vite", { manifest: true, legacyHooks: false });
  try {
    const client = path.join(managed.root, "src", "shared", "api", "client.ts");
    fs.appendFileSync(client, "// modified\n");
    assert.ok(buildUpgradePlan(managed.root, CLI_VERSION).conflicts.length > 0);
  } finally {
    removeFixture(managed.root);
  }

  const malformed = createFixture("react-vite");
  try {
    fs.writeFileSync(path.join(malformed.root, "fsd.config.json"), "not json\n");
    const result = await runUpgradeProject(
      { dryRun: false, check: true, yes: false, noInstall: false, allowDirty: false },
      { cwd: malformed.root, cliVersion: CLI_VERSION }
    );
    assert.equal(result.exitCode, UPGRADE_CHECK_EXIT_CODES.INVALID);
  } finally {
    removeFixture(malformed.root);
  }

  const future = createFixture("react-vite");
  try {
    const configPath = path.join(future.root, "fsd.config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.schemaVersion = 2;
    fs.writeFileSync(configPath, `${JSON.stringify(config)}\n`);
    assert.throws(() => buildUpgradePlan(future.root, CLI_VERSION), /unsupported future schema/);
  } finally {
    removeFixture(future.root);
  }

  const missingMarker = createFixture("nuxt");
  try {
    const configPath = path.join(missingMarker.root, "nuxt.config.ts");
    fs.writeFileSync(configPath, "export default defineNuxtConfig({});\n");
    assert.ok(
      buildUpgradePlan(missingMarker.root, CLI_VERSION).conflicts.some(
        (operation) => operation.path === "nuxt.config.ts"
      )
    );
  } finally {
    removeFixture(missingMarker.root);
  }
});

test("transaction rollback restores files and retains an internal recovery backup", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-upgrade-rollback-"));
  try {
    fs.mkdirSync(path.join(root, ".fsd"), { recursive: true });
    fs.writeFileSync(path.join(root, "one.txt"), "one\n", { mode: 0o755 });
    const transaction = new UpgradeTransaction(root, ["one.txt", "two.txt"], {
      failureInjection: ({ stage, operation }) => stage === "after-write" && operation.path === "two.txt",
    });
    transaction.begin();
    assert.throws(
      () =>
        transaction.apply([
          { status: "UPDATE", path: "one.txt", content: "changed\n" },
          { status: "CREATE", path: "two.txt", content: "created\n" },
        ]),
      /Injected upgrade failure/
    );
    assert.equal(transaction.rollback().ok, true);
    assert.equal(fs.readFileSync(path.join(root, "one.txt"), "utf8"), "one\n");
    assert.equal(fs.existsSync(path.join(root, "two.txt")), false);
    assert.equal(fs.statSync(path.join(root, "one.txt")).mode & 0o777, 0o755);
    assert.equal(fs.existsSync(transaction.backupLocation), true);
  } finally {
    removeFixture(root);
  }
});

test("manifest-write failure rolls back prior hook updates", () => {
  const { root } = createFixture("react-vite");
  try {
    const oldHook = fs.readFileSync(path.join(root, ".husky", "pre-commit"), "utf8");
    assert.throws(
      () =>
        applyUpgradePlan(buildUpgradePlan(root, CLI_VERSION), {
          noInstall: true,
          failureInjection: ({ stage, operation }) =>
            stage === "after-write" && operation.path === ".fsd/manifest.json",
        }),
      /affected source, configuration, manifest, and lockfile paths were rolled back/i
    );
    assert.equal(fs.readFileSync(path.join(root, ".husky", "pre-commit"), "utf8"), oldHook);
    assert.equal(fs.existsSync(path.join(root, ".fsd", "manifest.json")), false);
  } finally {
    removeFixture(root);
  }
});

test("migration graph rejects gaps, duplicate IDs, cycles, and downgrades", () => {
  assert.equal(selectMigrationPath(0).length, 2);
  assert.throws(
    () => validateMigrationGraph([{ id: "same", from: 0, to: 1 }, { id: "same", from: 1, to: 2 }]),
    /Duplicate/
  );
  assert.throws(
    () => validateMigrationGraph([{ id: "cycle", from: 1, to: 1 }]),
    /invalid state transition/
  );
  assert.throws(() => selectMigrationPath(3), /newer than this CLI supports/);
});

test("symlink escapes are rejected before planning writes", () => {
  const { root } = createFixture("react-vite");
  const external = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-upgrade-external-"));
  try {
    const client = path.join(root, "src", "shared", "api", "client.ts");
    fs.rmSync(client);
    fs.writeFileSync(path.join(external, "client.ts"), "external\n");
    fs.symlinkSync(path.join(external, "client.ts"), client);
    assert.throws(() => buildUpgradePlan(root, CLI_VERSION), /symlinked path/);
  } finally {
    removeFixture(root);
    removeFixture(external);
  }
});

test("dirty Git worktrees are refused unless explicitly allowed", async () => {
  const { root } = createFixture("react-vite");
  try {
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    await assert.rejects(
      () =>
        runUpgradeProject(
          { dryRun: false, check: false, yes: true, noInstall: true, allowDirty: false },
          { cwd: root, cliVersion: CLI_VERSION }
        ),
      /dirty Git worktree/
    );
    assert.equal(fs.existsSync(path.join(root, ".fsd", "manifest.json")), false);
  } finally {
    removeFixture(root);
  }
});
