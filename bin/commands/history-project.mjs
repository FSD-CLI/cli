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

// One line per commit, NUL-separated fields so subjects may contain any
// punctuation. `--name-only` then lists one changed path per line.
const LOG_FORMAT = "--pretty=format:%H%x00%ad%x00%s";

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
      const [hash, date, ...subjectParts] = line.split("\0");
      current = { hash, date, subject: subjectParts.join("\0"), files: [] };
      commits.push(current);
      continue;
    }
    if (line.trim() === "") continue;
    if (current) current.files.push(line);
  }
  return commits;
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
    ["log", "--name-only", LOG_FORMAT, "--date=short", "-n", String(limit)],
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
      const bucket = bucketFile(file, sourceRootRel);
      if (bucket) {
        layerTouches.set(bucket.layer, layerTouches.get(bucket.layer) + 1);
        if (bucket.slice !== null) {
          const key = `${bucket.layer}/${bucket.slice}`;
          sliceTouches.set(key, (sliceTouches.get(key) ?? 0) + 1);
        }
        return { path: file, ...bucket };
      }
      otherTouches += 1;
      return { path: file, layer: null, slice: null };
    });
  }
  const totalTouches = [...layerTouches.values()].reduce((sum, n) => sum + n, 0) + otherTouches;
  const slices = [...sliceTouches.entries()]
    .map(([key, touches]) => {
      const [layer, slice] = key.split("/");
      return { layer, slice, touches };
    })
    .sort((a, b) => b.touches - a.touches || a.layer.localeCompare(b.layer) || a.slice.localeCompare(b.slice));

  return {
    config,
    limit,
    commits,
    layers: HISTORY_LAYERS.map((layer) => ({ layer, touches: layerTouches.get(layer) })),
    slices,
    otherTouches,
    totalTouches,
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
}
