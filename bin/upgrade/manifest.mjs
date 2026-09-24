import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getFrameworkAdapter } from "../core/frameworks/index.mjs";
import {
  COMMITLINT_DEV_DEPENDENCIES,
  createHuskyHooks,
} from "../core/project-lifecycle.mjs";
import { getManagedProjectArtifacts } from "../project-config.mjs";
import { MANIFEST_SCHEMA, UpgradeStateError, validateJsonSchema } from "./config.mjs";
import { CURRENT_UPGRADE_STATE_VERSION, MIGRATIONS } from "./migrations/index.mjs";
import { normalizeRelativePath, resolveManagedPath } from "./project-root.mjs";

export const MANIFEST_PATH = ".fsd/manifest.json";

export function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

export function readUtf8(projectRoot, relativePath) {
  return fs.readFileSync(resolveManagedPath(projectRoot, relativePath), "utf8");
}

export function readJson(projectRoot, relativePath) {
  try {
    return JSON.parse(readUtf8(projectRoot, relativePath));
  } catch (error) {
    throw new UpgradeStateError(`Unable to read ${relativePath}: ${error.message}`);
  }
}

export function validateManifest(manifest) {
  validateJsonSchema(manifest, MANIFEST_SCHEMA, MANIFEST_PATH);
  for (const relativePath of Object.keys(manifest.managedFiles)) {
    assertManifestPath(relativePath);
  }
  for (const key of Object.keys(manifest.markerRegions)) {
    const parts = key.split("#");
    const [relativePath, markerName] = parts;
    assertManifestPath(relativePath);
    if (parts.length !== 2 || !markerName) {
      throw new UpgradeStateError(`Invalid marker manifest key: ${key}`);
    }
  }
  for (const key of Object.keys(manifest.managedPackageEntries)) {
    if (!/^(dependencies|devDependencies):[^:]+$/.test(key)) {
      throw new UpgradeStateError(`Invalid managed package entry: ${key}`);
    }
  }
  return manifest;
}

function assertManifestPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const segments = normalized.split("/");
  if (segments.includes("node_modules") || segments.some((segment) => segment.startsWith(".env"))) {
    throw new UpgradeStateError(`Manifest cannot record dependency or environment path: ${relativePath}`);
  }
  return normalized;
}

export function readManifest(projectRoot) {
  const manifestPath = resolveManagedPath(projectRoot, MANIFEST_PATH);
  if (!fs.existsSync(manifestPath)) return null;
  return validateManifest(readJson(projectRoot, MANIFEST_PATH));
}

