import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { getFrameworkAdapter } from "../core/frameworks/index.mjs";
import { loadProjectConfig } from "../generator.mjs";

export const EXPLAIN_LAYERS = [
  "app",
  "pages",
  "widgets",
  "features",
  "entities",
  "shared",
];

export function listSlices(layerPath) {
  if (!fs.existsSync(layerPath)) return [];
  return fs
    .readdirSync(layerPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function explainProject(cwd = process.cwd()) {
  const config = loadProjectConfig(cwd);
  const sourceRoot = path.join(
    cwd,
    getFrameworkAdapter(config.framework).sourceDirectory,
  );
  const layers = EXPLAIN_LAYERS.map((layer) => ({
    layer,
    kind: ["app", "shared"].includes(layer) ? "segment" : "slice",
    slices: listSlices(path.join(sourceRoot, layer)),
  }));
  const total = layers.reduce((sum, { slices, kind }) => sum + (kind === "slice" ? slices.length : 0), 0);
  return { config, sourceRoot, layers, total };
}

function printSummary(report) {
  const { config, layers, total } = report;
  console.log(chalk.bold("\n  FSD explain\n"));
  console.log(`  Framework: ${config.framework}`);
  console.log(`  Package manager: ${config.packageManager}`);
  console.log(`  API client: ${config.apiClient}`);
  console.log(`  Server state: ${config.serverState}`);
  console.log(`  Client state: ${config.clientState}`);
  console.log(`  Forms: ${config.forms}`);
  console.log();
  for (const { layer, slices, kind } of layers) {
    const noun = slices.length === 1 ? kind : `${kind}s`;
    const names = slices.length ? ` — ${slices.join(", ")}` : "";
    console.log(`  ${layer}: ${slices.length} ${noun}${names}`);
  }
  console.log(`\n  Total slices: ${total}\n`);
}

function renderTour(report) {
  const { config, sourceRoot, layers, total } = report;
  const lines = [
    "# Project tour",
    "",
    "This project was scaffolded with FSD CLI (`create-fsd-architecture`).",
    "",
    "## Stack",
    "",
    `- Framework: ${config.framework}`,
    `- Package manager: ${config.packageManager}`,
    `- API client: ${config.apiClient}`,
    `- Server state: ${config.serverState}`,
    `- Client state: ${config.clientState}`,
    `- Forms: ${config.forms}`,
    "",
    "## Architecture",
    "",
    `Layers live under \`${path.relative(process.cwd(), sourceRoot) || sourceRoot}/\`:`,
    "",
  ];
  for (const { layer, slices, kind } of layers) {
    const noun = slices.length === 1 ? kind : `${kind}s`;
    const names = slices.length ? `: ${slices.join(", ")}` : "";
    lines.push(`- ${layer} — ${slices.length} ${noun}${names}`);
  }
  lines.push("", `Total slices: ${total}`, "", "## Common commands", "");
  lines.push(
    "- `npx create-fsd-architecture --generate feature <name>` — generate a slice",
    "- `npx create-fsd-architecture check` — inspect config and layers",
    "- `npx create-fsd-architecture doctor` — diagnose the project and toolchain",
    "- `npx create-fsd-architecture config` — print the resolved configuration",
    "- `npx create-fsd-architecture explain` — print this summary again",
    "- `npx create-fsd-architecture explain --tour` — regenerate this file",
    "",
  );
  return `${lines.join("\n")}`;
}

export async function runExplainProject(
  command,
  cwd = process.cwd(),
  { tour = false, force = false } = {},
) {
  const report = explainProject(cwd);
  printSummary(report);
  if (!tour) return;

  const tourPath = path.join(cwd, "ONBOARDING.md");
  if (fs.existsSync(tourPath) && !force) {
    throw new Error(
      "ONBOARDING.md already exists. Use --force to replace it.",
    );
  }
  fs.writeFileSync(tourPath, renderTour(report), "utf8");
  console.log(`  Wrote ${path.relative(cwd, tourPath)}`);
}
