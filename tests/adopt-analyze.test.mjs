import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CliUsageError, parseCliArgs } from "../bin/cli/args.mjs";
import { analyzeAdoption } from "../bin/core/adopt-analysis.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));
const fixturesDir = fileURLToPath(new URL("fixtures/analysis", import.meta.url));

// A legacy (not yet FSD) project: flat components/utils/hooks/api/store
// directories, two files already in layers, two files directly under a
// layer, and two files no mapping knows. No fsd.config.json on purpose —
// adopt must work on projects that never had one.
function legacyFixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-adopt-legacy-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, "package.json"),
    JSON.stringify({
      name: "legacy-app",
      version: "0.1.0",
      dependencies: { react: "^18.0.0" },
    }),
  );
  const files = [
    "src/main.tsx",
    "src/components/Button.tsx",
    "src/components/Header.tsx",
    "src/components/forms/LoginForm.tsx",
    "src/utils/format.ts",
    "src/hooks/useAuth.ts",
    "src/api/client.ts",
    "src/store/index.ts",
    "src/models/User.ts",
    "src/features/auth/model/auth.ts",
    "src/features/auth/ui/LoginButton.tsx",
    "src/shared/ui/OldButton.tsx",
    "src/pages/home.tsx",
    "src/app/App.tsx",
  ];
  for (const file of files) {
    const full = path.join(cwd, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "export const x = 1;\n");
  }
  return cwd;
}

function runAdopt(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "adopt", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
  });
}

function byFile(analysis, file) {
  const found = analysis.files.find((entry) => entry.file === file);
  assert.ok(found, `expected ${file} in the analysis`);
  return found;
}

test("analyzeAdoption classifies a legacy project", (t) => {
  const cwd = legacyFixture(t);
  const analysis = analyzeAdoption(cwd);
  assert.equal(analysis.framework, "react-vite");
  assert.equal(analysis.sourceRoot, path.join(cwd, "src"));
  assert.deepEqual(analysis.totals, {
    files: 14,
    inLayer: 3,
    layerRoot: 2,
    flat: 7,
    unmapped: 2,
  });
  assert.equal(analysis.score, 21);

  assert.equal(byFile(analysis, "src/features/auth/model/auth.ts").status, "in-layer");
  assert.equal(byFile(analysis, "src/features/auth/model/auth.ts").layer, "features");
  assert.equal(byFile(analysis, "src/features/auth/model/auth.ts").slice, "auth");
  assert.equal(byFile(analysis, "src/shared/ui/OldButton.tsx").status, "in-layer");

  assert.equal(byFile(analysis, "src/pages/home.tsx").status, "layer-root");
  assert.equal(byFile(analysis, "src/app/App.tsx").status, "layer-root");

  assert.deepEqual(byFile(analysis, "src/components/Button.tsx").suggestion, {
    to: "shared/ui/Button.tsx",
    reason: "components/ maps to shared/ui",
  });
  assert.deepEqual(byFile(analysis, "src/components/forms/LoginForm.tsx").suggestion, {
    to: "shared/ui/forms/LoginForm.tsx",
    reason: "components/ maps to shared/ui",
  });
  assert.equal(byFile(analysis, "src/utils/format.ts").suggestion.to, "shared/lib/format.ts");
  assert.equal(byFile(analysis, "src/hooks/useAuth.ts").suggestion.to, "shared/lib/useAuth.ts");
  assert.equal(byFile(analysis, "src/api/client.ts").suggestion.to, "shared/api/client.ts");
  assert.equal(byFile(analysis, "src/store/index.ts").suggestion.to, "app/store/index.ts");

  assert.equal(byFile(analysis, "src/main.tsx").status, "unmapped");
  assert.match(byFile(analysis, "src/main.tsx").note, /top-level file/);
  assert.equal(byFile(analysis, "src/models/User.ts").status, "unmapped");
  assert.match(byFile(analysis, "src/models/User.ts").note, /no mapping for "models\/"/);
});

test("analyzeAdoption scores a fully layered project 100 and an empty one 0", (t) => {
  const minimal = analyzeAdoption(path.join(fixturesDir, "minimal"));
  assert.deepEqual(minimal.totals, {
    files: 11,
    inLayer: 11,
    layerRoot: 0,
    flat: 0,
    unmapped: 0,
  });
  assert.equal(minimal.score, 100);

  const empty = analyzeAdoption(path.join(fixturesDir, "empty"));
  assert.deepEqual(empty.totals, {
    files: 0,
    inLayer: 0,
    layerRoot: 0,
    flat: 0,
    unmapped: 0,
  });
  assert.equal(empty.score, 0);
});

test("parseCliArgs: adopt requires --analyze", () => {
  assert.deepEqual(parseCliArgs(["adopt", "--analyze"]), {
    command: "adopt",
    analyze: true,
    json: false,
  });
  assert.deepEqual(parseCliArgs(["adopt", "--analyze", "--json"]), {
    command: "adopt",
    analyze: true,
    json: true,
  });
  assert.throws(
    () => parseCliArgs(["adopt"]),
    (error) =>
      error instanceof CliUsageError && /only supports --analyze/.test(error.message),
  );
  assert.throws(() => parseCliArgs(["adopt", "--bogus"]), CliUsageError);
});

test("fsd adopt --analyze prints the score and the flat-file moves", (t) => {
  const cwd = legacyFixture(t);
  const result = runAdopt(cwd, ["--analyze"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Adoption score: 21%/);
  assert.match(result.stdout, /In layers: 3 · Layer root: 2 · Flat: 7 · Unmapped: 2/);
  assert.match(
    result.stdout,
    /src\/components\/Button\.tsx -> shared\/ui\/Button\.tsx/,
  );
  assert.match(result.stdout, /src\/main\.tsx — top-level file/);
});

test("fsd adopt --analyze --json prints the analysis object", (t) => {
  const cwd = legacyFixture(t);
  const result = runAdopt(cwd, ["--analyze", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), analyzeAdoption(cwd));
});

test("fsd adopt without --analyze is a usage error", (t) => {
  const cwd = legacyFixture(t);
  const result = runAdopt(cwd, []);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /only supports --analyze/);
});
