import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  explainSlice,
  runInteractiveExplain,
} from "../bin/commands/explain-project.mjs";
import { createDefaultProjectConfig } from "../bin/commands/create-project.mjs";

// INT-49: `fsd explain <slice>` deep-dive + `fsd explain --interactive`.
// Unit tests run against the INT-04 analysis fixtures
// (tests/fixtures/analysis/{minimal,with-violations}); CLI tests spawn the
// real binary with the fixture as its working directory (read-only).

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));
const fixturesDir = fileURLToPath(
  new URL("fixtures/analysis", import.meta.url),
);

function runExplain(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "explain", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
  });
}

test("explainSlice deep-dives a known slice: files, dependencies, dependents", () => {
  const deep = explainSlice(path.join(fixturesDir, "minimal"), "features/auth");
  assert.equal(deep.layer, "features");
  assert.equal(deep.slice, "auth");
  assert.equal(deep.id, "features/auth");
  assert.deepEqual(deep.files, [
    "features/auth/model/auth.ts",
    "features/auth/ui/login-form.tsx",
  ]);
  assert.deepEqual(
    deep.dependencies.map(({ id }) => id),
    ["entities/user", "shared/ui"],
  );
  assert.deepEqual(
    deep.dependents.map(({ id }) => id),
    ["pages/home"],
  );
  assert.deepEqual(deep.violations, []);
  assert.deepEqual(deep.externalImports, []);
});

test("explainSlice accepts a bare slice name when unambiguous", () => {
  const deep = explainSlice(path.join(fixturesDir, "minimal"), "auth");
  assert.equal(deep.id, "features/auth");
  assert.deepEqual(deep.files, [
    "features/auth/model/auth.ts",
    "features/auth/ui/login-form.tsx",
  ]);
});

test("explainSlice reports a slice with no imports but real dependents", () => {
  const deep = explainSlice(path.join(fixturesDir, "minimal"), "user");
  assert.equal(deep.id, "entities/user");
  assert.deepEqual(deep.files, ["entities/user/model/user.types.ts"]);
  assert.deepEqual(deep.dependencies, []);
  assert.deepEqual(deep.dependents, [
    {
      id: "features/auth",
      files: [
        "features/auth/model/auth.ts",
        "features/auth/ui/login-form.tsx",
      ],
    },
  ]);
  assert.deepEqual(deep.violations, []);
});

test("explainSlice flags both upward imports touching the slice in the with-violations fixture", () => {
  const deep = explainSlice(
    path.join(fixturesDir, "with-violations"),
    "features/auth",
  );
  assert.deepEqual(
    deep.dependencies.map(({ id }) => id),
    ["entities/user", "pages/home", "shared/ui"],
  );
  // features/auth is also imported by entities/product — an incoming
  // upward import (entities must never import from features).
  assert.deepEqual(
    deep.dependents.map(({ id }) => id),
    ["entities/product", "pages/home"],
  );
  assert.deepEqual(deep.violations, [
    {
      direction: "incoming",
      from: "entities/product",
      to: "features/auth",
      file: "entities/product/model/product.types.ts",
      specifier: "../../../features/auth/model/auth",
    },
    {
      direction: "outgoing",
      from: "features/auth",
      to: "pages/home",
      file: "features/auth/model/auth.ts",
      specifier: "../../../pages/home/ui/home-page",
    },
  ]);
});

test("explainSlice errors clearly for an unknown slice, naming the available ones", () => {
  assert.throws(
    () => explainSlice(path.join(fixturesDir, "minimal"), "nope"),
    /Unknown slice "nope"\. Available slices: .*features\/auth/,
  );
});

