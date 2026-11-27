import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createDefaultProjectConfig } from "../bin/commands/create-project.mjs";
import {
  historyProject,
  parseGitLog,
  straySegment,
  findUpwardImports,
} from "../bin/commands/history-project.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

function fixture(t, { git = true } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-history-erosion-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify(createDefaultProjectConfig("react-vite")),
  );
  if (git) {
    const run = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" });
    run("init", "-q");
    run("config", "user.name", "FSD Test");
    run("config", "user.email", "fsd-test@example.invalid");
    run("config", "commit.gpgsign", "false");
  }
  return cwd;
}

function writeFile(cwd, relativePath, content = "x\n") {
  const target = path.join(cwd, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

// entries: [relativePath, content?] pairs.
function commit(cwd, message, entries) {
  commitAs(cwd, message, entries, null);
}

function commitAs(cwd, message, entries, author) {
  for (const [relativePath, content] of entries) {
    writeFile(cwd, relativePath, content);
  }
  execFileSync("git", ["add", "-A"], { cwd, encoding: "utf8", stdio: "pipe" });
  const args = author
    ? ["-c", `user.name=${author}`, "-c", `user.email=${author.replace(/\s+/g, ".").toLowerCase()}@example.invalid`, "commit", "-q", "-m", message]
    : ["commit", "-q", "-m", message];
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" });
}

function remove(cwd, message, relativePath) {
  execFileSync("git", ["rm", "-q", relativePath], { cwd, encoding: "utf8", stdio: "pipe" });
  execFileSync("git", ["commit", "-q", "-m", message], { cwd, encoding: "utf8", stdio: "pipe" });
}

function runHistory(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "history", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
  });
}

test("parseGitLog reads --name-status lines and rename targets", () => {
  const output = [
    "abc1234\0 2026-11-26\0Ada Lovelace\0Add things",
    "A\tsrc/features/auth/ui.tsx",
    "M\tsrc/shared/ui/button.tsx",
    "D\tsrc/components/old.tsx",
    "R100\tsrc/old.ts\tsrc/features/auth/model/auth.ts",
    "",
    "def5678\0 2026-11-25\0Grace Hopper\0Earlier",
    "A\tREADME.md",
  ].join("\n");
  const commits = parseGitLog(output);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].author, "Ada Lovelace");
  assert.equal(commits[0].subject, "Add things");
  assert.equal(commits[1].author, "Grace Hopper");
  assert.deepEqual(commits[0].files, [
    { path: "src/features/auth/ui.tsx", status: "A" },
    { path: "src/shared/ui/button.tsx", status: "M" },
    { path: "src/components/old.tsx", status: "D" },
    { path: "src/features/auth/model/auth.ts", status: "R" },
  ]);
  assert.deepEqual(commits[1].files, [{ path: "README.md", status: "A" }]);
});

test("straySegment flags directories outside the FSD layers only", () => {
  assert.equal(straySegment("src/components/button.tsx", "src"), "components");
  assert.equal(straySegment("src/utils/format.ts", "src"), "utils");
  assert.equal(straySegment("apps/web/src/lib/api.ts", "apps/web/src"), "lib");
  assert.equal(straySegment("src/features/auth/ui.tsx", "src"), null);
  assert.equal(straySegment("src/shared/ui/button.tsx", "src"), null);
  // Bare files directly under the source root (entry points) are not erosion.
  assert.equal(straySegment("src/main.tsx", "src"), null);
  // Files outside the project source root are not erosion.
  assert.equal(straySegment("README.md", "src"), null);
  assert.equal(straySegment("scripts/build.mjs", "src"), null);
});

test("findUpwardImports flags imports of a higher layer only", () => {
  const file = { path: "src/shared/ui/button.tsx", layer: "shared", slice: null };
  const bad = findUpwardImports(
    "import { login } from \"../../features/auth/model/auth\";\n",
    file,
    "src",
  );
  assert.equal(bad.length, 1);
  assert.equal(bad[0].layer, "features");
  assert.equal(bad[0].specifier, "../../features/auth/model/auth");

  const ok = findUpwardImports(
    "import { http } from \"../api/http\";\nimport { x } from \"./button\";\n",
    file,
    "src",
  );
  assert.deepEqual(ok, []);

  // Same-layer and lower-layer imports are allowed for a feature slice.
  const feature = { path: "src/features/auth/ui/login-form.tsx", layer: "features", slice: "auth" };
  const allowed = findUpwardImports(
    "import { http } from \"../../../shared/api/http\";\nimport { model } from \"../model/auth\";\n",
    feature,
    "src",
  );
  assert.deepEqual(allowed, []);
});

