// Adoption analysis (INT-05) — the first slice of `fsd adopt`.
//
// A legacy project is not FSD yet: its files live in flat directories
// (`components/`, `utils/`, `hooks/`, `api/`, …) instead of FSD layers.
// This module measures how far such a project is from FSD and suggests a
// home for every flat file. It never writes anything and never moves a
// file — the editable migration plan is INT-06, execution is INT-07.
//
// Classification, per source file (paths relative to the source root):
// - `in-layer`: inside a layer slice/segment directory
//   (`features/auth/model/auth.ts`, `shared/ui/Button.tsx`). Already FSD.
// - `layer-root`: directly under a layer directory (`pages/home.tsx`,
//   `shared/index.ts`). The layer is right, the slice is missing — the
//   file needs restructuring into a slice, not a move to another layer.
// - `flat`: under a well-known legacy directory. The mapping table below
//   suggests a target; the suggestion is a starting point, editable in
//   the plan (INT-06), not a verdict.
// - `unmapped`: anything else (top-level files like `src/main.tsx`, or a
//   directory the table does not know). Listed for a manual decision.
//
// The score is the share of source files already in layers (0 when the
// project has no source files — nothing is in layers yet). It reuses
// `explainProject()` for the source root and the layer/slice inventory,
// so it agrees with `fsd explain` about what the project looks like.

import fs from "node:fs";
import path from "node:path";
import { explainProject } from "../commands/explain-project.mjs";

export const ADOPT_SOURCE_EXTENSIONS = [
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".vue",
  ".svelte",
];

// Legacy directory → FSD target. The first segment of a flat path decides
// the layer and slice; the rest of the path is kept, so
// `components/forms/LoginForm.tsx` suggests `shared/ui/forms/LoginForm.tsx`.
export const ADOPT_DIRECTORY_MAP = {
  components: { layer: "shared", slice: "ui" },
  ui: { layer: "shared", slice: "ui" },
  utils: { layer: "shared", slice: "lib" },
  lib: { layer: "shared", slice: "lib" },
  helpers: { layer: "shared", slice: "lib" },
  hooks: { layer: "shared", slice: "lib" },
  constants: { layer: "shared", slice: "lib" },
  api: { layer: "shared", slice: "api" },
  services: { layer: "shared", slice: "api" },
  store: { layer: "app", slice: "store" },
  stores: { layer: "app", slice: "store" },
};

export const ADOPT_LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function isSourceFile(filePath) {
  return ADOPT_SOURCE_EXTENSIONS.includes(path.extname(filePath));
}

function collectSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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

// `sourceDir` is the source root relative to the project root (e.g.
// "src"): `file` comes out relative to the project root, while
// `suggestion.to` is relative to the source root.
function classifyFile(relativeFile, sourceDir) {
  const segments = toPosix(relativeFile).split("/");
  const [first, second, ...rest] = segments;
  if (ADOPT_LAYERS.includes(first)) {
    if (segments.length >= 3) {
      return {
        file: path.join(sourceDir, relativeFile),
        status: "in-layer",
        layer: first,
        slice: second,
      };
    }
    return {
      file: path.join(sourceDir, relativeFile),
      status: "layer-root",
      layer: first,
      slice: null,
      note: "directly under the layer — restructure into a slice",
    };
  }
  if (segments.length === 1) {
    return {
      file: path.join(sourceDir, relativeFile),
      status: "unmapped",
      layer: null,
      slice: null,
      note: "top-level file — decide manually",
    };
  }
  const target = ADOPT_DIRECTORY_MAP[first];
  if (!target) {
    return {
      file: path.join(sourceDir, relativeFile),
      status: "unmapped",
      layer: null,
      slice: null,
      note: `no mapping for "${first}/" yet — place it manually`,
    };
  }
  return {
    file: path.join(sourceDir, relativeFile),
    status: "flat",
    layer: null,
    slice: null,
    suggestion: {
      to: `${target.layer}/${target.slice}/${[second, ...rest].join("/")}`,
      reason: `${first}/ maps to ${target.layer}/${target.slice}`,
    },
  };
}

/**
 * Analyzes a project for FSD adoption: how much of it already lives in
 * layers, and where every other source file should go.
 *
 * @param {string} root project root
 * @returns {{framework: string, sourceRoot: string, score: number, totals: {files: number, inLayer: number, layerRoot: number, flat: number, unmapped: number}, layers: {layer: string, slices: string[]}[], files: object[]}}
 */
export function analyzeAdoption(root) {
  const { config, sourceRoot, layers } = explainProject(root);
  const files = fs.existsSync(sourceRoot)
    ? collectSourceFiles(sourceRoot)
        .map((file) => path.relative(sourceRoot, file))
        .sort()
        .map((relative) => classifyFile(relative, path.relative(root, sourceRoot)))
    : [];
  const totals = {
    files: files.length,
    inLayer: files.filter((file) => file.status === "in-layer").length,
    layerRoot: files.filter((file) => file.status === "layer-root").length,
    flat: files.filter((file) => file.status === "flat").length,
    unmapped: files.filter((file) => file.status === "unmapped").length,
  };
  const score =
    totals.files === 0 ? 0 : Math.round((100 * totals.inLayer) / totals.files);
  return {
    framework: config.framework,
    sourceRoot,
    score,
    totals,
    layers: layers.map(({ layer, slices }) => ({ layer, slices })),
    files,
  };
}
