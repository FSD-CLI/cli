import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ChangeRunner,
  ChangeRunnerError,
  runVerifiedChange,
  verifyAffectedTests,
  verifyProjectCheck,
} from "../bin/core/change-runner.mjs";
import { configureProject, normalizeProjectConfig } from "../bin/project-config.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-change-runner-"));
}

function removeRoot(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

function writeFile(root, relativePath, content, mode) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, mode === undefined ? undefined : { mode });
}

function readFile(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

// Minimal project that passes `fsd check`: config + package.json + all six
// layers under src/.
function makeCheckedProject() {
  const root = makeRoot();
  for (const layer of ["app", "pages", "widgets", "features", "entities", "shared"]) {
    fs.mkdirSync(path.join(root, "src", layer), { recursive: true });
  }
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "change-runner-fixture", dependencies: { react: "^19.0.0" } })}\n`
  );
  configureProject(root, normalizeProjectConfig("react-vite", { packageManager: "npm" }));
  return root;
}

test("runVerifiedChange commits on success and discards the backup", async () => {
  const root = makeCheckedProject();
  try {
    writeFile(root, "src/app/index.ts", "before\n");
    const result = await runVerifiedChange(root, {
      files: ["src/app/index.ts", "src/features/new.ts"],
      apply: (runner) => {
        runner.write("src/app/index.ts", "after\n");
        runner.write("src/features/new.ts", "created\n");
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, "committed");
    assert.equal(result.verification.ok, true);
    assert.equal(readFile(root, "src/app/index.ts"), "after\n");
    assert.equal(readFile(root, "src/features/new.ts"), "created\n");
    // Commit discards the snapshot: no backup run directory remains
    // (the empty `.fsd/backups` parent is inert and left behind).
    const backups = path.join(root, ".fsd", "backups");
    assert.equal(fs.existsSync(backups) ? fs.readdirSync(backups).length : 0, 0);
  } finally {
    removeRoot(root);
  }
});

test("runVerifiedChange rolls back when a verifier fails", async () => {
  const root = makeCheckedProject();
  try {
    writeFile(root, "src/app/index.ts", "before\n");
    const result = await runVerifiedChange(root, {
      files: ["src/app/index.ts", "src/features/new.ts"],
      apply: (runner) => {
        runner.write("src/app/index.ts", "after\n");
        runner.write("src/features/new.ts", "created\n");
      },
      verify: [() => ({ label: "always fails", ok: false, detail: "boom" })],
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, "rolled-back");
    assert.equal(result.rollback.ok, true);
    assert.equal(result.verification.results[0].label, "always fails");
    assert.equal(readFile(root, "src/app/index.ts"), "before\n");
    assert.equal(fs.existsSync(path.join(root, "src", "features", "new.ts")), false);
  } finally {
    removeRoot(root);
  }
});

test("runVerifiedChange rolls back when apply throws", async () => {
  const root = makeCheckedProject();
  try {
    writeFile(root, "src/app/index.ts", "before\n");
    const result = await runVerifiedChange(root, {
      files: ["src/app/index.ts"],
      apply: (runner) => {
        runner.write("src/app/index.ts", "after\n");
        throw new Error("apply exploded");
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, "rolled-back");
    assert.equal(result.error.message, "apply exploded");
    assert.equal(readFile(root, "src/app/index.ts"), "before\n");
  } finally {
    removeRoot(root);
  }
});

test("default verifier is fsd check: a broken project rolls back", async () => {
  const root = makeRoot();
  try {
    // No fsd.config.json and no layers: `fsd check` must fail.
    writeFile(root, "package.json", '{ "name": "broken" }\n');
    writeFile(root, "src/app/index.ts", "before\n");
    const result = await runVerifiedChange(root, {
      files: ["src/app/index.ts"],
      apply: (runner) => runner.write("src/app/index.ts", "after\n"),
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, "rolled-back");
    assert.equal(result.verification.results[0].label, "fsd check");
    assert.equal(result.verification.results[0].ok, false);
    assert.equal(readFile(root, "src/app/index.ts"), "before\n");
  } finally {
    removeRoot(root);
  }
});

test("delete restores the file on rollback and removes it on commit", async () => {
  const root = makeCheckedProject();
  try {
    writeFile(root, "src/features/old.ts", "old\n");
    const rolledBack = await runVerifiedChange(root, {
      files: ["src/features/old.ts"],
      apply: (runner) => runner.delete("src/features/old.ts"),
      verify: [() => false],
    });
    assert.equal(rolledBack.ok, false);
    assert.equal(readFile(root, "src/features/old.ts"), "old\n");

    const committed = await runVerifiedChange(root, {
      files: ["src/features/old.ts"],
      apply: (runner) => runner.delete("src/features/old.ts"),
    });
    assert.equal(committed.ok, true);
    assert.equal(fs.existsSync(path.join(root, "src", "features", "old.ts")), false);
  } finally {
    removeRoot(root);
  }
});

test("rollback restores the original file mode", async () => {
  const root = makeCheckedProject();
  try {
    writeFile(root, "src/app/run.sh", "#!/bin/sh\n", 0o600);
    const result = await runVerifiedChange(root, {
      files: ["src/app/run.sh"],
      apply: (runner) => runner.write("src/app/run.sh", "changed\n", 0o755),
      verify: [() => false],
    });
    assert.equal(result.ok, false);
    assert.equal(readFile(root, "src/app/run.sh"), "#!/bin/sh\n");
    assert.equal(fs.statSync(path.join(root, "src", "app", "run.sh")).mode & 0o777, 0o600);
  } finally {
    removeRoot(root);
  }
});

test("verifyAffectedTests passes, fails, and passes vacuously", async () => {
  const root = makeRoot();
  try {
    writeFile(root, "passing.test.mjs", "import test from 'node:test';\ntest('ok', () => {});\n");
    writeFile(root, "failing.test.mjs", "import test from 'node:test';\ntest('no', () => { throw new Error('nope'); });\n");
    const passing = await verifyAffectedTests({ files: ["passing.test.mjs"] })(root);
    assert.equal(passing.ok, true);
    const failing = await verifyAffectedTests({ files: ["failing.test.mjs"] })(root);
    assert.equal(failing.ok, false);
    assert.match(failing.detail, /nope/);
    const none = await verifyAffectedTests({ files: [] })(root);
    assert.equal(none.ok, true);
  } finally {
    removeRoot(root);
  }
});

test("verifyProjectCheck passes on a valid project and fails on a broken one", async () => {
  const good = makeCheckedProject();
  const bad = makeRoot();
  try {
    const goodResult = await verifyProjectCheck(good);
    assert.equal(goodResult.ok, true);
    assert.equal(goodResult.label, "fsd check");
    const badResult = await verifyProjectCheck(bad);
    assert.equal(badResult.ok, false);
    assert.match(badResult.detail, /FSD layer: app/);
  } finally {
    removeRoot(good);
    removeRoot(bad);
  }
});

test("verify collects every verifier result, including throwing ones", async () => {
  const root = makeCheckedProject();
  const runner = new ChangeRunner(root, { files: [] });
  try {
    runner.begin();
    const verification = await runner.verify([
      () => true,
      () => {
        throw new Error("verifier exploded");
      },
      () => ({ label: "custom", ok: false, detail: "no" }),
    ]);
    assert.equal(verification.ok, false);
    assert.equal(verification.results.length, 3);
    assert.equal(verification.results[0].ok, true);
    assert.match(verification.results[1].detail, /verifier exploded/);
    assert.equal(verification.results[2].label, "custom");
    runner.rollback();
  } finally {
    removeRoot(root);
  }
});

test("writing an undeclared file is refused", async () => {
  const root = makeCheckedProject();
  const runner = new ChangeRunner(root, { files: ["src/app/index.ts"] });
  try {
    runner.begin();
    assert.throws(
      () => runner.write("src/app/other.ts", "x\n"),
      (error) => error instanceof ChangeRunnerError && /not declared/.test(error.message)
    );
    runner.rollback();
  } finally {
    removeRoot(root);
  }
});

test("paths escaping the root and symlinks are refused", async () => {
  const root = makeCheckedProject();
  try {
    assert.throws(() => new ChangeRunner(root, { files: ["../escape.ts"] }), /escapes the project root/);
    const outside = path.join(os.tmpdir(), "fsd-cli-change-runner-outside.txt");
    fs.writeFileSync(outside, "outside\n");
    const link = path.join(root, "src", "app", "link.ts");
    fs.symlinkSync(outside, link);
    try {
      assert.throws(
        () => new ChangeRunner(root, { files: ["src/app/link.ts"] }).begin(),
        /symlinked path/
      );
    } finally {
      fs.rmSync(outside, { force: true });
    }
  } finally {
    removeRoot(root);
  }
});

test("manual lifecycle: double begin, commit after rollback, and rollback after commit", async () => {
  const root = makeCheckedProject();
  const runner = new ChangeRunner(root, { files: ["src/app/index.ts"] });
  try {
    writeFile(root, "src/app/index.ts", "before\n");
    runner.begin();
    assert.throws(() => runner.begin(), ChangeRunnerError);
    runner.write("src/app/index.ts", "after\n");
    assert.equal(runner.rollback().ok, true);
    assert.equal(readFile(root, "src/app/index.ts"), "before\n");
    assert.equal(runner.rollback().ok, true);
    assert.throws(() => runner.commit(), ChangeRunnerError);

    const second = new ChangeRunner(root, { files: ["src/app/index.ts"] });
    second.begin();
    second.write("src/app/index.ts", "after\n");
    assert.equal(second.commit().ok, true);
    assert.throws(() => second.rollback(), ChangeRunnerError);
    assert.throws(() => second.write("src/app/index.ts", "x\n"), ChangeRunnerError);
  } finally {
    removeRoot(root);
  }
});

test("runVerifiedChange requires an apply function", async () => {
  const root = makeRoot();
  try {
    await assert.rejects(runVerifiedChange(root, { files: [] }), ChangeRunnerError);
  } finally {
    removeRoot(root);
  }
});
