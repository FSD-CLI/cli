import { spawnSync } from "node:child_process";
import prompts from "prompts";
import { getLockfiles } from "../core/package-managers.mjs";
import { readProjectConfig, UpgradeStateError } from "../upgrade/config.mjs";
import { MANIFEST_PATH, readManifest } from "../upgrade/manifest.mjs";
import { createUpgradePlan } from "../upgrade/planner.mjs";
import { findProjectRoot } from "../upgrade/project-root.mjs";
import { UpgradeTransaction } from "../upgrade/transaction.mjs";
import {
  installAndValidateDependencies,
  validateProjectStructure,
  validateUpgradedProject,
} from "../upgrade/validation.mjs";

export const UPGRADE_CHECK_EXIT_CODES = Object.freeze({
  CURRENT: 0,
  AVAILABLE: 2,
  BLOCKED: 3,
  INVALID: 4,
});

function getGitStatus(projectRoot) {
  const run = (args) => spawnSync("git", args, { cwd: projectRoot, encoding: "utf8", shell: false });
  const inside = run(["rev-parse", "--is-inside-work-tree"]);
  if (inside.error || inside.status !== 0 || inside.stdout.trim() !== "true") return null;
  const branch = run(["branch", "--show-current"]);
  const status = run(["status", "--porcelain"]);
  return {
    branch: branch.status === 0 ? branch.stdout.trim() || "detached HEAD" : "unknown",
    dirty: status.status === 0 && Boolean(status.stdout.trim()),
  };
}

function formatDiff(before, after) {
  if (typeof before !== "string" || typeof after !== "string") return null;
  const oldLines = before.split(/\r?\n/);
  const newLines = after.split(/\r?\n/);
  const first = oldLines.findIndex((line, index) => line !== newLines[index]);
  if (first === -1) return null;
  return [`- ${oldLines[first] ?? ""}`, `+ ${newLines[first] ?? ""}`].join("\n");
}

function printPlan(plan, { dryRun = false, check = false } = {}) {
  console.log("\nFSD project upgrade\n");
  console.log(`Project: ${plan.projectRoot}`);
  console.log(`Framework: ${plan.config.framework}`);
  console.log(
    `Current state: ${plan.legacy ? "legacy (no manifest)" : `managed state ${plan.currentState}`} / config schema ${plan.config.schemaVersion}`
  );
  console.log(`Target state: managed state ${plan.targetState} / config schema ${plan.config.schemaVersion}`);
  console.log(
    `Migration path: ${plan.migrationPath.length ? plan.migrationPath.map((item) => item.id).join(" -> ") : "up to date"}`
  );
  if (plan.legacy) console.log("Mode: conservative legacy ownership analysis");
  console.log();

  for (const operation of plan.operations) {
    console.log(`${operation.status.padEnd(15)} ${operation.path}${operation.reason ? `  ${operation.reason}` : ""}`);
    if (dryRun && ["CREATE", "UPDATE"].includes(operation.status)) {
      const diff = formatDiff(operation.current, operation.content);
      if (diff) console.log(`${diff}\n`);
    }
  }

  const counts = Object.fromEntries(
    ["CREATE", "UPDATE", "DELETE", "PRESERVE", "CONFLICT", "MANUAL"].map((status) => [
      status,
      plan.operations.filter((operation) => operation.status === status).length,
    ])
  );
  console.log(
    `\n${counts.CREATE} creates, ${counts.UPDATE} safe updates, ${counts.DELETE} deletes, ${counts.PRESERVE} preserved, ${counts.CONFLICT} conflicts, ${counts.MANUAL} manual actions`
  );
  console.log("Validations:");
  for (const validation of plan.validations) console.log(`  - ${validation}`);
  if (dryRun || check) console.log("No files were changed.");
}

function printGitStatus(status) {
  if (!status) {
    console.log("Git: no repository detected; internal transactional backup will be used.\n");
    return;
  }
  console.log(`Git: ${status.branch} (${status.dirty ? "dirty" : "clean"})\n`);
}

function hasBlockingIssues(plan) {
  return plan.conflicts.length > 0 || plan.manual.length > 0;
}

function dependencyMigration(plan) {
  return plan.writes.some((operation) => operation.path === "package.json");
}

function transactionPaths(plan) {
  const paths = plan.writes.map((operation) => operation.path);
  if (dependencyMigration(plan)) {
    paths.push(...getLockfiles(plan.config.packageManager).all);
  }
  return paths;
}

async function confirmUpgrade() {
  const answer = await prompts({
    type: "confirm",
    name: "apply",
    message: "Apply this safe upgrade plan?",
    initial: false,
  });
  return answer.apply === true;
}

