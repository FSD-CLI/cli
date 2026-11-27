import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createDefaultProjectConfig } from "../bin/commands/create-project.mjs";
import {
  detectMobile,
  detectMonorepo,
  inspectProject,
} from "../bin/commands/inspect-project.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

const LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];

function fixture(t, packageJson = { name: "inspect-fixture", version: "0.0.0" }) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-inspect-layout-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify(createDefaultProjectConfig("react-vite")),
  );
  fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify(packageJson));
  for (const layer of LAYERS) {
    fs.mkdirSync(path.join(cwd, "src", layer), { recursive: true });
  }
  return cwd;
}

function checkByLabel(report, label) {
  return report.checks.find((item) => item.label === label);
}

test("monorepo detected via pnpm-workspace.yaml", (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
  const monorepo = detectMonorepo(cwd);
  assert.deepEqual(monorepo, {
    detected: true,
    tool: "pnpm workspaces",
    signals: ["pnpm-workspace.yaml"],
  });
  const report = inspectProject(cwd);
  assert.deepEqual(report.monorepo, monorepo);
  assert.equal(checkByLabel(report, "Monorepo").ok, true);
  assert.equal(
    checkByLabel(report, "Monorepo").detail,
    "pnpm workspaces — pnpm-workspace.yaml",
  );
  assert.equal(report.checks.every((item) => item.ok), true);
});

test("monorepo detected via package.json workspaces field", (t) => {
  const cwd = fixture(t, {
    name: "inspect-fixture",
    version: "0.0.0",
    workspaces: ["apps/*", "packages/*"],
  });
  const monorepo = detectMonorepo(cwd);
  assert.deepEqual(monorepo, {
    detected: true,
    tool: "npm/yarn workspaces",
    signals: ["package.json workspaces"],
  });
  const report = inspectProject(cwd);
  assert.deepEqual(report.monorepo, monorepo);
  assert.equal(
    checkByLabel(report, "Monorepo").detail,
    "npm/yarn workspaces — package.json workspaces",
  );
  assert.equal(report.checks.every((item) => item.ok), true);
});

test("monorepo detected via turbo.json, nx.json, lerna.json and apps/ directory", (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, "turbo.json"), "{}\n");
  fs.mkdirSync(path.join(cwd, "apps", "web"), { recursive: true });
  assert.deepEqual(detectMonorepo(cwd), {
    detected: true,
    tool: "Turborepo",
    signals: ["turbo.json", "apps/ directory"],
  });

  const nxRoot = fixture(t);
  fs.writeFileSync(path.join(nxRoot, "nx.json"), "{}\n");
  assert.equal(detectMonorepo(nxRoot).tool, "Nx");

  const lernaRoot = fixture(t);
  fs.writeFileSync(path.join(lernaRoot, "lerna.json"), "{}\n");
  assert.equal(detectMonorepo(lernaRoot).tool, "Lerna");
});

test("mobile detected via expo dependency", (t) => {
  const cwd = fixture(t, {
    name: "inspect-fixture",
    version: "0.0.0",
    dependencies: { expo: "~54.0.0", react: "19.1.0", "react-native": "0.81.0" },
  });
  const mobile = detectMobile(cwd);
  assert.deepEqual(mobile, {
    detected: true,
    setup: "Expo",
    signals: ["expo dependency", "react-native dependency"],
  });
  const report = inspectProject(cwd);
  assert.deepEqual(report.mobile, mobile);
  assert.equal(checkByLabel(report, "Mobile project").ok, true);
  assert.equal(
    checkByLabel(report, "Mobile project").detail,
    "Expo — expo dependency, react-native dependency",
  );
  assert.equal(report.checks.every((item) => item.ok), true);
});

test("mobile detected via react-native dependency", (t) => {
  const cwd = fixture(t, {
    name: "inspect-fixture",
    version: "0.0.0",
    dependencies: { react: "19.1.0", "react-native": "0.81.0" },
  });
  assert.deepEqual(detectMobile(cwd), {
    detected: true,
    setup: "React Native",
    signals: ["react-native dependency"],
  });
});

test("mobile detected via app.json and app.config.js", (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(
    path.join(cwd, "app.json"),
    JSON.stringify({ expo: { name: "inspect-fixture" } }),
  );
  assert.deepEqual(detectMobile(cwd), {
    detected: true,
    setup: "Expo config",
    signals: ["app.json"],
  });
  const report = inspectProject(cwd);
  assert.equal(
    checkByLabel(report, "Mobile project").detail,
    "Expo config — app.json",
  );

  const configRoot = fixture(t);
  fs.writeFileSync(
    path.join(configRoot, "app.config.js"),
    "module.exports = { expo: { name: 'inspect-fixture' } };\n",
  );
  assert.deepEqual(detectMobile(configRoot), {
    detected: true,
    setup: "Expo config",
    signals: ["app.config.js"],
  });
});

test("plain single web project reports neither monorepo nor mobile", (t) => {
  const cwd = fixture(t, {
    name: "inspect-fixture",
    version: "0.0.0",
    dependencies: { react: "19.1.0" },
  });
  assert.equal(detectMonorepo(cwd), null);
  assert.equal(detectMobile(cwd), null);
  const report = inspectProject(cwd);
  assert.equal(report.monorepo, null);
  assert.equal(report.mobile, null);
  assert.equal(
    checkByLabel(report, "Monorepo").detail,
    "not detected — single package",
  );
  assert.equal(
    checkByLabel(report, "Mobile project").detail,
    "not detected — web project",
  );
  assert.equal(report.checks.every((item) => item.ok), true);
});

test("check and doctor print the monorepo and mobile findings", (t) => {
  const cwd = fixture(t, {
    name: "inspect-fixture",
    version: "0.0.0",
    dependencies: { expo: "~54.0.0" },
  });
  fs.writeFileSync(path.join(cwd, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
  for (const command of ["check", "doctor"]) {
    const result = spawnSync(process.execPath, [cli, command], {
      cwd,
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS {2}Monorepo — pnpm workspaces — pnpm-workspace\.yaml/);
    assert.match(result.stdout, /PASS {2}Mobile project — Expo — expo dependency/);
  }
});
