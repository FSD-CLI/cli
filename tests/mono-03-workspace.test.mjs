import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  WORKSPACE_FRAMEWORKS,
  WORKSPACE_MEMBER_PATTERNS,
  createWorkspaceRoot,
  renderWorkspaceRootFiles,
} from "../bin/generators/workspace-root.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const entry = path.join(root, "bin/index.mjs");

const OPTIONS = {
  projectName: "my-workspace",
  packageName: "my-workspace",
  framework: "react-vite",
  packageManager: "pnpm",
};

function runCli(t, args) {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fsd-mono03-e2e-")));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: "utf8" });
  return { ...result, output: `${result.stdout}\n${result.stderr}`, cwd };
}

test("the workspace root renders exactly the MONO-01 layout", () => {
  const files = renderWorkspaceRootFiles(OPTIONS);

  assert.deepEqual(Object.keys(files).sort(), [
    ".gitignore",
    "README.md",
    "apps/.gitkeep",
    "fsd.config.json",
    "package.json",
    "packages/.gitkeep",
    "pnpm-workspace.yaml",
  ]);

  // The root config is the spec shape: target multi-web, workspace
  // default framework, no src/ and no single-project stack fields.
  assert.deepEqual(JSON.parse(files["fsd.config.json"]), {
    schemaVersion: 1,
    framework: "react-vite",
    projectName: "my-workspace",
    packageManager: "pnpm",
    target: "multi-web",
  });

  // The root package is private and lists the member globs (pnpm reads
  // them from pnpm-workspace.yaml; the field keeps npm/Yarn/Bun tooling
  // honest about the layout until MONO-04–06 land).
  assert.deepEqual(JSON.parse(files["package.json"]), {
    name: "my-workspace",
    private: true,
    version: "0.1.0",
    workspaces: ["apps/*", "packages/*"],
    scripts: {
      dev: "pnpm -r run dev",
      build: "pnpm -r run build",
      lint: "pnpm -r run lint",
      test: "pnpm -r run test",
    },
  });

  assert.match(files["pnpm-workspace.yaml"], /packages:\n  - "apps\/\*"\n  - "packages\/\*"/);
  assert.match(files["pnpm-workspace.yaml"], /strictDepBuilds: true/);
  // react-vite build dependencies, mirroring the single-project pnpm policy.
  assert.match(files["pnpm-workspace.yaml"], /"@swc\/core": true/);
  assert.match(files["pnpm-workspace.yaml"], /"?esbuild"?: true/);

  // Empty member directories are kept by git; no app is scaffolded here
  // (apps arrive with `fsd add app`, MONO-13).
  assert.equal(files["apps/.gitkeep"], "");
  assert.equal(files["packages/.gitkeep"], "");
  assert.match(files[".gitignore"], /node_modules/);

  // The README names members with the MONO-02 scoped names.
  assert.match(files["README.md"], /# my-workspace/);
  assert.match(files["README.md"], /`@my-workspace\/web`/);
  assert.match(files["README.md"], /`@my-workspace\/shared-ui`/);
  assert.match(files["README.md"], /"workspace:\*"/);
});

test("the member patterns are the spec globs", () => {
  assert.deepEqual([...WORKSPACE_MEMBER_PATTERNS], ["apps/*", "packages/*"]);
  assert.ok(Object.isFrozen(WORKSPACE_MEMBER_PATTERNS));
  assert.deepEqual(
    [...WORKSPACE_FRAMEWORKS],
    ["react-vite", "nextjs", "vue-vite", "nuxt", "sveltekit", "angular"]
  );
});

test("the pnpm allowBuilds policy follows the workspace default framework", () => {
  const next = renderWorkspaceRootFiles({ ...OPTIONS, framework: "nextjs" });
  assert.match(next["pnpm-workspace.yaml"], /"?sharp"?: true/);
  assert.match(next["pnpm-workspace.yaml"], /"?unrs-resolver"?: true/);
  assert.equal(JSON.parse(next["fsd.config.json"]).framework, "nextjs");

  const angular = renderWorkspaceRootFiles({ ...OPTIONS, framework: "angular" });
  assert.match(angular["pnpm-workspace.yaml"], /"@parcel\/watcher": true/);
});

test("a scoped project name scopes the member names in the README", () => {
  const files = renderWorkspaceRootFiles({
    ...OPTIONS,
    projectName: "@acme/shop",
    packageName: "@acme/shop",
  });
  assert.match(files["README.md"], /`@acme\/web`/);
  assert.match(files["README.md"], /`@acme\/shared-ui`/);
  assert.equal(JSON.parse(files["package.json"]).name, "@acme/shop");
});

test("createWorkspaceRoot writes the rendered files to disk", (t) => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-mono03-"));
  t.after(() => fs.rmSync(targetDir, { recursive: true, force: true }));

  const written = createWorkspaceRoot(targetDir, OPTIONS);
  assert.deepEqual(written, [
    "fsd.config.json",
    "package.json",
    "pnpm-workspace.yaml",
    "apps/.gitkeep",
    "packages/.gitkeep",
    "README.md",
    ".gitignore",
  ]);

  const rendered = renderWorkspaceRootFiles(OPTIONS);
  for (const relativePath of written) {
    assert.equal(
      fs.readFileSync(path.join(targetDir, relativePath), "utf8"),
      rendered[relativePath]
    );
  }
  assert.equal(fs.existsSync(path.join(targetDir, "src")), false);
  assert.equal(fs.existsSync(path.join(targetDir, "apps", "web")), false);
});

