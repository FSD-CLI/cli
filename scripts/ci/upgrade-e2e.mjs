// Historical upgrade E2E: create a project with a published CLI release, then
// prove the current CLI's upgrade path on it end to end:
//   check (available) -> dry-run (read-only) -> conflict refusal ->
//   partial-failure rollback -> apply -> check (current) -> install -> build.
// Usage: node scripts/ci/upgrade-e2e.mjs <framework> <cli-version> [--skip-build]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(repoRoot, "bin", "index.mjs");
const [framework, version, ...flags] = process.argv.slice(2);
const skipBuild = flags.includes("--skip-build");
const isWindows = process.platform === "win32";

if (!framework || !version) {
  console.error("Usage: node scripts/ci/upgrade-e2e.mjs <framework> <cli-version> [--skip-build]");
  process.exit(64);
}

const EXIT = { CURRENT: 0, AVAILABLE: 2, BLOCKED: 3 };

function run(label, command, args, cwd, { expect = 0, allowAny = false } = {}) {
  console.log(`\n[${label}] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: isWindows && command !== process.execPath,
    env: { ...process.env, HUSKY: "0", CI: "true" },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const status = result.status ?? 1;
  if (!allowAny && (Array.isArray(expect) ? !expect.includes(status) : status !== expect)) {
    throw new Error(`${label}: expected exit ${expect}, got ${status}`);
  }
  return { ...result, status };
}

const fsd = (label, args, cwd, options) => run(label, process.execPath, [cli, ...args], cwd, options);
const git = (args, cwd) => run(`git ${args[0]}`, "git", args, cwd);

function commit(cwd, message, addArgs) {
  git(["add", ...addArgs], cwd);
  git(["-c", "user.email=ci@example.com", "-c", "user.name=CI", "commit", "-q", "--no-verify", "--allow-empty", "-m", message], cwd);
}

function gitStatus(cwd) {
  return spawnSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" }).stdout.trim();
}

function snapshot(cwd) {
  return spawnSync("git", ["diff", "HEAD", "--stat"], { cwd, encoding: "utf8" }).stdout.trim();
}

function dependencyVersions(cwd) {
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `fsd-upgrade-${framework}-${version}-`));
const project = path.join(workspace, "app");
const report = { framework, fromVersion: version, steps: [] };
const step = (name, detail = "") => {
  report.steps.push({ name, detail });
  console.log(`\n✔ ${name}${detail ? ` — ${detail}` : ""}`);
};

try {
  run("create (historical)", "npx", [
    "-y",
    `create-fsd-architecture@${version}`,
    "app",
    "--framework",
    framework,
    "--package-manager",
    "npm",
    "--yes",
    "--no-install",
    "--no-start",
  ], workspace);
  assert(fs.existsSync(path.join(project, "fsd.config.json")), "historical project has no fsd.config.json");
  // Historical CLIs initialize Git themselves; commit whatever they left so
  // the upgrade sees a clean worktree. Hooks are skipped (no dependencies yet).
  if (!fs.existsSync(path.join(project, ".git"))) git(["init", "-q"], project);
  commit(project, "historical", ["-A"]);
  step("historical project created", `create-fsd-architecture@${version}`);
  const dependenciesBefore = dependencyVersions(project);

  fsd("upgrade --check", ["upgrade", "--check"], project, { expect: EXIT.AVAILABLE });
  step("upgrade --check reports an available upgrade");

  fsd("upgrade --dry-run", ["upgrade", "--dry-run"], project);
  assert(gitStatus(project) === "", "dry-run changed the working tree");
  step("dry-run is read-only");

  // Negative: a user-edited managed hook must block the whole upgrade.
  const hook = path.join(project, ".husky", "pre-commit");
  fs.appendFileSync(hook, "\necho user-customized\n");
  commit(project, "customize hook", ["-A"]);
  fsd("upgrade --check (customized)", ["upgrade", "--check"], project, { expect: EXIT.BLOCKED });
  fsd("upgrade --yes (customized)", ["upgrade", "--yes", "--no-install"], project, { allowAny: true });
  assert(gitStatus(project) === "", "a blocked upgrade wrote files");
  git(["reset", "-q", "--hard", "HEAD~1"], project);
  step("customized managed file blocks the upgrade without writes");

  // Negative: a failure late in the transaction must roll back earlier writes.
  if (!isWindows) {
    // Backups stay writable, so hook and config updates are applied first and
    // only the final manifest write into .fsd fails.
    const lockedDir = path.join(project, ".fsd");
    const hadManifestDir = fs.existsSync(lockedDir);
    fs.mkdirSync(path.join(lockedDir, "backups"), { recursive: true });
    fs.chmodSync(lockedDir, 0o555);
    const before = snapshot(project);
    const failed = fsd("upgrade --yes (unwritable .fsd)", ["upgrade", "--yes", "--no-install", "--allow-dirty"], project, { allowAny: true });
    fs.chmodSync(lockedDir, 0o755);
    if (!hadManifestDir) fs.rmSync(lockedDir, { recursive: true, force: true });
    else fs.rmSync(path.join(lockedDir, "backups"), { recursive: true, force: true });
    assert(failed.status !== 0, "upgrade succeeded although .fsd was not writable");
    assert(/rolled back/.test(failed.stderr), "failure did not report a rollback");
    assert(!/mkdir .*backups/.test(failed.stderr), "failure happened before any write, not mid-transaction");
    assert(snapshot(project) === before, "partial failure left modified tracked files");
    for (const leftover of fs.readdirSync(workspace).filter((name) => name !== "app")) {
      fs.rmSync(path.join(workspace, leftover), { recursive: true, force: true });
    }
    git(["clean", "-fdq", "-e", "node_modules"], project);
    step("partial failure rolls back tracked files");
  } else {
    step("partial failure rollback", "skipped on Windows (POSIX permissions)");
  }

  fsd("upgrade --yes", ["upgrade", "--yes", "--no-install"], project);
  fsd("upgrade --check (after)", ["upgrade", "--check"], project, { expect: EXIT.CURRENT });
  const manifest = JSON.parse(fs.readFileSync(path.join(project, ".fsd", "manifest.json"), "utf8"));
  step("upgrade applied", `state ${manifest.stateVersion}, migrations ${manifest.appliedMigrations.join(", ")}`);

  const dependenciesAfter = dependencyVersions(project);
  const changed = Object.keys({ ...dependenciesBefore, ...dependenciesAfter }).filter(
    (name) => dependenciesBefore[name] !== dependenciesAfter[name]
  );
  report.dependencyChanges = changed.map((name) => ({
    name,
    before: dependenciesBefore[name] ?? null,
    after: dependenciesAfter[name] ?? null,
  }));
  step(
    "dependency versions",
    changed.length ? `changed: ${changed.join(", ")}` : "unchanged (the upgrade only migrates CLI-owned tooling)"
  );

  if (!skipBuild) {
    run("npm install", "npm", ["install", "--no-audit", "--no-fund"], project);
    if (framework === "nuxt") run("nuxt prepare", "npx", ["nuxt", "prepare"], project);
    run("npm run build", "npm", ["run", "build"], project);
    step("install and build succeed after upgrade");
  }

  report.result = "pass";
} catch (error) {
  report.result = "fail";
  report.error = error.message;
  console.error(`\n✖ ${error.message}`);
  process.exitCode = 1;
} finally {
  const outDir = process.env.CI_ARTIFACTS_DIR ?? path.join(repoRoot, "ci-artifacts");
  fs.mkdirSync(path.join(outDir, "upgrade-e2e"), { recursive: true });
  const reportPath = path.join(outDir, "upgrade-e2e", `${framework}-${version}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReport: ${reportPath}`);
  if (report.result === "pass") fs.rmSync(workspace, { recursive: true, force: true });
}
