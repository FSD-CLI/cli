#!/usr/bin/env node

import fs from "fs";
import path from "path";
import chalk from "chalk";
import { parseCliArgs, CliUsageError } from "./cli/args.mjs";
import { showHelp, showTemplateList } from "./cli/output.mjs";
import { runCreateProject } from "./commands/create-project.mjs";
import { runGenerator } from "./generator.mjs";
import { runProjectInspection } from "./commands/inspect-project.mjs";
import { runUpgradeProject } from "./commands/upgrade-project.mjs";
import { listTemplates } from "./core/template-registry.mjs";
import { checkNodeVersion } from "./core/runtime-requirements.mjs";

function readPackageVersion() {
  const packageUrl = new URL("../package.json", import.meta.url);
  return JSON.parse(fs.readFileSync(packageUrl, "utf8")).version;
}

function invokedProgram() {
  const name = path.basename(process.argv[1] ?? "", path.extname(process.argv[1] ?? ""));
  return name === "fsd" ? "fsd" : "create-fsd-architecture";
}

export async function runCli(args = process.argv.slice(2)) {
  const command = parseCliArgs(args);

  if (command.command === "help") {
    showHelp(readPackageVersion(), invokedProgram());
    return;
  }
  if (command.command === "version") {
    console.log(readPackageVersion());
    return;
  }
  if (command.command === "list-templates") {
    showTemplateList(listTemplates());
    return;
  }

  // The CLI runtime contract is enforced for every command that reads or writes
  // a project. Diagnostics stay available so `doctor` can report the exact
  // required version on an unsupported Node.js runtime.
  const runtimeCheck = checkNodeVersion(process.versions.node);
  if (!runtimeCheck.ok && !["check", "doctor", "config"].includes(command.command)) {
    throw new Error(
      `${runtimeCheck.message} Upgrade Node.js to satisfy the supported runtime range before running this command.`
    );
  }

  if (command.command === "generate") {
    await runGenerator({
      shouldGenerate: true,
      type: command.type,
      name: command.name,
      force: command.force,
      dryRun: command.dryRun,
      authProvider: command.authProvider,
      names: command.names,
      root: command.root,
      segments: command.segments,
    });
    return;
  }
  if (["check", "doctor", "config"].includes(command.command)) {
    await runProjectInspection(command.command, process.cwd(), {
      architecture: command.architecture,
    });
    return;
  }
  if (command.command === "upgrade") {
    return runUpgradeProject(command, { cliVersion: readPackageVersion() });
  }

  await runCreateProject(command);
}

runCli()
  .then((result) => {
    if (result?.exitCode !== undefined) process.exitCode = result.exitCode;
  })
  .catch((error) => {
    console.error(chalk.red(`  Error: ${error.message}`));
    if (error instanceof CliUsageError) {
      console.error(
        chalk.dim("  Run with --help to see the available commands."),
      );
    }
    process.exitCode = error.exitCode ?? 1;
  });