test("the workspace root refuses any package manager but pnpm, npm, yarn and bun", (t) => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-mono03-"));
  t.after(() => fs.rmSync(targetDir, { recursive: true, force: true }));

  // MONO-04 added npm, MONO-05 added yarn, MONO-06 added bun: only a
  // genuinely unknown manager is refused now.
  for (const packageManager of ["deno"]) {
    assert.throws(
      () => createWorkspaceRoot(targetDir, { ...OPTIONS, packageManager }),
      /support pnpm, npm, yarn and bun/
    );
    assert.equal(fs.existsSync(path.join(targetDir, "fsd.config.json")), false);
  }
});

test("the workspace root refuses unknown frameworks and unusable names", () => {
  assert.throws(
    () => renderWorkspaceRootFiles({ ...OPTIONS, framework: "unknown" }),
    /Unknown framework "unknown"/
  );
  assert.throws(
    () => renderWorkspaceRootFiles({ ...OPTIONS, projectName: "" }),
    /project name is required/i
  );
  assert.throws(
    () => renderWorkspaceRootFiles({ ...OPTIONS, packageName: "MyApp" }),
    /is not a valid npm package name/
  );
});

test("`fsd --monorepo` creates the workspace root on disk", (t) => {
  const result = runCli(t, [
    "my-workspace",
    "--framework",
    "react-vite",
    "--yes",
    "--monorepo",
  ]);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Workspace created successfully!/);
  assert.match(result.output, /pnpm install/);
  const targetDir = path.join(result.cwd, "my-workspace");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(targetDir, "fsd.config.json"), "utf8")), {
    schemaVersion: 1,
    framework: "react-vite",
    projectName: "my-workspace",
    packageManager: "pnpm",
    target: "multi-web",
  });
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(targetDir, "package.json"), "utf8")).private,
    true
  );
  assert.match(
    fs.readFileSync(path.join(targetDir, "pnpm-workspace.yaml"), "utf8"),
    /"apps\/\*"/
  );
  assert.equal(fs.existsSync(path.join(targetDir, "apps", ".gitkeep")), true);
  assert.equal(fs.existsSync(path.join(targetDir, "packages", ".gitkeep")), true);
});

test("`--target multi-web` with nextjs writes the nextjs build policy", (t) => {
  const result = runCli(t, [
    "shop",
    "--framework",
    "nextjs",
    "--yes",
    "--target",
    "multi-web",
  ]);

  assert.equal(result.status, 0, result.output);
  assert.match(
    fs.readFileSync(path.join(result.cwd, "shop", "pnpm-workspace.yaml"), "utf8"),
    /"?sharp"?: true/
  );
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
