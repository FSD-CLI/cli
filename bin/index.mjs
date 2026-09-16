#!/usr/bin/env node

import fs from "fs";
import chalk from "chalk";
import { parseCliArgs, CliUsageError } from "./cli/args.mjs";
import { showHelp, showTemplateList } from "./cli/output.mjs";
import { runCreateProject } from "./commands/create-project.mjs";
import { runGenerator } from "./generator.mjs";
import { listTemplates } from "./core/template-registry.mjs";

function readPackageVersion() {
  const packageUrl = new URL("../package.json", import.meta.url);
  return JSON.parse(fs.readFileSync(packageUrl, "utf8")).version;
}

export async function runCli(args = process.argv.slice(2)) {
  const command = parseCliArgs(args);

  if (command.command === "help") {
    showHelp(readPackageVersion());
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
  if (command.command === "generate") {
    await runGenerator({
      shouldGenerate: true,
      type: command.type,
      name: command.name,
      force: command.force,
    });
    return;
  }

  await runCreateProject(command);
}

runCli().catch((error) => {
  console.error(chalk.red(`  Error: ${error.message}`));
  if (error instanceof CliUsageError) {
    console.error(chalk.dim("  Run with --help to see the available commands."));
  }
  process.exitCode = 1;
});
