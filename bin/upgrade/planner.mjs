import fs from "node:fs";
import {
  createHuskyHooks,
} from "../core/project-lifecycle.mjs";
import { getManagedProjectArtifacts } from "../project-config.mjs";
import { UpgradeStateError } from "./config.mjs";
import {
  emptyManifest,
  getCommitlintDependencyEntries,
  getManagedDependencyEntries,
  getPnpmWorkspaceContent,
  MANIFEST_PATH,
  readJson,
  readMarkerRegion,
  readUtf8,
  renderMarkerRegion,
  serializeManifest,
  sha256,
  validateManifest,
} from "./manifest.mjs";
import {
  CURRENT_UPGRADE_STATE_VERSION,
  MIGRATIONS,
  selectMigrationPath,
} from "./migrations/index.mjs";
import { normalizeRelativePath, resolveManagedPath } from "./project-root.mjs";

export const OPERATION_STATUSES = Object.freeze([
  "CREATE",
  "UPDATE",
  "ALREADY_APPLIED",
  "PRESERVE",
  "CONFLICT",
  "MANUAL",
  "DELETE",
]);

function addOperation(operations, status, relativePath, reason, details = {}) {
  if (!OPERATION_STATUSES.includes(status)) {
    throw new UpgradeStateError(`Unknown upgrade operation status: ${status}`);
  }
  operations.push({
    status,
    path: relativePath,
    reason,
    ...details,
  });
}

function legacyManifest(config, cliVersion) {
  const manifest = emptyManifest(config, "legacy", 1);
  manifest.lastUpgradedWithCliVersion = cliVersion;
  manifest.appliedMigrations = [];
  return manifest;
}

function addTrackedFile(manifest, relativePath, owner, content) {
  manifest.managedFiles[normalizeRelativePath(relativePath)] = {
    owner,
    contentHash: sha256(content),
  };
}

function addTrackedMarker(manifest, relativePath, markerName, owner, content) {
  manifest.markerRegions[`${normalizeRelativePath(relativePath)}#${markerName}`] = {
    owner,
    contentHash: sha256(content),
  };
}

function fileExists(projectRoot, relativePath) {
  return fs.existsSync(resolveManagedPath(projectRoot, relativePath));
}

function legacyHuskyHooks(packageManager) {
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
  return {
    "pre-commit": `${run("lint")}\ngit diff --check\n${run("build")}\n`,
    "commit-msg": `#!/bin/sh\n${execCommitlint}\n`,
    "pre-push": `${run("build")}\n`,
  };
}

function inspectManagedFile({
  projectRoot,
  relativePath,
  target,
  owner,
  manifest,
  targetManifest,
  operations,
  allowUpdate = false,
  allowCreate = false,
  allowRecordedContent = false,
  legacyBase,
}) {
  const entry = manifest?.managedFiles[relativePath];
  if (!fileExists(projectRoot, relativePath)) {
    if (allowCreate) {
      addOperation(operations, "CREATE", relativePath, "A new CLI-owned tooling file will be created.", {
        content: target,
      });
      addTrackedFile(targetManifest, relativePath, owner, target);
    } else {
      addOperation(
        operations,
        "MANUAL",
        relativePath,
        "A required CLI-managed file is missing, so ownership cannot be proven."
      );
    }
    return;
  }

  const current = readUtf8(projectRoot, relativePath);
  const currentHash = sha256(current);
  if (current === target) {
    addOperation(operations, "ALREADY_APPLIED", relativePath, "Current content already matches the target.");
    addTrackedFile(targetManifest, relativePath, owner, current);
    return;
  }
  if (entry && currentHash === entry.contentHash && allowRecordedContent) {
    addOperation(
      operations,
      "ALREADY_APPLIED",
      relativePath,
      "Verified managed content includes CLI-generated registrations."
    );
    addTrackedFile(targetManifest, relativePath, owner, current);
    return;
  }
  if (entry && currentHash === entry.contentHash && allowUpdate) {
    addOperation(operations, "UPDATE", relativePath, "Verified managed content will be updated.", {
      content: target,
      current,
    });
    addTrackedFile(targetManifest, relativePath, owner, target);
    return;
  }
  if (!entry && legacyBase !== undefined && current === legacyBase && allowUpdate) {
    addOperation(operations, "UPDATE", relativePath, "Matched a released legacy CLI signature.", {
      content: target,
      current,
    });
    addTrackedFile(targetManifest, relativePath, owner, target);
    return;
  }
  if (entry && currentHash !== entry.contentHash) {
    addOperation(
      operations,
      "CONFLICT",
      relativePath,
      "Current content differs from the manifest-recorded managed hash."
    );
    return;
  }
  addOperation(
    operations,
    "CONFLICT",
    relativePath,
    entry
      ? "The managed file differs from both its recorded base and the migration target."
      : "Legacy ownership cannot be proven because the file does not match a released CLI signature."
  );
}

