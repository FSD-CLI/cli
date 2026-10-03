import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runAndCapture } from "../scripts/ci/run-and-capture.mjs";

test("CI command capture preserves argument boundaries in paths with spaces", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fsd cli capture-"));
  const cwd = path.join(root, "workspace with spaces");
  const logDirectory = path.join(root, "logs");
  fs.mkdirSync(cwd);

  try {
    const result = runAndCapture({
      command: process.execPath,
      args: ["-e", "process.stdout.write(process.cwd())"],
      cwd,
      logDirectory,
      label: "cwd with spaces",
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, fs.realpathSync(cwd));
    assert.match(fs.readFileSync(result.logPath, "utf8"), /exitCode: 0/);
    assert.match(
      fs.readFileSync(result.logPath, "utf8"),
      /"-e","process\.stdout\.write\(process\.cwd\(\)\)"/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
