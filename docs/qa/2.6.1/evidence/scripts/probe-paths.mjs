// docs/qa/2.6.1/evidence/scripts/probe-paths.mjs
// Prints the plan returned by the page generator for a throwaway React + Vite project, so the
// path separators used in generatedFiles/changedFiles can be observed on any OS.
// Repository root: FSD_CLI_ROOT, or derived from this file's location (5 levels up).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.FSD_CLI_ROOT || path.join(HERE, "..", "..", "..", "..", ".."));
const load = (rel) => import(pathToFileURL(path.join(ROOT, "bin", rel)).href);
const { createGeneratorPlan } = await load("generator.mjs");
const { configureProject, normalizeProjectConfig } = await load("project-config.mjs");

const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-probe-"));
try {
  for (const layer of ["app", "pages", "widgets", "features", "entities", "shared"]) {
    fs.mkdirSync(path.join(cwd, "src", layer), { recursive: true });
  }
  fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ dependencies: { react: "latest" } }));
  fs.mkdirSync(path.join(cwd, "src/app/routing"), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, "src/app/routing/index.tsx"),
    "// fsd-cli:route-imports:start\n// fsd-cli:route-imports:end\nexport const routes = [\n  // fsd-cli:routes:start\n  // fsd-cli:routes:end\n];\n"
  );
  const config = normalizeProjectConfig("react-vite");
  configureProject(cwd, config);
  console.log(JSON.stringify(createGeneratorPlan({ cwd, type: "page", name: "account", config }), null, 2));
} finally {
  fs.rmSync(cwd, { recursive: true, force: true });
}
