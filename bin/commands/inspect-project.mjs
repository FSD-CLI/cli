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

function readPackageJson(cwd) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
  } catch {
    return {};
  }
}

function hasWorkspacesField(packageJson) {
  const workspaces = packageJson?.workspaces;
  if (Array.isArray(workspaces)) return workspaces.length > 0;
  if (workspaces && typeof workspaces === "object") {
    return (
      Array.isArray(workspaces.packages) && workspaces.packages.length > 0
    );
  }
  return false;
}

// Read-only detection of a monorepo layout. Returns null for a single
// package, otherwise the detected workspace tool and every signal found.
// Informational only: a monorepo is a supported layout, never a failure.
export function detectMonorepo(cwd) {
  const signals = [];
  if (fs.existsSync(path.join(cwd, "pnpm-workspace.yaml"))) {
    signals.push("pnpm-workspace.yaml");
  }
  const packageJson = readPackageJson(cwd);
  const hasWorkspaces = hasWorkspacesField(packageJson);
  if (hasWorkspaces) signals.push("package.json workspaces");
  if (fs.existsSync(path.join(cwd, "turbo.json"))) signals.push("turbo.json");
  if (fs.existsSync(path.join(cwd, "nx.json"))) signals.push("nx.json");
  if (fs.existsSync(path.join(cwd, "lerna.json"))) signals.push("lerna.json");
  try {
    if (fs.statSync(path.join(cwd, "apps")).isDirectory()) {
      signals.push("apps/ directory");
    }
  } catch {
    // No apps/ directory.
  }
  if (signals.length === 0) return null;
  const tool = signals.includes("pnpm-workspace.yaml")
    ? "pnpm workspaces"
    : hasWorkspaces
      ? "npm/yarn workspaces"
      : signals.includes("turbo.json")
        ? "Turborepo"
        : signals.includes("nx.json")
          ? "Nx"
          : signals.includes("lerna.json")
            ? "Lerna"
            : "apps/ layout";
  return { detected: true, tool, signals };
}

// Read-only detection of a mobile (Expo / React Native) project. Returns
// null for a plain web project, otherwise the detected setup and every
// signal found. Informational only, never a failure.
export function detectMobile(cwd) {
  const signals = [];
  const packageJson = readPackageJson(cwd);
  const dependencies = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
  };
  if (dependencies.expo) signals.push("expo dependency");
  if (dependencies["react-native"]) signals.push("react-native dependency");
  if (fs.existsSync(path.join(cwd, "app.json"))) signals.push("app.json");
  if (fs.existsSync(path.join(cwd, "app.config.js"))) {
    signals.push("app.config.js");
  }
  if (signals.length === 0) return null;
  const setup = dependencies.expo
    ? "Expo"
    : dependencies["react-native"]
      ? "React Native"
      : "Expo config";
  return { detected: true, setup, signals };
}

function monorepoCheck(monorepo) {
  return result(
    "Monorepo",
    true,
    monorepo
      ? `${monorepo.tool} — ${monorepo.signals.join(", ")}`
      : "not detected — single package",
  );
}

function mobileCheck(mobile) {
  return result(
    "Mobile project",
    true,
    mobile
      ? `${mobile.setup} — ${mobile.signals.join(", ")}`
      : "not detected — web project",
  );
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
  // Layout detection is independent of the FSD configuration, so it runs
  // first and is reported even when the configuration cannot be loaded.
  const monorepo = detectMonorepo(cwd);
  const mobile = detectMobile(cwd);

  try {
    config = loadProjectConfig(cwd);
    checks.push(result("FSD configuration", true, config.framework));
  } catch (error) {
    checks.push(result("FSD configuration", false, error.message));
    checks.push(monorepoCheck(monorepo));
    checks.push(mobileCheck(mobile));
    return { config: null, checks, monorepo, mobile };
  }

  checks.push(monorepoCheck(monorepo));
  checks.push(mobileCheck(mobile));

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
    monorepo,
    mobile,
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
  console.log(chalk.bold(`\n  FSD ${command}\n`));
  printChecks(report.checks);
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
