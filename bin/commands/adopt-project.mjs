import chalk from "chalk";
import path from "node:path";
import { analyzeAdoption } from "../core/adopt-analysis.mjs";
import {
  ADOPT_PLAN_FILE,
  buildAdoptionPlan,
  readAdoptionPlan,
  summarizePlan,
  writeAdoptionPlan,
} from "../core/adopt-plan.mjs";

// `fsd adopt` — adoption of an existing project into FSD, slice by slice.
// INT-05 (`--analyze`) measures the gap; INT-06 (`--plan`, `--show-plan`)
// turns the analysis into a migration plan the user edits before anything
// moves. Execution is INT-07 — until then the plan is only read and
// written, never applied.

function printAnalysis(analysis) {
  const { score, totals } = analysis;
  console.log(chalk.bold("\n  FSD adopt — analysis\n"));
  console.log(
    `  Adoption score: ${score}% (${totals.inLayer} of ${totals.files} source files already in FSD layers)`,
  );
  console.log(
    `  In layers: ${totals.inLayer} · Layer root: ${totals.layerRoot} · Flat: ${totals.flat} · Unmapped: ${totals.unmapped}\n`,
  );
  const flat = analysis.files.filter((file) => file.status === "flat");
  if (flat.length > 0) {
    console.log("  Flat files (need a home):");
    for (const file of flat) {
      console.log(`    ${file.file} -> ${file.suggestion.to}`);
    }
    console.log();
  }
  const layerRoot = analysis.files.filter((file) => file.status === "layer-root");
  if (layerRoot.length > 0) {
    console.log("  Layer root (restructure into a slice):");
    for (const file of layerRoot) {
      console.log(`    ${file.file}`);
    }
    console.log();
  }
  const unmapped = analysis.files.filter((file) => file.status === "unmapped");
  if (unmapped.length > 0) {
    console.log("  Unmapped (decide manually):");
    for (const file of unmapped) {
      console.log(`    ${file.file} — ${file.note}`);
    }
    console.log();
  }
  console.log(
    chalk.dim("  Suggestions are starting points — edit them in the migration plan (fsd adopt --plan)."),
  );
}

function printPlan(plan) {
  const summary = summarizePlan(plan);
  console.log(chalk.bold("\n  FSD adopt — migration plan\n"));
  console.log(
    `  ${summary.moves} moves · ${summary.pending} pending · ${summary.approved} approved · ${summary.skipped} skipped`,
  );
  console.log();
  for (const move of plan.moves) {
    console.log(`  [${move.status}] ${move.id}: ${move.from} -> ${move.to}`);
  }
  if (plan.layerRoot.length > 0) {
    console.log("\n  Layer root (no move yet — restructure into a slice):");
    for (const entry of plan.layerRoot) {
      console.log(`    ${entry.file}`);
    }
  }
  if (plan.unmapped.length > 0) {
    console.log("\n  Unmapped (no move yet — place manually):");
    for (const entry of plan.unmapped) {
      console.log(`    ${entry.file} — ${entry.note}`);
    }
  }
  console.log();
}

export async function runAdoptProject(
  command,
  cwd = process.cwd(),
  { analyze = false, plan = false, showPlan = false, force = false, json = false } = {},
) {
  if (analyze) {
    const analysis = analyzeAdoption(cwd);
    if (json) {
      console.log(JSON.stringify(analysis, null, 2));
      return;
    }
    printAnalysis(analysis);
    return;
  }
  if (plan) {
    const built = buildAdoptionPlan(cwd, analyzeAdoption(cwd));
    const file = writeAdoptionPlan(cwd, built, { force });
    if (json) {
      console.log(JSON.stringify(built, null, 2));
      return;
    }
    const summary = summarizePlan(built);
    console.log(`  Wrote ${path.relative(cwd, file)}`);
    console.log(
      `  ${summary.moves} moves (all pending) · ${built.layerRoot.length} layer-root · ${built.unmapped.length} unmapped`,
    );
    console.log(
      chalk.dim(
        "  Edit the file to change a target or mark a move approved/skipped. Regenerating with --force discards your edits.",
      ),
    );
    return;
  }
  if (showPlan) {
    const loaded = readAdoptionPlan(cwd);
    if (json) {
      console.log(JSON.stringify(loaded, null, 2));
      return;
    }
    printPlan(loaded);
    return;
  }
  throw new Error("`fsd adopt` needs one of --analyze, --plan or --show-plan.");
}
