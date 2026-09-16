import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CliUsageError, parseCliArgs } from "../bin/cli/args.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("CLI parser keeps legacy creation and generation syntax", () => {
  assert.deepEqual(parseCliArgs(["shop"]), {
    command: "create",
    projectName: "shop",
    framework: undefined,
    yes: false,
    noInstall: false,
    noStart: false,
  });
  assert.deepEqual(parseCliArgs(["-g", "feature", "auth", "--force"]), {
    command: "generate",
    type: "feature",
    name: "auth",
    force: true,
  });
});

test("CLI parser supports automation-friendly create flags", () => {
  assert.deepEqual(
    parseCliArgs([
      "shop",
      "--framework=nextjs",
      "--yes",
      "--no-install",
      "--no-start",
    ]),
    {
      command: "create",
      projectName: "shop",
      framework: "nextjs",
      yes: true,
      noInstall: true,
      noStart: true,
    }
  );
  assert.throws(() => parseCliArgs(["--yes"]), CliUsageError);
  assert.throws(() => parseCliArgs(["shop", "--unknown"]), /Unknown option/);
  assert.throws(
    () => parseCliArgs(["--generate", "feature", "auth", "extra"]),
    /Unexpected argument/
  );
});

test("CLI exposes version, help, and template discovery without prompts", () => {
  const run = (...args) =>
    execFileSync(process.execPath, ["bin/index.mjs", ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });

  assert.equal(run("--version").trim(), "2.2.0");
  assert.match(run("--help"), /--list-templates/);
  const templates = run("--list-templates");
  assert.match(templates, /react-vite\s+stable/);
  assert.match(templates, /vue-vite\s+planned/);
});

test("CLI fails before cloning an unknown framework", () => {
  const result = spawnSync(
    process.execPath,
    ["bin/index.mjs", "shop", "--framework", "unknown", "--yes", "--no-install"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
    }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown framework/);
});
