import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runAndCapture } from "./run-and-capture.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = path.join(repoRoot, "bin", "index.mjs");
const logDirectory = path.join(
  process.env.CI_ARTIFACTS_DIR ?? path.join(repoRoot, "ci-artifacts"),
  "os-smoke"
);

function printOutput(record) {
  if (record.stdout) process.stdout.write(record.stdout);
  if (record.stderr) process.stderr.write(record.stderr);
}

function runStep(label, args, cwd, { expectFailure = false } = {}) {
  console.log(`\n[${label}] ${JSON.stringify([process.execPath, ...args])}`);
  const record = runAndCapture({
    command: process.execPath,
    args,
    cwd,
    logDirectory,
    label,
  });
  printOutput(record);

  if (expectFailure ? record.exitCode === 0 : record.exitCode !== 0) {
    throw new Error(
      `${label} ${expectFailure ? "unexpectedly succeeded" : `failed with exit code ${record.exitCode}`}; see ${record.logPath}`
    );
  }
  return record;
}

function assertProjectContract(projectDir) {
  const configPath = path.join(projectDir, "fsd.config.json");
  if (!fs.existsSync(configPath)) throw new Error("fsd.config.json was not created.");

  for (const layer of ["app", "pages", "widgets", "features", "entities", "shared"]) {
    if (!fs.existsSync(path.join(projectDir, "src", layer))) {
      throw new Error(`Required FSD layer is missing: ${layer}`);
    }
  }
}

async function verifyRollback(workspace) {
  const targetDir = path.join(workspace, "rollback-target");
  fs.mkdirSync(targetDir);
  fs.writeFileSync(path.join(targetDir, "original.txt"), "keep me\n");

  const { beginProjectTransaction } = await import(
    pathToFileURL(path.join(repoRoot, "bin", "core", "project-lifecycle.mjs")).href
  );
  const transaction = beginProjectTransaction(targetDir, { force: true });
  fs.mkdirSync(targetDir);
  fs.writeFileSync(path.join(targetDir, "partial.txt"), "partial\n");
  transaction.rollback();

  if (fs.readFileSync(path.join(targetDir, "original.txt"), "utf8") !== "keep me\n") {
    throw new Error("Rollback did not restore the original target.");
  }
  if (fs.existsSync(path.join(targetDir, "partial.txt"))) {
    throw new Error("Rollback did not remove partial project files.");
  }
}

async function main() {
  fs.rmSync(logDirectory, { recursive: true, force: true });
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fsd cli os smoke-"));
  const workspace = path.join(temporaryRoot, "workspace with spaces");
  const projectName = "os-smoke-app";
  const projectDir = path.join(workspace, projectName);
  let succeeded = false;
  fs.mkdirSync(workspace);

  try {
    const createArgs = [
      cliPath,
      projectName,
      "--framework",
      "react-vite",
      "--package-manager",
      "npm",
      "--yes",
      "--no-install",
      "--no-start",
    ];
    runStep("01-create", createArgs, workspace);
    assertProjectContract(projectDir);

    runStep("02-generate-feature", [cliPath, "--generate", "feature", "checkout"], projectDir);
    runStep("03-generate-entity", [cliPath, "--generate", "entity", "product"], projectDir);
    runStep("04-generate-widget", [cliPath, "--generate", "widget", "cart-summary"], projectDir);
    runStep("05-generate-page", [cliPath, "--generate", "page", "account"], projectDir);
    runStep("06-generate-auth", [cliPath, "--generate", "feature", "auth"], projectDir);
    runStep("07-check", [cliPath, "check"], projectDir);
    runStep("08-doctor", [cliPath, "doctor"], projectDir);

    runStep(
      "09-invalid-path",
      [cliPath, "../outside", "--framework", "react-vite", "--yes", "--no-install", "--no-start"],
      workspace,
      { expectFailure: true }
    );
    if (fs.existsSync(path.resolve(workspace, "..", "outside"))) {
      throw new Error("Invalid project path created files outside the workspace.");
    }

    const existingTarget = path.join(workspace, "existing-target");
    fs.mkdirSync(existingTarget);
    const markerPath = path.join(existingTarget, "original.txt");
    fs.writeFileSync(markerPath, "keep me\n");
    runStep(
      "10-existing-target",
      [cliPath, "existing-target", "--framework", "react-vite", "--yes", "--no-install", "--no-start"],
      workspace,
      { expectFailure: true }
    );
    if (fs.readFileSync(markerPath, "utf8") !== "keep me\n") {
      throw new Error("Existing target was modified after a rejected create command.");
    }

    await verifyRollback(workspace);
    succeeded = true;
    console.log(`\nCross-OS smoke passed. Logs: ${logDirectory}`);
  } finally {
    if (succeeded) {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    } else {
      console.error(`Cross-OS smoke workspace retained for diagnostics: ${temporaryRoot}`);
    }
  }
}

main().catch((error) => {
  console.error(`Cross-OS smoke failed: ${error.message}`);
  process.exitCode = 1;
});
