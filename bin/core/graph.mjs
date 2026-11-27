// Project graph engine (INT-01) — shared analyzer.
//
// Slice 1 builds the node inventory: it walks the project source root and
// maps every source file to its (layer, slice/segment).
// Slice 2 adds the import parser: it reads every node file, extracts its
// import specifiers, and resolves relative specifiers to nodes, emitting
// the graph's edges. No judgement happens here — violation detection is
// slice 3; edges are plain facts, including the 3 deliberate upward imports
// in the with-violations fixture.
//
// The layer layout is never re-derived in this module: it reuses
// `explainProject()` from bin/commands/explain-project.mjs, which resolves
// the source root from the project config and the framework adapter.
//
// Node shape (stable across slices):
//   { id, file, layer, slice }
//   - id:    path relative to the source root, without the file extension
//            (e.g. "features/auth/model/auth") — the import-like identity
//            the parser resolves import specifiers against.
//   - file:  path relative to the project root, with extension
//            (e.g. "src/features/auth/model/auth.ts").
//   - layer: one of app / pages / widgets / features / entities / shared.
//   - slice: the slice name for pages/widgets/features/entities, or the
//            segment name for app/shared (e.g. "providers", "ui").
//
// Edge shape:
//   { from, to, specifier, resolved }
//   - from:      the importing node's id.
//   - to:        the imported node's id, or null when the specifier could
//                not be resolved to a node.
//   - specifier: the raw import specifier as written in the source.
//   - resolved:  true when `to` is a node, false otherwise. Bare imports
//                (e.g. "react") and alias imports (e.g. "@/...") are
//                unresolved-but-recorded: they appear as edges with
//                to: null instead of being silently dropped. Alias
//                resolution (tsconfig paths) is a follow-up, not slice 2.
//
// Files that are not inside a slice/segment directory (for example
// `src/main.tsx` or `src/shared/index.ts`) are skipped: they belong to no
// layer slice. Single-file-component sources (.vue / .svelte / .astro) are
// not discovered or parsed — they stay out of scope for the graph engine
// until a later slice adds them.

import fs from "node:fs";
import path from "node:path";
import { explainProject } from "../commands/explain-project.mjs";

// Source extensions the graph tracks. The parser parses exactly these files.
export const GRAPH_SOURCE_EXTENSIONS = [".js", ".mjs", ".ts", ".tsx", ".jsx"];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function isSourceFile(filePath) {
  return GRAPH_SOURCE_EXTENSIONS.includes(path.extname(filePath));
}

function collectSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Hidden directories (.git, .fsd) and dependencies never hold FSD slices.
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, out);
    } else if (entry.isFile() && isSourceFile(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

// Strip // and /* */ comments, respecting string literals (including
// template literals) so a "//" inside a string is left alone. The parser
// below only sees comment-free code, so a fake `import ... from` inside a
// comment never becomes an edge. Known limit: a `//` inside a ${...}
// expression of a template literal is treated as string content, and a
// regex literal containing "//" can confuse the scanner — neither occurs
// in import statements, which is all this parser reads.
function stripComments(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  let quote = null;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

// Static import statements only ever start a statement, so the pattern is
// anchored to a line start (or a statement separator) — an `import ... from`
// inside a string literal is never matched. Dynamic import() and require()
// can appear mid-expression, so those patterns are unanchored.
const STATIC_IMPORT_RE =
  /(?:^|[;{}])\s*import\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
const REEXPORT_RE =
  /(?:^|[;{}])\s*export\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_RE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

// Extract every import specifier from one source file, in source order,
// duplicates kept (one entry per import statement). Handles `import ...`,
// `import type ...`, side-effect `import "..."`, `export ... from`,
// `export * from`, `require("...")` and dynamic `import("...")`.
export function parseImports(source) {
  const clean = stripComments(source);
  const found = [];
  for (const re of [
    STATIC_IMPORT_RE,
    REEXPORT_RE,
    DYNAMIC_IMPORT_RE,
    REQUIRE_RE,
  ]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(clean)) !== null) {
      found.push({ specifier: match[1], index: match.index });
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found.map(({ specifier }) => specifier);
}

// Resolve a relative specifier to a node id, or null when it does not point
// at a node. Only the final source extension is stripped (a ".types" suffix
// in a name like product.types is part of the id, not an extension), and a
// directory import resolves to its index file. Specifiers that escape the
// source root never resolve.
function resolveToNode(specifier, fromFile, sourceRoot, nodeById) {
  if (!specifier.startsWith(".")) return null;
  const absolute = path.normalize(
    path.join(path.dirname(fromFile), specifier),
  );
  const relative = toPosix(path.relative(sourceRoot, absolute));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const ext = path.extname(absolute);
  const base = GRAPH_SOURCE_EXTENSIONS.includes(ext)
    ? relative.slice(0, -ext.length)
    : relative;
  if (nodeById.has(base)) return base;
  const indexId = `${base}/index`;
  if (nodeById.has(indexId)) return indexId;
  return null;
}

export function buildGraph(cwd = process.cwd()) {
  const { sourceRoot, layers } = explainProject(cwd);
  const knownLayers = new Set(layers.map(({ layer }) => layer));
  const nodes = [];

  if (fs.existsSync(sourceRoot)) {
    for (const filePath of collectSourceFiles(sourceRoot)) {
      const relative = toPosix(path.relative(sourceRoot, filePath));
      const parts = relative.split("/");
      // A node needs at least layer/slice/file. Files sitting directly
      // under the source root or directly under a layer directory belong
      // to no slice and are skipped.
      if (parts.length < 3) continue;
      const [layer, slice] = parts;
      if (!knownLayers.has(layer)) continue;
      nodes.push({
        id: relative.replace(/\.[^.]+$/, ""),
        file: toPosix(path.relative(cwd, filePath)),
        layer,
        slice,
      });
    }
  }

  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = [];
  const seen = new Set();
  for (const node of nodes) {
    const absoluteFile = path.join(cwd, node.file);
    const source = fs.readFileSync(absoluteFile, "utf8");
    for (const specifier of parseImports(source)) {
      // One edge per (file, specifier): importing the same module twice
      // (e.g. `import type` plus `import`) is a single dependency.
      const key = `${node.id}\0${specifier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const to = resolveToNode(specifier, absoluteFile, sourceRoot, nodeById);
      edges.push({
        from: node.id,
        to,
        specifier,
        resolved: to !== null,
      });
    }
  }
  edges.sort((a, b) =>
    a.from < b.from
      ? -1
      : a.from > b.from
        ? 1
        : (a.to ?? "") < (b.to ?? "")
          ? -1
          : (a.to ?? "") > (b.to ?? "")
            ? 1
            : a.specifier < b.specifier
              ? -1
              : a.specifier > b.specifier
                ? 1
                : 0,
  );

  return { nodes, edges };
}
