#!/usr/bin/env node
// docs/qa/2.6.1/evidence/scripts/qa-evidence.mjs
//
// Portable evidence runner for the 2.6.1 QA baseline (Windows, Linux, macOS). No dependencies.
// It runs the CLI under test, records every command with cwd, exit code, timing and raw
// stdout/stderr logs, and checks outcomes. Nothing here modifies the repository.
//
// Repository root: derived from this file's location (5 levels up) or FSD_CLI_ROOT.
// Workspace: --work <dir> or QA_WORK (required, must be outside the repository). The
// runner only creates and deletes things inside the workspace, and only after the
// workspace carries its marker file.
//
// Usage:
//   node docs/qa/2.6.1/evidence/scripts/qa-evidence.mjs --work <dir> [--out <dir>] [--groups a,b] [--audited <sha>]
//
// Groups (default: all except "install"): provenance, create, generate, inspect, upgrade,
// legacy, doctor-managers, imports, probe, packed, published, templates-end, install
//
// Exit code: 0 when no executed case failed, 1 when at least one failed, 2 for usage errors.

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.FSD_CLI_ROOT || path.join(HERE, "..", "..", "..", "..", ".."));
const IS_WIN = process.platform === "win32";
const SHELL_CMDS = new Set(["npm", "pnpm", "yarn", "bun"]); // .cmd shims on Windows need a shell

// ---------- arguments ----------
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
function usage(msg) {
  console.error(msg);
  console.error("Usage: node qa-evidence.mjs --work <dir> [--out <dir>] [--groups a,b] [--audited <sha>]");
  process.exit(2);
}
const workArg = opt("work", process.env.QA_WORK);
if (!workArg) usage("Missing --work <dir> (or QA_WORK). The workspace must be outside the repository.");
const WORK = path.resolve(workArg);
const OUT = path.resolve(opt("out", path.join(WORK, `evidence-${crypto.randomUUID()}`)));
const LOGS = path.join(OUT, "logs");
const CMD_TIMEOUT_MS = Number(opt("cmd-timeout", 180)) * 1000; // per command, seconds on the command line
const AUDITED = opt("audited", "9640dcc6ab47ebfaedda60ff80572a3ce08e9562");
const DEFAULT_GROUPS = ["provenance", "create", "generate", "inspect", "upgrade", "legacy", "doctor-managers", "imports", "probe", "packed", "published", "templates-end"];
const GROUPS = new Set((opt("groups", "") || "").split(",").filter(Boolean).length ? opt("groups").split(",") : DEFAULT_GROUPS);
const want = (g) => GROUPS.has(g);

// ---------- workspace guards ----------
const MARKER = ".fsd-qa-workspace";
const within = (parent, child) => {
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
};
if (WORK === ROOT || within(ROOT, WORK) || within(WORK, ROOT)) usage(`Workspace must be outside the repository (${ROOT}): ${WORK}`);
if (WORK === path.parse(WORK).root || WORK === os.homedir()) usage(`Refusing to use ${WORK} as a workspace.`);
if (fs.existsSync(OUT) && (!fs.statSync(OUT).isDirectory() || fs.readdirSync(OUT).length)) {
  usage(`Output must be a new or empty directory; refusing to overwrite existing evidence: ${OUT}`);
}
if (fs.existsSync(WORK)) {
  const entries = fs.readdirSync(WORK);
  if (entries.length && !entries.includes(MARKER)) usage(`${WORK} is not empty and has no ${MARKER} marker. Use an empty or dedicated folder.`);
} else {
  fs.mkdirSync(WORK, { recursive: true });
}
fs.writeFileSync(path.join(WORK, MARKER), "created by qa-evidence.mjs; safe to delete\n");
function safeRemove(target) {
  const abs = path.resolve(target);
  if (!fs.existsSync(path.join(WORK, MARKER)) || !within(WORK, abs)) throw new Error(`Refusing to delete outside the QA workspace: ${abs}`);
  fs.rmSync(abs, { recursive: true, force: true });
}
fs.mkdirSync(LOGS, { recursive: true });

