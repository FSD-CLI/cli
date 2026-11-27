/**
 * Monorepo workspace root generator (MONO-03).
 *
 * Writes the root of a pnpm workspace exactly as specified in
 * docs/MONOREPO-LAYOUT.md (MONO-01): a root `fsd.config.json` with
 * `target: "multi-web"`, a private root `package.json` listing the
 * workspace members, a `pnpm-workspace.yaml` with the member globs, and
 * the empty `apps/` and `packages/` member directories. The root has no
 * `src/` of its own and no dependencies: apps are added later with
 * `fsd add app` (MONO-13) and shared packages with MONO-14–16.
 *
 * pnpm is the only package manager the workspace root supports today:
 * npm, Yarn and Bun workspaces are MONO-04–06. The generator refuses
 * any other manager instead of writing a root pnpm cannot install.
 *
 * The file contents are pure renderers (`renderWorkspaceRootFiles`), so
 * tests can assert the exact bytes without touching disk; the create
 * flow owns the target directory (transaction, `--force`) and calls
 * `createWorkspaceRoot` to write them.
 */
import fs from "fs";
import path from "path";
import { inspectPackageName, workspaceMemberName } from "../core/package-name.mjs";

/** The workspace member globs, from the MONO-01 layout spec. */
export const WORKSPACE_MEMBER_PATTERNS = Object.freeze(["apps/*", "packages/*"]);

/** The frameworks a workspace can default to (same six as fsd.config.json). */
export const WORKSPACE_FRAMEWORKS = Object.freeze([
  "react-vite",
  "nextjs",
  "vue-vite",
  "nuxt",
  "sveltekit",
  "angular",
]);

// pnpm >=10.26 refuses to run install-time scripts unless the package is
// approved. This mirrors the allowBuilds policy configureProject writes
// for a single pnpm project (bin/project-config.mjs): the same framework
// build dependencies, so an app created under this workspace installs
// exactly as it would on its own.
const FRAMEWORK_BUILD_DEPENDENCIES = Object.freeze({
  "react-vite": Object.freeze(["@swc/core", "esbuild"]),
  nextjs: Object.freeze(["sharp", "unrs-resolver"]),
  "vue-vite": Object.freeze(["esbuild", "vue-demi"]),
  nuxt: Object.freeze(["esbuild", "unrs-resolver", "vue-demi"]),
  sveltekit: Object.freeze(["esbuild"]),
  angular: Object.freeze(["@parcel/watcher", "esbuild", "lmdb", "msgpackr-extract"]),
});

function assertWorkspaceOptions({ projectName, packageName, framework, packageManager }) {
  if (packageManager !== "pnpm") {
    throw new Error(
      `Multi-web workspaces support only pnpm today (received "${packageManager}"). ` +
        "npm, Yarn and Bun workspaces are separate tasks (MONO-04–06)."
    );
  }
  if (!WORKSPACE_FRAMEWORKS.includes(framework)) {
    throw new Error(
      `Unknown framework "${framework}". Supported frameworks: ${WORKSPACE_FRAMEWORKS.join(", ")}.`
    );
  }
  const packageCheck = inspectPackageName(packageName ?? "");
  if (!packageCheck.valid) {
    const reasons = [...packageCheck.errors, ...packageCheck.warnings].join(", ");
    throw new Error(
      `"${packageName}" is not a valid npm package name${reasons ? ` (${reasons})` : "."}`
    );
  }
  // Deriving one member name validates the project name the same way:
  // an unusable name fails here instead of producing a broken scope.
  workspaceMemberName(projectName, "web");
}

function renderFsdConfig({ projectName, framework }) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      framework,
      projectName,
      packageManager: "pnpm",
      target: "multi-web",
    },
    null,
    2
  );
}

function renderRootPackageJson({ packageName }) {
  return JSON.stringify(
    {
      name: packageName,
      private: true,
      version: "0.1.0",
      workspaces: [...WORKSPACE_MEMBER_PATTERNS],
      scripts: {
        dev: "pnpm -r run dev",
        build: "pnpm -r run build",
        lint: "pnpm -r run lint",
        test: "pnpm -r run test",
      },
    },
    null,
    2
  );
}

