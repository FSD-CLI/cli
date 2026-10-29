import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  beginProjectTransaction,
  createHuskyHooks,
  ensureCommitlintConfig,
  ensureCommitlintDependencies,
  ensureHuskyHooks,
  runCommand,
} from "../bin/core/project-lifecycle.mjs";

test("project replacement can be committed or rolled back atomically", () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-transaction-"));
  const target = path.join(fixtureRoot, "app");
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, "original.txt"), "keep me\n");

  try {
    const rollback = beginProjectTransaction(target, { force: true });
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "partial.txt"), "partial\n");
    rollback.rollback();
    assert.equal(fs.readFileSync(path.join(target, "original.txt"), "utf8"), "keep me\n");
    assert.equal(fs.existsSync(path.join(target, "partial.txt")), false);

    const commit = beginProjectTransaction(target, { force: true });
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "complete.txt"), "complete\n");
    commit.commit();
    assert.equal(fs.existsSync(path.join(target, "original.txt")), false);
    assert.equal(fs.readFileSync(path.join(target, "complete.txt"), "utf8"), "complete\n");
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("project lifecycle creates deterministic commit tooling", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-lifecycle-"));
  try {
    fs.writeFileSync(
      path.join(fixture, "package.json"),
      `${JSON.stringify({ devDependencies: { typescript: "latest" } })}\n`
    );
    ensureCommitlintDependencies(fixture);
    ensureCommitlintConfig(fixture);
    ensureHuskyHooks(fixture, "pnpm");

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(fixture, "package.json"), "utf8")
    );
    assert.ok(packageJson.devDependencies["@commitlint/cli"]);
    assert.ok(packageJson.devDependencies["@commitlint/config-conventional"]);
    assert.ok(fs.existsSync(path.join(fixture, "commitlint.config.cjs")));
    assert.match(
      fs.readFileSync(path.join(fixture, ".husky", "commit-msg"), "utf8"),
      /pnpm exec commitlint/
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("hook generation rejects unknown package managers", () => {
  assert.throws(() => createHuskyHooks("unknown"), /Unsupported package manager/);
});

test("project lifecycle runs executable paths from working directories with spaces", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "fsd cli lifecycle "));
  try {
    assert.match(runCommand(process.execPath, ["--version"], fixture), /^v\d+/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

for (const manager of ['npm', 'pnpm', 'yarn', 'bun']) {
  test(`${manager}: light hooks skip builds by default, opt in explicitly, and support bypass`, { skip: process.platform === "win32" }, () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'fsd hook policy '));
    try {
      const bin = path.join(cwd, 'bin'); fs.mkdirSync(bin);
      const log = path.join(cwd, 'calls.log');
      for (const command of ['git', manager]) {
        const executable = path.join(bin, command);
        fs.writeFileSync(executable, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$FSD_TEST_LOG"\nif [ "$FSD_TEST_FAIL" = "1" ]; then exit 7; fi\n');
        fs.chmodSync(executable, 0o755);
      }
      const hooks = createHuskyHooks(manager);
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, HUSKY: '1', FSD_TEST_LOG: log, FSD_PRE_COMMIT_LINT: '0', FSD_PRE_PUSH_CHECKS: '0' };
      const run = (hook, extra = {}) => spawnSync('/bin/sh', ['-c', hooks[hook]], { cwd, env: { ...env, ...extra }, encoding: 'utf8' });
      assert.equal(run('pre-commit').status, 0);
      assert.equal(run('pre-push').status, 0);
      assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /build|lint/);
      assert.equal(run('pre-commit', { FSD_PRE_COMMIT_LINT: '1' }).status, 0);
      assert.equal(run('pre-push', { FSD_PRE_PUSH_CHECKS: '1' }).status, 0);
      assert.match(fs.readFileSync(log, 'utf8'), /build/);
      assert.equal(run('pre-push', { FSD_PRE_PUSH_CHECKS: '1', FSD_TEST_FAIL: '1' }).status, 7);
      const previous = fs.readFileSync(log, 'utf8');
      assert.equal(run('pre-push', { HUSKY: '0', FSD_PRE_PUSH_CHECKS: '1' }).status, 0);
      assert.equal(fs.readFileSync(log, 'utf8'), previous);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  });
}