// ---------- recording ----------
const results = [];
const RESULTS = path.join(OUT, "results.jsonl");
fs.writeFileSync(RESULTS, "");
const quote = (a) => (/\s/.test(a) ? `"${a}"` : a);
function push(row) {
  results.push(row);
  fs.appendFileSync(RESULTS, JSON.stringify(row) + "\n");
  const tag = row.status.padEnd(10);
  console.log(`[${tag}] ${row.id}${row.exit !== undefined ? ` (exit ${row.exit})` : ""}${row.note ? ` - ${row.note}` : ""}`);
}
function run(id, group, cmd, args, { cwd = WORK, expect = 0, timeout = CMD_TIMEOUT_MS, env = {}, note = "" } = {}) {
  const shell = IS_WIN && SHELL_CMDS.has(cmd);
  const started = new Date();
  const out = path.join(LOGS, `${id}.stdout.log`);
  const err = path.join(LOGS, `${id}.stderr.log`);
  // Output goes straight to the log files (no pipes) and stdin is closed, so a command that
  // waits for input or keeps a pipe open cannot stall the runner; the timeout still applies.
  const fo = fs.openSync(out, "w");
  const fe = fs.openSync(err, "w");
  const r = spawnSync(cmd, shell ? args.map(quote) : args, {
    cwd, shell, timeout, env: { ...process.env, CI: "1", ...env }, stdio: ["ignore", fo, fe],
  });
  fs.closeSync(fo);
  fs.closeSync(fe);
  const ended = new Date();
  if (r.error) fs.appendFileSync(err, `\n[spawn error] ${r.error.code ?? ""} ${r.error.message}\n`);
  const ok = !r.error && r.status === expect;
  push({
    id, group, status: ok ? "PASS" : "FAIL", command: [cmd, ...args].map(quote).join(" "), cwd,
    exit: r.status, signal: r.signal ?? null, spawnError: r.error ? `${r.error.code ?? ""} ${r.error.message}` : null,
    expected: `exit ${expect}`, startedAt: started.toISOString(), endedAt: ended.toISOString(), durationMs: ended - started,
    stdout: path.relative(OUT, out).split(path.sep).join("/"), stderr: path.relative(OUT, err).split(path.sep).join("/"), note,
  });
  return r;
}
function check(id, group, description, ok, observed) {
  push({ id, group, status: ok ? "PASS" : "FAIL", command: "(assertion)", expected: description, observed, note: observed });
}
function skip(id, group, reason) {
  push({ id, group, status: "NOT TESTED", command: "(not run)", note: reason });
}
const runCli = (id, group, args, opts) => run(id, group, "node", [path.join(ROOT, "bin", "index.mjs"), ...args], opts);
const tool = (name) => {
  const r = spawnSync(name, ["--version"], { encoding: "utf8", shell: IS_WIN && SHELL_CMDS.has(name) });
  return !r.error && r.status === 0 ? r.stdout.trim().split("\n")[0] : null;
};
const git = (...a) => spawnSync("git", a, { cwd: ROOT, encoding: "utf8" });

// ---------- registry (templates and frameworks come from the CLI itself) ----------
const registry = await import(pathToFileURL(path.join(ROOT, "bin", "core", "template-registry.mjs")).href);
const TEMPLATES = registry.listTemplates({ includePlanned: false }).map((t) => ({ id: t.value, repo: t.repo }));
const srcDir = (fw) => (fw === "nuxt" ? "app" : "src");
const LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];
const proj = (fw) => path.join(WORK, `${fw}-r2`);
const GEN = [["feature", "profile", "features/profile"], ["entity", "user", "entities/user"], ["widget", "header", "widgets/header"], ["page", "account", "pages/account"], ["feature", "auth", "features/auth"]];

