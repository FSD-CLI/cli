import fs from "fs";
import path from "path";
import { getTemplateProvenance } from "./template-registry.mjs";
import { configureProject } from "../project-config.mjs";
import { execFileSafe } from "./command-runner.mjs";
import { getInstallCommand } from "./package-managers.mjs";

const REQUIRED_HUSKY_HOOKS = ["pre-commit", "commit-msg", "pre-push"];
export const COMMITLINT_DEV_DEPENDENCIES = {
  "@commitlint/cli": "^20.5.3",
  "@commitlint/config-conventional": "^20.5.3",
};
const COMMITLINT_CONFIG_FILES = [
  "commitlint.config.js",
  "commitlint.config.cjs",
  "commitlint.config.mjs",
];

export function runCommand(command, args, cwd, options = {}) {
  return execFileSafe(command, args, {
    cwd,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

export async function cloneTemplate(template, targetDir) {
  const provenance = getTemplateProvenance(template);
  if (fs.existsSync(targetDir)) throw new Error("Template destination must not already exist.");
  fs.mkdirSync(targetDir, { recursive: true });
  runCommand("git", ["init", "--quiet"], targetDir);
  // Fetch the object directly: full SHAs must remain usable after branch tips move.
  try {
    runCommand("git", ["-c", "maintenance.auto=false", "-c", "gc.auto=0",
      "fetch", "--depth=1", "--no-tags",
      `https://github.com/${template.repo}.git`, template.ref], targetDir);
  } catch (error) {
    throw new Error(`Cannot download template ${template.repo} at pinned commit ${template.ref}: ${error.message}`, { cause: error });
  }
  const resolvedCommit = runCommand("git", ["rev-parse", "FETCH_HEAD"], targetDir).trim();
  if (resolvedCommit !== template.ref) throw new Error("Downloaded template commit does not match its immutable ref.");
  runCommand("git", ["-c", "core.autocrlf=false", "-c", "core.eol=lf",
    "checkout", "--quiet", "--detach", resolvedCommit], targetDir);
  fs.rmSync(path.join(targetDir, ".git"), { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  fs.mkdirSync(path.join(targetDir, ".fsd"), { recursive: true });
  fs.writeFileSync(path.join(targetDir, ".fsd", "template.json"),
    JSON.stringify({ ...provenance, resolvedCommit }, null, 2) + "\n");
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
    "pre-commit": `#!/bin/sh\nset -e\nif [ "\${HUSKY:-1}" = "0" ]; then\n  echo "FSD: hook bypassed via HUSKY=0; CI checks still apply."\n  exit 0\nfi\ngit diff --cached --check\ngit diff --check\nif [ "\${FSD_PRE_COMMIT_LINT:-0}" = "1" ]; then\n  ${run("lint")}\nfi\n`,
    "commit-msg": `#!/bin/sh\nset -e\nif [ "\${HUSKY:-1}" = "0" ]; then\n  echo "FSD: hook bypassed via HUSKY=0; CI checks still apply."\n  exit 0\nfi\n${execCommitlint}\n`,
    "pre-push": `#!/bin/sh\nset -e\nif [ "\${HUSKY:-1}" = "0" ]; then\n  echo "FSD: hook bypassed via HUSKY=0; CI checks still apply."\n  exit 0\nfi\nif [ "\${FSD_PRE_PUSH_CHECKS:-0}" = "1" ]; then\n  ${run("lint")}\n  ${run("build")}\nelse\n  echo "FSD: quality/build run in CI. Use FSD_PRE_PUSH_CHECKS=1 for local checks."\nfi\n`,
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
