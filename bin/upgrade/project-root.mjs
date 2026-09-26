import fs from "node:fs";
import path from "node:path";
import { UpgradeStateError } from "./config.mjs";

export function normalizeRelativePath(relativePath) {
  if (typeof relativePath !== "string" || !relativePath) {
    throw new UpgradeStateError("Managed paths must be non-empty relative paths.");
  }
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
  if (
    path.posix.isAbsolute(normalized) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new UpgradeStateError(`Managed path escapes the project root: ${relativePath}`);
  }
  return normalized;
}

export function resolveManagedPath(projectRoot, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const root = fs.realpathSync(projectRoot);
  const target = path.resolve(root, normalized);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new UpgradeStateError(`Managed path escapes the project root: ${relativePath}`);
  }

  let cursor = root;
  for (const segment of normalized.split("/")) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) continue;
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) {
      throw new UpgradeStateError(`Refusing to operate on symlinked path: ${relativePath}`);
    }
  }
  return target;
}

export function findProjectRoot(startDirectory = process.cwd()) {
  let current;
  try {
    current = fs.realpathSync(startDirectory);
  } catch (error) {
    throw new UpgradeStateError(`Cannot resolve working directory: ${error.message}`);
  }
  const roots = [];
  const incompleteRoots = [];

  while (true) {
    const hasConfig = fs.existsSync(path.join(current, "fsd.config.json"));
    const hasPackage = fs.existsSync(path.join(current, "package.json"));
    if (hasConfig && hasPackage) roots.push(current);
    if (hasConfig !== hasPackage && roots.length === 0) incompleteRoots.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  if (incompleteRoots.length) {
    throw new UpgradeStateError(
      `Cannot use ${incompleteRoots[0]} as an upgrade root: fsd.config.json and package.json must both exist.`
    );
  }

  if (!roots.length) {
    throw new UpgradeStateError(
      "No FSD project root was found. Upgrade requires both fsd.config.json and package.json."
    );
  }
  if (roots.length > 1) {
    throw new UpgradeStateError(`Conflicting nested FSD project roots: ${roots.join(", ")}`);
  }
  return roots[0];
}
