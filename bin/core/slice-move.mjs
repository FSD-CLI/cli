import fs from "node:fs";
import path from "node:path";
import { toKebabCase } from "../generators/shared.mjs";
import { getFrameworkAdapter } from "./frameworks/index.mjs";

// `fsd move` / `fsd rename` (PLAT-05): relocate an FSD slice and rewrite
// every import that points at it, so the project keeps compiling after the
// move. Pages are excluded: their route registration is framework-specific
// (see registerPageRoute in bin/generator.mjs) and cannot be rewired by a
// plain directory move.
export const MOVABLE_SLICE_TYPES = Object.freeze([
  "feature",
  "entity",
  "widget",
]);

const LAYER_DIRS = Object.freeze({
  feature: "features",
  entity: "entities",
  widget: "widgets",
});

const REWRITABLE_EXTENSIONS = Object.freeze([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".vue",
  ".svelte",
]);

// Only static string-literal specifiers are rewritten: `import … from "…"`,
// `export … from "…"`, dynamic `import("…")` and `require("…")`. Imports
// built at runtime (template strings, concatenation) are left untouched.
const SPECIFIER_PATTERN =
  /(?:from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\))/g;

function validateSliceName(name, label) {
  const normalized = toKebabCase(name);
  if (!normalized || !/^[a-z]/.test(normalized)) {
    throw new Error(
      `Slice ${label} "${name}" must contain at least one letter or number and start with a letter after normalization.`
    );
  }
  return normalized;
}

export function validateMoveOptions({ type, oldName, newName, toType }) {
  if (!type || !MOVABLE_SLICE_TYPES.includes(type)) {
    throw new Error(
      type === "page"
        ? 'Moving pages is not supported yet: page routes are framework-specific. Move feature, entity or widget slices only.'
        : `Invalid slice type "${type ?? ""}". Movable types: ${MOVABLE_SLICE_TYPES.join(", ")}.`
    );
  }
  if (toType !== undefined && !MOVABLE_SLICE_TYPES.includes(toType)) {
    throw new Error(
      `Invalid target type "${toType}". Movable types: ${MOVABLE_SLICE_TYPES.join(", ")}.`
    );
  }
  return {
    type,
    oldName: validateSliceName(oldName, "name"),
    newName: validateSliceName(newName, "new name"),
    toType: toType ?? type,
  };
}

export function resolveSliceDir(cwd, config, type, name) {
  const adapter = getFrameworkAdapter(config.framework);
  const sourceRoot = path.join(cwd, adapter.sourceDirectory);
  const baseDir = fs.existsSync(sourceRoot)
    ? path.join(sourceRoot, LAYER_DIRS[type])
    : path.join(cwd, LAYER_DIRS[type]);
  return path.join(baseDir, name);
}

function resolveSourceRoot(cwd, config) {
  const adapter = getFrameworkAdapter(config.framework);
  const sourceRoot = path.join(cwd, adapter.sourceDirectory);
  return fs.existsSync(sourceRoot) ? sourceRoot : cwd;
}

// Alias bases for import specifiers, from the project's tsconfig paths when
// present, with the CLI's own conventions as fallback: `@/` maps to the
// source root (generated React/Vue code imports `@/shared/api`), `@app/`
// maps to `<source root>/app` (Angular schematics).
export function loadAliasBases(cwd, sourceRoot) {
  const bases = [
    { prefix: "@/", base: sourceRoot },
    { prefix: "@app/", base: path.join(sourceRoot, "app") },
  ];
  try {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(cwd, "tsconfig.json"), "utf8")
    );
    for (const [pattern, targets] of Object.entries(
      tsconfig.compilerOptions?.paths ?? {}
    )) {
      if (!pattern.endsWith("/*") || !targets?.length) continue;
      const prefix = pattern.slice(0, -1);
      const target = String(targets[0]).replace(/\/\*$/, "");
      bases.unshift({
        prefix,
        base: path.join(cwd, target),
      });
    }
  } catch {
    // No tsconfig or unreadable paths: the fallback bases above apply.
  }
  return bases;
}