export function buildUpgradePlan(cwd = process.cwd(), cliVersion = "unknown") {
  const projectRoot = findProjectRoot(cwd);
  validateProjectStructure(projectRoot);
  const config = readProjectConfig(projectRoot);
  const manifest = readManifest(projectRoot);
  return createUpgradePlan({ projectRoot, config, manifest, cliVersion });
}

export function applyUpgradePlan(plan, { noInstall = false, failureInjection, commandRunner } = {}) {
  const transaction = new UpgradeTransaction(plan.projectRoot, transactionPaths(plan), {
    failureInjection,
  });
  const manifestOperation = plan.writes.find((operation) => operation.path === MANIFEST_PATH);
  const sourceOperations = plan.writes.filter((operation) => operation.path !== MANIFEST_PATH);
  const runner = commandRunner ?? spawnSync;
  let dependencyInstallStarted = false;

  try {
    transaction.begin();
    transaction.apply(sourceOperations);
    validateProjectStructure(plan.projectRoot);

    if (dependencyMigration(plan) && !noInstall) {
      dependencyInstallStarted = true;
      console.log("\nDependency installation and generated-project checks:");
      installAndValidateDependencies(plan.projectRoot, plan.config, runner);
    } else if (dependencyMigration(plan)) {
      console.log("\nDependency installation skipped by --no-install.");
    } else {
      console.log("\nDependency installation skipped; this migration does not change dependencies.");
    }

    if (manifestOperation) transaction.apply([manifestOperation]);
    validateUpgradedProject(plan.projectRoot);
    transaction.commit();
  } catch (error) {
    const rollback = transaction.rollback();
    const recovery = transaction.backupLocation
      ? ` Recovery backup: ${transaction.backupLocation}.`
      : "";
    if (!rollback.ok) {
      throw new Error(
        `Upgrade failed and rollback also failed: ${rollback.error.message}.${recovery}`,
        { cause: error }
      );
    }
    const installRecovery = dependencyInstallStarted
      ? ` node_modules may require recovery with: ${plan.config.packageManager} install.`
      : "";
    throw new Error(
      `Upgrade failed: ${error.message} Affected source, configuration, manifest, and lockfile paths were rolled back.${installRecovery}${recovery}`,
      { cause: error }
    );
  }
}

export async function runUpgradeProject(options, { cwd = process.cwd(), cliVersion = "unknown" } = {}) {
  let plan;
  try {
    plan = buildUpgradePlan(cwd, cliVersion);
  } catch (error) {
    if (options.check) {
      console.error(`Upgrade state is unsupported or invalid: ${error.message}`);
      return { exitCode: UPGRADE_CHECK_EXIT_CODES.INVALID };
    }
    throw error;
  }

  const gitStatus = getGitStatus(plan.projectRoot);
  printPlan(plan, { dryRun: options.dryRun, check: options.check });
  printGitStatus(gitStatus);

  if (options.check) {
    if (hasBlockingIssues(plan)) return { exitCode: UPGRADE_CHECK_EXIT_CODES.BLOCKED };
    return {
      exitCode: plan.writes.length
        ? UPGRADE_CHECK_EXIT_CODES.AVAILABLE
        : UPGRADE_CHECK_EXIT_CODES.CURRENT,
    };
  }
  if (options.dryRun) {
    return { exitCode: hasBlockingIssues(plan) ? UPGRADE_CHECK_EXIT_CODES.BLOCKED : 0 };
  }
  if (hasBlockingIssues(plan)) {
    throw new UpgradeStateError(
      "Upgrade has unresolved conflicts or manual actions. No files were changed. Resolve them and run again."
    );
  }
  if (!plan.writes.length) {
    console.log("Project is already up to date. No files were changed.");
    return { exitCode: 0 };
  }
  if (gitStatus?.dirty && !options.allowDirty) {
    throw new UpgradeStateError(
      "Refusing to apply in a dirty Git worktree. Use --allow-dirty only after reviewing the plan."
    );
  }
  if (gitStatus?.dirty && options.allowDirty) {
    console.log("WARNING: applying in a dirty Git worktree; the internal affected-path backup is active.");
  }

  if (!options.yes) {
    const confirmed = await confirmUpgrade();
    if (!confirmed) {
      console.log("Upgrade cancelled. No files were changed.");
      return { exitCode: 0 };
    }
  }
  applyUpgradePlan(plan, { noInstall: options.noInstall });
  console.log("\nUpgrade completed successfully. CLI-owned migration state is current.");
  return { exitCode: 0 };
}
