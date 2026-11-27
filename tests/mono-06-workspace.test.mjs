import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  WORKSPACE_PACKAGE_MANAGERS,
  createWorkspaceRoot,
  renderWorkspaceRootFiles,
} from "../bin/generators/workspace-root.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const entry = path.join(root, "bin/index.mjs");

const BUN_OPTIONS = {
  projectName: "my-workspace",
  packageName: "my-workspace",
  framework: "react-vite",
  packageManager: "bun",
};

const PNPM_OPTIONS = { ...BUN_OPTIONS, packageManager: "pnpm" };
const NPM_OPTIONS = { ...BUN_OPTIONS, packageManager: "npm" };
const YARN_OPTIONS = { ...BUN_OPTIONS, packageManager: "yarn" };

function runCli(t, args) {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fsd-mono06-e2e-")));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: "utf8" });
  return { ...result, output: `${result.stdout}\n${result.stderr}`, cwd };
}

test("a bun workspace root declares its members in package.json, with no pnpm-workspace.yaml", () => {
  const files = renderWorkspaceRootFiles(BUN_OPTIONS);

  assert.deepEqual(Object.keys(files).sort(), [
    ".gitignore",
    "README.md",
    "apps/.gitkeep",
    "fsd.config.json",
    "package.json",
    "packages/.gitkeep",
  ]);
  assert.equal("pnpm-workspace.yaml" in files, false);

  // The root config records the chosen manager, like the pnpm, npm and
  // yarn roots do.
  assert.deepEqual(JSON.parse(files["fsd.config.json"]), {
    schemaVersion: 1,
    framework: "react-vite",
    projectName: "my-workspace",
    packageManager: "bun",
    target: "multi-web",
  });

  // Bun reads the member globs from the workspaces field — the same
  // declaration npm and yarn use, so there is no separate workspace
  // file and no bunfig.toml.
  assert.deepEqual(JSON.parse(files["package.json"]), {
    name: "my-workspace",
    private: true,
    version: "0.1.0",
    workspaces: ["apps/*", "packages/*"],
    scripts: {
      dev: "bun run --filter '*' dev",
      build: "bun run --filter '*' build",
      lint: "bun run --filter '*' lint",
      test: "bun run --filter '*' test",
    },
  });

  // Empty member directories are kept by git; no app is scaffolded here.
  assert.equal(files["apps/.gitkeep"], "");
  assert.equal(files["packages/.gitkeep"], "");
  assert.match(files[".gitignore"], /node_modules/);

  // The README names the bun commands and the MONO-02 scoped names.
  assert.match(files["README.md"], /# my-workspace/);
  assert.match(files["README.md"], /A bun workspace of FSD applications/);
  assert.match(files["README.md"], /`bun install`/);
  assert.match(files["README.md"], /`bun run --filter '\*' dev`/);
  assert.match(files["README.md"], /`bun run --filter '\*' test`/);
  assert.equal(files["README.md"].includes("pnpm"), false);
  assert.equal(files["README.md"].includes("npm run"), false);
  assert.equal(files["README.md"].includes("yarn"), false);
  assert.match(files["README.md"], /`@my-workspace\/web`/);
  assert.match(files["README.md"], /`@my-workspace\/shared-ui`/);
});

test("the supported workspace managers are pnpm, npm, yarn and bun", () => {
  assert.deepEqual([...WORKSPACE_PACKAGE_MANAGERS], ["pnpm", "npm", "yarn", "bun"]);
  assert.ok(Object.isFrozen(WORKSPACE_PACKAGE_MANAGERS));
});

test("a pnpm workspace root is unchanged by the bun support", () => {
  const files = renderWorkspaceRootFiles(PNPM_OPTIONS);

  assert.deepEqual(Object.keys(files).sort(), [
    ".gitignore",
    "README.md",
    "apps/.gitkeep",
    "fsd.config.json",
    "package.json",
    "packages/.gitkeep",
    "pnpm-workspace.yaml",
  ]);
  assert.deepEqual(JSON.parse(files["fsd.config.json"]).packageManager, "pnpm");
  assert.deepEqual(JSON.parse(files["package.json"]).scripts, {
    dev: "pnpm -r run dev",
    build: "pnpm -r run build",
    lint: "pnpm -r run lint",
    test: "pnpm -r run test",
  });
  assert.match(files["pnpm-workspace.yaml"], /packages:\n  - "apps\/\*"\n  - "packages\/\*"/);
  assert.match(files["pnpm-workspace.yaml"], /strictDepBuilds: true/);
  assert.match(files["README.md"], /A pnpm workspace of FSD applications/);
  assert.match(files["README.md"], /`pnpm install`/);
  assert.equal(files["README.md"].includes("npm run"), false);
  assert.equal(files["README.md"].includes("yarn"), false);
  assert.equal(files["README.md"].includes("bun"), false);
});

test("an npm workspace root is unchanged by the bun support", () => {
  const files = renderWorkspaceRootFiles(NPM_OPTIONS);

  assert.deepEqual(Object.keys(files).sort(), [
    ".gitignore",
    "README.md",
    "apps/.gitkeep",
    "fsd.config.json",
    "package.json",
    "packages/.gitkeep",
  ]);
  assert.equal("pnpm-workspace.yaml" in files, false);
  assert.deepEqual(JSON.parse(files["fsd.config.json"]).packageManager, "npm");
  assert.deepEqual(JSON.parse(files["package.json"]), {
    name: "my-workspace",
    private: true,
    version: "0.1.0",
    workspaces: ["apps/*", "packages/*"],
    scripts: {
      dev: "npm run dev --workspaces",
      build: "npm run build --workspaces",
      lint: "npm run lint --workspaces",
      test: "npm run test --workspaces",
    },
  });
  assert.match(files["README.md"], /An npm workspace of FSD applications/);
  assert.match(files["README.md"], /`npm install`/);
  assert.equal(files["README.md"].includes("pnpm"), false);
  assert.equal(files["README.md"].includes("yarn"), false);
  assert.equal(files["README.md"].includes("bun"), false);
});

test("a yarn workspace root is unchanged by the bun support", () => {
  const files = renderWorkspaceRootFiles(YARN_OPTIONS);

  assert.deepEqual(Object.keys(files).sort(), [
    ".gitignore",
    "README.md",
    "apps/.gitkeep",
    "fsd.config.json",
    "package.json",
    "packages/.gitkeep",
  ]);
  assert.equal("pnpm-workspace.yaml" in files, false);
  assert.deepEqual(JSON.parse(files["fsd.config.json"]).packageManager, "yarn");
  assert.deepEqual(JSON.parse(files["package.json"]), {
    name: "my-workspace",
    private: true,
    version: "0.1.0",
    workspaces: ["apps/*", "packages/*"],
    scripts: {
      dev: "yarn workspaces run dev",
      build: "yarn workspaces run build",
      lint: "yarn workspaces run lint",
      test: "yarn workspaces run test",
    },
  });
  assert.match(files["README.md"], /A yarn workspace of FSD applications/);
  assert.match(files["README.md"], /`yarn install`/);
  assert.match(files["README.md"], /Yarn 1 \(classic\)/);
  assert.equal(files["README.md"].includes("pnpm"), false);
  assert.equal(files["README.md"].includes("npm run"), false);
  assert.equal(files["README.md"].includes("bun"), false);
});

test("omitting the package manager still defaults to pnpm", () => {
  const { packageManager, ...noManager } = BUN_OPTIONS;
  const files = renderWorkspaceRootFiles(noManager);
  assert.equal(JSON.parse(files["fsd.config.json"]).packageManager, "pnpm");
  assert.equal("pnpm-workspace.yaml" in files, true);
});

test("createWorkspaceRoot writes the bun root to disk, without pnpm-workspace.yaml", (t) => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-mono06-"));
  t.after(() => fs.rmSync(targetDir, { recursive: true, force: true }));

  const written = createWorkspaceRoot(targetDir, BUN_OPTIONS);
  assert.deepEqual(written, [
    "fsd.config.json",
    "package.json",
    "apps/.gitkeep",
    "packages/.gitkeep",
    "README.md",
    ".gitignore",
  ]);

  const rendered = renderWorkspaceRootFiles(BUN_OPTIONS);
  for (const relativePath of written) {
    assert.equal(
      fs.readFileSync(path.join(targetDir, relativePath), "utf8"),
      rendered[relativePath]
    );
  }
  assert.equal(fs.existsSync(path.join(targetDir, "pnpm-workspace.yaml")), false);
  assert.equal(fs.existsSync(path.join(targetDir, "bunfig.toml")), false);
  assert.equal(fs.existsSync(path.join(targetDir, "src")), false);
  assert.equal(fs.existsSync(path.join(targetDir, "apps", "web")), false);
});