function probeFile(logicalPath) {
  if (fs.existsSync(logicalPath) && fs.statSync(logicalPath).isFile()) {
    return logicalPath;
  }
  for (const extension of REWRITABLE_EXTENSIONS) {
    const candidate = `${logicalPath}${extension}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  for (const extension of REWRITABLE_EXTENSIONS) {
    const candidate = path.join(logicalPath, `index${extension}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function logicalTarget(specifier, fromFile, sourceRoot, aliasBases) {
  if (specifier.startsWith(".")) {
    return path.normalize(
      path.join(path.dirname(fromFile), specifier)
    );
  }
  for (const { prefix, base } of aliasBases) {
    if (specifier.startsWith(prefix)) {
      return path.normalize(path.join(base, specifier.slice(prefix.length)));
    }
  }
  return null;
}

function reexpressSpecifier(newLogicalPath, fromDir, alias) {
  // Preserve the original specifier's style: a relative import stays
  // relative, an alias import keeps its alias prefix.
  if (alias) {
    const suffix = path.relative(alias.base, newLogicalPath);
    return `${alias.prefix}${suffix.split(path.sep).join("/")}`;
  }
  const relative = path
    .relative(fromDir, newLogicalPath)
    .split(path.sep)
    .join("/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

// Returns the rewritten specifier when it points inside the moved slice,
// or null when it does not (or cannot be resolved).
export function rewriteSpecifier(
  specifier,
  fromFile,
  sourceRoot,
  aliasBases,
  oldSliceDir,
  newSliceDir
) {
  const logicalPath = logicalTarget(specifier, fromFile, sourceRoot, aliasBases);
  if (!logicalPath) return null;
  const resolved = probeFile(logicalPath);
  if (!resolved) return null;
  if (resolved !== oldSliceDir && !resolved.startsWith(`${oldSliceDir}${path.sep}`)) {
    return null;
  }
  const suffix = logicalPath.slice(oldSliceDir.length);
  const newLogicalPath = path.normalize(`${newSliceDir}${suffix}`);
  const alias = specifier.startsWith(".")
    ? null
    : aliasBases.find(({ prefix }) => specifier.startsWith(prefix));
  // The importing file may move with the slice: express the new specifier
  // relative to where the file will live after the move, so a relative
  // import between two files inside the slice keeps its original form.
  const fromDir = fromFile.startsWith(`${oldSliceDir}${path.sep}`)
    ? path.join(newSliceDir, path.relative(oldSliceDir, path.dirname(fromFile)))
    : path.dirname(fromFile);
  return reexpressSpecifier(newLogicalPath, fromDir, alias ?? null);
}

function collectSourceFiles(sourceRoot) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walk(entryPath);
      } else if (REWRITABLE_EXTENSIONS.includes(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  };
  if (fs.existsSync(sourceRoot)) walk(sourceRoot);
  return files;
}

export function planSliceMove({ cwd, config, type, oldName, newName, toType }) {
  const options = validateMoveOptions({ type, oldName, newName, toType });
  const sourceRoot = resolveSourceRoot(cwd, config);
  const oldSliceDir = resolveSliceDir(cwd, config, options.type, options.oldName);
  const newSliceDir = resolveSliceDir(
    cwd,
    config,
    options.toType,
    options.newName
  );

  if (!fs.existsSync(oldSliceDir) || !fs.statSync(oldSliceDir).isDirectory()) {
    throw new Error(
      `Slice "${options.type} ${options.oldName}" does not exist (${path.relative(cwd, oldSliceDir)}).`
    );
  }
  if (oldSliceDir === newSliceDir) {
    throw new Error(
      `Slice "${options.type} ${options.oldName}" is already named "${options.newName}".`
    );
  }
  if (fs.existsSync(newSliceDir)) {
    throw new Error(
      `Destination "${path.relative(cwd, newSliceDir)}" already exists. Choose another name.`
    );
  }

  const aliasBases = loadAliasBases(cwd, sourceRoot);
  const rewrites = [];
  for (const file of collectSourceFiles(sourceRoot)) {
    const content = fs.readFileSync(file, "utf8");
    let changed = false;
    const updated = content.replace(
      SPECIFIER_PATTERN,
      (match, fromSpecifier, importSpecifier, requireSpecifier) => {
        const specifier = fromSpecifier ?? importSpecifier ?? requireSpecifier;
        const rewritten = rewriteSpecifier(
          specifier,
          file,
          sourceRoot,
          aliasBases,
          oldSliceDir,
          newSliceDir
        );
        if (!rewritten || rewritten === specifier) return match;
        changed = true;
        return match.replace(specifier, rewritten);
      }
    );
    if (changed) rewrites.push({ file, content: updated });
  }

  return {
    cwd,
    config,
    ...options,
    sourceRoot,
    oldSliceDir,
    newSliceDir,
    rewrites,
  };
}

export function applySliceMove(plan) {
  // A rewritten file inside the moved slice lives under the new directory
  // after the rename; a file outside it keeps its path.
  const targetPath = (file) =>
    file.startsWith(`${plan.oldSliceDir}${path.sep}`)
      ? path.join(plan.newSliceDir, path.relative(plan.oldSliceDir, file))
      : file;
  const snapshots = plan.rewrites.map(({ file }) => ({
    file,
    content: fs.readFileSync(file, "utf8"),
  }));
  let moved = false;
  try {
    fs.renameSync(plan.oldSliceDir, plan.newSliceDir);
    moved = true;
    for (const { file, content } of plan.rewrites) {
      fs.writeFileSync(targetPath(file), content);
    }
    return {
      ...plan,
      rewrittenFiles: plan.rewrites.map(({ file }) =>
        path.relative(plan.cwd, targetPath(file))
      ),
    };
  } catch (error) {
    if (moved && fs.existsSync(plan.newSliceDir)) {
      fs.renameSync(plan.newSliceDir, plan.oldSliceDir);
    }
    for (const { file, content } of snapshots) {
      if (fs.existsSync(file)) fs.writeFileSync(file, content);
    }
    throw error;
  }
}

export function moveSlice(options) {
  return applySliceMove(planSliceMove(options));
}
