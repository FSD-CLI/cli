import chalk from "chalk";
import path from "node:path";
import { TURBO_JSON_FILE, writeTurboConfig } from "../core/turbo-config.mjs";

export async function runTurboProject(
  command,
  cwd = process.cwd(),
  { force = false } = {},
) {
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
}
