import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import prompts from "prompts";
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

// --- Slice deep-dive (INT-49) -------------------------------------------
// A small hand-rolled import scanner: main has no shared graph engine yet
// (INT-01 lands separately), so the deep-dive scans source files directly.
// Zero new dependencies.

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

function collectSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      files.push(...collectSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files.sort();
}

// Static and dynamic imports plus re-exports: `import ... from "x"`,
// `import "x"`, `export ... from "x"`, `import("x")`.
const IMPORT_PATTERNS = [
  /import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
  /export\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

export function extractImportSpecifiers(source) {
  const specifiers = [];
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

// Map a file under the source root to its "layer/slice" id, or null when the
// file is not inside a slice/segment (for example directly under src/).
function sliceIdForPath(sourceRoot, filePath) {
  const relative = path.relative(sourceRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const [layer, slice] = relative.split(path.sep);
  if (!layer || !slice || !EXPLAIN_LAYERS.includes(layer)) return null;
  return `${layer}/${slice}`;
}

// Resolve a relative import to the "layer/slice" it points at, or null when
// it is a bare specifier or lands outside the source root.
function resolveRelativeImport(sourceFile, specifier, sourceRoot) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(sourceFile), specifier);
  const candidates = [base];
  for (const extension of SOURCE_EXTENSIONS) {
    candidates.push(`${base}${extension}`);
    candidates.push(path.join(base, `index${extension}`));
  }
  const target = candidates.find((candidate) => fs.existsSync(candidate));
  if (!target) return null;
  return sliceIdForPath(sourceRoot, target);
}

function listAllSlices(report) {
  const slices = [];
  for (const { layer, slices: names } of report.layers) {
    for (const slice of names) slices.push({ layer, slice, id: `${layer}/${slice}` });
  }
  return slices.sort((a, b) => a.id.localeCompare(b.id));
}

function resolveSliceQuery(report, query) {
  const slices = listAllSlices(report);
  const available = slices.map(({ id }) => id).join(", ");
  const exact = slices.find(({ id }) => id === query);
  if (exact) return exact;
  const bare = slices.filter(({ slice }) => slice === query);
  if (bare.length === 1) return bare[0];
  if (bare.length > 1) {
    throw new Error(
      `Ambiguous slice "${query}" — it matches ${bare.map(({ id }) => id).join(", ")}. ` +
        `Use layer/slice, for example "fsd explain ${bare[0].id}".`,
    );
  }
  throw new Error(
    `Unknown slice "${query}". Available slices: ${available || "(none)"}.`,
  );
}

// Unit-testable deep-dive data: no printing, no prompts. Violations are
// layer-boundary (upward) imports touching the slice, either outgoing (the
// slice imports from a higher layer) or incoming (a lower-layer slice
// imports this slice). Layer order is app > pages > widgets > features >
// entities > shared; a slice may only import from its own layer or lower.
export function explainSlice(cwd = process.cwd(), query) {
  const report = explainProject(cwd);
  const target = resolveSliceQuery(report, query);
  const { sourceRoot } = report;
  const sliceDir = path.join(sourceRoot, target.layer, target.slice);
  const files = collectSourceFiles(sliceDir).map((file) =>
    path.relative(sourceRoot, file),
  );

  const dependencies = new Map();
  const externalImports = new Set();
  for (const file of collectSourceFiles(sliceDir)) {
    const source = fs.readFileSync(file, "utf8");
    for (const specifier of extractImportSpecifiers(source)) {
      const resolved = resolveRelativeImport(file, specifier, sourceRoot);
      if (resolved === null) {
        if (!specifier.startsWith(".")) externalImports.add(specifier);
        continue;
      }
      if (resolved === target.id) continue;
      if (!dependencies.has(resolved)) dependencies.set(resolved, []);
      dependencies.get(resolved).push(path.relative(sourceRoot, file));
    }
  }

  const dependents = new Map();
  const edges = [];
  for (const file of collectSourceFiles(sourceRoot)) {
    const from = sliceIdForPath(sourceRoot, file);
    if (from === null) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const specifier of extractImportSpecifiers(source)) {
      const to = resolveRelativeImport(file, specifier, sourceRoot);
      if (to === null) continue;
      edges.push({ from, to, file: path.relative(sourceRoot, file), specifier });
      if (from === target.id || to !== target.id) continue;
      if (!dependents.has(from)) dependents.set(from, []);
      dependents.get(from).push(path.relative(sourceRoot, file));
    }
  }

  const layerIndex = new Map(EXPLAIN_LAYERS.map((layer, index) => [layer, index]));
  const violations = edges
    .filter(({ from, to }) => {
      const touches = from === target.id || to === target.id;
      if (!touches) return false;
      const [fromLayer] = from.split("/");
      const [toLayer] = to.split("/");
      // Upward import: the importer sits in a lower layer than its target.
      return layerIndex.get(fromLayer) > layerIndex.get(toLayer);
    })
    .map(({ from, to, file, specifier }) => ({
      direction: from === target.id ? "outgoing" : "incoming",
      from,
      to,
      file,
      specifier,
    }));

  const byId = (map) =>
    [...map.entries()]
      .map(([id, files]) => ({ id, files: [...new Set(files)].sort() }))
      .sort((a, b) => a.id.localeCompare(b.id));

  return {
    ...target,
    files,
    dependencies: byId(dependencies),
    dependents: byId(dependents),
    externalImports: [...externalImports].sort(),
    violations,
  };
}

