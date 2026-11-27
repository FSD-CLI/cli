import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CliUsageError, parseCliArgs } from "../bin/cli/args.mjs";
import { analyzeAdoption } from "../bin/core/adopt-analysis.mjs";
import {
  ADOPT_PLAN_FILE,
  buildAdoptionPlan,
  readAdoptionPlan,
  summarizePlan,
  writeAdoptionPlan,
} from "../bin/core/adopt-plan.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

// Same legacy project as tests/adopt-analyze.test.mjs: 7 flat files, 2
// layer-root, 2 unmapped, 3 already in layers.
function legacyFixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-adopt-plan-"));
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

function planPath(cwd) {
  return path.join(cwd, ADOPT_PLAN_FILE);
}

test("buildAdoptionPlan turns flat files into pending moves", (t) => {
  const cwd = legacyFixture(t);
  const plan = buildAdoptionPlan(cwd, analyzeAdoption(cwd));
  assert.equal(plan.version, 1);
  assert.equal(plan.sourceRoot, "src");
  assert.equal(plan.score, 21);
  assert.equal(plan.moves.length, 7);
  // Moves follow the analysis file order (sorted by path), so the api
  // move comes first and the utils move last.
  assert.deepEqual(plan.moves[0], {
    id: "move-001",
    from: "src/api/client.ts",
    to: "src/shared/api/client.ts",
    status: "pending",
    reason: "api/ maps to shared/api",
  });
  assert.deepEqual(plan.moves[1], {
    id: "move-002",
    from: "src/components/Button.tsx",
    to: "src/shared/ui/Button.tsx",
    status: "pending",
    reason: "components/ maps to shared/ui",
  });
  assert.equal(plan.moves[6].from, "src/utils/format.ts");
  assert.equal(plan.moves[6].to, "src/shared/lib/format.ts");
  assert.ok(plan.moves.every((move) => move.status === "pending"));
  assert.deepEqual(
    plan.layerRoot.map((entry) => entry.file),
    ["src/app/App.tsx", "src/pages/home.tsx"],
  );
  assert.deepEqual(
    plan.unmapped.map((entry) => entry.file),
    ["src/main.tsx", "src/models/User.ts"],
  );
  assert.deepEqual(summarizePlan(plan), {
    moves: 7,
    pending: 7,
    approved: 0,
    skipped: 0,
  });
});

test("writeAdoptionPlan refuses to overwrite without --force, then round-trips", (t) => {
  const cwd = legacyFixture(t);
  const plan = buildAdoptionPlan(cwd, analyzeAdoption(cwd));
  const file = writeAdoptionPlan(cwd, plan);
  assert.equal(file, planPath(cwd));
  assert.deepEqual(readAdoptionPlan(cwd), plan);
  assert.throws(
    () => writeAdoptionPlan(cwd, plan),
    /already exists.*--force/,
  );
  const rebuilt = buildAdoptionPlan(cwd, analyzeAdoption(cwd));
  assert.equal(writeAdoptionPlan(cwd, rebuilt, { force: true }), planPath(cwd));
  assert.deepEqual(readAdoptionPlan(cwd), rebuilt);
});

test("readAdoptionPlan keeps user edits and counts statuses", (t) => {
  const cwd = legacyFixture(t);
  const plan = buildAdoptionPlan(cwd, analyzeAdoption(cwd));
  writeAdoptionPlan(cwd, plan);
  const edited = JSON.parse(fs.readFileSync(planPath(cwd), "utf8"));
  edited.moves[0].to = "src/widgets/Button.tsx";
  edited.moves[0].status = "approved";
  edited.moves[1].status = "skipped";
  fs.writeFileSync(planPath(cwd), JSON.stringify(edited, null, 2));
  const loaded = readAdoptionPlan(cwd);
  assert.equal(loaded.moves[0].to, "src/widgets/Button.tsx");
  assert.deepEqual(summarizePlan(loaded), {
    moves: 7,
    pending: 5,
    approved: 1,
    skipped: 1,
  });
});

