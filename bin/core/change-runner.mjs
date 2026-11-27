// Verified change runner (INT-03).
//
// A standalone transaction engine for in-place project changes: snapshot the
// affected files first, apply the change, verify it, then commit it
// permanently on success or roll back to the snapshot on failure.
//
// This is the internal engine other commands use. It is deliberately not a
// CLI command: callers drive it through the module API below.
//
// The snapshot mechanics generalize the upgrade transaction
// (bin/upgrade/transaction.mjs) — per-file backups under `.fsd/backups`,
// atomic writes via temp file + rename, path confinement to the project
// root — instead of duplicating them. The upgrade transaction stays the
// owner of upgrade-specific preconditions; this runner adds the verify step
// and the commit/rollback orchestration around it.
//
// Lifecycle:
//   const runner = new ChangeRunner(root, { files: ["src/app/index.ts"] });
//   runner.begin();                    // snapshot declared files
//   runner.write("src/app/index.ts", next);
//   const verification = await runner.verify();   // `fsd check` by default
//   if (verification.ok) runner.commit();         // backups discarded
//   else runner.rollback();                       // snapshot restored
//
// Or in one call:
//   await runVerifiedChange(root, { files, apply, verify });
//
// "Commit" here means "make the change permanent" (discard the snapshot).
// It never creates a Git commit.

import fs from "node:fs";
import path from "node:path";
import { spawnSyncSafe } from "./command-runner.mjs";
import { normalizeRelativePath, resolveManagedPath } from "../upgrade/project-root.mjs";
import { UpgradeTransaction } from "../upgrade/transaction.mjs";

export class ChangeRunnerError extends Error {
  constructor(message) {
    super(message);
    this.name = "ChangeRunnerError";
    this.code = "CHANGE_RUNNER_ERROR";
  }
}

function normalizeVerifierResult(label, value) {
  if (typeof value === "boolean") return { label, ok: value, detail: "" };
  if (value && typeof value === "object" && typeof value.ok === "boolean") {
    return {
      label: typeof value.label === "string" && value.label ? value.label : label,
      ok: value.ok,
      detail: typeof value.detail === "string" ? value.detail : "",
    };
  }
  throw new ChangeRunnerError(
    `Verifier "${label}" must return a boolean or { ok, label?, detail? }.`
  );
}

// Default verifier: the `fsd check` semantics — the same inspection the CLI
// runs for `fsd check` (configuration, package.json, all six FSD layers).
// Loaded lazily so this core module never statically depends on a command
// module.
export async function verifyProjectCheck(root, runner) {
  const { inspectProject } = await import("../commands/inspect-project.mjs");
  const { checks } = inspectProject(root);
  const failed = checks.filter((check) => !check.ok);
  return {
    label: "fsd check",
    ok: failed.length === 0,
    detail:
      failed.length === 0
        ? `${checks.length} checks passed`
        : `failed: ${failed.map((check) => check.label).join(", ")}`,
  };
}

// Verifier factory for the affected tests, when running them is cheap:
// spawns `node --test <files>` inside the project and reports pass/fail.
// With no files it passes vacuously — callers only pass tests that cover
// the files the change touches.
export function verifyAffectedTests({ files = [], timeoutMs = 60_000 } = {}) {
  const label =
    files.length === 0 ? "affected tests" : `node --test ${files.join(" ")}`;
  return async (root) => {
    if (files.length === 0) {
      return { label, ok: true, detail: "no affected tests" };
    }
    // A caller running inside `node --test` inherits NODE_TEST_CONTEXT,
    // which makes a spawned `node --test` behave as a runner child and
    // report exit code 0 even when tests fail. Strip it so the spawned
    // run is standalone and its exit code means what it says.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const probe = spawnSyncSafe("node", ["--test", ...files], {
      cwd: root,
      encoding: "utf8",
      timeout: timeoutMs,
      env,
    });
    if (probe.error) {
      return { label, ok: false, detail: `could not run tests: ${probe.error.message}` };
    }
    const output = `${probe.stdout ?? ""}${probe.stderr ?? ""}`.trim();
    if (probe.status === 0) {
      return { label, ok: true, detail: "tests passed" };
    }
    const lines = output.split(/\r?\n/);
    const errorLines = lines.filter((line) => /Error:/.test(line)).slice(0, 2);
    const summaryLines = lines.filter((line) => /✖|not ok/.test(line)).slice(0, 1);
    const relevant = [...errorLines, ...summaryLines];
    const detail =
      relevant.length > 0 ? relevant.join(" ").trim() : lines.slice(-3).join(" ").trim();
    return { label, ok: false, detail: detail || `exit code ${probe.status}` };
  };
}