test("the bun root refuses unknown managers before writing anything", (t) => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-mono06-"));
  t.after(() => fs.rmSync(targetDir, { recursive: true, force: true }));

  // MONO-06 completed the set: pnpm, npm, yarn and bun are supported,
  // so only a genuinely unknown manager is refused.
  for (const packageManager of ["deno"]) {
    assert.throws(
      () => createWorkspaceRoot(targetDir, { ...BUN_OPTIONS, packageManager }),
      /support pnpm, npm, yarn and bun/
    );
    assert.equal(fs.existsSync(path.join(targetDir, "fsd.config.json")), false);
  }
});

test("the bun root refuses unknown frameworks and unusable names", () => {
  assert.throws(
    () => renderWorkspaceRootFiles({ ...BUN_OPTIONS, framework: "unknown" }),
    /Unknown framework "unknown"/
  );
  assert.throws(
    () => renderWorkspaceRootFiles({ ...BUN_OPTIONS, projectName: "" }),
    /project name is required/i
  );
  assert.throws(
    () => renderWorkspaceRootFiles({ ...BUN_OPTIONS, packageName: "MyApp" }),
    /is not a valid npm package name/
  );
});

test("`fsd --monorepo --package-manager bun` creates the bun workspace root on disk", (t) => {
  const result = runCli(t, [
    "my-workspace",
    "--framework",
    "react-vite",
    "--yes",
    "--monorepo",
    "--package-manager",
    "bun",
  ]);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Workspace created successfully!/);
  assert.match(result.output, /bun install/);
  const targetDir = path.join(result.cwd, "my-workspace");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(targetDir, "fsd.config.json"), "utf8")), {
    schemaVersion: 1,
    framework: "react-vite",
    projectName: "my-workspace",
    packageManager: "bun",
    target: "multi-web",
  });
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(targetDir, "package.json"), "utf8")).workspaces,
    ["apps/*", "packages/*"]
  );
  assert.equal(fs.existsSync(path.join(targetDir, "pnpm-workspace.yaml")), false);
  assert.equal(fs.existsSync(path.join(targetDir, "bunfig.toml")), false);
  assert.equal(fs.existsSync(path.join(targetDir, "apps", ".gitkeep")), true);
  assert.equal(fs.existsSync(path.join(targetDir, "packages", ".gitkeep")), true);
  assert.match(
    fs.readFileSync(path.join(targetDir, "README.md"), "utf8"),
    /bun run --filter '\*' dev/
  );
});