function inspectMarker({ projectRoot, relativePath, definition, manifest, targetManifest, operations }) {
  const manifestKey = `${relativePath}#${definition.start}`;
  let current;
  let target;
  try {
    const file = readUtf8(projectRoot, relativePath);
    current = readMarkerRegion(file, definition.start, definition.end).content;
    target = renderMarkerRegion(file, definition);
  } catch (error) {
    addOperation(operations, "CONFLICT", relativePath, error.message);
    return;
  }

  const entry = manifest?.markerRegions[manifestKey];
  if (current === target) {
    addOperation(operations, "ALREADY_APPLIED", relativePath, "The CLI marker region already matches the target.");
    addTrackedMarker(targetManifest, relativePath, definition.start, definition.owner, current);
    return;
  }
  if (entry && sha256(current) !== entry.contentHash) {
    addOperation(
      operations,
      "CONFLICT",
      relativePath,
      "The CLI-managed marker region was modified after it was recorded."
    );
    return;
  }
  addOperation(
    operations,
    "CONFLICT",
    relativePath,
    entry
      ? "Marker content differs from the target without a migration that can safely rewrite it."
      : "Legacy marker content does not match a released CLI signature."
  );
}

function inspectDependencies({ projectRoot, config, manifest, targetManifest, operations }) {
  const packageJson = readJson(projectRoot, "package.json");
  const expected = {
    ...getManagedDependencyEntries(config),
    ...getCommitlintDependencyEntries(),
  };
  const managedEntries = manifest?.managedPackageEntries ?? expected;
  const keys = new Set(Object.keys(managedEntries));

  for (const key of [...keys].sort((left, right) => left.localeCompare(right))) {
    const entry = managedEntries[key];
    if (!entry) continue;
    const [section, name] = key.split(":", 2);
    const actual = packageJson[section]?.[name];
    if (actual === entry.value) {
      targetManifest.managedPackageEntries[key] = entry;
      addOperation(operations, "ALREADY_APPLIED", "package.json", `${key} matches its managed value.`);
      continue;
    }
    addOperation(
      operations,
      "CONFLICT",
      "package.json",
      `${key} is ${actual === undefined ? "missing" : `"${actual}"`} instead of its managed value "${entry.value}".`
    );
  }
  addOperation(
    operations,
    "PRESERVE",
    "package.json",
    "Unmanaged dependencies, scripts, and metadata will remain untouched."
  );
}

function inspectUnplannedManifestFiles({ projectRoot, manifest, knownPaths, operations }) {
  if (!manifest) return;
  for (const [relativePath, entry] of Object.entries(manifest.managedFiles)) {
    if (knownPaths.has(relativePath)) continue;
    if (!fileExists(projectRoot, relativePath)) {
      addOperation(operations, "CONFLICT", relativePath, "A manifest-tracked managed file is missing.");
      continue;
    }
    const actual = readUtf8(projectRoot, relativePath);
    if (sha256(actual) !== entry.contentHash) {
      addOperation(
        operations,
        "CONFLICT",
        relativePath,
        "Current content differs from the manifest-recorded managed hash."
      );
    } else {
      addOperation(operations, "PRESERVE", relativePath, "Verified managed content has no migration in this run.");
    }
  }
}