export class ChangeRunner {
  constructor(root, { files = [], failureInjection } = {}) {
    if (typeof root !== "string" || !root) {
      throw new ChangeRunnerError("ChangeRunner requires a project root path.");
    }
    this.root = fs.realpathSync(root);
    this.declaredFiles = [...new Set(files.map((file) => normalizeRelativePath(file)))].sort();
    this.failureInjection = failureInjection;
    this.transaction = new UpgradeTransaction(this.root, this.declaredFiles, {
      failureInjection,
    });
    this.state = "idle";
  }

  begin() {
    if (this.state !== "idle") {
      throw new ChangeRunnerError(`Cannot begin a change in state "${this.state}".`);
    }
    this.transaction.begin();
    this.state = "active";
    return this;
  }

  assertActive() {
    if (this.state !== "active") {
      throw new ChangeRunnerError(`Change runner is not active (state "${this.state}").`);
    }
  }

  assertDeclared(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    if (!this.declaredFiles.includes(normalized)) {
      throw new ChangeRunnerError(
        `Refusing to touch ${normalized}: it was not declared (and snapshotted) up front.`
      );
    }
    return normalized;
  }

  // Atomic write (temp file + rename) of a declared file. Content may be a
  // string or a Buffer.
  write(relativePath, content, mode) {
    this.assertActive();
    const normalized = this.assertDeclared(relativePath);
    this.transaction.writeAtomically(normalized, content, mode);
    return this;
  }

  delete(relativePath) {
    this.assertActive();
    const normalized = this.assertDeclared(relativePath);
    const target = resolveManagedPath(this.root, normalized);
    if (fs.existsSync(target)) {
      if (!fs.lstatSync(target).isFile()) {
        throw new ChangeRunnerError(`Refusing to delete non-file path: ${normalized}`);
      }
      fs.unlinkSync(target);
    }
    return this;
  }

  read(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    return fs.readFileSync(resolveManagedPath(this.root, normalized), "utf8");
  }

  exists(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    return fs.existsSync(resolveManagedPath(this.root, normalized));
  }

  // Run every verifier (default: `fsd check`) against the changed project
  // and collect the full report. A verifier that throws counts as failed;
  // the rest still run so the caller sees every failure at once.
  async verify(verifiers = [verifyProjectCheck]) {
    this.assertActive();
    const list = Array.isArray(verifiers) ? verifiers : [verifiers];
    const results = [];
    for (const verifier of list) {
      const label = verifier.name || "verifier";
      try {
        results.push(normalizeVerifierResult(label, await verifier(this.root, this)));
      } catch (error) {
        results.push({ label, ok: false, detail: error.message });
      }
    }
    return { ok: results.every((result) => result.ok), results };
  }

  commit() {
    this.assertActive();
    this.transaction.commit();
    this.state = "committed";
    return { ok: true };
  }

  // Best-effort restore of the snapshot. Returns { ok } on success and
  // { ok: false, error } when the restore itself could not complete — the
  // caller must surface that, because the project may be half-restored.
  rollback() {
    if (this.state === "committed") {
      throw new ChangeRunnerError("Cannot roll back a committed change.");
    }
    if (this.state === "rolled-back") return { ok: true };
    if (this.state === "idle") return { ok: true };
    const result = this.transaction.rollback();
    this.state = "rolled-back";
    return result;
  }
}

// One-shot form: begin → apply → verify → commit, rolling back on any
// failure (a throwing apply, a failing verifier, or a failing commit).
// Never throws for a failed change: the outcome is in the returned object.
// `verify` may be a single verifier, a list, or omitted (default `fsd check`).
export async function runVerifiedChange(
  root,
  { files = [], apply, verify, failureInjection } = {}
) {
  if (typeof apply !== "function") {
    throw new ChangeRunnerError("runVerifiedChange requires an apply function.");
  }
  const runner = new ChangeRunner(root, { files, failureInjection });
  runner.begin();
  try {
    await apply(runner);
  } catch (error) {
    return { ok: false, status: "rolled-back", error, rollback: runner.rollback() };
  }
  let verification;
  try {
    verification = await runner.verify(verify === undefined ? undefined : verify);
  } catch (error) {
    return { ok: false, status: "rolled-back", error, rollback: runner.rollback() };
  }
  if (!verification.ok) {
    return { ok: false, status: "rolled-back", verification, rollback: runner.rollback() };
  }
  try {
    runner.commit();
  } catch (error) {
    return { ok: false, status: "rolled-back", error, rollback: runner.rollback() };
  }
  return { ok: true, status: "committed", verification };
}
