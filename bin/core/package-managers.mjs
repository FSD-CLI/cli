export const PACKAGE_MANAGERS = Object.freeze(["npm", "pnpm", "yarn", "bun"]);

const LOCKFILES = Object.freeze({
  npm: Object.freeze(["package-lock.json"]),
  pnpm: Object.freeze(["pnpm-lock.yaml"]),
  yarn: Object.freeze(["yarn.lock"]),
  bun: Object.freeze(["bun.lock", "bun.lockb"]),
});

export function getPackageManager(packageManager) {
  if (!PACKAGE_MANAGERS.includes(packageManager)) {
    throw new Error(`Unsupported package manager "${packageManager}".`);
  }
  return packageManager;
}

export function getRunScriptCommand(packageManager, script) {
  getPackageManager(packageManager);
  if (packageManager === "npm" || packageManager === "bun") {
    return { command: packageManager, args: ["run", script] };
  }
  return { command: packageManager, args: [script] };
}

export function getInstallCommand(packageManager) {
  getPackageManager(packageManager);
  return {
    command: packageManager,
    args:
      packageManager === "yarn"
        ? ["install", "--no-immutable"]
        : ["install"],
  };
}

export function getLockfiles(packageManager) {
  getPackageManager(packageManager);
  return {
    keep: [...LOCKFILES[packageManager]],
    all: [...new Set(Object.values(LOCKFILES).flat())],
  };
}
