// Turborepo task pipelines for a monorepo workspace (MONO-07).
//
// The layout this matches is docs/MONOREPO-LAYOUT.md (MONO-01): apps/* are
// runnable FSD projects, packages/* are libraries, and members import each
// other by workspace name (`workspace:*`). The pipelines therefore run the
// dependency's task first (`^build`) before an app's own build, lint, test
// or typecheck, so a package is always built before an app that imports it.
//
// The file is generated, never hand-edited: `fsd turbo` writes it from this
// module, and MONO-08 verifies Turborepo caching against it. Everything
// here is deterministic — same members in, same bytes out — so the file can
// be regenerated (`fsd turbo --force`) and diffed safely.

import fs from "node:fs";
import path from "node:path";

export const TURBO_JSON_FILE = "turbo.json";
export const TURBO_SCHEMA_URL = "https://turbo.build/schema.json";

// Pipelines, in the order they are written into the file. The order is part
// of the deterministic output: it never depends on discovery order.
export const TURBO_TASK_NAMES = [
  "build",
  "lint",
  "test",
  "typecheck",
  "dev",
  "clean",
];

const WORKSPACE_SIGNALS = ["apps", "packages", "pnpm-workspace.yaml"];

// Build outputs that are not `dist/**`, keyed by the app framework id in
// fsd.config.json. Next.js writes `.next/`, Nuxt writes `.output/`; every
// other template the CLI supports (React + Vite, Vue, SvelteKit, Angular)
// writes `dist/`.
const FRAMEWORK_BUILD_OUTPUTS = {
  nextjs: ".next/**",
  nuxt: ".output/**",
};

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// The framework of one app member, from its own fsd.config.json. A missing
// or unreadable config is not an error: the member still builds to dist/**.
function readMemberFramework(memberDir) {
  const config = readJsonFile(path.join(memberDir, "fsd.config.json"));
  return typeof config?.framework === "string" ? config.framework : undefined;
}

function isWorkspaceMemberDir(dir) {
  return (
    fs.existsSync(dir) &&
    fs.statSync(dir).isDirectory() &&
    fs.existsSync(path.join(dir, "package.json"))
  );
}

/**
 * Discovers the workspace members under a root, following the MONO-01
 * layout: every directory under apps/* and packages/* that carries its own
 * package.json is one member. Directories without a package.json (an empty
 * apps/ slot, a docs folder, node_modules) are not members and are ignored.
 *
 * @param {string} root workspace root
 * @returns {{kind: "app"|"package", name: string, dir: string, framework?: string}[]}
 *   sorted by relative directory, so discovery order never changes output
 */
export function discoverWorkspaceMembers(root) {
  const members = [];
  for (const [kind, base] of [
    ["app", "apps"],
    ["package", "packages"],
  ]) {
    const baseDir = path.join(root, base);
    if (!fs.existsSync(baseDir) || !fs.statSync(baseDir).isDirectory()) {
      continue;
    }
    for (const name of fs.readdirSync(baseDir).sort()) {
      if (name.startsWith(".")) continue;
      const dir = path.join(baseDir, name);
      if (!isWorkspaceMemberDir(dir)) continue;
      const member = { kind, name, dir: `${base}/${name}` };
      if (kind === "app") {
        const framework = readMemberFramework(dir);
        if (framework) member.framework = framework;
      }
      members.push(member);
    }
  }
  return members.sort((a, b) => a.dir.localeCompare(b.dir));
}

// The build outputs for a member set. Every member emits dist/** unless its
// framework says otherwise; a workspace with no members yet gets the
// union, so apps added later (MONO-13, `fsd add app`) are covered without
// regenerating the file.
function buildOutputsForMembers(members) {
  if (members.length === 0) return ["dist/**", ".next/**"];
  const outputs = new Set(["dist/**"]);
  for (const member of members) {
    const extra = FRAMEWORK_BUILD_OUTPUTS[member.framework ?? ""];
    if (extra) outputs.add(extra);
  }
  return [...outputs].sort();
}

/**
 * Builds the turbo.json config object for a workspace.
 *
 * - `build` runs after each dependency's build (`^build`) and caches its
 *   outputs; `lint`, `test` and `typecheck` also wait for `^build`, because
 *   members import each other through the workspace protocol and linting or
 *   testing an app against stale package output would be wrong.
 * - `dev` is never cached and stays attached (`persistent`), because it is a
 *   long-running server, not a task that finishes.
 * - `clean` is never cached: it deletes outputs, so there is nothing to
 *   restore from cache.
 *
 * @param {{kind: string, name: string, dir: string, framework?: string}[]} members
 *   workspace members from discoverWorkspaceMembers(); [] for an empty root
 * @returns {object} the turbo.json config object, keys in written order
 */
export function buildTurboConfig(members = []) {
  return {
    $schema: TURBO_SCHEMA_URL,
    tasks: {
      build: {
        dependsOn: ["^build"],
        inputs: ["$TURBO_DEFAULT$", ".env*"],
        outputs: buildOutputsForMembers(members),
      },
      lint: {
        dependsOn: ["^build"],
        inputs: ["$TURBO_DEFAULT$", "eslint.config.*", ".eslintrc*"],
      },
      test: {
        dependsOn: ["^build"],
        inputs: ["$TURBO_DEFAULT$"],
      },
      typecheck: {
        dependsOn: ["^build"],
        inputs: ["$TURBO_DEFAULT$", "tsconfig.json", "tsconfig.*.json"],
      },
      dev: {
        cache: false,
        persistent: true,
      },
      clean: {
        cache: false,
      },
    },
  };
}

