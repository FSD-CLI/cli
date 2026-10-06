import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAndCapture } from "./ci/run-and-capture.mjs";

const version = process.env.CLI_SMOKE_VERSION;
const framework = process.env.CLI_SMOKE_FRAMEWORK ?? "react-vite";
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  throw new Error("CLI_SMOKE_VERSION must be an exact published semver, never latest or a command.");
}
if (!["react-vite", "nextjs"].includes(framework)) throw new Error("Unsupported release smoke framework.");
const npmPath = process.env.npm_execpath;
if (!npmPath || !/npm-cli\.js$/.test(npmPath)) throw new Error("Run with npm run smoke:published.");
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "fsd npm smoke-"));
const logDirectory = path.resolve(process.env.CI_ARTIFACTS_DIR ?? "ci-artifacts", `published-${framework}`);
const installer = path.join(workspace, "cli-install");
fs.mkdirSync(installer);
let succeeded = false;
function run(label, args, cwd, command = process.execPath) {
  const result = runAndCapture({command, args, cwd, logDirectory, label});
  if (result.exitCode !== 0) throw new Error(`${label} failed (${result.exitCode}); ${result.logPath}`);
  return result.stdout.trim();
}
function npm(label, args, cwd) { return run(label, [npmPath, ...args], cwd); }
try {
  const metadata = JSON.parse(npm("01-registry", ["view", `create-fsd-architecture@${version}`, "--json"], workspace));
  assert.equal(metadata.version, version, "registry returned a different version");
  assert(metadata.dist?.integrity && metadata.dist?.tarball, "registry integrity/tarball missing");
  const evidence = {date: new Date().toISOString(), version, framework, node: process.version,
    os: `${process.platform}/${process.arch}`, npm: npm("02-npm-version", ["--version"], workspace),
    integrity: metadata.dist.integrity, gitHead: metadata.gitHead, tarball: metadata.dist.tarball};
  fs.writeFileSync(path.join(logDirectory, "metadata.json"), JSON.stringify(evidence, null, 2) + "\n");
  const packed = JSON.parse(npm("03-package-content", ["pack", `create-fsd-architecture@${version}`, "--dry-run", "--json"], workspace));
  const packageFiles = new Set(packed[0].files.map((file) => file.path));
  for (const required of ["package.json", "bin/index.mjs", "bin/generator.mjs", "bin/commands/create-project.mjs", "bin/commands/upgrade-project.mjs", "bin/core/template-registry.mjs", "schema/fsd.config.schema.json"]) {
    assert(packageFiles.has(required), `published artifact is missing ${required}`);
  }
  npm("04-install-cli", ["install", "--prefix", installer, "--ignore-scripts", "--no-audit", "--no-fund", `create-fsd-architecture@${version}`], workspace);
  const installed = path.join(installer, "node_modules", "create-fsd-architecture");
  assert.equal(JSON.parse(fs.readFileSync(path.join(installed, "package.json"))).version, version);
  const cli = path.join(installed, "bin", "index.mjs");
  const actualVersion = run("05-version", [cli, "--version"], workspace);
  assert(actualVersion.includes(version), "CLI --version did not identify the requested version");
  run("06-help", [cli, "--help"], workspace);
  run("07-templates", [cli, "--list-templates"], workspace);
  run("08-create", [cli, "app", "--framework", framework, "--package-manager", "npm", "--yes", "--no-start"], workspace);
  const project = path.join(workspace, "app");
  for (const [kind, name] of [["feature", "checkout"], ["entity", "product"], ["widget", "cart-summary"], ["page", "account"]]) {
    run(`generate-${kind}`, [cli, "--generate", kind, name], project);
  }
  run("09-doctor", [cli, "doctor"], project);
  run("10-check", [cli, "check"], project);
  npm("11-generated-ci", ["run", "ci"], project);
  const config = JSON.parse(fs.readFileSync(path.join(project, "fsd.config.json"), "utf8"));
  assert.equal(config.framework, framework);
  fs.writeFileSync(path.join(logDirectory, "fsd.config.json"), JSON.stringify(config, null, 2) + "\n");
  fs.writeFileSync(path.join(logDirectory, "result.json"), JSON.stringify({status:"PASS", ...evidence}, null, 2) + "\n");
  succeeded = true;
  console.log(`Published ${version} / ${framework}: PASS; evidence ${logDirectory}`);
} finally {
  if (succeeded) fs.rmSync(workspace, {recursive:true, force:true});
  else console.error(`Failed smoke workspace retained: ${workspace}; evidence ${logDirectory}`);
}