test("a commit adding a file in the wrong layer is attributed to that commit", (t) => {
  const cwd = fixture(t);
  commit(cwd, "Add clean feature", [["src/features/auth/ui.tsx", "export {};\n"]]);
  commit(cwd, "Add stray component", [["src/components/button.tsx", "export {};\n"]]);
  const report = historyProject(cwd, {});
  assert.equal(report.erosion.totalErodingCommits, 1);
  assert.equal(report.erosion.totalErodingFiles, 1);
  const [entry] = report.erosion.commits;
  assert.equal(entry.subject, "Add stray component");
  assert.equal(entry.count, 1);
  assert.deepEqual(entry.files, [{
    path: "src/components/button.tsx",
    kind: "misplaced",
    expectedLayer: null,
    actualLayer: "components",
    detail: "sits in src/components/, outside the FSD layers",
  }]);
  const bySubject = new Map(report.commits.map((c) => [c.subject, c.erosionCount]));
  assert.equal(bySubject.get("Add stray component"), 1);
  assert.equal(bySubject.get("Add clean feature"), 0);
});

test("a clean commit shows zero erosion", (t) => {
  const cwd = fixture(t);
  commit(cwd, "Add feature and shared button", [
    ["src/features/auth/ui.tsx", "export {};\n"],
    ["src/shared/ui/button.tsx", "export {};\n"],
  ]);
  const report = historyProject(cwd, {});
  assert.deepEqual(report.erosion, {
    commits: [],
    totalErodingCommits: 0,
    totalErodingFiles: 0,
    worstOffenders: [],
    byAuthor: [],
  });
  assert.equal(report.commits[0].erosionCount, 0);
});

test("a commit adding an upward import is attributed to that commit", (t) => {
  const cwd = fixture(t);
  commit(cwd, "Add feature model", [["src/features/auth/model/auth.ts", "export const login = () => {};\n"]]);
  commit(cwd, "Shared button reaches into features", [
    ["src/shared/ui/button.tsx", "import { login } from \"../../features/auth/model/auth\";\nexport {};\n"],
  ]);
  const report = historyProject(cwd, {});
  assert.equal(report.erosion.totalErodingCommits, 1);
  const [entry] = report.erosion.commits;
  assert.equal(entry.subject, "Shared button reaches into features");
  assert.equal(entry.files[0].kind, "upward-import");
  assert.equal(entry.files[0].path, "src/shared/ui/button.tsx");
  assert.equal(entry.files[0].expectedLayer, "shared");
  assert.equal(entry.files[0].actualLayer, "features");
  assert.match(entry.files[0].detail, /imports \.\.\/\.\.\/features\/auth\/model\/auth from features/);
});

test("a modified file is blamed only for imports it newly introduces", (t) => {
  const cwd = fixture(t);
  commit(cwd, "Add feature model", [["src/features/auth/model/auth.ts", "export const login = () => {};\n"]]);
  commit(cwd, "Add clean shared button", [["src/shared/ui/button.tsx", "export {};\n"]]);
  commit(cwd, "Button now imports the feature", [
    ["src/shared/ui/button.tsx", "import { login } from \"../../features/auth/model/auth\";\nexport {};\n"],
  ]);
  commit(cwd, "Touch the button without changing imports", [
    ["src/shared/ui/button.tsx", "import { login } from \"../../features/auth/model/auth\";\n// comment\nexport {};\n"],
  ]);
  const report = historyProject(cwd, {});
  assert.equal(report.erosion.totalErodingCommits, 1);
  assert.equal(report.erosion.commits[0].subject, "Button now imports the feature");
  const bySubject = new Map(report.commits.map((c) => [c.subject, c.erosionCount]));
  assert.equal(bySubject.get("Add clean shared button"), 0);
  assert.equal(bySubject.get("Touch the button without changing imports"), 0);
});

