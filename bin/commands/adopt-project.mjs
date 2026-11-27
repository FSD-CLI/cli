import chalk from "chalk";
import { analyzeAdoption } from "../core/adopt-analysis.mjs";

// `fsd adopt --analyze` (INT-05) — the first slice of `fsd adopt`. It
// analyzes an existing project for FSD adoption: how much of it already
// lives in layers, and where every flat file should go. Read-only: it
// never writes or moves a file. The editable migration plan is INT-06,
// execution is INT-07 — a bare `fsd adopt` is a usage error until then.

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
    chalk.dim("  Suggestions are starting points — edit them in the migration plan (fsd adopt --plan, INT-06)."),
  );
}

export async function runAdoptProject(
  command,
  cwd = process.cwd(),
  { analyze = false, json = false } = {},
) {
  if (!analyze) {
    throw new Error("`fsd adopt` only supports --analyze for now.");
  }
  const analysis = analyzeAdoption(cwd);
  if (json) {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }
  printAnalysis(analysis);
}
