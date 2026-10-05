import assert from "node:assert/strict";
import test from "node:test";
import {
  areSafeArgs,
  buildWindowsCommandLine,
  execFileSafe,
  getWindowsCmdInvocation,
  isSafeCommand,
  isSimpleToken,
  isWindows,
  spawnSafe,
  spawnSyncSafe,
} from "../bin/core/command-runner.mjs";
import { getInstallCommand, getRunScriptCommand } from "../bin/core/package-managers.mjs";
import { commandExists } from "../bin/commands/inspect-project.mjs";

test("platform detection isolates Windows behavior", () => {
  assert.equal(isWindows("win32"), true);
  assert.equal(isWindows("linux"), false);
  assert.equal(isWindows("darwin"), false);
});

test("simple tokens allow safe flags and reject shell metacharacters", () => {
  for (const token of ["npm", "pnpm", "yarn", "bun", "--version", "install", "--no-immutable", "run", "build"]) {
    assert.equal(isSimpleToken(token), true, token);
  }
  for (const token of ["", "npm --version", "a&b", "a|b", "a;b", "$(x)", "`x`", "a\"b", "a b", "a\nb"]) {
    assert.equal(isSimpleToken(token), false, JSON.stringify(token));
  }
});

test("command validation keeps paths usable but rejects shell injection", () => {
  assert.equal(isSafeCommand("npm"), true);
  assert.equal(isSafeCommand(process.execPath), true);
  // Absolute Windows path with spaces stays usable via direct spawn.
  assert.equal(isSafeCommand("C:\\Program Files\\nodejs\\node.exe"), true);
  // A command string that embeds arguments is treated as a single path
  // (it fails closed downstream instead of being split by a shell).
  assert.equal(isSafeCommand(`${process.execPath} --version`), true);
  for (const unsafe of ["", "a&b", "a|b", "a;b", "a$(b)", "a`b`", "a\"b", "a\nb", "a\0b"]) {
    assert.equal(isSafeCommand(unsafe), false, JSON.stringify(unsafe));
  }
  assert.equal(areSafeArgs(["--version"]), true);
  assert.equal(areSafeArgs("not an array"), false);
});

test("Windows command lines keep commands and arguments separate", () => {
  assert.equal(buildWindowsCommandLine("npm", ["--version"]), "npm --version");
  assert.equal(buildWindowsCommandLine("git", ["--version"]), "git --version");
  for (const manager of ["npm", "pnpm", "yarn", "bun"]) {
    const line = buildWindowsCommandLine(manager, ["--version"]);
    assert.equal(line, `${manager} --version`);
  }
  assert.throws(() => buildWindowsCommandLine("npm --version", ["--version"]), /non-simple command/);
  assert.throws(() => buildWindowsCommandLine("npm", ["--version; evil"]), /non-simple argument/);
  assert.throws(() => buildWindowsCommandLine("npm & evil", ["--version"]), /unsafe command/);
});

test("Windows cmd invocations never enable a shell and preserve boundaries", () => {
  for (const manager of ["npm", "pnpm", "yarn", "bun", "git"]) {
    const invocation = getWindowsCmdInvocation(manager, ["--version"]);
    assert.equal(invocation.command, "cmd.exe");
    assert.deepEqual(invocation.args, ["/d", "/s", "/c", `${manager} --version`]);
  }
  // Dependency-install commands route through the same safe path.
  for (const manager of ["npm", "pnpm", "yarn", "bun"]) {
    const install = getInstallCommand(manager);
    const invocation = getWindowsCmdInvocation(install.command, install.args);
    assert.equal(invocation.command, "cmd.exe");
    assert.equal(invocation.args[0], "/d");
    assert.match(invocation.args[3], new RegExp(`^${manager} install`));
  }
  for (const manager of ["npm", "pnpm", "yarn", "bun"]) {
    const run = getRunScriptCommand(manager, "build");
    const invocation = getWindowsCmdInvocation(run.command, run.args);
    assert.equal(invocation.command, "cmd.exe");
  }
});

test("safe runners fail closed for injection without a shell", () => {
  const probe = spawnSyncSafe("npm & evil", ["--version"], { encoding: "utf8", platform: "win32" });
  assert.ok(probe.error);
  assert.equal(probe.status, null);
  assert.throws(() => buildWindowsCommandLine("npm", ["a b"]), /non-simple argument/);
  assert.throws(() => spawnSafe("npm & evil", ["--version"], { platform: "win32" }), /unsafe command/);
  assert.throws(() => execFileSafe("npm & evil", ["--version"], { platform: "win32" }), /unsafe command/);
});

test("commandExists preserves safe argument handling on this platform", () => {
  assert.equal(commandExists(process.execPath), true);
  assert.equal(commandExists(`${process.execPath} --version`), false);
  assert.equal(commandExists("npm"), true);
});
