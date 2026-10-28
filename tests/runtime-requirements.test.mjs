import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectProject } from "../bin/commands/inspect-project.mjs";
import {
  CLI_MINIMUM_NODE,
  CLI_NODE_RANGE,
  FRAMEWORK_NODE_RANGES,
  PACKAGE_MANAGER_MINIMUMS,
  checkNodeVersion,
  checkPackageManagerVersion,
  describeRuntimeRequirements,
  frameworkAddsNodeConstraint,
  getNodeRequirement,
  getPackageManagerRequirement,
} from "../bin/core/runtime-requirements.mjs";
import { compareVersions, satisfiesRange } from "../bin/core/version-range.mjs";
import { configureProject, normalizeProjectConfig } from "../bin/project-config.mjs";

const packageJson = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

test("version ranges evaluate the published engines syntax", () => {
  assert.equal(satisfiesRange("22.12.0", ">=22.12.0"), true);
  assert.equal(satisfiesRange("22.11.9", ">=22.12.0"), false);
  assert.equal(satisfiesRange("22.22.2", "^22.22.2 || ^24.11.0 || >=26.0.0"), true);
  assert.equal(satisfiesRange("24.5.0", "^22.22.2 || ^24.11.0 || >=26.0.0"), false);
  assert.equal(satisfiesRange("24.11.0", "^22.22.2 || ^24.11.0 || >=26.0.0"), true);
  assert.equal(satisfiesRange("26.0.0", "^22.22.2 || ^24.11.0 || >=26.0.0"), true);
  assert.equal(satisfiesRange("23.5.0", "^22.22.2 || >=24.0.0"), false);
  assert.equal(satisfiesRange("1.5.0", "^1.2.3"), true);
  assert.equal(satisfiesRange("2.0.0", "^1.2.3"), false);
  assert.equal(satisfiesRange("0.2.5", "^0.2.3"), true);
  assert.equal(satisfiesRange("0.3.0", "^0.2.3"), false);
  assert.equal(satisfiesRange("1.2.9", "~1.2.3"), true);
  assert.equal(satisfiesRange("1.3.0", "~1.2.3"), false);
  assert.equal(satisfiesRange("20.19.0", "^20.19.0 || >=22.12.0"), true);
});

test("version comparison orders releases and prereleases", () => {
  assert.equal(compareVersions("22.12.0", "22.12.0"), 0);
  assert.equal(compareVersions("22.12.0", "24.0.0"), -1);
  assert.equal(compareVersions("24.0.0", "22.12.0"), 1);
  assert.equal(compareVersions("22.12.0", "22.12.0-rc.1"), 1);
  assert.equal(compareVersions("22.12.0-rc.1", "22.12.0"), -1);
});

test("the published engines field matches the CLI runtime contract", () => {
  assert.equal(packageJson.engines.node, CLI_NODE_RANGE);
  assert.equal(CLI_NODE_RANGE, ">=22.12.0");
  assert.equal(CLI_MINIMUM_NODE, "22.12.0");
});

test("every supported framework declares a verified Node range", () => {
  for (const framework of Object.keys(FRAMEWORK_NODE_RANGES)) {
    const requirement = getNodeRequirement(framework);
    assert.ok(requirement.range, `${framework} must declare a Node range`);
    assert.ok(
      satisfiesRange(CLI_MINIMUM_NODE, requirement.cliRange),
      `${framework} must keep the CLI range satisfiable`
    );
  }
});

test("only the templates with a stricter floor add a framework constraint", () => {
  assert.equal(frameworkAddsNodeConstraint("react-vite"), false);
  assert.equal(frameworkAddsNodeConstraint("vue-vite"), false);
  assert.equal(frameworkAddsNodeConstraint("nextjs"), false);
  assert.equal(frameworkAddsNodeConstraint("nuxt"), true);
  assert.equal(frameworkAddsNodeConstraint("sveltekit"), true);
});

