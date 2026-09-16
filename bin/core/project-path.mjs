import path from "path";

export function resolveProjectPath(cwd, projectName) {
  const normalizedName = projectName?.trim();
  if (!normalizedName) throw new Error("Project name is required.");

  const targetDir = path.resolve(cwd, normalizedName);
  const relativePath = path.relative(cwd, targetDir);
  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Project directory must be created inside the current directory.");
  }
  return targetDir;
}