const lsRemote = (repo) => {
  const r = spawnSync("git", ["ls-remote", `https://github.com/${repo}.git`, "HEAD"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.split(/\s/)[0] : null;
};
const templateShasStart = {};

// Every run needs metadata, including runs that omit the provenance checks.
{
  const head = git("rev-parse", "HEAD").stdout.trim();
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const manifest = {
    createdAt: new Date().toISOString(), repoRoot: ROOT, workspace: WORK, output: OUT, repoHead: head,
    branch: git("rev-parse", "--abbrev-ref", "HEAD").stdout.trim(), auditedCliSha: AUDITED, cliVersion: pkg.version,
    scriptSha256: crypto.createHash("sha256").update(fs.readFileSync(fileURLToPath(import.meta.url))).digest("hex"),
    os: `${os.type()} ${os.release()} ${os.arch()}`, node: process.version,
    tools: { npm: tool("npm"), pnpm: tool("pnpm"), yarn: tool("yarn"), bun: tool("bun"), git: tool("git") },
    groups: [...GROUPS],
  };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

// ---------- provenance ----------
if (want("provenance")) {
  const head = git("rev-parse", "HEAD").stdout.trim();
  const dirty = git("status", "--porcelain", "--", ".", ":(exclude)docs/qa").stdout.trim();
  check("R2-PROV-01", "provenance", "repository tree (outside docs/qa) is clean", dirty === "", dirty || "clean");
  const diff = spawnSync("git", ["diff", "--quiet", AUDITED, "HEAD", "--", ".", ":(exclude)docs"], { cwd: ROOT });
  check("R2-PROV-02", "provenance", `code outside docs/ is identical to audited CLI SHA ${AUDITED.slice(0, 7)}`, diff.status === 0,
    diff.status === 0 ? "identical" : `git diff exit ${diff.status} (repo HEAD ${head.slice(0, 7)} differs from the audited CLI)`);
  for (const t of TEMPLATES) {
    templateShasStart[t.id] = lsRemote(t.repo);
    check(`R2-PROV-TPL-${t.id}`, "provenance", `template ${t.repo} HEAD resolvable`, !!templateShasStart[t.id], templateShasStart[t.id] ?? "git ls-remote failed");
  }
}

// ---------- create (no install) ----------
if (want("create")) {
  for (const { id: fw } of TEMPLATES) {
    if (fs.existsSync(proj(fw))) safeRemove(proj(fw));
    runCli(`R2-CREATE-${fw}`, "create", [`${fw}-r2`, "--framework", fw, "--yes", "--package-manager", "npm", "--no-install", "--no-start"], { cwd: WORK });
    const p = proj(fw);
    let cfg = null;
    try { cfg = JSON.parse(fs.readFileSync(path.join(p, "fsd.config.json"), "utf8")); } catch { /* reported below */ }
    check(`R2-CREATE-${fw}-config`, "create", `fsd.config.json exists with framework=${fw}`, cfg?.framework === fw, cfg ? `framework=${cfg.framework}; stack=${[cfg.apiClient, cfg.serverState, cfg.clientState, cfg.forms].join(", ")}` : "missing or invalid");
    const missing = LAYERS.filter((l) => !fs.existsSync(path.join(p, srcDir(fw), l)));
    check(`R2-CREATE-${fw}-layers`, "create", `six FSD layers under ${srcDir(fw)}/`, missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : "all six present");
  }
}

// ---------- generators ----------
if (want("generate")) {
  for (const { id: fw } of TEMPLATES) {
    if (!fs.existsSync(proj(fw))) { skip(`R2-GEN-${fw}`, "generate", "project from the create group is missing (run the create group first)"); continue; }
    for (const [type, name, rel] of GEN) {
      runCli(`R2-GEN-${fw}-${type}-${name}`, "generate", ["--generate", type, name], { cwd: proj(fw) });
      const dir = path.join(proj(fw), srcDir(fw), ...rel.split("/"));
      check(`R2-GEN-${fw}-${type}-${name}-exists`, "generate", `${srcDir(fw)}/${rel} exists`, fs.existsSync(dir), fs.existsSync(dir) ? "present" : "missing");
    }
  }
}

// ---------- inspect ----------
if (want("inspect")) {
  for (const { id: fw } of TEMPLATES) {
    if (!fs.existsSync(proj(fw))) { skip(`R2-INSPECT-${fw}`, "inspect", "project is missing"); continue; }
    for (const c of ["check", "config", "doctor"]) runCli(`R2-INSPECT-${c}-${fw}`, "inspect", [c], { cwd: proj(fw) });
  }
}

// ---------- upgrade on fresh projects ----------
if (want("upgrade")) {
  for (const { id: fw } of TEMPLATES) {
    if (!fs.existsSync(proj(fw))) { skip(`R2-UPG-${fw}`, "upgrade", "project is missing"); continue; }
    runCli(`R2-UPG-check-${fw}`, "upgrade", ["upgrade", "--check"], { cwd: proj(fw) });
    runCli(`R2-UPG-dry-${fw}`, "upgrade", ["upgrade", "--dry-run"], { cwd: proj(fw) });
  }
}

// ---------- legacy-state SIMULATION (not a real historical project) ----------
if (want("legacy")) {
  const base = proj("react-vite");
  const legacy = path.join(WORK, "react-vite-legacy-sim");
  if (!fs.existsSync(base)) {
    skip("R2-LEGACY-SIM", "legacy", "react-vite project is missing");
  } else {
    if (fs.existsSync(legacy)) safeRemove(legacy);
    fs.cpSync(base, legacy, { recursive: true });
    safeRemove(path.join(legacy, ".fsd")); // simulates a project without the ownership manifest
    runCli("R2-LEGACY-SIM-check", "legacy", ["upgrade", "--check"], { cwd: legacy, expect: 2, note: "simulation: .fsd/ deleted from a fresh project" });
    runCli("R2-LEGACY-SIM-dry-run", "legacy", ["upgrade", "--dry-run"], { cwd: legacy, note: "simulation" });
    runCli("R2-LEGACY-SIM-apply", "legacy", ["upgrade", "--yes", "--no-install", "--allow-dirty"], { cwd: legacy, note: "simulation" });
    runCli("R2-LEGACY-SIM-recheck", "legacy", ["upgrade", "--check"], { cwd: legacy, note: "simulation" });
  }
  skip("R2-UPG-HIST-E2E", "legacy", "no real historical (2.5.x) project, install and build exists; templates are unpinned");
}

// ---------- doctor per package manager (CLI invocation, no download) ----------
if (want("doctor-managers")) {
  const base = proj("react-vite");
  if (!fs.existsSync(base)) skip("R2-DOCTOR-managers", "doctor-managers", "react-vite project is missing");
  else for (const pm of ["npm", "pnpm", "yarn", "bun"]) {
    const version = tool(pm);
    if (!version) { skip(`R2-DOCTOR-${pm}`, "doctor-managers", `${pm} is not installed on this machine`); continue; }
    const dir = path.join(WORK, `doctor-${pm}`);
    if (fs.existsSync(dir)) safeRemove(dir);
    fs.cpSync(base, dir, { recursive: true });
    const cfgPath = path.join(dir, "fsd.config.json");
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    cfg.packageManager = pm;
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
    runCli(`R2-DOCTOR-${pm}`, "doctor-managers", ["doctor"], { cwd: dir, note: `${pm} ${version} is installed` });
  }
}

// ---------- backslashes in generated imports ----------
if (want("imports")) {
  const re = /\b(?:from|import)\s*\(?\s*["'][^"'\n]*\\[^"'\n]*["']/;
  const walk = (d, acc = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      const p = path.join(d, e.name);
      e.isDirectory() ? walk(p, acc) : /\.(ts|tsx|js|mjs|vue|svelte)$/.test(e.name) && acc.push(p);
    }
    return acc;
  };
  for (const { id: fw } of TEMPLATES) {
    if (!fs.existsSync(proj(fw))) { skip(`R2-IMPORTS-${fw}`, "imports", "project is missing"); continue; }
    const hits = walk(path.join(proj(fw), srcDir(fw))).filter((f) => re.test(fs.readFileSync(f, "utf8")));
    check(`R2-IMPORTS-${fw}`, "imports", "no backslash inside import/export module specifiers of generated sources", hits.length === 0,
      hits.length ? `${hits.length} file(s): ${hits.slice(0, 3).map((h) => path.relative(proj(fw), h)).join(", ")}` : "none found");
  }
}

// ---------- plan path separators probe ----------
if (want("probe")) {
  run("R2-PROBE-paths", "probe", "node", [path.join(HERE, "probe-paths.mjs")], { cwd: ROOT, env: { FSD_CLI_ROOT: ROOT }, note: "prints generatedFiles for a page generator plan" });
  try {
    const plan = JSON.parse(fs.readFileSync(path.join(LOGS, "R2-PROBE-paths.stdout.log"), "utf8"));
    const sep = plan.generatedFiles.some((f) => f.includes("\\")) ? "backslash" : "forward slash";
    push({ id: "R2-PROBE-paths-separator", group: "probe", status: "INFO", command: "(observation)", note: `generatedFiles use ${sep} separators on ${process.platform}` });
  } catch { /* the PROBE case already failed */ }
}

// ---------- packed artifact ----------
const pkgVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
function installedCli(dir) { return path.join(dir, "node_modules", "create-fsd-architecture", "bin", "index.mjs"); }
if (want("packed")) {
  const dir = path.join(WORK, "packed");
  if (fs.existsSync(dir)) safeRemove(dir);
  fs.mkdirSync(dir, { recursive: true });
  const r = run("R2-PACK-npm-pack", "packed", "npm", ["pack", "--pack-destination", dir], { cwd: ROOT });
  const tgz = fs.readdirSync(dir).find((f) => f.endsWith(".tgz"));
  if (r.status !== 0 || !tgz) skip("R2-PACK-rest", "packed", "npm pack failed");
  else {
    const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, tgz))).digest("hex");
    push({ id: "R2-PACK-sha256", group: "packed", status: "INFO", command: "(observation)", note: `${tgz} sha256 ${sha}` });
    run("R2-PACK-npm-init", "packed", "npm", ["init", "-y"], { cwd: dir });
    run("R2-PACK-npm-install", "packed", "npm", ["install", path.join(dir, tgz)], { cwd: dir });
    run("R2-PACK-version", "packed", "node", [installedCli(dir), "--version"], { cwd: dir });
    run("R2-PACK-create-react-vite", "packed", "node", [installedCli(dir), "packed-rv", "--framework", "react-vite", "--yes", "--package-manager", "npm", "--no-install", "--no-start"], { cwd: dir });
  }
}

// ---------- published package ----------
if (want("published")) {
  const dir = path.join(WORK, "published");
  if (fs.existsSync(dir)) safeRemove(dir);
  fs.mkdirSync(dir, { recursive: true });
  run("R2-PUB-npm-view", "published", "npm", ["view", `create-fsd-architecture@${pkgVersion}`, "version", "dist.shasum", "dist.integrity", "time.modified"], { cwd: dir });
  run("R2-PUB-npm-init", "published", "npm", ["init", "-y"], { cwd: dir });
  run("R2-PUB-npm-install", "published", "npm", ["install", `create-fsd-architecture@${pkgVersion}`], { cwd: dir });
  run("R2-PUB-version", "published", "node", [installedCli(dir), "--version"], { cwd: dir });
  run("R2-PUB-create-react-vite", "published", "node", [installedCli(dir), "published-rv", "--framework", "react-vite", "--yes", "--package-manager", "npm", "--no-install", "--no-start"], { cwd: dir });
}

// ---------- optional: create WITH install, then the template's own ci script (large downloads) ----------
if (want("install")) {
  for (const { id: fw } of TEMPLATES) {
    const dir = path.join(WORK, `${fw}-install`);
    if (fs.existsSync(dir)) safeRemove(dir);
    const r = run(`R2-INSTALL-create-${fw}`, "install", "node", [path.join(ROOT, "bin", "index.mjs"), `${fw}-install`, "--framework", fw, "--yes", "--package-manager", "npm", "--no-start"], { cwd: WORK, timeout: 30 * 60 * 1000 });
    if (r.status === 0) run(`R2-INSTALL-ci-${fw}`, "install", "npm", ["run", "ci"], { cwd: dir, timeout: 30 * 60 * 1000 });
    else skip(`R2-INSTALL-ci-${fw}`, "install", "create with install failed; see the create case");
  }
}

// ---------- templates moved during the run? ----------
if (want("templates-end") && Object.keys(templateShasStart).length) {
  for (const t of TEMPLATES) {
    const end = lsRemote(t.repo);
    check(`R2-TPL-END-${t.id}`, "templates-end", `template ${t.repo} HEAD unchanged since the start of the run`, end === templateShasStart[t.id], `${templateShasStart[t.id]} -> ${end}`);
  }
}

// ---------- summary ----------
const executed = results.filter((r) => r.status === "PASS" || r.status === "FAIL");
const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.filter((r) => r.status === "FAIL").length;
const notTested = results.filter((r) => r.status === "NOT TESTED").length;
const by = {};
for (const r of results) { by[r.group] ??= { PASS: 0, FAIL: 0, "NOT TESTED": 0, INFO: 0 }; by[r.group][r.status]++; }
const lines = [
  "# Evidence run summary (generated)", "",
  `Platform ${process.platform} ${os.arch()}, Node ${process.version}. Rows: ${results.length}.`, "",
  `- Executed: ${executed.length}, PASS ${pass}, FAIL ${fail}, NOT TESTED ${notTested}`,
  `- Coverage (executed / counted rows): ${executed.length}/${executed.length + notTested}`,
  `- Pass rate (PASS / executed): ${executed.length ? ((100 * pass) / executed.length).toFixed(1) : "n/a"}%`, "",
  "| Group | PASS | FAIL | NOT TESTED | INFO |", "|---|---|---|---|---|",
  ...Object.entries(by).map(([g, c]) => `| ${g} | ${c.PASS} | ${c.FAIL} | ${c["NOT TESTED"]} | ${c.INFO} |`), "",
  "## Failures", "",
  ...(fail ? results.filter((r) => r.status === "FAIL").map((r) => `- ${r.id}: ${r.command} (exit ${r.exit ?? "-"}) ${r.note ?? ""}`) : ["none"]),
];
fs.writeFileSync(path.join(OUT, "SUMMARY.md"), lines.join("\n") + "\n");
console.log("\n" + lines.join("\n"));
process.exit(fail ? 1 : 0);
