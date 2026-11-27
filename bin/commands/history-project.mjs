import chalk from "chalk";
import path from "node:path";
import { getFrameworkAdapter } from "../core/frameworks/index.mjs";
import { spawnSyncSafe } from "../core/command-runner.mjs";
import { loadProjectConfig } from "../generator.mjs";

export const HISTORY_LAYERS = [
  "app",
  "pages",
  "widgets",
  "features",
  "entities",
  "shared",
];

export const DEFAULT_HISTORY_LIMIT = 50;
export const MAX_HISTORY_SLICES = 5;
export const MAX_EROSION_OFFENDERS = 5;

// Statuses that introduce or change a file at its current path. Deletions
// (D) remove erosion instead of introducing it, so they are never blamed.
const EROSION_STATUSES = new Set(["A", "M", "R", "T"]);

// Only JS/TS sources can carry imports, so only they are read back with
// `git show` for the cross-layer check. Other files are still checked for
// being placed outside the FSD layers.
const CODE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);

// Erosion kinds reported per file.
export const EROSION_KINDS = ["misplaced", "upward-import"];

// One line per commit, NUL-separated fields so subjects may contain any
// punctuation. `--name-status` then lists one `STATUS<TAB>path` line per
// changed file (renames list old and new paths; the new path is used). The
// status is what lets erosion be attributed to the commit that introduced
// it instead of to any later commit that merely touched the file. The author
// name is captured alongside so erosion can also be summed per author.
const LOG_FORMAT = "--pretty=format:%H%x00%ad%x00%an%x00%s";

function normalizePosix(value) {
  return value.replace(/\\/g, "/");
}

export function bucketFile(filePath, sourceRootRel) {
  const normalized = normalizePosix(filePath);
  const root = normalizePosix(sourceRootRel);
  const rest = root
    ? normalized.startsWith(`${root}/`)
      ? normalized.slice(root.length + 1)
      : null
    : normalized;
  if (rest === null) return null;
  const segments = rest.split("/");
  if (segments.length < 2) return null;
  const [layer, slice] = segments;
  if (!HISTORY_LAYERS.includes(layer)) return null;
  return { layer, slice: ["app", "shared"].includes(layer) || segments.length < 3 ? null : slice };
}

export function parseGitLog(output) {
  const commits = [];
  let current = null;
  for (const line of String(output ?? "").split(/\r?\n/)) {
    if (line.includes("\0")) {
      const [hash, date, author, ...subjectParts] = line.split("\0");
      current = { hash, date, author: author ?? "", subject: subjectParts.join("\0"), files: [] };
      commits.push(current);
      continue;
    }
    if (line.trim() === "") continue;
    if (!current) continue;
    // `--name-status` lines are `STATUS<TAB>path`; renames carry the old
    // path as a second field, so the new path is always the last one. The
    // status may carry a similarity score (for example `R100`), so only
    // its first letter is kept.
    const fields = line.split("\t");
    const status = fields.length > 1 ? fields[0].trim()[0] : "M";
    current.files.push({ path: fields[fields.length - 1], status });
  }
  return commits;
}

// The top-level directory a file sits in under the source root when that
// directory is not one of the FSD layers (for example `src/components/...`
// returns "components"). Returns null for files inside a layer, files
// outside the source root, and bare files directly under the source root
// (entry points such as `src/main.tsx` are conventional, not erosion).
export function straySegment(filePath, sourceRootRel) {
  const normalized = normalizePosix(filePath);
  const root = normalizePosix(sourceRootRel);
  const rest = root
    ? normalized.startsWith(`${root}/`)
      ? normalized.slice(root.length + 1)
      : null
    : normalized;
  if (rest === null) return null;
  const segments = rest.split("/");
  if (segments.length < 2) return null;
  if (HISTORY_LAYERS.includes(segments[0])) return null;
  return segments[0];
}