test("explainSlice errors clearly for an ambiguous bare slice name", (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-explain-ambig-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify(createDefaultProjectConfig("react-vite")),
  );
  for (const dir of ["src/features/auth", "src/entities/auth"]) {
    fs.mkdirSync(path.join(cwd, dir), { recursive: true });
    fs.writeFileSync(path.join(cwd, dir, "index.ts"), "export {};\n");
  }
  assert.throws(
    () => explainSlice(cwd, "auth"),
    /Ambiguous slice "auth" — it matches entities\/auth, features\/auth/,
  );
  // The qualified form still resolves.
  assert.equal(explainSlice(cwd, "entities/auth").id, "entities/auth");
});

test("explain <slice> prints the deep-dive through the CLI", () => {
  const result = runExplain(path.join(fixturesDir, "minimal"), [
    "features/auth",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Slice: features\/auth/);
  assert.match(result.stdout, /Layer: features/);
  assert.match(result.stdout, /features\/auth\/model\/auth\.ts/);
  assert.match(result.stdout, /features\/auth\/ui\/login-form\.tsx/);
  assert.match(result.stdout, /Depends on \(2\):/);
  assert.match(result.stdout, /entities\/user/);
  assert.match(result.stdout, /Depended on by \(1\):/);
  assert.match(result.stdout, /pages\/home/);
  assert.match(result.stdout, /Layer-boundary violations: none/);
});

test("explain <slice> prints the violation through the CLI", () => {
  const result = runExplain(path.join(fixturesDir, "with-violations"), [
    "auth",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Slice: features\/auth/);
  assert.match(result.stdout, /Layer-boundary violations \(2\):/);
  assert.match(
    result.stdout,
    /outgoing: features\/auth -> pages\/home \(features\/auth\/model\/auth\.ts/,
  );
  assert.match(
    result.stdout,
    /incoming: entities\/product -> features\/auth \(entities\/product\/model\/product\.types\.ts/,
  );
});

test("explain <unknown slice> exits non-zero and names the available slices", () => {
  const result = runExplain(path.join(fixturesDir, "minimal"), ["nope"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown slice "nope"/);
  assert.match(result.stderr, /Available slices: .*features\/auth/);
});

test("explain rejects combining a slice with --tour or --interactive", () => {
  const cwd = path.join(fixturesDir, "minimal");
  const tour = runExplain(cwd, ["auth", "--tour"]);
  assert.equal(tour.status, 1);
  assert.match(tour.stderr, /cannot be combined/);
  const interactive = runExplain(cwd, ["auth", "--interactive"]);
  assert.equal(interactive.status, 1);
  assert.match(interactive.stderr, /cannot be combined/);
  const both = runExplain(cwd, ["--interactive", "--tour"]);
  assert.equal(both.status, 1);
  assert.match(both.stderr, /cannot be combined/);
});

test("runInteractiveExplain loops over picked slices and quits on Quit", async () => {
  const cwd = path.join(fixturesDir, "minimal");
  const answers = [{ slice: "features/auth" }, { slice: null }];
  const seen = [];
  const ask = async (prompt) => {
    seen.push(prompt);
    return answers.shift();
  };
  const lines = [];
  const originalLog = console.log;
  console.log = (...parts) => lines.push(parts.join(" "));
  try {
    await runInteractiveExplain(cwd, ask);
  } finally {
    console.log = originalLog;
  }
  assert.equal(seen.length, 2);
  assert.equal(seen[0].type, "select");
  assert.deepEqual(
    seen[0].choices.map(({ value }) => value),
    [
      "app/providers",
      "entities/product",
      "entities/user",
      "features/auth",
      "features/cart",
      "pages/home",
      "shared/api",
      "shared/ui",
      "widgets/header",
      null,
    ],
  );
  const output = lines.join("\n");
  assert.match(output, /Slice: features\/auth/);
  assert.match(output, /Depended on by \(1\):/);
});

test("runInteractiveExplain quits immediately when the prompt is cancelled", async () => {
  const cwd = path.join(fixturesDir, "minimal");
  let calls = 0;
  await runInteractiveExplain(cwd, async () => {
    calls += 1;
    return {};
  });
  assert.equal(calls, 1);
});