export function createUpgradePlan({ projectRoot, config, manifest, cliVersion }) {
  if (manifest && (manifest.framework !== config.framework || manifest.configSchemaVersion !== config.schemaVersion)) {
    throw new UpgradeStateError("Manifest framework or configuration schema does not match fsd.config.json.");
  }
  const currentState = manifest?.stateVersion ?? 0;
  if (manifest) {
    const expectedMigrations = selectMigrationPath(0, currentState).map((migration) => migration.id);
    const knownMigrations = new Set(MIGRATIONS.map((migration) => migration.id));
    if (
      manifest.appliedMigrations.some((id) => !knownMigrations.has(id)) ||
      manifest.appliedMigrations.length !== expectedMigrations.length ||
      expectedMigrations.some((id, index) => manifest.appliedMigrations[index] !== id)
    ) {
      throw new UpgradeStateError("Manifest migration history is inconsistent with its managed state.");
    }
  }
  const migrationPath = selectMigrationPath(currentState);
  const targetManifest = manifest ? structuredClone(manifest) : legacyManifest(config, cliVersion);
  const operations = [];
  const knownPaths = new Set(["fsd.config.json"]);

  if (manifest?.managedFiles["fsd.config.json"]) {
    const currentConfig = readUtf8(projectRoot, "fsd.config.json");
    if (sha256(currentConfig) !== manifest.managedFiles["fsd.config.json"].contentHash) {
      addOperation(
        operations,
        "CONFLICT",
        "fsd.config.json",
        "Current configuration differs from the manifest-recorded managed hash."
      );
    } else {
      addOperation(operations, "ALREADY_APPLIED", "fsd.config.json", "Configuration schema is current.");
      addTrackedFile(targetManifest, "fsd.config.json", "project-config/fsd-config", currentConfig);
    }
  } else {
    const currentConfig = readUtf8(projectRoot, "fsd.config.json");
    addOperation(operations, "ALREADY_APPLIED", "fsd.config.json", "Validated current configuration schema.");
    addTrackedFile(targetManifest, "fsd.config.json", "project-config/fsd-config", currentConfig);
  }

  const artifacts = getManagedProjectArtifacts(config);
  for (const [relativePath, target] of Object.entries(artifacts.files)) {
    knownPaths.add(relativePath);
    inspectManagedFile({
      projectRoot,
      relativePath,
      target,
      owner: "project-config/generated",
      manifest,
      targetManifest,
      operations,
      allowRecordedContent: artifacts.mutableFiles?.includes(relativePath),
    });
  }
  for (const [relativePath, definition] of Object.entries(artifacts.markerRegions)) {
    inspectMarker({
      projectRoot,
      relativePath,
      definition,
      manifest,
      targetManifest,
      operations,
    });
  }
  inspectDependencies({ projectRoot, config, manifest, targetManifest, operations });

  const toolingPlanned = migrationPath.some((migration) => migration.id === "tooling-hardening-v1");
  const planToolingMigration = () => {
    const targetHooks = createHuskyHooks(config.packageManager);
    const previousHooks = legacyHuskyHooks(config.packageManager);
    for (const [name, target] of Object.entries(targetHooks)) {
      const relativePath = `.husky/${name}`;
      knownPaths.add(relativePath);
      inspectManagedFile({
        projectRoot,
        relativePath,
        target,
        owner: "project-lifecycle/husky",
        manifest,
        targetManifest,
        operations,
        allowUpdate: true,
        legacyBase: previousHooks[name],
      });
    }

    if (config.packageManager === "pnpm") {
      const relativePath = "pnpm-workspace.yaml";
      knownPaths.add(relativePath);
      inspectManagedFile({
        projectRoot,
        relativePath,
        target: getPnpmWorkspaceContent(config.framework),
        owner: "project-config/pnpm-build-policy",
        manifest,
        targetManifest,
        operations,
        allowCreate: true,
      });
    }
    return [];
  };
  if (toolingPlanned) {
    for (const migration of migrationPath) {
      if (!migration.frameworks.includes(config.framework)) {
        throw new UpgradeStateError(`${migration.id} does not support ${config.framework}.`);
      }
      migration.plan({ planToolingMigration });
    }
  }

  inspectUnplannedManifestFiles({ projectRoot, manifest, knownPaths, operations });
  addOperation(
    operations,
    "PRESERVE",
    "application code",
    "Features, entities, widgets, pages, components, styles, routes, and environment files are not CLI-owned."
  );

  if (migrationPath.length) {
    targetManifest.stateVersion = CURRENT_UPGRADE_STATE_VERSION;
    targetManifest.lastUpgradedWithCliVersion = cliVersion;
    targetManifest.appliedMigrations = [
      ...new Set([...targetManifest.appliedMigrations, ...migrationPath.map((migration) => migration.id)]),
    ];
    validateManifest(targetManifest);
    addOperation(
      operations,
      manifest ? "UPDATE" : "CREATE",
      MANIFEST_PATH,
      manifest
        ? "Migration state will be committed only after validation succeeds."
        : "A new ownership manifest will be created after all safety checks succeed.",
      {
        content: serializeManifest(targetManifest),
        current: manifest ? readUtf8(projectRoot, MANIFEST_PATH) : undefined,
        mode: 0o600,
      }
    );
  }

  const conflicts = operations.filter((operation) => operation.status === "CONFLICT");
  const manual = operations.filter((operation) => operation.status === "MANUAL");
  const writes = operations.filter((operation) =>
    ["CREATE", "UPDATE", "DELETE"].includes(operation.status)
  );
  return {
    projectRoot,
    config,
    manifest,
    currentState,
    targetState: CURRENT_UPGRADE_STATE_VERSION,
    migrationPath,
    operations,
    targetManifest,
    conflicts,
    manual,
    writes,
    legacy: !manifest,
    validations: [
      "fsd.config.json schema and capability validation",
      "framework adapter and required FSD layers",
      "package.json and managed dependency consistency",
      "managed-file hashes and marker integrity",
      "ownership manifest schema validation",
    ],
  };
}
