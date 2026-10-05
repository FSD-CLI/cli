import { execFileSync, spawn, spawnSync } from "node:child_process";

// Bare executable names that are known to be .cmd shims on Windows
// (npm, pnpm, yarn, bun) plus git/node which are .exe but safe to route
// through the same validated cmd.exe path when needed.
const WINDOWS_SHIM_ALLOWLIST = new Set(["git", "node", "npm", "pnpm", "yarn", "bun", "bunx"]);

// Tokens that can be safely joined with spaces for cmd.exe /d /s /c.
// No whitespace, quotes, shell metacharacters, or control characters.
// Covers: --version, install, --no-immutable, run, build, lint, dev,
// config keys, hook names, bare package-manager names, simple paths.
const SIMPLE_TOKEN_PATTERN = /^[A-Za-z0-9_@+=:,./-]+$/;

export function isWindows(platform = process.platform) {
  return platform === "win32";
}

export function isSimpleToken(value) {
  return typeof value === "string" && SIMPLE_TOKEN_PATTERN.test(value);
}

// Rejects null bytes, newlines, quotes, and cmd/sh metacharacters that
// could break out of a quoted token. Allows spaces, slashes, backslashes,
// colons, and dots so absolute paths with spaces (for example
// "C:\Program Files\nodejs\node.exe") remain usable via direct spawn.
export function isSafeCommand(command) {
  if (typeof command !== "string" || command.length === 0) return false;
  if (command.includes("\0")) return false;
  if (/[\r\n]/.test(command)) return false;
  if (/[&|;<>()$`!*?~#^"%'!]/.test(command)) return false;
  return true;
}

export function areSafeArgs(args) {
  if (!Array.isArray(args)) return false;
  for (const arg of args) {
    if (typeof arg !== "string") return false;
    if (arg.includes("\0")) return false;
    if (/[\r\n]/.test(arg)) return false;
  }
  return true;
}

// Only simple tokens are ever joined into a cmd.exe /c string.
// Anything else fails closed instead of being quoted unsafely.
export function buildWindowsCommandLine(command, args = []) {
  if (!isSafeCommand(command)) {
    throw new Error(`Refusing to build Windows command for unsafe command: ${command}`);
  }
  if (!areSafeArgs(args)) {
    throw new Error("Refusing to build Windows command for unsafe arguments.");
  }
  if (!isSimpleToken(command)) {
    throw new Error(`Refusing to route non-simple command through cmd.exe: ${command}`);
  }
  for (const arg of args) {
    if (!isSimpleToken(arg)) {
      throw new Error(`Refusing to route non-simple argument through cmd.exe: ${arg}`);
    }
  }
  return [command, ...args].join(" ");
}

export function getWindowsCmdInvocation(command, args = []) {
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", buildWindowsCommandLine(command, args)],
  };
}

function shouldUseCmdFallback(command, args, platform) {
  if (!isWindows(platform)) return false;
  if (typeof command !== "string") return false;
  const normalized = command.toLowerCase();
  if (!WINDOWS_SHIM_ALLOWLIST.has(normalized)) return false;
  if (!isSimpleToken(command)) return false;
  if (!Array.isArray(args) || !args.every(isSimpleToken)) return false;
  return true;
}

function splitCmdOptions(options = {}) {
  const { platform: _platform, ...rest } = options;
  return rest;
}

export function spawnSyncSafe(command, args = [], options = {}) {
  const { platform = process.platform, ...spawnOptions } = options;
  if (!isSafeCommand(command) || !areSafeArgs(args)) {
    return {
      error: new Error(`Refusing to execute unsafe command: ${command}`),
      status: null,
      signal: null,
      stdout: "",
      stderr: "",
    };
  }
  if (shouldUseCmdFallback(command, args, platform)) {
    const commandLine = buildWindowsCommandLine(command, args);
    return spawnSync("cmd.exe", ["/d", "/s", "/c", commandLine], {
      ...splitCmdOptions(spawnOptions),
      shell: false,
    });
  }
  return spawnSync(command, args, { ...splitCmdOptions(spawnOptions), shell: false });
}

export function execFileSafe(command, args = [], options = {}) {
  const { platform = process.platform, ...execOptions } = options;
  if (!isSafeCommand(command) || !areSafeArgs(args)) {
    const error = new Error(`Refusing to execute unsafe command: ${command}`);
    error.status = null;
    error.stdout = "";
    error.stderr = "";
    throw error;
  }
  if (shouldUseCmdFallback(command, args, platform)) {
    const commandLine = buildWindowsCommandLine(command, args);
    return execFileSync("cmd.exe", ["/d", "/s", "/c", commandLine], {
      ...splitCmdOptions(execOptions),
      shell: false,
    });
  }
  return execFileSync(command, args, { ...splitCmdOptions(execOptions), shell: false });
}

export function spawnSafe(command, args = [], options = {}) {
  const { platform = process.platform, ...spawnOptions } = options;
  if (!isSafeCommand(command) || !areSafeArgs(args)) {
    throw new Error(`Refusing to execute unsafe command: ${command}`);
  }
  if (shouldUseCmdFallback(command, args, platform)) {
    const commandLine = buildWindowsCommandLine(command, args);
    return spawn("cmd.exe", ["/d", "/s", "/c", commandLine], {
      ...splitCmdOptions(spawnOptions),
      shell: false,
    });
  }
  return spawn(command, args, { ...splitCmdOptions(spawnOptions), shell: false });
}