// Relative imports (`./` / `../`) found in `content`, resolved to
// repo-relative paths and bucketed by FSD layer. Alias imports (`@/…`)
// need project alias configuration to resolve, so they are out of scope.
export function collectLayerImports(content, fromFile, sourceRootRel) {
  const specifiers = new Set();
  const patterns = [
    /\bfrom\s*['"](\.[^'"]+)['"]/g,
    /\bimport\s*['"](\.[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]/g,
    /\brequire\s*\(\s*['"](\.[^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    for (const match of String(content ?? "").matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }
  const imports = [];
  for (const specifier of specifiers) {
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(normalizePosix(fromFile)), specifier),
    );
    const bucket = bucketFile(resolved, sourceRootRel);
    if (bucket) imports.push({ specifier, path: resolved, layer: bucket.layer });
  }
  return imports;
}

// Imports from a layer above the file's own layer. Layers are ordered
// app → pages → widgets → features → entities → shared; a layer may only
// import itself and the layers below it, so an import of an earlier layer
// is an upward (boundary-violating) import.
export function findUpwardImports(content, file, sourceRootRel) {
  if (!file.layer) return [];
  const ownRank = HISTORY_LAYERS.indexOf(file.layer);
  return collectLayerImports(content, file.path, sourceRootRel)
    .filter((entry) => HISTORY_LAYERS.indexOf(entry.layer) < ownRank)
    .map((entry) => ({ ...entry, fromLayer: file.layer }));
}

function runGit(args, cwd) {
  const result = spawnSyncSafe("git", args, { cwd, encoding: "utf8" });
  if (result.error) {
    throw new Error(
      "Git is not available. Install Git to use `fsd history`.",
    );
  }
  return result;
}

// File content at a revision, or null when the file does not exist there
// (deleted, or the parent revision of a root commit).
function readFileAt(ref, filePath, cwd) {
  const result = runGit(["show", `${ref}:${filePath}`], cwd);
  if (result.status !== 0) return null;
  return result.stdout;
}

function emptyErosion() {
  return {
    commits: [],
    totalErodingCommits: 0,
    totalErodingFiles: 0,
    worstOffenders: [],
    byAuthor: [],
  };
}

// Attribute the structural erosion a commit introduced: files it placed
// outside the FSD layers, and new cross-layer imports it added. A modified
// file is only blamed for imports that were not already there in its first
// parent, so touching an already-eroded file does not move the blame.
export function attributeErosion(commits, sourceRootRel, cwd) {
  const eroding = [];
  for (const commit of commits) {
    const files = [];
    for (const file of commit.files) {
      if (!EROSION_STATUSES.has(file.status ?? "M")) continue;
      const introduced = file.status === "A" || file.status === "R";
      if (!file.layer) {
        const stray = straySegment(file.path, sourceRootRel);
        if (stray && introduced) {
          files.push({
            path: file.path,
            kind: "misplaced",
            expectedLayer: null,
            actualLayer: stray,
            detail: `sits in src/${stray}/, outside the FSD layers`,
          });
        }
        continue;
      }
      if (!CODE_EXTENSIONS.has(path.posix.extname(file.path))) continue;
      const content = readFileAt(commit.hash, file.path, cwd);
      if (content === null) continue;
      let upward = findUpwardImports(content, file, sourceRootRel);
      if (!introduced) {
        const parentContent = readFileAt(`${commit.hash}^`, file.path, cwd);
        const parentSpecifiers = new Set(
          parentContent === null
            ? []
            : findUpwardImports(parentContent, file, sourceRootRel).map(
                (entry) => entry.specifier,
              ),
        );
        upward = upward.filter((entry) => !parentSpecifiers.has(entry.specifier));
      }
      for (const entry of upward) {
        files.push({
          path: file.path,
          kind: "upward-import",
          expectedLayer: file.layer,
          actualLayer: entry.layer,
          detail: `imports ${entry.specifier} from ${entry.layer}`,
        });
      }
    }
    if (files.length) {
      eroding.push({
        hash: commit.hash,
        date: commit.date,
        author: commit.author || "unknown",
        subject: commit.subject,
        files,
        count: files.length,
      });
    }
  }
  const totalErodingFiles = eroding.reduce((sum, entry) => sum + entry.count, 0);
  const byAuthorMap = new Map();
  for (const entry of eroding) {
    const authorEntry = byAuthorMap.get(entry.author) ?? { author: entry.author, commits: 0, files: 0 };
    authorEntry.commits += 1;
    authorEntry.files += entry.count;
    byAuthorMap.set(entry.author, authorEntry);
  }
  return {
    commits: eroding,
    totalErodingCommits: eroding.length,
    totalErodingFiles,
    worstOffenders: [...eroding]
      .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))
      .slice(0, MAX_EROSION_OFFENDERS)
      .map(({ hash, date, subject, count }) => ({ hash, date, subject, count })),
    byAuthor: [...byAuthorMap.values()].sort(
      (a, b) => b.files - a.files || b.commits - a.commits || a.author.localeCompare(b.author),
    ),
  };
}