/**
 * Renders a config object as the exact turbo.json file bytes: two-space
 * indent, trailing newline. JSON.stringify preserves insertion order, and
 * buildTurboConfig always inserts keys in the same order, so the output is
 * byte-stable for the same members.
 */
export function renderTurboJson(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/**
 * Checks a parsed turbo.json config against what this generator promises.
 * MONO-08 reuses this to verify a workspace's turbo.json before running
 * Turborepo against it.
 *
 * @param {unknown} config parsed turbo.json contents
 * @returns {string[]} issues; empty means the config is usable as generated
 */
export function validateTurboConfig(config) {
  const issues = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return ["turbo.json must contain a JSON object."];
  }
  const tasks = config.tasks;
  if (!tasks || typeof tasks !== "object" || Array.isArray(tasks)) {
    return ["turbo.json must contain a \"tasks\" object."];
  }
  for (const name of ["build", "lint", "test", "typecheck"]) {
    const task = tasks[name];
    if (!task || typeof task !== "object") {
      issues.push(`turbo.json is missing the "${name}" task.`);
      continue;
    }
    if (!Array.isArray(task.dependsOn) || !task.dependsOn.includes("^build")) {
      issues.push(
        `the "${name}" task must depend on "^build" so workspace dependencies build first.`,
      );
    }
    if (!Array.isArray(task.inputs) || !task.inputs.includes("$TURBO_DEFAULT$")) {
      issues.push(`the "${name}" task must include "$TURBO_DEFAULT$" in its inputs.`);
    }
  }
  const build = tasks.build;
  if (build && typeof build === "object") {
    if (!Array.isArray(build.outputs) || build.outputs.length === 0) {
      issues.push(`the "build" task must declare its "outputs" for caching.`);
    }
  }
  const dev = tasks.dev;
  if (dev && typeof dev === "object") {
    if (dev.cache !== false) {
      issues.push(`the "dev" task must set "cache" to false.`);
    }
    if (dev.persistent !== true) {
      issues.push(`the "dev" task must set "persistent" to true.`);
    }
  }
  const clean = tasks.clean;
  if (clean && typeof clean === "object" && clean.cache !== false) {
    issues.push(`the "clean" task must set "cache" to false.`);
  }
  return issues;
}

/**
 * Reads and validates an existing turbo.json. Throws when the file is
 * missing or is not valid JSON; returns the config with any validation
 * issues otherwise.
 */
export function readTurboConfig(root) {
  const file = path.join(root, TURBO_JSON_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(`No ${TURBO_JSON_FILE} found in ${root}.`);
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${TURBO_JSON_FILE} in ${root} is not valid JSON: ${error.message}`);
  }
  return { config, issues: validateTurboConfig(config) };
}

function assertWorkspaceRoot(root) {
  const hasMemberDirs = WORKSPACE_SIGNALS.slice(0, 2).some((dir) => {
    const full = path.join(root, dir);
    return fs.existsSync(full) && fs.statSync(full).isDirectory();
  });
  const hasWorkspaceFile = fs.existsSync(
    path.join(root, "pnpm-workspace.yaml"),
  );
  const rootPackage = readJsonFile(path.join(root, "package.json"));
  const hasWorkspacesField = Array.isArray(rootPackage?.workspaces);
  if (!hasMemberDirs && !hasWorkspaceFile && !hasWorkspacesField) {
    throw new Error(
      `${root} is not a monorepo workspace root: no apps/ or packages/ directory, no pnpm-workspace.yaml and no "workspaces" field in package.json. Generate the workspace first (see docs/MONOREPO-LAYOUT.md).`,
    );
  }
}

/**
 * Writes turbo.json into a workspace root.
 *
 * Refuses to overwrite an existing turbo.json unless `force` is passed, and
 * refuses outright when nx.json is present: the MONO-01 layout allows
 * exactly one of Turborepo or Nx, not both — remove nx.json first to switch
 * runners. Members are discovered from the root unless passed explicitly.
 *
 * @param {string} root workspace root
 * @param {{force?: boolean, members?: ReturnType<typeof discoverWorkspaceMembers>}} options
 * @returns {{path: string, config: object, members: ReturnType<typeof discoverWorkspaceMembers>}}
 */
export function writeTurboConfig(root, { force = false, members } = {}) {
  assertWorkspaceRoot(root);
  const file = path.join(root, TURBO_JSON_FILE);
  if (fs.existsSync(path.join(root, "nx.json"))) {
    throw new Error(
      `nx.json already exists in ${root}: a workspace uses Turborepo or Nx, not both (docs/MONOREPO-LAYOUT.md). Remove nx.json first to switch to Turborepo.`,
    );
  }
  if (fs.existsSync(file) && !force) {
    throw new Error(
      `${TURBO_JSON_FILE} already exists in ${root}. Pass --force to regenerate it.`,
    );
  }
  const discovered = members ?? discoverWorkspaceMembers(root);
  const config = buildTurboConfig(discovered);
  const issues = validateTurboConfig(config);
  if (issues.length > 0) {
    throw new Error(`Generated ${TURBO_JSON_FILE} is invalid: ${issues.join(" ")}`);
  }
  fs.writeFileSync(file, renderTurboJson(config), "utf8");
  return { path: file, config, members: discovered };
}
