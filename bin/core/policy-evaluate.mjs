// Policy evaluation inside `fsd check` (INT-36).
//
// `bin/core/policy.mjs` only defines the `fsd.policy.ts` format and loads +
// validates it. This module evaluates a loaded policy against the project's
// source files, with no dependency on the INT-01 graph engine: it walks the
// source root, parses import specifiers out of each source file, resolves
// them to FSD layers/slices, and checks each enabled rule.
//
// Rules evaluated (see docs/POLICY-FORMAT.md for the declared semantics):
// - `layer-boundaries`: an import from a layer to another layer must be
//   allowed by the rule's `allow` map, or by the standard FSD order when
//   `allow` does not mention the importing layer. Imports inside the same
//   layer are not layer-boundary violations.
// - `no-slice-cross-imports`: slices in the same layer must not import each
//   other. The `app` and `shared` layers are exempt: app segments compose
//   the application and shared segments are low-level building blocks that
//   legitimately compose each other.
// - `no-public-api-bypass`: an import into another slice must target the
//   slice's public API — the slice directory itself or its index file —
//   not a file nested inside the slice. Imports into the `app` layer are
//   exempt (app is the composition root and has no per-slice public API);
//   imports within the same slice are always allowed.
//
// Only relative imports (`./`, `../`) and the `@/` alias (the source root,
// as generated code uses it, e.g. `@/shared/api`) are resolved. Bare
// package specifiers are ignored, and imports that cannot be resolved to
// a file under the source root are skipped, not reported.

import fs from "node:fs";
import path from "node:path";
import { POLICY_LAYERS } from "./policy.mjs";

export const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
];

const INDEX_FILES = SOURCE_EXTENSIONS.map((ext) => `index${ext}`);

// Standard FSD order: a layer may import only layers below it.
// `app` sits above everything; `shared` sits below everything and is
// imported, never importing another layer (same-layer imports are not
// layer-boundary violations, so `shared` has an empty allow-list here).
export const DEFAULT_LAYER_ALLOW = {
  app: ["pages", "widgets", "features", "entities", "shared"],
  pages: ["widgets", "features", "entities", "shared"],
  widgets: ["features", "entities", "shared"],
  features: ["entities", "shared"],
  entities: ["shared"],
  shared: [],
};

// Layers whose segments/slices may import each other. `app` segments
// compose the application and `shared` segments are low-level utilities;
// the other layers are slice layers, where cross-slice imports are banned.
const CROSS_IMPORT_EXEMPT_LAYERS = new Set(["app", "shared"]);

function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");
}

const IMPORT_PATTERNS = [
  // import ... from "spec" / import "spec"
  /(?:^|[;}\n])\s*import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
  // export ... from "spec"
  /(?:^|[;}\n])\s*export\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
  // import("spec") / require("spec")
  /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

export function parseImports(content) {
  const clean = stripComments(content);
  const specifiers = [];
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(clean)) !== null) {
      specifiers.push({ specifier: match[1], index: match.index });
    }
  }
  return specifiers;
}

export function collectSourceFiles(sourceRoot) {
  const files = [];
  if (!fs.existsSync(sourceRoot)) return files;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
      } else if (
        entry.isFile() &&
        SOURCE_EXTENSIONS.includes(path.extname(entry.name))
      ) {
        files.push(full);
      }
    }
  };
  walk(sourceRoot);
  return files.sort();
}