export function historyProject(cwd = process.cwd(), { limit = DEFAULT_HISTORY_LIMIT } = {}) {
  const config = loadProjectConfig(cwd);

  const repoRootResult = runGit(["rev-parse", "--show-toplevel"], cwd);
  if (repoRootResult.status !== 0) {
    throw new Error(
      "Not a Git repository. Run `fsd history` inside a Git repository.",
    );
  }
  // Ask Git for the project prefix: cwd may use a Windows junction or a
  // symlink while --show-toplevel returns the physical repository path.
  const prefix = runGit(["rev-parse", "--show-prefix"], cwd);
  if (prefix.status !== 0) throw new Error(`git rev-parse failed: ${prefix.stderr.trim()}`);
  const sourceRootRel = path.posix.join(
    normalizePosix(prefix.stdout.trim()),
    normalizePosix(getFrameworkAdapter(config.framework).sourceDirectory),
  );

  const log = runGit(
    ["log", "--name-status", LOG_FORMAT, "--date=short", "-n", String(limit)],
    cwd,
  );
  if (log.status !== 0) {
    if (/does not have any commits yet/.test(log.stderr)) {
      return {
        config,
        limit,
        commits: [],
        layers: HISTORY_LAYERS.map((layer) => ({ layer, touches: 0 })),
        slices: [],
        otherTouches: 0,
        totalTouches: 0,
        erosion: emptyErosion(),
      };
    }
    throw new Error(`git log failed: ${log.stderr.trim()}`);
  }

  const commits = parseGitLog(log.stdout);
  const layerTouches = new Map(HISTORY_LAYERS.map((layer) => [layer, 0]));
  const sliceTouches = new Map();
  let otherTouches = 0;
  for (const commit of commits) {
    commit.files = commit.files.map((file) => {
      const bucket = bucketFile(file.path, sourceRootRel);
      if (bucket) {
        layerTouches.set(bucket.layer, layerTouches.get(bucket.layer) + 1);
        if (bucket.slice !== null) {
          const key = `${bucket.layer}/${bucket.slice}`;
          sliceTouches.set(key, (sliceTouches.get(key) ?? 0) + 1);
        }
        return { path: file.path, status: file.status, ...bucket };
      }
      otherTouches += 1;
      return { path: file.path, status: file.status, layer: null, slice: null };
    });
  }
  const totalTouches = [...layerTouches.values()].reduce((sum, n) => sum + n, 0) + otherTouches;
  const slices = [...sliceTouches.entries()]
    .map(([key, touches]) => {
      const [layer, slice] = key.split("/");
      return { layer, slice, touches };
    })
    .sort((a, b) => b.touches - a.touches || a.layer.localeCompare(b.layer) || a.slice.localeCompare(b.slice));

  const erosion = attributeErosion(commits, sourceRootRel, cwd);
  const erosionByHash = new Map(erosion.commits.map((entry) => [entry.hash, entry.count]));
  for (const commit of commits) {
    commit.erosionCount = erosionByHash.get(commit.hash) ?? 0;
  }

  return {
    config,
    limit,
    commits,
    layers: HISTORY_LAYERS.map((layer) => ({ layer, touches: layerTouches.get(layer) })),
    slices,
    otherTouches,
    totalTouches,
    erosion,
  };
}

