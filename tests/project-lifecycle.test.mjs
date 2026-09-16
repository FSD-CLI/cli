import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createHuskyHooks,
  ensureCommitlintConfig,
  ensureCommitlintDependencies,
  ensureHuskyHooks,
} from "../bin/core/project-lifecycle.mjs";

test("project lifecycle creates deterministic commit tooling", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-lifecycle-"));
  try {
    fs.writeFileSync(
      path.join(fixture, "package.json"),
      `${JSON.stringify({ devDependencies: { typescript: "latest" } })}\n`
    );
    ensureCommitlintDependencies(fixture);
    ensureCommitlintConfig(fixture);
    ensureHuskyHooks(fixture, "pnpm");

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(fixture, "package.json"), "utf8")
    );
    assert.ok(packageJson.devDependencies["@commitlint/cli"]);
    assert.ok(packageJson.devDependencies["@commitlint/config-conventional"]);
    assert.ok(fs.existsSync(path.join(fixture, "commitlint.config.cjs")));
    assert.match(
      fs.readFileSync(path.join(fixture, ".husky", "commit-msg"), "utf8"),
      /pnpm exec commitlint/
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("hook generation rejects unknown package managers", () => {
  assert.throws(() => createHuskyHooks("unknown"), /Unsupported package manager/);
});