test("readAdoptionPlan rejects a missing file, bad JSON, bad version and bad moves", (t) => {
  const cwd = legacyFixture(t);
  assert.throws(() => readAdoptionPlan(cwd), /No adoption plan found/);

  const plan = buildAdoptionPlan(cwd, analyzeAdoption(cwd));
  writeAdoptionPlan(cwd, plan);
  fs.writeFileSync(planPath(cwd), "{not json");
  assert.throws(() => readAdoptionPlan(cwd), /not valid JSON/);

  const wrongVersion = { ...plan, version: 99 };
  fs.writeFileSync(planPath(cwd), JSON.stringify(wrongVersion));
  assert.throws(() => readAdoptionPlan(cwd), /unsupported version 99/);

  const badStatus = structuredClone(plan);
  badStatus.moves[0].status = "maybe";
  fs.writeFileSync(planPath(cwd), JSON.stringify(badStatus));
  assert.throws(() => readAdoptionPlan(cwd), /status "maybe"/);

  const duplicateFrom = structuredClone(plan);
  duplicateFrom.moves[1].from = duplicateFrom.moves[0].from;
  fs.writeFileSync(planPath(cwd), JSON.stringify(duplicateFrom));
  assert.throws(() => readAdoptionPlan(cwd), /duplicate move source/);
});

test("parseCliArgs: adopt accepts --plan and --show-plan, one mode at a time", () => {
  assert.deepEqual(parseCliArgs(["adopt", "--plan"]), {
    command: "adopt",
    analyze: false,
    plan: true,
    showPlan: false,
    force: false,
    json: false,
  });
  assert.deepEqual(parseCliArgs(["adopt", "--show-plan"]), {
    command: "adopt",
    analyze: false,
    plan: false,
    showPlan: true,
    force: false,
    json: false,
  });
  assert.throws(
    () => parseCliArgs(["adopt", "--analyze", "--plan"]),
    (error) =>
      error instanceof CliUsageError && /exactly one of --analyze/.test(error.message),
  );
  assert.throws(
    () => parseCliArgs(["adopt", "--plan", "--show-plan"]),
    (error) =>
      error instanceof CliUsageError && /exactly one of --analyze/.test(error.message),
  );
});

test("fsd adopt --plan writes the plan and refuses a second run without --force", (t) => {
  const cwd = legacyFixture(t);
  const result = runAdopt(cwd, ["--plan"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Wrote \.fsd\/adopt-plan\.json/);
  assert.match(result.stdout, /7 moves \(all pending\) · 2 layer-root · 2 unmapped/);
  const stored = JSON.parse(fs.readFileSync(planPath(cwd), "utf8"));
  assert.equal(stored.moves.length, 7);

  const again = runAdopt(cwd, ["--plan"]);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists/);

  const forced = runAdopt(cwd, ["--plan", "--force"]);
  assert.equal(forced.status, 0, forced.stderr);
});

test("fsd adopt --show-plan prints the plan and reflects edits", (t) => {
  const cwd = legacyFixture(t);
  const missing = runAdopt(cwd, ["--show-plan"]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /No adoption plan found/);

  assert.equal(runAdopt(cwd, ["--plan"]).status, 0);
  const shown = runAdopt(cwd, ["--show-plan"]);
  assert.equal(shown.status, 0, shown.stderr);
  assert.match(shown.stdout, /7 moves · 7 pending · 0 approved · 0 skipped/);
  assert.match(
    shown.stdout,
    /\[pending\] move-001: src\/api\/client\.ts -> src\/shared\/api\/client\.ts/,
  );
  assert.match(
    shown.stdout,
    /\[pending\] move-002: src\/components\/Button\.tsx -> src\/shared\/ui\/Button\.tsx/,
  );

  const edited = JSON.parse(fs.readFileSync(planPath(cwd), "utf8"));
  edited.moves[0].status = "approved";
  fs.writeFileSync(planPath(cwd), JSON.stringify(edited, null, 2));
  const reshown = runAdopt(cwd, ["--show-plan"]);
  assert.match(reshown.stdout, /7 moves · 6 pending · 1 approved · 0 skipped/);
  assert.match(reshown.stdout, /\[approved\] move-001/);
});

test("fsd adopt --plan --json prints the written plan", (t) => {
  const cwd = legacyFixture(t);
  const result = runAdopt(cwd, ["--plan", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const printed = JSON.parse(result.stdout);
  assert.equal(printed.moves.length, 7);
  assert.deepEqual(printed, JSON.parse(fs.readFileSync(planPath(cwd), "utf8")));
});
