import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function logName(label) {
  return label.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function runAndCapture({
  command,
  args = [],
  cwd = process.cwd(),
  env = process.env,
  logDirectory,
  label = path.basename(command),
}) {
  if (!logDirectory) throw new Error("A log directory is required.");

  fs.mkdirSync(logDirectory, { recursive: true });
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  const record = {
    command,
    args,
    cwd,
    status: result.status,
    signal: result.signal,
    error: result.error?.message,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
  const exitCode = typeof record.status === "number" ? record.status : 1;
  const log = [
    `label: ${label}`,
    `cwd: ${cwd}`,
    `command: ${JSON.stringify([command, ...args])}`,
    `exitCode: ${exitCode}`,
    `signal: ${record.signal ?? ""}`,
    `spawnError: ${record.error ?? ""}`,
    "",
    "stdout:",
    record.stdout,
    "",
    "stderr:",
    record.stderr,
    "",
  ].join("\n");
  const logPath = path.join(logDirectory, `${logName(label)}.log`);
  fs.writeFileSync(logPath, log);

  return { ...record, exitCode, logPath };
}
