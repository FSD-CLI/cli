import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createDefaultProjectConfig } from "../bin/commands/create-project.mjs";

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
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-explain-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify(createDefaultProjectConfig("react-vite")),
  );
  for (const [layer, names] of Object.entries(SLICES)) {
    for (const name of names) {
      fs.mkdirSync(path.join(cwd, "src", layer, name), { recursive: true });
    }
  }
  return cwd;
}

function runExplain(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "explain", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
  });
}

test("explain prints framework, stack and per-layer slice counts", (t) => {
  const cwd = fixture(t);
  const result = runExplain(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Framework: react-vite/);
  assert.match(result.stdout, /Package manager: npm/);
  assert.match(result.stdout, /features: 2 slices — auth, cart/);
  assert.match(result.stdout, /entities: 1 slice — product/);
  assert.match(result.stdout, /widgets: 0 slices/);
  assert.match(result.stdout, /Total slices: 4/);
  assert.match(result.stdout, /app: 1 segment — providers/);
  assert.match(result.stdout, /shared: 2 segments — api, ui/);
});

test("explain --tour writes ONBOARDING.md with stack, layers and commands", (t) => {
  const cwd = fixture(t);
  const result = runExplain(cwd, ["--tour"]);
  assert.equal(result.status, 0, result.stderr);
  const tourPath = path.join(cwd, "ONBOARDING.md");
  assert.ok(fs.existsSync(tourPath));
  const content = fs.readFileSync(tourPath, "utf8");
  assert.match(content, /Framework: react-vite/);
  assert.match(content, /features — 2 slices: auth, cart/);
  assert.match(content, /entities — 1 slice: product/);
  assert.match(content, /Total slices: 4/);
  assert.match(content, /shared — 2 segments: api, ui/);
  assert.match(content, /check/);
  assert.match(content, /doctor/);
});

test("explain --tour --force regenerates identical content", (t) => {
  const cwd = fixture(t);
  assert.equal(runExplain(cwd, ["--tour"]).status, 0);
  const first = fs.readFileSync(path.join(cwd, "ONBOARDING.md"), "utf8");
  const result = runExplain(cwd, ["--tour", "--force"]);
  assert.equal(result.status, 0, result.stderr);
  const second = fs.readFileSync(path.join(cwd, "ONBOARDING.md"), "utf8");
  assert.equal(second, first);
});

test("explain --tour refuses to overwrite an existing ONBOARDING.md without --force", (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(
    path.join(cwd, "ONBOARDING.md"),
    "# Hand-written tour\n",
    "utf8",
  );
  const result = runExplain(cwd, ["--tour"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ONBOARDING\.md already exists/);
  assert.equal(
    fs.readFileSync(path.join(cwd, "ONBOARDING.md"), "utf8"),
    "# Hand-written tour\n",
  );
});

test("explain rejects unknown options", (t) => {
  const cwd = fixture(t);
  const result = runExplain(cwd, ["--bogus"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unexpected argument "--bogus"/);
});