function printDeepDive(deep) {
  console.log(chalk.bold(`\n  Slice: ${deep.id}\n`));
  console.log(`  Layer: ${deep.layer}`);
  console.log(`  Files (${deep.files.length}):`);
  for (const file of deep.files) console.log(`    ${file}`);
  console.log();
  console.log(`  Depends on (${deep.dependencies.length}):`);
  if (deep.dependencies.length === 0) console.log("    (none)");
  for (const { id, files } of deep.dependencies) {
    console.log(`    ${id} — ${files.length} file${files.length === 1 ? "" : "s"}: ${files.join(", ")}`);
  }
  console.log();
  console.log(`  Depended on by (${deep.dependents.length}):`);
  if (deep.dependents.length === 0) console.log("    (none)");
  for (const { id, files } of deep.dependents) {
    console.log(`    ${id} — ${files.length} file${files.length === 1 ? "" : "s"}: ${files.join(", ")}`);
  }
  console.log();
  console.log(`  External imports (${deep.externalImports.length}):`);
  console.log(`    ${deep.externalImports.length ? deep.externalImports.join(", ") : "(none)"}`);
  console.log();
  if (deep.violations.length === 0) {
    console.log("  Layer-boundary violations: none\n");
    return;
  }
  console.log(chalk.red(`  Layer-boundary violations (${deep.violations.length}):`));
  for (const { direction, from, to, file, specifier } of deep.violations) {
    console.log(`    ${direction}: ${from} -> ${to} (${file}, "${specifier}")`);
  }
  console.log();
}

// Interactive view (INT-49): a prompt loop over the project slices. The
// prompt function is injectable so tests can drive the loop without a TTY.
export async function runInteractiveExplain(cwd = process.cwd(), ask = prompts) {
  const report = explainProject(cwd);
  const slices = listAllSlices(report);
  if (slices.length === 0) {
    console.log("  No slices found in this project.\n");
    return;
  }
  const choices = [
    ...slices.map(({ id }) => ({ title: id, value: id })),
    { title: "Quit", value: null },
  ];
  for (;;) {
    const answer = await ask({
      type: "select",
      name: "slice",
      message: "Pick a slice to deep-dive into",
      choices,
    });
    if (!answer || !answer.slice) return;
    printDeepDive(explainSlice(cwd, answer.slice));
  }
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
  { tour = false, force = false, slice, interactive = false } = {},
) {
  if (interactive) {
    if (slice !== undefined || tour) {
      throw new Error("--interactive cannot be combined with a slice or --tour.");
    }
    await runInteractiveExplain(cwd);
    return;
  }
  if (slice !== undefined) {
    if (tour) {
      throw new Error("A slice and --tour cannot be combined.");
    }
    printDeepDive(explainSlice(cwd, slice));
    return;
  }
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
