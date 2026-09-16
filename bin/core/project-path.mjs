import path from "path";

export function resolveProjectPath(cwd, projectName) {
  const normalizedName = projectName?.trim();
  if (!normalizedName) throw new Error("Project name is required.");
  if (normalizedName.includes("\\")) {
    throw new Error("Project name must use forward slashes for nested directories.");
  }

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

  const segments = normalizedName.split("/");
  const reserved = new Set([".", "..", ".git", "node_modules"]);
  for (const segment of segments) {
    if (
      !segment ||
      reserved.has(segment.toLowerCase()) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment)
    ) {
      throw new Error(
        `Invalid project name "${projectName}". Use letters, numbers, dots, underscores, dashes, and optional nested paths.`
      );
    }
  }

  return targetDir;
}
