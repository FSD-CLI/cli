import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CliUsageError, parseCliArgs } from "../bin/cli/args.mjs";
import { createDefaultProjectConfig } from "../bin/commands/create-project.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("CLI parser keeps legacy creation and generation syntax", () => {
  assert.deepEqual(parseCliArgs(["shop"]), {
    command: "create",
    projectName: "shop",
    framework: undefined,
    packageManager: undefined,
    apiClient: undefined,
    serverState: undefined,
    clientState: undefined,
    forms: undefined,
    yes: false,
    noInstall: false,
    noStart: false,
    dryRun: false,
    force: false,
  });
  assert.deepEqual(parseCliArgs(["-g", "feature", "auth", "--force"]), {
    command: "generate",
    type: "feature",
    name: "auth",
    force: true,
    dryRun: false,
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
      packageManager: undefined,
      apiClient: undefined,
      serverState: undefined,
      clientState: undefined,
      forms: undefined,
      yes: true,
      noInstall: true,
      noStart: true,
      dryRun: false,
      force: false,
    }
  );
  assert.throws(() => parseCliArgs(["--yes"]), CliUsageError);
  assert.throws(() => parseCliArgs(["shop", "--unknown"]), /Unknown option/);
  assert.throws(
    () => parseCliArgs(["--generate", "feature", "auth", "extra"]),
    /Unexpected argument/
  );
});

test("CLI parser exposes dry-run, safe replacement, and inspection commands", () => {
  assert.deepEqual(
    parseCliArgs(["shop", "--framework", "vue-vite", "--yes", "--dry-run", "--force"]),
    {
      command: "create",
      projectName: "shop",
      framework: "vue-vite",
      packageManager: undefined,
      apiClient: undefined,
      serverState: undefined,
      clientState: undefined,
      forms: undefined,
      yes: true,
      noInstall: false,
      noStart: false,
      dryRun: true,
      force: true,
    }
  );
  assert.deepEqual(parseCliArgs(["-g", "page", "settings", "--dry-run"]), {
    command: "generate",
    type: "page",
    name: "settings",
    force: false,
    dryRun: true,
  });
  assert.deepEqual(parseCliArgs(["doctor"]), { command: "doctor" });
  assert.throws(() => parseCliArgs(["doctor", "extra"]), /Unexpected argument/);
});

test("CLI parser accepts explicit stack choices for repeatable E2E creation", () => {
  const command = parseCliArgs([
    "shop",
    "--framework",
    "react-vite",
    "--package-manager",
    "pnpm",
    "--api-client",
    "fetch",
    "--server-state",
    "none",
    "--client-state",
    "redux",
    "--forms",
    "none",
    "--yes",
  ]);
  assert.equal(command.packageManager, "pnpm");
  assert.equal(command.apiClient, "fetch");
  assert.equal(command.serverState, "none");
  assert.equal(command.clientState, "redux");
  assert.equal(command.forms, "none");
});

test("--yes resolves defaults from the selected framework", () => {
  const react = createDefaultProjectConfig("react-vite");
  const vue = createDefaultProjectConfig("vue-vite");
  assert.equal(react.serverState, "react-query");
  assert.equal(react.clientState, "zustand");
  assert.equal(vue.serverState, "vue-query");
  assert.equal(vue.clientState, "pinia");
  assert.equal(vue.forms, "vee-validate-zod");
});

test("CLI exposes version, help, and template discovery without prompts", () => {
  const run = (...args) =>
    execFileSync(process.execPath, ["bin/index.mjs", ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });

  assert.equal(run("--version").trim(), "2.3.1");
  assert.match(run("--help"), /--list-templates/);
  const templates = run("--list-templates");
  assert.match(templates, /react-vite\s+stable/);
  assert.match(templates, /vue-vite\s+stable/);
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

test("project dry-run prints the plan without cloning a template", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-create-plan-"));
  try {
    const output = execFileSync(
      process.execPath,
      [
        path.join(repoRoot, "bin/index.mjs"),
        "preview-app",
        "--framework",
        "vue-vite",
        "--yes",
        "--dry-run",
      ],
      { cwd, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } }
    );
    assert.match(output, /Project plan \(dry run\)/);
    assert.match(output, /Vue \+ Vite/);
    assert.equal(fs.existsSync(path.join(cwd, "preview-app")), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