function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}

function printSummary(report) {
  const { layers, slices, otherTouches, totalTouches, limit } = report;
  console.log(chalk.bold("\n  FSD history\n"));
  console.log(`  Last ${limit} ${plural(limit, "commit", "commits")}`);
  console.log();
  for (const { layer, touches } of layers) {
    console.log(`  ${layer}: ${touches} ${plural(touches, "touch", "touches")}`);
  }
  console.log(`  other: ${otherTouches} ${plural(otherTouches, "touch", "touches")}`);
  console.log(`\n  Total touches: ${totalTouches}\n`);
  if (!slices.length) return;
  console.log("  Most-touched slices:");
  for (const { layer, slice, touches } of slices.slice(0, MAX_HISTORY_SLICES)) {
    console.log(`  ${layer}/${slice}: ${touches} ${plural(touches, "touch", "touches")}`);
  }
  console.log();
}

function printTimeline(report) {
  const { commits } = report;
  if (!commits.length) return;
  console.log("  Timeline (oldest first):");
  for (const commit of [...commits].reverse()) {
    const shortHash = commit.hash.slice(0, 7);
    const subject = commit.subject.length > 60
      ? `${commit.subject.slice(0, 57)}...`
      : commit.subject;
    const layerCounts = {};
    for (const file of commit.files) {
      if (file.layer) layerCounts[file.layer] = (layerCounts[file.layer] ?? 0) + 1;
    }
    const detail = Object.entries(layerCounts)
      .map(([layer, count]) => `${layer}: ${count}`)
      .join(", ");
    console.log(`  ${commit.date} ${shortHash} ${subject}${detail ? ` — ${detail}` : ""}`);
  }
  console.log();
}

function printErosion(report) {
  const { erosion, commits } = report;
  if (!erosion.totalErodingFiles) {
    console.log("  Erosion: none in the sampled commits.\n");
    return;
  }
  console.log("  Erosion (oldest first):");
  for (const entry of [...erosion.commits].reverse()) {
    const shortHash = entry.hash.slice(0, 7);
    const subject = entry.subject.length > 60
      ? `${entry.subject.slice(0, 57)}...`
      : entry.subject;
    console.log(`  ${entry.date} ${shortHash} ${subject} — ${entry.count} ${plural(entry.count, "eroding file", "eroding files")}`);
    for (const file of entry.files) {
      const expected = file.expectedLayer ?? "(inside a layer)";
      console.log(`    ${file.path} — ${file.kind}: expected ${expected}, actual ${file.actualLayer} (${file.detail})`);
    }
  }
  console.log(`\n  Eroding commits: ${erosion.totalErodingCommits} of ${commits.length} · Eroding files: ${erosion.totalErodingFiles}`);
  const worst = erosion.worstOffenders
    .map((entry) => `${entry.hash.slice(0, 7)} (${entry.count})`)
    .join(", ");
  console.log(`  Worst offenders: ${worst}`);
  console.log("  Erosion by author:");
  for (const entry of erosion.byAuthor) {
    console.log(`    ${entry.author}: ${entry.files} ${plural(entry.files, "eroding file", "eroding files")} in ${entry.commits} ${plural(entry.commits, "commit", "commits")}`);
  }
  console.log();
}

export async function runHistoryProject(
  command,
  cwd = process.cwd(),
  { limit = DEFAULT_HISTORY_LIMIT } = {},
) {
  const report = historyProject(cwd, { limit });
  if (!report.commits.length) {
    console.log(chalk.bold("\n  FSD history\n"));
    console.log("  No commits yet in this repository.\n");
    return;
  }
  printSummary(report);
  printTimeline(report);
  printErosion(report);
}
