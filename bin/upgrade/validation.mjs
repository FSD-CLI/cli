import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getFrameworkAdapter } from "../core/frameworks/index.mjs";
import { getInstallCommand, getRunScriptCommand } from "../core/package-managers.mjs";
import { getManagedProjectArtifacts } from "../project-config.mjs";
import { readProjectConfig, UpgradeStateError } from "./config.mjs";
import { readJson, readMarkerRegion, readManifest, readUtf8, sha256 } from "./manifest.mjs";
import { resolveManagedPath } from "./project-root.mjs";

const REQUIRED_LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];

function validateManagedHashes(projectRoot, manifest) {
  for (const [relativePath, entry] of Object.entries(manifest.managedFiles)) {
    const target = resolveManagedPath(projectRoot, relativePath);
    if (!fs.existsSync(target)) {
      throw new UpgradeStateError(`Manifest-tracked file is missing after upgrade: ${relativePath}`);
    }
    if (sha256(readUtf8(projectRoot, relativePath)) !== entry.contentHash) {
      throw new UpgradeStateError(`Managed file hash mismatch after upgrade: ${relativePath}`);
    }
  }

  const artifacts = getManagedProjectArtifacts(readProjectConfig(projectRoot));
  for (const [key, entry] of Object.entries(manifest.markerRegions)) {
    const [relativePath, markerName] = key.split("#", 2);
    const definition = artifacts.markerRegions[relativePath];
    if (!definition || definition.start !== markerName) {
      throw new UpgradeStateError(`Manifest contains unknown marker region: ${key}`);
    }
    const content = readUtf8(projectRoot, relativePath);
    const region = readMarkerRegion(content, definition.start, definition.end);
    if (sha256(region.content) !== entry.contentHash) {
      throw new UpgradeStateError(`Managed marker hash mismatch after upgrade: ${key}`);
    }
  }

  const packageJson = readJson(projectRoot, "package.json");
  for (const [key, entry] of Object.entries(manifest.managedPackageEntries)) {
    const [section, name] = key.split(":", 2);
    if (packageJson[section]?.[name] !== entry.value) {
      throw new UpgradeStateError(`Managed dependency mismatch after upgrade: ${key}`);
    }
  }
}

export function validateProjectStructure(projectRoot) {
  const config = readProjectConfig(projectRoot);
  const adapter = getFrameworkAdapter(config.framework);
  for (const layer of REQUIRED_LAYERS) {
    const layerPath = path.join(projectRoot, adapter.sourceDirectory, layer);
    if (!fs.existsSync(layerPath) || !fs.lstatSync(layerPath).isDirectory()) {
      throw new UpgradeStateError(`Required FSD layer is missing: ${path.relative(projectRoot, layerPath)}`);
    }
  }
  readJson(projectRoot, "package.json");
  return config;
}

export function validateUpgradedProject(projectRoot) {
  const config = validateProjectStructure(projectRoot);
  const manifest = readManifest(projectRoot);
  if (!manifest) throw new UpgradeStateError("Ownership manifest is missing after upgrade.");
  validateManagedHashes(projectRoot, manifest);
  return { config, manifest };
}

export function assertPackageManagerAvailable(packageManager, runner = spawnSync) {
  const result = runner(packageManager, ["--version"], { encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) {
    throw new UpgradeStateError(`Selected package manager is unavailable: ${packageManager}.`);
  }
}

function runCommand(command, args, projectRoot, runner) {
  console.log(`  $ ${command} ${args.join(" ")}`);
  const result = runner(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    const detail = [result.stdout, result.stderr, result.error?.message]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      `Command failed (${command} ${args.join(" ")}) with exit status ${result.status ?? "unknown"}.${
        detail ? `\n${detail}` : ""
      }`
    );
  }
}

export function installAndValidateDependencies(projectRoot, config, runner = spawnSync) {
  assertPackageManagerAvailable(config.packageManager, runner);
  const install = getInstallCommand(config.packageManager);
  runCommand(install.command, install.args, projectRoot, runner);
  const packageJson = readJson(projectRoot, "package.json");
  for (const script of ["lint", "typecheck", "test", "build"]) {
    if (!packageJson.scripts?.[script]) continue;
    const command = getRunScriptCommand(config.packageManager, script);
    runCommand(command.command, command.args, projectRoot, runner);
  }
}