test("`--target multi-web --package-manager bun` with nextjs records bun in the config", (t) => {
  const result = runCli(t, [
    "shop",
    "--framework",
    "nextjs",
    "--yes",
    "--target",
    "multi-web",
    "--package-manager",
    "bun",
  ]);

  assert.equal(result.status, 0, result.output);
  const config = JSON.parse(
    fs.readFileSync(path.join(result.cwd, "shop", "fsd.config.json"), "utf8")
  );
  assert.equal(config.packageManager, "bun");
  assert.equal(config.framework, "nextjs");
  assert.equal(fs.existsSync(path.join(result.cwd, "shop", "pnpm-workspace.yaml")), false);
  assert.equal(fs.existsSync(path.join(result.cwd, "shop", "bunfig.toml")), false);
});

test("`--monorepo --package-manager bun --dry-run` plans a bun root and writes nothing", (t) => {
  const result = runCli(t, [
    "shop",
    "--framework",
    "react-vite",
    "--yes",
    "--monorepo",
    "--package-manager",
    "bun",
    "--dry-run",
  ]);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Workspace plan \(dry run\)/);
  assert.match(result.output, /Package manager: bun/);
  assert.match(result.output, /No pnpm-workspace\.yaml — bun reads the workspaces from package\.json/);
  assert.match(result.output, /No files were changed for shop\./);
  assert.equal(fs.existsSync(path.join(result.cwd, "shop")), false);
});

test("`--monorepo` with an unknown package manager refuses before writing anything", (t) => {
  const result = runCli(t, [
    "shop",
    "--framework",
    "react-vite",
    "--yes",
    "--monorepo",
    "--package-manager",
    "deno",
  ]);

  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /support pnpm, npm, yarn and bun/);
  assert.equal(fs.existsSync(path.join(result.cwd, "shop")), false);
});