test("node checks name the exact required version on failure", () => {
  const cliFailure = checkNodeVersion("20.19.0");
  assert.equal(cliFailure.ok, false);
  assert.match(cliFailure.message, />=22\.12\.0/);
  assert.match(cliFailure.message, /found 20\.19\.0/);

  const nuxtFailure = checkNodeVersion("22.13.0", { framework: "nuxt" });
  assert.equal(nuxtFailure.ok, false);
  assert.match(nuxtFailure.message, /\^22\.22\.2 \|\| \^24\.11\.0 \|\| >=26\.0\.0/);

  // SvelteKit accepts the 22.22.2+ line and everything from 24.0.0, so the
  // unsupported band is 22.12.0 - 22.22.1 and the 23.x line.
  const sveltekitFailure = checkNodeVersion("23.5.0", { framework: "sveltekit" });
  assert.equal(sveltekitFailure.ok, false);
  assert.match(sveltekitFailure.message, /\^22\.22\.2 \|\| >=24\.0\.0/);
  assert.equal(checkNodeVersion("24.1.0", { framework: "sveltekit" }).ok, true);

  assert.equal(checkNodeVersion("24.15.0").ok, true);
  assert.equal(checkNodeVersion("24.15.0", { framework: "nuxt" }).ok, true);
  assert.equal(checkNodeVersion("24.15.0", { framework: "sveltekit" }).ok, true);
  assert.equal(checkNodeVersion("22.22.2", { framework: "sveltekit" }).ok, true);
  assert.equal(checkNodeVersion("24.11.0", { framework: "nuxt" }).ok, true);
});

test("package manager checks name the exact required version on failure", () => {
  assert.equal(checkPackageManagerVersion("pnpm", "10.26.0").ok, true);
  assert.equal(checkPackageManagerVersion("pnpm", "11.0.0").ok, true);

  const failure = checkPackageManagerVersion("pnpm", "9.15.0");
  assert.equal(failure.ok, false);
  assert.match(failure.message, /pnpm 9\.15\.0 is installed/);
  assert.match(failure.message, />=10\.26\.0 is required/);

  const missing = checkPackageManagerVersion("yarn", null);
  assert.equal(missing.ok, false);
  assert.match(missing.message, /yarn is not installed/);

  for (const [packageManager, minimum] of Object.entries(PACKAGE_MANAGER_MINIMUMS)) {
    assert.equal(getPackageManagerRequirement(packageManager).minimum, minimum);
  }
});

test("the runtime requirement summary stays in sync with the constants", () => {
  const summary = describeRuntimeRequirements();
  assert.equal(summary.cli.range, CLI_NODE_RANGE);
  assert.equal(summary.lowestSupportedNode.minor, 12);
  assert.equal(summary.lowestSupportedNode.major, 22);
  assert.equal(summary.packageManagers.npm.minimum, "10.9.0");
});

test("doctor reports the verified Node requirement for the current runtime", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-runtime-"));
  try {
    const sourceDirectory = "src";
    for (const layer of ["app", "pages", "widgets", "features", "entities", "shared"]) {
      fs.mkdirSync(path.join(cwd, sourceDirectory, layer), { recursive: true });
    }
    fs.writeFileSync(
      path.join(cwd, "package.json"),
      `${JSON.stringify({ dependencies: { react: "latest" } })}\n`
    );
    fs.mkdirSync(path.join(cwd, "src/app/routing"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, "src/app/routing/index.tsx"),
      `// fsd-cli:route-imports:start\n// fsd-cli:route-imports:end\nexport const routes = [\n  // fsd-cli:routes:start\n  // fsd-cli:routes:end\n];\n`
    );
    configureProject(cwd, normalizeProjectConfig("react-vite"));

    const report = inspectProject(cwd, { includeToolchain: true });
    const nodeCheck = report.checks.find((item) => item.label === "Node.js");
    assert.ok(nodeCheck, "doctor must report a Node.js check");
    assert.equal(nodeCheck.ok, true);
    assert.equal(nodeCheck.detail, process.version);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
