import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { UpgradeStateError } from "./config.mjs";
import { normalizeRelativePath, resolveManagedPath } from "./project-root.mjs";

function uniquePaths(paths) {
  return [...new Set(paths.map(normalizeRelativePath))].sort((left, right) =>
    left.localeCompare(right)
  );
}

export class UpgradeTransaction {
  constructor(projectRoot, affectedPaths, { failureInjection } = {}) {
    this.projectRoot = fs.realpathSync(projectRoot);
    this.affectedPaths = uniquePaths(affectedPaths);
    this.failureInjection = failureInjection;
    this.snapshots = new Map();
    this.backupLocation = null;
    this.started = false;
    this.finished = false;
  }

  begin() {
    if (this.started) throw new UpgradeStateError("Upgrade transaction has already started.");
    for (const relativePath of this.affectedPaths) resolveManagedPath(this.projectRoot, relativePath);

    const backupDirectory = resolveManagedPath(this.projectRoot, ".fsd/backups");
    fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
    this.backupLocation = path.join(
      backupDirectory,
      `upgrade-${process.pid}-${crypto.randomUUID()}`
    );
    fs.mkdirSync(this.backupLocation, { mode: 0o700 });

    const metadata = [];
    for (const [index, relativePath] of this.affectedPaths.entries()) {
      const target = resolveManagedPath(this.projectRoot, relativePath);
      if (!fs.existsSync(target)) {
        this.snapshots.set(relativePath, { exists: false });
        metadata.push({ relativePath, exists: false });
        continue;
      }
      const stat = fs.lstatSync(target);
      if (!stat.isFile()) {
        throw new UpgradeStateError(`Refusing to snapshot non-file path: ${relativePath}`);
      }
      const backupFile = `files/${index}`;
      fs.mkdirSync(path.join(this.backupLocation, "files"), { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(this.backupLocation, backupFile), fs.readFileSync(target), {
        mode: stat.mode & 0o777,
      });
      this.snapshots.set(relativePath, {
        exists: true,
        mode: stat.mode & 0o777,
        backupFile,
      });
      metadata.push({ relativePath, exists: true, mode: stat.mode & 0o777, backupFile });
    }
    fs.writeFileSync(
      path.join(this.backupLocation, "metadata.json"),
      `${JSON.stringify({ version: 1, paths: metadata }, null, 2)}\n`,
      { mode: 0o600 }
    );
    this.started = true;
    this.inject("after-backup");
    return this;
  }

  inject(stage, operation) {
    if (!this.failureInjection) return;
    const result = this.failureInjection({ stage, operation, transaction: this });
    if (result instanceof Error) throw result;
    if (result === true) throw new Error(`Injected upgrade failure at ${stage}.`);
  }

  writeAtomically(relativePath, content, mode) {
    const target = resolveManagedPath(this.projectRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    resolveManagedPath(this.projectRoot, relativePath);
    const temporary = path.join(
      path.dirname(target),
      `.${path.basename(target)}.fsd-upgrade-${process.pid}-${crypto.randomUUID()}.tmp`
    );
    try {
      fs.writeFileSync(temporary, content, { mode: mode ?? 0o644 });
      fs.renameSync(temporary, target);
      if (mode !== undefined) fs.chmodSync(target, mode);
    } finally {
      if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    }
  }

  apply(operations) {
    if (!this.started || this.finished) throw new UpgradeStateError("Upgrade transaction is not active.");
    for (const operation of operations) {
      if (!["CREATE", "UPDATE", "DELETE"].includes(operation.status)) continue;
      const relativePath = normalizeRelativePath(operation.path);
      if (!this.snapshots.has(relativePath)) {
        throw new UpgradeStateError(`Operation was not included in the backup: ${relativePath}`);
      }
      this.inject("before-write", operation);
      const snapshot = this.snapshots.get(relativePath);
      if (operation.status === "DELETE") {
        const target = resolveManagedPath(this.projectRoot, relativePath);
        if (fs.existsSync(target)) {
          if (!fs.lstatSync(target).isFile()) {
            throw new UpgradeStateError(`Refusing to delete non-file path: ${relativePath}`);
          }
          fs.unlinkSync(target);
        }
      } else {
        this.writeAtomically(relativePath, operation.content, operation.mode ?? snapshot.mode);
      }
      this.inject("after-write", operation);
    }
  }

  rollback() {
    if (!this.started || this.finished) return { ok: true };
    try {
      for (const relativePath of [...this.affectedPaths].reverse()) {
        const snapshot = this.snapshots.get(relativePath);
        const target = resolveManagedPath(this.projectRoot, relativePath);
        if (!snapshot.exists) {
          if (fs.existsSync(target)) {
            if (!fs.lstatSync(target).isFile()) {
              throw new UpgradeStateError(`Cannot remove non-file during rollback: ${relativePath}`);
            }
            fs.unlinkSync(target);
          }
          continue;
        }
        const content = fs.readFileSync(path.join(this.backupLocation, snapshot.backupFile));
        this.writeAtomically(relativePath, content, snapshot.mode);
      }
      this.finished = true;
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }

  commit() {
    if (!this.started || this.finished) throw new UpgradeStateError("Upgrade transaction is not active.");
    this.inject("before-commit");
    fs.rmSync(this.backupLocation, { recursive: true, force: true });
    this.finished = true;
  }
}
