import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { getFrameworkAdapter } from "../core/frameworks/index.mjs";
import { spawnSyncSafe } from "../core/command-runner.mjs";
import {
  checkNodeVersion,
  checkPackageManagerVersion,
  getPackageManagerRequirement,
} from "../core/runtime-requirements.mjs";
import { loadPolicy } from "../core/policy.mjs";
import { evaluatePolicy } from "../core/policy-evaluate.mjs";
import { loadProjectConfig } from "../generator.mjs";
import { explainProject } from "./explain-project.mjs";

const REQUIRED_LAYERS = [
  "app",
  "pages",
  "widgets",
  "features",
  "entities",
  "shared",
];

function result(label, ok, detail) {
  return { label, ok, detail };
}

export function commandExists(command) {
  const probe = spawnSyncSafe(command, ["--version"], { encoding: "utf8" });
  return !probe.error && probe.status === 0;
}

export function commandVersion(command) {
  const probe = spawnSyncSafe(command, ["--version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) return null;
  return String(probe.stdout ?? "").trim().split(/\r?\n/)[0]?.trim() ?? null;
}

export function inspectProject(cwd = process.cwd(), { includeToolchain = false } = {}) {
  const checks = [];
  let config;

  try {
    config = loadProjectConfig(cwd);
    checks.push(result("FSD configuration", true, config.framework));
  } catch (error) {
    checks.push(result("FSD configuration", false, error.message));
    return { config: null, checks };
  }

  const packagePath = path.join(cwd, "package.json");
  checks.push(
    result(
      "package.json",
      fs.existsSync(packagePath),
      fs.existsSync(packagePath) ? "found" : "missing",
    ),
  );

  const sourceRoot = path.join(
    cwd,
    getFrameworkAdapter(config.framework).sourceDirectory,
  );
  for (const layer of REQUIRED_LAYERS) {
    const layerPath = path.join(sourceRoot, layer);
    checks.push(
      result(
        `FSD layer: ${layer}`,
        fs.existsSync(layerPath),
        path.relative(cwd, layerPath),
      ),
    );
  }

  if (includeToolchain) {
    const nodeCheck = checkNodeVersion(process.versions.node, { framework: config.framework });
    checks.push(
      result(
        "Node.js",
        nodeCheck.ok,
        nodeCheck.ok ? process.version : nodeCheck.message
      )
    );
    checks.push(result("Git", commandExists("git"), "required for generated repositories"));
    const packageManager = config.packageManager;
    const packageManagerRequirement = getPackageManagerRequirement(packageManager);
    const installedVersion = commandVersion(packageManager);
    const packageManagerCheck = checkPackageManagerVersion(packageManager, installedVersion);
    checks.push(
      result(
        packageManager,
        packageManagerCheck.ok,
        packageManagerCheck.ok
          ? `${installedVersion} — selected in fsd.config.json`
          : `${packageManagerCheck.message} ${packageManagerRequirement?.evidence ?? ""}`.trim()
      )
    );
  }

  return {
    config,
    checks,
    // Doctor reuses the slice-count summary from `fsd explain` so the
    // diagnosis also shows the size of the project it is checking.
    metrics: includeToolchain ? explainProject(cwd) : null,
  };
}

function printChecks(checks) {
  for (const check of checks) {
    const status = check.ok ? chalk.green("PASS") : chalk.red("FAIL");
    console.log(
      `  ${status}  ${check.label}${check.detail ? ` — ${check.detail}` : ""}`,
    );
  }
}

function printMetrics({ layers, total }) {
  console.log(chalk.bold("  Project metrics\n"));
  for (const { layer, slices, kind } of layers) {
    const noun = slices.length === 1 ? kind : `${kind}s`;
    const names = slices.length ? ` — ${slices.join(", ")}` : "";
    console.log(`  ${layer}: ${slices.length} ${noun}${names}`);
  }
  console.log(`\n  Total slices: ${total}\n`);
}

function printPolicyWarnings(warnings) {
  for (const warning of warnings) {
    console.log(
      `  ${chalk.yellow("WARN")}  Policy: ${warning.ruleId} — ${warning.message}`,
    );
  }
}

// Policy as Code (INT-36): `fsd check` loads `fsd.policy.ts` when present
// and evaluates it against the project source. When no policy file exists
// this returns no checks and `check` behaves exactly as before. Error
// violations become failing checks (so `check` exits non-zero); `warn`
// violations are reported but do not fail the run. An invalid policy file
// is a failing check, not a silent skip.
async function evaluateProjectPolicy(cwd, report) {
  const checks = [];
  const warnings = [];
  const { found, path: file, policy, errors } = await loadPolicy(cwd);
  if (!found) return { checks, warnings };

  const fileName = path.basename(file);
  if (errors.length) {
    checks.push(
      result(
        `Policy: ${fileName}`,
        false,
        errors.length === 1
          ? errors[0]
          : `${errors.length} errors — ${errors[0]}`,
      ),
    );
    return { checks, warnings };
  }

  const sourceRoot = path.join(
    cwd,
    getFrameworkAdapter(report.config.framework).sourceDirectory,
  );
  const { filesScanned, importsChecked, violations } = evaluatePolicy(
    policy,
    cwd,
    sourceRoot,
  );
  const errorViolations = violations.filter(
    (violation) => violation.severity === "error",
  );
  const warnViolations = violations.filter(
    (violation) => violation.severity === "warn",
  );
  for (const violation of errorViolations) {
    checks.push(result(`Policy: ${violation.ruleId}`, false, violation.message));
  }
  warnings.push(...warnViolations);
  if (!errorViolations.length) {
    const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
    checks.push(
      result(
        "Policy",
        true,
        `${fileName} — ${plural(policy.rules.length, "rule")} evaluated, ` +
          `${plural(filesScanned, "file")}, ${plural(importsChecked, "import")}, ` +
          `${plural(warnViolations.length, "warning")}`,
      ),
    );
  }
  return { checks, warnings };
}

export async function runProjectInspection(
  command,
  cwd = process.cwd(),
  { architecture = false } = {},
) {
  if (command === "config") {
    console.log(JSON.stringify(loadProjectConfig(cwd), null, 2));
    return;
  }

  const report = inspectProject(cwd, {
    includeToolchain: command === "doctor",
  });

  let policyWarnings = [];
  if (command === "check" && report.config) {
    const policyOutcome = await evaluateProjectPolicy(cwd, report);
    report.checks.push(...policyOutcome.checks);
    policyWarnings = policyOutcome.warnings;
  }

  console.log(chalk.bold(`\n  FSD ${command}\n`));
  printChecks(report.checks);
  printPolicyWarnings(policyWarnings);
  console.log();
  if (command === "doctor" && report.metrics) {
    printMetrics(report.metrics);
  }

  const failures = report.checks.filter((check) => !check.ok);
  if (failures.length) {
    throw new Error(
      `${failures.length} ${command} check${failures.length === 1 ? "" : "s"} failed.`,
    );
  }
  if (!architecture) {
    console.log(
      "  Scope: configuration, layers and optional toolchain only. Use check --architecture for installed Steiger checks.",
    );
    return;
  }
  const steiger = path.join(
    cwd,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "steiger.cmd" : "steiger",
  );
  if (!fs.existsSync(steiger))
    throw new Error(
      "Install steiger and @feature-sliced/steiger-plugin in this project before using --architecture. No packages are downloaded automatically.",
    );
  const sourceRoot = path.join(
    cwd,
    getFrameworkAdapter(report.config.framework).sourceDirectory,
  );
  const validation = spawnSyncSafe(steiger, [sourceRoot], {
    cwd,
    stdio: "inherit",
  });
  if (validation.error || validation.status !== 0)
    throw new Error(
      `Steiger architecture validation failed (${validation.status ?? validation.error?.message}).`,
    );
}
