import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createDefaultProjectConfig } from "../bin/commands/create-project.mjs";
import { inspectProject } from "../bin/commands/inspect-project.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

const SLICES = {
  app: ["providers"],
  pages: ["home"],
  widgets: [],
  features: ["auth", "cart"],
  entities: ["product"],
  shared: ["api", "ui"],
};

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-doctor-metrics-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify(createDefaultProjectConfig("react-vite")),
  );
  fs.writeFileSync(
    path.join(cwd, "package.json"),
    JSON.stringify({ name: "doctor-metrics-fixture", version: "0.0.0" }),
  );
  for (const [layer, names] of Object.entries(SLICES)) {
    // Every layer directory must exist: doctor checks for it even when a
    // layer holds no slices yet.
    fs.mkdirSync(path.join(cwd, "src", layer), { recursive: true });
    for (const name of names) {
      fs.mkdirSync(path.join(cwd, "src", layer, name), { recursive: true });
    }
  }
  return cwd;
}

function runCli(cwd, args = []) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
  });
}

test("doctor prints project metrics with per-layer slice counts", (t) => {
  const cwd = fixture(t);
  const result = runCli(cwd, ["doctor"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Project metrics/);
  assert.match(result.stdout, /features: 2 slices — auth, cart/);
  assert.match(result.stdout, /entities: 1 slice — product/);
  assert.match(result.stdout, /widgets: 0 slices/);
  assert.match(result.stdout, /app: 1 segment — providers/);
  assert.match(result.stdout, /shared: 2 segments — api, ui/);
  assert.match(result.stdout, /Total slices: 4/);
  // The checks still come first.
  assert.ok(
    result.stdout.indexOf("FSD configuration") <
      result.stdout.indexOf("Project metrics"),
  );
});

test("check does not print project metrics", (t) => {
  const cwd = fixture(t);
  const result = runCli(cwd, ["check"]);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Project metrics/);
  assert.doesNotMatch(result.stdout, /Total slices/);
});

test("inspectProject includes metrics for doctor and not for check", (t) => {
  const cwd = fixture(t);
  const doctor = inspectProject(cwd, { includeToolchain: true });
  assert.equal(doctor.checks.every((item) => item.ok), true);
  assert.equal(doctor.metrics.total, 4);
  assert.deepEqual(
    doctor.metrics.layers.map(({ layer, slices }) => [layer, slices.length]),
    [
      ["app", 1],
      ["pages", 1],
      ["widgets", 0],
      ["features", 2],
      ["entities", 1],
      ["shared", 2],
    ],
  );
  const check = inspectProject(cwd);
  assert.equal(check.metrics, null);
});

test("doctor still prints metrics when a layer check fails", (t) => {
  const cwd = fixture(t);
  fs.rmSync(path.join(cwd, "src", "pages"), { recursive: true, force: true });
  const result = runCli(cwd, ["doctor"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FAIL.*FSD layer: pages/);
  assert.match(result.stdout, /Project metrics/);
  assert.match(result.stdout, /pages: 0 slices/);
  assert.match(result.stdout, /Total slices: 3/);
});
