import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createDefaultProjectConfig } from "../bin/commands/create-project.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

function fixture(t, { git = true } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-history-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify(createDefaultProjectConfig("react-vite")),
  );
  if (git) {
    const run = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" });
    run("init", "-q");
    run("config", "user.name", "FSD Test");
    run("config", "user.email", "fsd-test@example.invalid");
    run("config", "commit.gpgsign", "false");
  }
  return cwd;
}

function writeFile(cwd, relativePath, content = "x\n") {
  const target = path.join(cwd, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function commit(cwd, message, files) {
  for (const file of files) writeFile(cwd, file);
  execFileSync("git", ["add", "-A"], { cwd, encoding: "utf8", stdio: "pipe" });
  execFileSync("git", ["commit", "-q", "-m", message], { cwd, encoding: "utf8", stdio: "pipe" });
}

function historyFixture(t) {
  const cwd = fixture(t);
  commit(cwd, "Add auth feature", [
    "src/features/auth/ui.tsx",
    "src/entities/product/model.ts",
  ]);
  commit(cwd, "Add cart and shared button", [
    "src/features/auth/api.ts",
    "src/features/cart/ui.tsx",
    "src/shared/ui/button.tsx",
  ]);
  commit(cwd, "Update readme", ["README.md"]);
  return cwd;
}

function runHistory(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "history", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
  });
}

test("history prints per-layer touch counts, most-touched slices and a timeline", (t) => {
  const cwd = historyFixture(t);
  const result = runHistory(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Last 50 commits/);
  assert.match(result.stdout, /features: 3 touches/);
  assert.match(result.stdout, /entities: 1 touch/);
  assert.match(result.stdout, /shared: 1 touch/);
  assert.match(result.stdout, /other: 2 touches/);
  assert.match(result.stdout, /Total touches: 7/);
  assert.match(result.stdout, /features\/auth: 2 touches/);
  const first = result.stdout.indexOf("Add auth feature");
  const second = result.stdout.indexOf("Add cart and shared button");
  const third = result.stdout.indexOf("Update readme");
  assert.ok(first !== -1 && second !== -1 && third !== -1);
  assert.ok(first < second && second < third, "timeline is oldest first");
  assert.match(result.stdout, /Add auth feature — entities: 1, features: 1/);
});

test("history --limit samples only the most recent commits", (t) => {
  const cwd = historyFixture(t);
  const result = runHistory(cwd, ["--limit", "2"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Last 2 commits/);
  assert.match(result.stdout, /features: 2 touches/);
  assert.match(result.stdout, /entities: 0 touches/);
  assert.match(result.stdout, /shared: 1 touch/);
  assert.match(result.stdout, /other: 1 touch/);
  assert.match(result.stdout, /Total touches: 4/);
  assert.doesNotMatch(result.stdout, /Add auth feature/);
});

test("history --limit=2 accepts the inline form", (t) => {
  const cwd = historyFixture(t);
  const result = runHistory(cwd, ["--limit=2"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Last 2 commits/);
});

test("history rejects a non-positive or non-numeric --limit", (t) => {
  const cwd = historyFixture(t);
  for (const value of ["0", "abc"]) {
    const result = runHistory(cwd, ["--limit", value]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--limit requires a positive integer/);
  }
});

test("history reports a clear error outside a Git repository", (t) => {
  const cwd = fixture(t, { git: false });
  const result = runHistory(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Not a Git repository/);
});

test("history prints a note and exits successfully with no commits", (t) => {
  const cwd = fixture(t);
  const result = runHistory(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No commits yet in this repository/);
});

test("history rejects unknown options", (t) => {
  const cwd = historyFixture(t);
  const result = runHistory(cwd, ["--bogus"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unexpected argument "--bogus"/);
});


test("history resolves project paths through symlinks and Windows junctions", (t) => {
  const cwd = historyFixture(t);
  const container = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-history-link-"));
  t.after(() => fs.rmSync(container, { recursive: true, force: true }));
  const alias = path.join(container, "project");
  fs.symlinkSync(cwd, alias, process.platform === "win32" ? "junction" : "dir");
  const result = runHistory(alias);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /features: 3 touches/);
  assert.match(result.stdout, /shared: 1 touch/);
});

test("history counts app/shared activity without calling segments slices", (t) => {
  const cwd = fixture(t);
  commit(cwd, "Add segments and a feature", [
    "src/app/providers/index.ts",
    "src/shared/ui/button.tsx",
    "src/features/auth/ui.tsx",
  ]);
  const result = runHistory(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /app: 1 touch/);
  assert.match(result.stdout, /shared: 1 touch/);
  assert.match(result.stdout, /features\/auth: 1 touch/);
  assert.doesNotMatch(result.stdout, /app\/providers:|shared\/ui:/);
});

test("history resolves an FSD project nested inside a repository", (t) => {
  const root = fixture(t);
  const project = path.join(root, "apps", "web");
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, "fsd.config.json"), JSON.stringify(createDefaultProjectConfig("react-vite")));
  commit(root, "Nested project", ["apps/web/src/features/auth/ui.tsx", "src/features/other/ui.tsx"]);
  const result = runHistory(project);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /features: 1 touch/);
  assert.match(result.stdout, /features\/auth: 1 touch/);
  assert.doesNotMatch(result.stdout, /features\/other:/);
});
