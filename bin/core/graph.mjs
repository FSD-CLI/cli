// Project graph engine (INT-01) — shared analyzer.
//
// Slice 1 builds the node inventory only: it walks the project source root
// and maps every source file to its (layer, slice/segment). No import
// parsing happens here — edges stay empty until slice 2.
//
// The layer layout is never re-derived in this module: it reuses
// `explainProject()` from bin/commands/explain-project.mjs, which resolves
// the source root from the project config and the framework adapter.
//
// Node shape (stable across slices):
//   { id, file, layer, slice }
//   - id:    path relative to the source root, without the file extension
//            (e.g. "features/auth/model/auth") — the import-like identity
//            slice 2 resolves import specifiers against.
//   - file:  path relative to the project root, with extension
//            (e.g. "src/features/auth/model/auth.ts").
//   - layer: one of app / pages / widgets / features / entities / shared.
//   - slice: the slice name for pages/widgets/features/entities, or the
//            segment name for app/shared (e.g. "providers", "ui").
//
// Files that are not inside a slice/segment directory (for example
// `src/main.tsx` or `src/shared/index.ts`) are skipped: they belong to no
// layer slice. Single-file-component sources (.vue / .svelte / .astro) are
// not discovered yet — they arrive with slice 2's import extraction.

import fs from "node:fs";
import path from "node:path";
import { explainProject } from "../commands/explain-project.mjs";

// Source extensions the graph tracks. Keep in sync with the slice-2
// import parser — it parses exactly these files.
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
  return { nodes, edges: [] };
}
