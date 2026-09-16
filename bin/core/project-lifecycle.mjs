import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import degit from "degit";
import { configureProject } from "../project-config.mjs";
import { getInstallCommand } from "./package-managers.mjs";

const REQUIRED_HUSKY_HOOKS = ["pre-commit", "commit-msg", "pre-push"];
const COMMITLINT_DEV_DEPENDENCIES = {
  "@commitlint/cli": "^20.5.3",
  "@commitlint/config-conventional": "^20.5.3",
};
const COMMITLINT_CONFIG_FILES = [
  "commitlint.config.js",
  "commitlint.config.cjs",
  "commitlint.config.mjs",
];

export function runCommand(command, args, cwd, options = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

export async function cloneTemplate(template, targetDir) {
  const emitter = degit(template.repo, { cache: false, force: true });
  await emitter.clone(targetDir);
}

export function beginProjectTransaction(targetDir, { force = false } = {}) {
  const targetExists = fs.existsSync(targetDir);
  if (targetExists && !force) {
    throw new Error(
      `Folder "${path.basename(targetDir)}" already exists. Re-run with --force to replace it.`
    );
  }

  const backupDir = targetExists
    ? `${targetDir}.fsd-cli-backup-${process.pid}-${Date.now()}`
    : null;
  if (backupDir) fs.renameSync(targetDir, backupDir);

  let finished = false;
  return {
    commit() {
      if (finished) return;
      if (backupDir) fs.rmSync(backupDir, { recursive: true, force: true });
      finished = true;
    },
    rollback() {
      if (finished) return;
      fs.rmSync(targetDir, { recursive: true, force: true });
      if (backupDir && fs.existsSync(backupDir)) fs.renameSync(backupDir, targetDir);
      finished = true;
    },
  };
}

export function prepareProject(targetDir, config) {
  configureProject(targetDir, config);
  ensureCommitlintDependencies(targetDir);
  ensureCommitlintConfig(targetDir);
  ensureGitRepository(targetDir);
  ensureHuskyHooks(targetDir, config.packageManager);
}

export function installProjectDependencies(targetDir, packageManager) {
  const install = getInstallCommand(packageManager);
  runCommand(install.command, install.args, targetDir);
  runCommand("git", ["config", "core.hooksPath", ".husky"], targetDir);
}

export function ensureGitRepository(targetDir) {
  runCommand("git", ["init"], targetDir);
  runCommand("git", ["config", "core.hooksPath", ".husky"], targetDir);

  const remotes = runCommand("git", ["remote"], targetDir).split(/\r?\n/);
  if (remotes.includes("origin")) {
    runCommand("git", ["remote", "remove", "origin"], targetDir);
  }
}

export function ensureCommitlintDependencies(targetDir) {
  const packageJsonPath = path.join(targetDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  packageJson.devDependencies ??= {};

  for (const [name, version] of Object.entries(COMMITLINT_DEV_DEPENDENCIES)) {
    if (!packageJson.devDependencies[name] && !packageJson.dependencies?.[name]) {
      packageJson.devDependencies[name] = version;
    }
  }

  packageJson.devDependencies = Object.fromEntries(
    Object.entries(packageJson.devDependencies).sort(([a], [b]) => a.localeCompare(b))
  );
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

export function ensureCommitlintConfig(targetDir) {
  const hasCommitlintConfig = COMMITLINT_CONFIG_FILES.some((file) =>
    fs.existsSync(path.join(targetDir, file))
  );
  if (!hasCommitlintConfig) {
    fs.writeFileSync(
      path.join(targetDir, "commitlint.config.cjs"),
      "module.exports = { extends: ['@commitlint/config-conventional'] };\n"
    );
  }
}

export function createHuskyHooks(packageManager) {
  const run = (script) =>
    packageManager === "npm" || packageManager === "bun"
      ? `${packageManager} run ${script}`
      : `${packageManager} ${script}`;
  const execCommitlint = {
    npm: './node_modules/.bin/commitlint --edit "$1"',
    pnpm: 'pnpm exec commitlint --edit "$1"',
    yarn: 'yarn exec commitlint --edit "$1"',
    bun: 'bunx commitlint --edit "$1"',
  }[packageManager];

  if (!execCommitlint) {
    throw new Error(`Unsupported package manager "${packageManager}".`);
  }

  return {
    "pre-commit": `${run("lint")}\ngit diff --check\n${run("build")}\n`,
    "commit-msg": `#!/bin/sh\n${execCommitlint}\n`,
    "pre-push": `${run("build")}\n`,
  };
}

export function ensureHuskyHooks(targetDir, packageManager) {
  const huskyDir = path.join(targetDir, ".husky");
  const hooks = createHuskyHooks(packageManager);
  fs.mkdirSync(huskyDir, { recursive: true });

  for (const hook of REQUIRED_HUSKY_HOOKS) {
    const hookPath = path.join(huskyDir, hook);
    fs.writeFileSync(hookPath, hooks[hook]);
    fs.chmodSync(hookPath, 0o755);
  }
}

export function verifyCommitlintRejectsInvalidMessage(targetDir) {
  const commitMsgHook = path.join(targetDir, ".husky", "commit-msg");
  const invalidMessagePath = path.join(
    targetDir,
    ".git",
    "COMMITLINT_INVALID_MESSAGE_CHECK"
  );
  fs.writeFileSync(invalidMessagePath, "test\n");

  try {
    runCommand(commitMsgHook, [invalidMessagePath], targetDir);
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`;
    if (
      output.includes("subject may not be empty") &&
      output.includes("type may not be empty")
    ) {
      return true;
    }
    throw error;
  } finally {
    fs.rmSync(invalidMessagePath, { force: true });
  }

  throw new Error('Commitlint accepted invalid commit message "test".');
}