test("deleting a misplaced file is not erosion for the deleting commit", (t) => {
  const cwd = fixture(t);
  commit(cwd, "Add stray component", [["src/components/button.tsx", "export {};\n"]]);
  remove(cwd, "Remove stray component", "src/components/button.tsx");
  const report = historyProject(cwd, {});
  assert.equal(report.erosion.totalErodingCommits, 1);
  assert.equal(report.erosion.commits[0].subject, "Add stray component");
  const bySubject = new Map(report.commits.map((c) => [c.subject, c.erosionCount]));
  assert.equal(bySubject.get("Remove stray component"), 0);
});

test("erosion summary ranks the worst offenders first", (t) => {
  const cwd = fixture(t);
  commit(cwd, "One stray file", [["src/components/a.tsx", "export {};\n"]]);
  commit(cwd, "Two stray files", [
    ["src/utils/a.ts", "export {};\n"],
    ["src/lib/b.ts", "export {};\n"],
  ]);
  const report = historyProject(cwd, {});
  assert.equal(report.erosion.totalErodingCommits, 2);
  assert.equal(report.erosion.totalErodingFiles, 3);
  assert.equal(report.erosion.worstOffenders.length, 2);
  assert.equal(report.erosion.worstOffenders[0].subject, "Two stray files");
  assert.equal(report.erosion.worstOffenders[0].count, 2);
  assert.equal(report.erosion.worstOffenders[1].subject, "One stray file");
});

test("erosion is summed per author, worst author first", (t) => {
  const cwd = fixture(t);
  commitAs(cwd, "Ada adds one stray file", [["src/components/a.tsx", "export {};\n"]], "Ada Lovelace");
  commitAs(cwd, "Grace adds two stray files", [
    ["src/utils/a.ts", "export {};\n"],
    ["src/lib/b.ts", "export {};\n"],
  ], "Grace Hopper");
  commitAs(cwd, "Ada adds another stray file", [["src/components/b.tsx", "export {};\n"]], "Ada Lovelace");
  const report = historyProject(cwd, {});
  assert.deepEqual(report.erosion.byAuthor, [
    { author: "Ada Lovelace", commits: 2, files: 2 },
    { author: "Grace Hopper", commits: 1, files: 2 },
  ]);
  assert.equal(report.erosion.commits[0].author, "Ada Lovelace");
});

test("empty and single-commit histories degrade gracefully", (t) => {
  const empty = fixture(t);
  const emptyReport = historyProject(empty, {});
  assert.deepEqual(emptyReport.commits, []);
  assert.deepEqual(emptyReport.erosion, {
    commits: [],
    totalErodingCommits: 0,
    totalErodingFiles: 0,
    worstOffenders: [],
    byAuthor: [],
  });

  const single = fixture(t);
  commit(single, "Only commit", [["src/features/auth/ui.tsx", "export {};\n"]]);
  const singleReport = historyProject(single, {});
  assert.equal(singleReport.commits.length, 1);
  assert.equal(singleReport.erosion.totalErodingFiles, 0);
});

test("history CLI prints the erosion section, or none when clean", (t) => {
  const dirty = fixture(t);
  commit(dirty, "Add stray component", [["src/components/button.tsx", "export {};\n"]]);
  const dirtyResult = runHistory(dirty);
  assert.equal(dirtyResult.status, 0, dirtyResult.stderr);
  assert.match(dirtyResult.stdout, /Erosion \(oldest first\):/);
  assert.match(dirtyResult.stdout, /src\/components\/button\.tsx — misplaced: expected \(inside a layer\), actual components/);
  assert.match(dirtyResult.stdout, /Eroding commits: 1 of 1 · Eroding files: 1/);
  assert.match(dirtyResult.stdout, /Worst offenders:/);
  assert.match(dirtyResult.stdout, /Erosion by author:/);
  assert.match(dirtyResult.stdout, /FSD Test: 1 eroding file in 1 commit/);

  const clean = fixture(t);
  commit(clean, "Add clean feature", [["src/features/auth/ui.tsx", "export {};\n"]]);
  const cleanResult = runHistory(clean);
  assert.equal(cleanResult.status, 0, cleanResult.stderr);
  assert.match(cleanResult.stdout, /Erosion: none in the sampled commits\./);
  assert.match(cleanResult.stdout, /Add clean feature/);
});
