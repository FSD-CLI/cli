// Verified runtime requirements for the CLI and the projects it generates.
//
// Every range below is derived from published `engines.node` fields instead of
// being hand-written, and each entry records where the number came from:
//
//   - chalk 6.0.1               -> ">=22"                    (CLI runtime dependency)
//   - ora 9.4.0                 -> ">=20"                    (CLI runtime dependency)
//   - vite 8.3.0                -> "^20.19.0 || >=22.12.0"   (React, Vue and SvelteKit templates)
//   - @sveltejs/vite-plugin-svelte 6.2.1 -> "^20.19 || ^22.12 || >=24"
//   - next 16.4.3               -> ">=20.9.0"                (Next.js template)
//   - nuxt 4.5.2                -> "^22.19.0 || ^24.11.0 || >=26.0.0"
//   - FSD-NUXT template         -> ">=22.22.2"
//   - fsd-sveltekit template    -> ">=22.22.2"
//
// The CLI floor is the lowest Node that runs the CLI itself *and* every
// shipped Vite based template. The CLI dependency floor is Node 22 (chalk 6),
// and the template floor is Node 22.12.0 (Vite 8 and the SvelteKit Vite
// plugin), so 22.12.0 is the supported CLI runtime.
//
// The Nuxt and SvelteKit templates declare their own, stricter floors. Those
// are enforced per framework so the CLI never reports a project as supported
// when its own dependencies reject the running Node.

import { lowestVersionInRange, satisfiesRange } from "./version-range.mjs";

export const CLI_MINIMUM_NODE = "22.12.0";
export const CLI_NODE_RANGE = ">=22.12.0";

export const FRAMEWORK_NODE_RANGES = Object.freeze({
  "react-vite": ">=22.12.0",
  nextjs: ">=22.12.0",
  "vue-vite": ">=22.12.0",
  nuxt: "^22.22.2 || ^24.11.0 || >=26.0.0",
  sveltekit: "^22.22.2 || >=24.0.0",
});

export const FRAMEWORK_NODE_EVIDENCE = Object.freeze({
  "react-vite": "vite 8.3.0 requires ^20.19.0 || >=22.12.0",
  nextjs: "next 16.4.3 requires >=20.9.0",
  "vue-vite": "vite 8.3.0 requires ^20.19.0 || >=22.12.0",
  nuxt:
    "the FSD-NUXT template requires >=22.22.2 and nuxt 4.5.2 requires ^22.19.0 || ^24.11.0 || >=26.0.0",
  sveltekit:
    "the fsd-sveltekit template requires >=22.22.2 and @sveltejs/vite-plugin-svelte 6.2.1 requires ^20.19 || ^22.12 || >=24",
});

// Minimum supported package manager versions. These are the versions the CI
// matrix exercises, so a documented minimum is always backed by a green run.
export const PACKAGE_MANAGER_MINIMUMS = Object.freeze({
  npm: "10.9.0",
  pnpm: "10.26.0",
  yarn: "4.18.0",
  bun: "1.2.0",
});

export const PACKAGE_MANAGER_EVIDENCE = Object.freeze({
  npm: "the npm bundled with Node 22.12.0, the supported CLI runtime",
  pnpm: "the lowest pnpm release exercised by the CI build policy matrix",
  yarn: "the Yarn 4 release pinned by the CI package manager matrix",
  bun: "the oldest Bun release line supported by the CLI package manager matrix",
});

export function getFrameworkNodeRange(framework) {
  if (!framework) return null;
  return FRAMEWORK_NODE_RANGES[framework] ?? null;
}

// A framework range only adds a constraint when the CLI lower bound does not
// already satisfy it. Every range in this module is a union of lower bounded
// intervals and the CLI range is a single lower bound, so testing the CLI
// bound is enough to detect a stricter framework requirement.
export function frameworkAddsNodeConstraint(framework) {
  const frameworkRange = getFrameworkNodeRange(framework);
  if (!frameworkRange) return false;
  return !satisfiesRange(CLI_MINIMUM_NODE, frameworkRange);
}

export function getNodeRequirement(framework) {
  const frameworkRange = getFrameworkNodeRange(framework);
  const addsConstraint = frameworkAddsNodeConstraint(framework);

  return {
    range: addsConstraint ? frameworkRange : CLI_NODE_RANGE,
    cliRange: CLI_NODE_RANGE,
    frameworkRange,
    addsConstraint,
    evidence: addsConstraint ? [FRAMEWORK_NODE_EVIDENCE[framework]].filter(Boolean) : [],
  };
}

export function checkNodeVersion(version, { framework = null } = {}) {
  const current = String(version ?? "");
  const requirement = getNodeRequirement(framework);
  const satisfiesCli = satisfiesRange(current, requirement.cliRange);
  const satisfiesFramework =
    !requirement.addsConstraint || satisfiesRange(current, requirement.frameworkRange);

  if (satisfiesCli && satisfiesFramework) {
    return {
      ok: true,
      current,
      range: requirement.range,
      cliRange: requirement.cliRange,
      frameworkRange: requirement.frameworkRange,
    };
  }

  const missing = [];
  if (!satisfiesCli) {
    missing.push(`Node.js ${requirement.cliRange} is required by the CLI`);
  }
  if (!satisfiesFramework) {
    missing.push(
      `Node.js ${requirement.frameworkRange} is required by ${framework} projects`
    );
  }

  return {
    ok: false,
    current,
    range: requirement.range,
    cliRange: requirement.cliRange,
    frameworkRange: requirement.frameworkRange,
    message: `${missing.join(" and ")} (found ${current}).`,
  };
}

export function getPackageManagerRequirement(packageManager) {
  const minimum = PACKAGE_MANAGER_MINIMUMS[packageManager];
  if (!minimum) return null;
  return {
    minimum,
    range: `>=${minimum}`,
    evidence: PACKAGE_MANAGER_EVIDENCE[packageManager],
  };
}

export function checkPackageManagerVersion(packageManager, version) {
  const requirement = getPackageManagerRequirement(packageManager);
  if (!requirement) return { ok: true, current: version ?? null, minimum: null };

  const current = String(version ?? "").trim();
  if (!current) {
    return {
      ok: false,
      current: null,
      minimum: requirement.minimum,
      message: `${packageManager} is not installed, but ${packageManager} ${requirement.range} is required.`,
    };
  }

  if (satisfiesRange(current, requirement.range)) {
    return { ok: true, current, minimum: requirement.minimum };
  }

  return {
    ok: false,
    current,
    minimum: requirement.minimum,
    message: `${packageManager} ${current} is installed, but ${packageManager} ${requirement.range} is required.`,
  };
}

export function describeRuntimeRequirements() {
  return {
    cli: { range: CLI_NODE_RANGE, minimum: CLI_MINIMUM_NODE },
    frameworks: Object.fromEntries(
      Object.keys(FRAMEWORK_NODE_RANGES).map((framework) => [
        framework,
        {
          range: FRAMEWORK_NODE_RANGES[framework],
          evidence: FRAMEWORK_NODE_EVIDENCE[framework],
          addsConstraint: frameworkAddsNodeConstraint(framework),
        },
      ])
    ),
    packageManagers: Object.fromEntries(
      Object.keys(PACKAGE_MANAGER_MINIMUMS).map((packageManager) => [
        packageManager,
        {
          minimum: PACKAGE_MANAGER_MINIMUMS[packageManager],
          evidence: PACKAGE_MANAGER_EVIDENCE[packageManager],
        },
      ])
    ),
    lowestSupportedNode: lowestVersionInRange(CLI_NODE_RANGE),
  };
}
