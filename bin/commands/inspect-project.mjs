import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import chalk from "chalk";
import { getFrameworkAdapter } from "../core/frameworks/index.mjs";
import { loadProjectConfig } from "../generator.mjs";

const REQUIRED_LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];

function result(label, ok, detail) {
  return { label, ok, detail };
}

function commandExists(command) {
  const probe = spawnSync(command, ["--version"], { encoding: "utf8", shell: false });
  return !probe.error && probe.status === 0;
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
      fs.existsSync(packagePath) ? "found" : "missing"
    )
  );

  const sourceRoot = path.join(
    cwd,
    getFrameworkAdapter(config.framework).sourceDirectory
  );
  for (const layer of REQUIRED_LAYERS) {
    const layerPath = path.join(sourceRoot, layer);
    checks.push(
      result(`FSD layer: ${layer}`, fs.existsSync(layerPath), path.relative(cwd, layerPath))
    );
  }

  if (includeToolchain) {
    const major = Number(process.versions.node.split(".")[0]);
    checks.push(result("Node.js", major >= 20, process.version));
    checks.push(result("Git", commandExists("git"), "required for generated repositories"));
    checks.push(
      result(
        config.packageManager,
        commandExists(config.packageManager),
        `selected in fsd.config.json`
      )
    );
  }

  return { config, checks };
}

function printChecks(checks) {
  for (const check of checks) {
    const status = check.ok ? chalk.green("PASS") : chalk.red("FAIL");
    console.log(`  ${status}  ${check.label}${check.detail ? ` — ${check.detail}` : ""}`);
  }
}

export async function runProjectInspection(command, cwd = process.cwd()) {
  if (command === "config") {
    console.log(JSON.stringify(loadProjectConfig(cwd), null, 2));
    return;
  }

  const report = inspectProject(cwd, { includeToolchain: command === "doctor" });
  console.log(chalk.bold(`\n  FSD ${command}\n`));
  printChecks(report.checks);
  console.log();

  const failures = report.checks.filter((check) => !check.ok);
  if (failures.length) {
    throw new Error(`${failures.length} ${command} check${failures.length === 1 ? "" : "s"} failed.`);
  }
}
