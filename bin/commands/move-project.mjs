import path from "node:path";
import chalk from "chalk";
import { loadProjectConfig } from "../generator.mjs";
import { applySliceMove, planSliceMove } from "../core/slice-move.mjs";

function printMovePlan(plan) {
  console.log(chalk.cyanBright("Move plan (dry run — nothing written):"));
  console.log(
    `  ${path.relative(plan.cwd, plan.oldSliceDir)} → ${path.relative(plan.cwd, plan.newSliceDir)}`
  );
  if (plan.rewrites.length === 0) {
    console.log("  No import references to rewrite.");
    return;
  }
  console.log(`  Rewrite imports in ${plan.rewrites.length} file(s):`);
  for (const { file } of plan.rewrites) {
    console.log(`    ${path.relative(plan.cwd, file)}`);
  }
}

function printMoveResult(result) {
  console.log(
    chalk.green(
      `Moved ${result.type} "${result.oldName}" → ${result.toType} "${result.newName}".`
    )
  );
  console.log(
    `  ${path.relative(result.cwd, result.oldSliceDir)} → ${path.relative(result.cwd, result.newSliceDir)}`
  );
  if (result.rewrittenFiles.length === 0) {
    console.log("  No import references needed rewriting.");
    return;
  }
  console.log(
    `  Rewrote imports in ${result.rewrittenFiles.length} file(s):`
  );
  for (const file of result.rewrittenFiles) {
    console.log(`    ${file}`);
  }
}

export async function runMoveProject(command, cwd, { dryRun } = {}) {
  const config = loadProjectConfig(cwd);
  const plan = planSliceMove({
    cwd,
    config,
    type: command.type,
    oldName: command.oldName,
    newName: command.newName,
    toType: command.toType,
  });
  if (dryRun) {
    printMovePlan(plan);
    return;
  }
  printMoveResult(applySliceMove(plan));
}