export function writeManifestAtomically(projectRoot, manifest) {
  validateManifest(manifest);
  const target = resolveManagedPath(projectRoot, MANIFEST_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.fsd-upgrade-${process.pid}-${crypto.randomUUID()}.tmp`
  );
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

export function getManagedDependencyEntries(config) {
  const adapter = getFrameworkAdapter(config.framework);
  const selected = ["apiClient", "serverState", "clientState", "forms"].flatMap(
    (capability) => adapter.dependencies[capability]?.[config[capability]] ?? []
  );
  selected.push(...(adapter.baseDependencies ?? []));
  return Object.fromEntries(
    [...new Set(selected)].map((name) => [`dependencies:${name}`, {
      owner: "project-config/dependency",
      value: adapter.dependencyVersions[name],
    }])
  );
}

export function getCommitlintDependencyEntries() {
  return Object.fromEntries(
    Object.entries(COMMITLINT_DEV_DEPENDENCIES).map(([name, value]) => [
      `devDependencies:${name}`,
      { owner: "project-lifecycle/commitlint", value },
    ])
  );
}

export function getPnpmWorkspaceContent(framework) {
  const buildDependencies = {
    "react-vite": ["@swc/core", "esbuild"],
    nextjs: ["sharp", "unrs-resolver"],
    "vue-vite": ["esbuild", "vue-demi"],
    nuxt: ["esbuild", "unrs-resolver", "vue-demi"],
    sveltekit: ["esbuild"],
  }[framework];
  if (!buildDependencies) throw new UpgradeStateError(`Unknown framework "${framework}".`);
  return [
    "# pnpm >=10.26: only these framework build dependencies may run scripts.",
    "# Review new dependencies explicitly with pnpm approve-builds.",
    "strictDepBuilds: true",
    "allowBuilds:",
    ...buildDependencies.map((name) => `  ${JSON.stringify(name)}: true`),
    "",
  ].join("\n");
}

function markerOccurrences(content, marker) {
  const indexes = [];
  let index = content.indexOf(marker);
  while (index !== -1) {
    indexes.push(index);
    index = content.indexOf(marker, index + marker.length);
  }
  return indexes;
}

export function readMarkerRegion(content, start, end) {
  const starts = markerOccurrences(content, start);
  const ends = markerOccurrences(content, end);
  if (starts.length !== 1 || ends.length !== 1 || starts[0] >= ends[0]) {
    throw new UpgradeStateError(`Marker block ${start} / ${end} is missing, duplicated, or reordered.`);
  }
  const region = content.slice(starts[0] + start.length, ends[0]);
  if (region.includes(start) || region.includes(end)) {
    throw new UpgradeStateError(`Marker block ${start} / ${end} is nested or malformed.`);
  }
  return { content: region, startIndex: starts[0], endIndex: ends[0] };
}

export function renderMarkerRegion(content, definition) {
  const region = readMarkerRegion(content, definition.start, definition.end);
  const before = content.slice(0, region.startIndex);
  const indentation = before.match(/(^|\n)([ \t]*)$/)?.[2] ?? "";
  return definition.lines.length
    ? `\n${definition.lines.map((line) => `${indentation}${line}`).join("\n")}\n${indentation}`
    : `\n${indentation}`;
}

export function emptyManifest(config, cliVersion, stateVersion = CURRENT_UPGRADE_STATE_VERSION) {
  return {
    manifestVersion: 1,
    stateVersion,
    framework: config.framework,
    configSchemaVersion: config.schemaVersion,
    createdWithCliVersion: cliVersion,
    lastUpgradedWithCliVersion: cliVersion,
    appliedMigrations: MIGRATIONS.filter((migration) => migration.to <= stateVersion).map(
      (migration) => migration.id
    ),
    managedFiles: {},
    managedPackageEntries: {},
    markerRegions: {},
  };
}

function addFile(manifest, relativePath, owner, content) {
  manifest.managedFiles[normalizeRelativePath(relativePath)] = {
    owner,
    contentHash: sha256(content),
  };
}

export function createInitialManifest(projectRoot, config, cliVersion) {
  const manifest = emptyManifest(config, cliVersion);
  addFile(manifest, "fsd.config.json", "project-config/fsd-config", readUtf8(projectRoot, "fsd.config.json"));

  const artifacts = getManagedProjectArtifacts(config);
  for (const [relativePath, expected] of Object.entries(artifacts.files)) {
    const actual = readUtf8(projectRoot, relativePath);
    if (actual !== expected) {
      throw new UpgradeStateError(`Newly generated managed file differs from its renderer: ${relativePath}`);
    }
    addFile(manifest, relativePath, "project-config/generated", actual);
  }

  for (const [relativePath, definition] of Object.entries(artifacts.markerRegions)) {
    const current = readUtf8(projectRoot, relativePath);
    const region = readMarkerRegion(current, definition.start, definition.end);
    manifest.markerRegions[`${relativePath}#${definition.start}`] = {
      owner: definition.owner,
      contentHash: sha256(region.content),
    };
  }

  for (const [name, content] of Object.entries(createHuskyHooks(config.packageManager))) {
    const relativePath = `.husky/${name}`;
    if (readUtf8(projectRoot, relativePath) === content) {
      addFile(manifest, relativePath, "project-lifecycle/husky", content);
    }
  }
  const commitlintPath = "commitlint.config.cjs";
  if (
    fs.existsSync(resolveManagedPath(projectRoot, commitlintPath)) &&
    readUtf8(projectRoot, commitlintPath) ===
      "module.exports = { extends: ['@commitlint/config-conventional'] };\n"
  ) {
    addFile(manifest, commitlintPath, "project-lifecycle/commitlint", readUtf8(projectRoot, commitlintPath));
  }

  const packageJson = readJson(projectRoot, "package.json");
  for (const [key, entry] of Object.entries({
    ...getManagedDependencyEntries(config),
    ...getCommitlintDependencyEntries(),
  })) {
    const [section, name] = key.split(":", 2);
    if (packageJson[section]?.[name] === entry.value) {
      manifest.managedPackageEntries[key] = entry;
    }
  }
  return manifest;
}

export function writeInitialManifest(projectRoot, config, cliVersion) {
  const manifest = createInitialManifest(projectRoot, config, cliVersion);
  writeManifestAtomically(projectRoot, manifest);
  return manifest;
}