// Classify a file under the source root as `{ layer, slice }`, where
// `slice` is the first segment below the layer (`features/auth`,
// `shared/ui`, `app/providers`). Files directly under a layer or outside
// the layers have `slice: null`; files outside the source root (or under
// an unknown top-level directory) return null.
export function classifyFile(filePath, sourceRoot) {
  const relative = path.relative(sourceRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const [layer, slice] = relative.split(path.sep);
  if (!POLICY_LAYERS.includes(layer)) return null;
  return { layer, slice: slice ?? null, relative };
}

function resolveImportToFile(fromFile, specifier, sourceRoot) {
  let base;
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else if (specifier === "@" || specifier.startsWith("@/")) {
    base = path.join(sourceRoot, specifier.slice(2));
  } else {
    return null;
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of SOURCE_EXTENSIONS) {
    if (fs.existsSync(`${base}${ext}`)) return `${base}${ext}`;
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const indexFile of INDEX_FILES) {
      const candidate = path.join(base, indexFile);
      if (fs.existsSync(candidate)) return candidate;
    }
    return base;
  }
  return null;
}

// A resolved import targets a slice's public API when it resolves to the
// slice directory itself or to an index file directly inside it.
function isPublicApiImport(resolvedPath, sourceRoot, target) {
  const sliceRoot = path.join(sourceRoot, target.layer, target.slice);
  if (resolvedPath === sliceRoot) return true;
  return (
    path.dirname(resolvedPath) === sliceRoot &&
    INDEX_FILES.includes(path.basename(resolvedPath))
  );
}

function violation(ruleId, severity, message, file, cwd) {
  return {
    ruleId,
    severity,
    message,
    file: file ? path.relative(cwd, file) : null,
  };
}

export function evaluatePolicy(policy, cwd = process.cwd(), sourceRoot) {
  const root =
    sourceRoot ?? path.join(cwd, "src");
  const rules = new Map(
    (policy.rules ?? []).map((rule) => [rule.id, rule]),
  );
  const violations = [];
  const files = collectSourceFiles(root);
  let importsChecked = 0;

  for (const file of files) {
    const source = classifyFile(file, root);
    if (!source || !source.slice) continue;
    const content = fs.readFileSync(file, "utf8");
    for (const { specifier } of parseImports(content)) {
      const resolved = resolveImportToFile(file, specifier, root);
      if (!resolved) continue;
      const target = classifyFile(resolved, root);
      if (!target || !target.slice) continue;
      importsChecked += 1;
      const displaySource = path.relative(cwd, file);
      const displayTarget = path.relative(cwd, resolved);

      const boundaries = rules.get("layer-boundaries");
      if (
        boundaries &&
        target.layer !== source.layer
      ) {
        const allowed =
          boundaries.allow?.[source.layer] ??
          DEFAULT_LAYER_ALLOW[source.layer];
        if (!allowed.includes(target.layer)) {
          violations.push(
            violation(
              "layer-boundaries",
              boundaries.severity ?? "error",
              `${displaySource} imports "${target.layer}" layer (${displayTarget}), but "${source.layer}" may only import ${allowed.length ? allowed.join(", ") : "nothing"}.`,
              file,
              cwd,
            ),
          );
        }
      }

      const crossImports = rules.get("no-slice-cross-imports");
      if (
        crossImports &&
        target.layer === source.layer &&
        target.slice !== source.slice &&
        !CROSS_IMPORT_EXEMPT_LAYERS.has(source.layer)
      ) {
        violations.push(
          violation(
            "no-slice-cross-imports",
            crossImports.severity ?? "error",
            `${displaySource} imports slice "${target.layer}/${target.slice}" from slice "${source.layer}/${source.slice}" — slices in the same layer must not import each other.`,
            file,
            cwd,
          ),
        );
      }

      const bypass = rules.get("no-public-api-bypass");
      if (
        bypass &&
        target.layer !== "app" &&
        (target.layer !== source.layer || target.slice !== source.slice) &&
        !isPublicApiImport(resolved, root, target)
      ) {
        violations.push(
          violation(
            "no-public-api-bypass",
            bypass.severity ?? "error",
            `${displaySource} imports "${displayTarget}" — import the public API of slice "${target.layer}/${target.slice}" (its index) instead of reaching into its internals.`,
            file,
            cwd,
          ),
        );
      }
    }
  }

  return {
    filesScanned: files.length,
    importsChecked,
    violations,
  };
}