function renderPnpmWorkspace({ framework }) {
  return [
    "# pnpm workspace: every directory under apps/ and packages/ is a member.",
    "packages:",
    ...WORKSPACE_MEMBER_PATTERNS.map((pattern) => `  - ${JSON.stringify(pattern)}`),
    "",
    "# pnpm >=10.26: only these framework build dependencies may run scripts.",
    "# Review new dependencies explicitly with pnpm approve-builds.",
    "strictDepBuilds: true",
    "allowBuilds:",
    ...FRAMEWORK_BUILD_DEPENDENCIES[framework].map((name) => `  ${JSON.stringify(name)}: true`),
    "",
  ].join("\n");
}

function renderWorkspaceReadme({ projectName }) {
  const web = workspaceMemberName(projectName, "apps/web");
  const sharedUi = workspaceMemberName(projectName, "packages/shared-ui");
  return [
    `# ${projectName}`,
    "",
    "A pnpm workspace of FSD applications, created with FSD CLI (`fsd --monorepo`).",
    "",
    "## Layout",
    "",
    "- `apps/` — runnable FSD applications, one full FSD project each",
    `  (for example \`apps/web\` is \`${web}\`).`,
    "- `packages/` — shared libraries, never applications:",
    `  \`packages/shared-*\` for shared-layer primitives (for example \`${sharedUi}\`)`,
    "  and `packages/entities-<name>` for one shared entity each.",
    "",
    "An app imports a package only by its workspace name",
    `(\`"${sharedUi}": "workspace:*"\`); an app never imports from another app,`,
    "and a package never imports from an app. See `docs/MONOREPO-LAYOUT.md`",
    "in the FSD CLI repository for the full layout contract.",
    "",
    "## Commands",
    "",
    "- `pnpm install` — install dependencies for every member",
    "- `pnpm -r run dev` — start every app's dev server",
    "- `pnpm -r run build` — build every member",
    "- `pnpm -r run test` — test every member",
    "",
    "Run `fsd check` and `fsd doctor` inside an app directory: at the",
    "workspace root they report the workspace, never a failure.",
    "",
  ].join("\n");
}

/**
 * Renders every file the workspace root contains, as relative paths to
 * exact contents. The root `fsd.config.json` is the MONO-01 shape
 * (`target: "multi-web"`, no stack fields): it is not a single-project
 * config, so the single-project schema does not apply to it.
 *
 * @param {{projectName: string, packageName: string, framework: string, packageManager?: string}} options
 * @returns {Record<string, string>} relative path → file contents
 */
export function renderWorkspaceRootFiles(options) {
  const resolved = { packageManager: "pnpm", ...options };
  assertWorkspaceOptions(resolved);
  const { projectName, packageName, framework } = resolved;
  return {
    "fsd.config.json": `${renderFsdConfig({ projectName, framework })}\n`,
    "package.json": `${renderRootPackageJson({ packageName })}\n`,
    "pnpm-workspace.yaml": renderPnpmWorkspace({ framework }),
    "apps/.gitkeep": "",
    "packages/.gitkeep": "",
    "README.md": renderWorkspaceReadme({ projectName }),
    ".gitignore": "node_modules\ndist\n",
  };
}

/**
 * Writes the workspace root into `targetDir`. The caller owns the
 * directory (the create flow's transaction creates or replaces it), so
 * existing root files are overwritten.
 *
 * @param {string} targetDir
 * @param {{projectName: string, packageName: string, framework: string, packageManager?: string}} options
 * @returns {string[]} the written files, as relative paths in write order
 */
export function createWorkspaceRoot(targetDir, options) {
  const files = renderWorkspaceRootFiles(options);
  const written = [];
  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(targetDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
    written.push(relativePath);
  }
  return written;
}
