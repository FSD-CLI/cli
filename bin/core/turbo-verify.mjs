// Turborepo caching verification (MONO-08).
//
// `fsd turbo` writes turbo.json; this module checks that the file Turborepo
// will actually run against is usable and that caching will work for the
// workspace as it stands today:
//
// - the config parses and matches what the generator promises
//   (readTurboConfig / validateTurboConfig from MONO-07),
// - the build task has caching enabled (a build with `cache: false` caches
//   nothing, which defeats the point of the file),
// - every app member's framework build output is declared, so Turborepo can
//   restore it from cache (a hand-edited turbo.json that drops `.next/**`
//   silently stops caching a Next.js app),
// - no member is missing the `build` script the pipeline runs (Turborepo
//   skips such a member without an error, so nothing is ever cached for it),
// - the workspace does not also carry nx.json (Turborepo or Nx, not both).
//
// The live half is `runTurboDryRun`: when a `turbo` binary is on PATH it
// runs `turbo build --dry-run=json` against the workspace, which proves
// Turborepo itself loads the config and resolves the packages and tasks.
// When no binary is available the static checks still run and the dry run
// is reported as skipped — verification never requires Turborepo to be
// installed.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  discoverWorkspaceMembers,
  readTurboConfig,
  validateTurboConfig,
} from "./turbo-config.mjs";

// Build outputs Turborepo must be able to restore, keyed by the app
// framework id in fsd.config.json. Mirrors the generator's
// FRAMEWORK_BUILD_OUTPUTS in turbo-config.mjs; `dist/**` is the default
// output for every other framework and is always declared by the
// generator, so it needs no per-member check here.
const FRAMEWORK_BUILD_OUTPUTS = {
  nextjs: ".next/**",
  nuxt: ".output/**",
};

function readMemberScripts(memberDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(memberDir, "package.json"), "utf8"));
    return pkg && typeof pkg === "object" && pkg.scripts && typeof pkg.scripts === "object"
      ? pkg.scripts
      : {};
  } catch {
    return {};
  }
}

/**
 * Verifies a workspace's turbo.json against the workspace as it stands.
 * Never throws for a bad config: a missing file or invalid JSON is reported
 * as an issue, so the command can print every problem at once.
 *
 * @param {string} root workspace root
 * @returns {{ok: boolean, issues: string[], warnings: string[], members: ReturnType<typeof discoverWorkspaceMembers>, config: object|null}}
 */
export function verifyTurboSetup(root) {
  let config = null;
  let issues = [];
  try {
    const read = readTurboConfig(root);
    config = read.config;
    issues = [...read.issues];
  } catch (error) {
    return { ok: false, issues: [error.message], warnings: [], members: [], config: null };
  }

  const build = config.tasks?.build;
  if (build && typeof build === "object" && build.cache === false) {
    issues.push(
      `the "build" task sets "cache" to false, so Turborepo never caches a build. Remove "cache" from the "build" task or regenerate with: fsd turbo --force`,
    );
  }

  if (fs.existsSync(path.join(root, "nx.json"))) {
    issues.push(
      `nx.json exists in ${root}: a workspace uses Turborepo or Nx, not both. Remove nx.json to verify against Turborepo.`,
    );
  }

  const members = discoverWorkspaceMembers(root);
  const outputs = Array.isArray(build?.outputs) ? build.outputs : [];
  const warnings = [];
  for (const member of members) {
    const expected = FRAMEWORK_BUILD_OUTPUTS[member.framework ?? ""];
    if (expected && !outputs.includes(expected)) {
      issues.push(
        `the "build" task outputs are missing "${expected}" for the ${member.framework} app ${member.dir} — its build output would never be cached.`,
      );
    }
    const scripts = readMemberScripts(path.join(root, member.dir));
    if (typeof scripts.build !== "string") {
      warnings.push(
        `member ${member.dir} has no "build" script, so "turbo build" skips it and nothing is cached for it.`,
      );
    }
  }

  return { ok: issues.length === 0, issues, warnings, members, config };
}

/**
 * Locates a `turbo` binary: TURBO_BIN when set, otherwise `turbo` on PATH.
 * Returns null when no binary resolves, so callers can skip the live run.
 */
export function findTurboBinary() {
  if (process.env.TURBO_BIN) return process.env.TURBO_BIN;
  const probe = spawnSync("turbo", ["--version"], { encoding: "utf8", timeout: 10000 });
  return probe.error || probe.status !== 0 ? null : "turbo";
}

/**
 * Runs `turbo build --dry-run=json` in a workspace and reports what
 * Turborepo resolved. Throws when the binary runs but exits non-zero or
 * its output is not JSON — a config Turborepo cannot load is a failed
 * verification, not a skipped one.
 *
 * @param {string} root workspace root
 * @param {{turboBin?: string|null}} options resolved binary; null skips the run
 * @returns {{available: boolean, packages?: number, tasks?: number, reason?: string}}
 */
export function runTurboDryRun(root, { turboBin = findTurboBinary() } = {}) {
  if (!turboBin) {
    return { available: false, reason: "no turbo binary found on PATH" };
  }
  const result = spawnSync(turboBin, ["build", "--dry-run=json"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });
  if (result.error) {
    throw new Error(`Could not run "${turboBin} build --dry-run=json": ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `"${turboBin} build --dry-run=json" failed (exit ${result.status}): ${(result.stderr || result.stdout || "").trim()}`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `"${turboBin} build --dry-run=json" printed output that is not JSON, so its task graph could not be verified.`,
    );
  }
  return {
    available: true,
    packages: Array.isArray(parsed.packages) ? parsed.packages.length : 0,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.length : 0,
  };
}
