import chalk from "chalk";
import path from "node:path";
import { TURBO_JSON_FILE, writeTurboConfig } from "../core/turbo-config.mjs";
import {
  findTurboBinary,
  runTurboDryRun,
  verifyTurboSetup,
} from "../core/turbo-verify.mjs";

function printVerification(root, result) {
  const apps = result.members.filter((member) => member.kind === "app").length;
  const packages = result.members.filter((member) => member.kind === "package").length;
  console.log(chalk.bold("\n  Turborepo verification\n"));
  console.log(
    `  ${TURBO_JSON_FILE}: ${result.config ? "valid" : "unreadable"} — ` +
      `${result.members.length} member${result.members.length === 1 ? "" : "s"} ` +
      `(${apps} app${apps === 1 ? "" : "s"}, ${packages} package${packages === 1 ? "" : "s"})`,
  );
  for (const warning of result.warnings) {
    console.log(chalk.yellow(`  Warning: ${warning}`));
  }
  for (const issue of result.issues) {
    console.log(chalk.red(`  Issue: ${issue}`));
  }
  if (result.issues.length > 0) {
    console.log();
    throw new Error(
      `turbo.json verification failed with ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"}. ` +
        `Fix them, or regenerate the file with: fsd turbo --force`,
    );
  }
  const binary = findTurboBinary();
  if (!binary) {
    console.log(
      chalk.dim(
        "  Turborepo binary not found — skipped the live dry run (static checks only).",
      ),
    );
  } else {
    const dryRun = runTurboDryRun(root, { turboBin: binary });
    console.log(
      `  turbo build --dry-run: ${dryRun.packages} package${dryRun.packages === 1 ? "" : "s"}, ` +
        `${dryRun.tasks} task${dryRun.tasks === 1 ? "" : "s"} resolved.`,
    );
  }
  console.log(
    `  ${TURBO_JSON_FILE} verified — caching is configured for ${apps} app${apps === 1 ? "" : "s"} ` +
      `and ${packages} package${packages === 1 ? "" : "s"}.\n`,
  );
}

export async function runTurboProject(
  command,
  cwd = process.cwd(),
  { force = false, verify = false } = {},
) {
  if (verify) {
    printVerification(cwd, verifyTurboSetup(cwd));
    return;
  }
  const { path: filePath, members } = writeTurboConfig(cwd, { force });
  const apps = members.filter((member) => member.kind === "app").length;
  const packages = members.filter((member) => member.kind === "package").length;
  console.log(`  Wrote ${path.relative(cwd, filePath)}`);
  console.log(
    chalk.dim(
      `  Pipelines: build, lint, test, typecheck (each after ^build), dev, clean — covering ${apps} app${apps === 1 ? "" : "s"} and ${packages} package${packages === 1 ? "" : "s"}.`,
    ),
  );
  console.log(chalk.dim("  Regenerate with: fsd turbo --force"));
  console.log(chalk.dim("  Verify it with: fsd turbo --verify"));
}
