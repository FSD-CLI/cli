/**
 * Shared per-adapter contract harness (CORE-21).
 *
 * The generic loop in `tests/adapter-contract.test.mjs` checks every
 * registered adapter against the v2 validator, but it cannot exercise what
 * an adapter promises beyond its declaration: that its capability matrix
 * row is derived from it, that a template-shaped project configures and
 * inspects cleanly, that every generator it declares actually plans (and
 * for pages, writes) slices, and that its template is pinned to an
 * immutable commit. This harness runs those checks for one adapter id, so
 * each adapter gets a dedicated contract file (`tests/<id>-contract.test.mjs`) instead of sharing one loop that hides per-adapter gaps.
 *
 * The harness only reads the adapter's own declarations (id, family,
 * targets, sourceDirectory, runtime, capabilities, generators,
 * dependencies) to drive the checks, so a new adapter gets the same
 * coverage by adding one file that calls `runAdapterContractTests` with
 * its id. The one thing it cannot derive is how an existing project is
 * detected as that framework: pass the marker dependencies as
 * `detectDependencies` (the `package.json` dependencies
 * `loadProjectConfig` keys on).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ADAPTER_CONTRACT_VERSION,
  CAPABILITY_IDS,
  PROJECT_TARGETS,
  assertAdapterContract,
  validateAdapter,
} from "../bin/core/frameworks/adapter-contract.mjs";
import { CAPABILITY_MATRIX } from "../bin/core/capability-matrix.mjs";
import {
  getFrameworkAdapter,
  listFrameworkAdapters,
  listFrameworkAdaptersByTarget,
} from "../bin/core/frameworks/index.mjs";
import {
  getAvailableTemplate,
  getTemplate,
  getTemplateProvenance,
  listTemplates,
} from "../bin/core/template-registry.mjs";
import {
  configureProject,
  getManagedProjectArtifacts,
  normalizeProjectConfig,
} from "../bin/project-config.mjs";
import { inspectProject } from "../bin/commands/inspect-project.mjs";
import { createGeneratorPlan, generateSlice, loadProjectConfig } from "../bin/generator.mjs";
import { SHARED_SEGMENTS, createSharedLayerPlan, generateSharedLayer } from "../bin/generators/shared-layer.mjs";
import { migrateProjectConfig } from "../bin/upgrade/config.mjs";

const LAYER_DIRS = ["app", "pages", "widgets", "features", "entities", "shared"];

/** Content of the routing entry a template project carries (react-vite, vue-vite). */
const ROUTING_FILE_CONTENT = [
  "// fsd-cli:route-imports:start",
  "// fsd-cli:route-imports:end",
  "export const routes = [",
  "  // fsd-cli:routes:start",
  "  // fsd-cli:routes:end",
  "];",
  "",
].join("\n");

/**
 * Every npm package the adapter manages: its base dependencies plus every
 * package named by any capability option.
 */
function managedDependencyNames(adapter) {
  const names = new Set(adapter.baseDependencies ?? []);
  for (const options of Object.values(adapter.dependencies ?? {})) {
    for (const packages of Object.values(options)) {
      for (const name of packages) names.add(name);
    }
  }
  return names;
}

/**
 * Scaffolds the minimal project a template ships, mirroring the fixture
 * in `tests/hardening.test.mjs`: the FSD layer directories under the
 * adapter's source directory, an empty `package.json`, and the default
 * `fsd.config.json`. Nuxt projects also carry `nuxt.config.ts` with the
 * module markers `configureProject` registers framework modules between.
 * Detection-marker dependencies are deliberately left out: the config
 * round-trip asserts the installed set is exactly the adapter's managed
 * default stack, and detection is covered by its own test.
 */
export function scaffoldTemplateProject(adapter) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `fsd-${adapter.id}-contract-`));
  const config = normalizeProjectConfig(adapter.id);
  for (const layer of LAYER_DIRS) {
    fs.mkdirSync(path.join(root, adapter.sourceDirectory, layer), { recursive: true });
  }
  fs.writeFileSync(path.join(root, "package.json"), "{}\n");
  fs.writeFileSync(path.join(root, "fsd.config.json"), JSON.stringify(config));
  if (adapter.runtime === "nuxt") {
    fs.writeFileSync(
      path.join(root, "nuxt.config.ts"),
      [
        "export default defineNuxtConfig({",
        "  modules: [",
        "    // fsd-cli:modules:start",
        "    // fsd-cli:modules:end",
        "  ],",
        "});",
        "",
      ].join("\n")
    );
    fs.mkdirSync(path.join(root, adapter.sourceDirectory, "app/routes"), { recursive: true });
  }
  return { root, config };
}

/**
 * Plans a page slice. Router-based adapters need the template's routing
 * entry before a page can register its route; the generator names the exact
 * file a template project carries, so create it from the error and retry
 * once instead of hard-coding which adapters route that way.
 */
export function planPage(root, config) {
  try {
    return createGeneratorPlan({ cwd: root, type: "page", name: "probe", config });
  } catch (error) {
    const match = /Routing entry "([^"]+)" is missing/.exec(error.message);
    if (!match) throw error;
    const routingPath = path.join(root, match[1]);
    fs.mkdirSync(path.dirname(routingPath), { recursive: true });
    fs.writeFileSync(routingPath, ROUTING_FILE_CONTENT);
    return createGeneratorPlan({ cwd: root, type: "page", name: "probe", config });
  }
}

/**
 * Registers the full v2 contract test set for one adapter id.
 *
 * @param {string} adapterId - Adapter id from the framework registry.
 * @param {{ detectDependencies?: Record<string, string> }} [options] -
 *   Marker `package.json` dependencies `loadProjectConfig` uses to detect
 *   an existing project as this framework. When omitted, the detection
 *   test is skipped: detection is only meaningful for frameworks with a
 *   marker dependency.
 */
export function runAdapterContractTests(adapterId, options = {}) {
  const adapter = getFrameworkAdapter(adapterId);

  test(`${adapterId} conforms to adapter contract v${ADAPTER_CONTRACT_VERSION}`, () => {
    assert.equal(ADAPTER_CONTRACT_VERSION, 2);
    assert.deepEqual(validateAdapter(adapter), [], adapterId);
    assert.deepEqual(validateAdapter(adapter, { requireV2: true }), [], adapterId);
    assert.equal(assertAdapterContract(adapter, { requireV2: true }), adapter);
    assert.ok(
      listFrameworkAdapters().some((registered) => registered.id === adapterId),
      `${adapterId} is registered`
    );
  });

  test(`${adapterId} declares usable targets`, () => {
    assert.ok(Array.isArray(adapter.targets) && adapter.targets.length > 0, "targets declared");
    assert.deepEqual([...new Set(adapter.targets)], adapter.targets, "targets are unique");
    for (const target of adapter.targets) {
      assert.ok(PROJECT_TARGETS.includes(target), `target "${target}" is known`);
      assert.ok(
        listFrameworkAdaptersByTarget(target).some((listed) => listed.id === adapterId),
        `${adapterId} is listed for target "${target}"`
      );
    }
    for (const target of PROJECT_TARGETS.filter((target) => !adapter.targets.includes(target))) {
      assert.equal(
        listFrameworkAdaptersByTarget(target).some((listed) => listed.id === adapterId),
        false,
        `${adapterId} is not listed for target "${target}"`
      );
    }
  });

  test(`${adapterId} capability matrix row is derived from the adapter`, () => {
    const row = CAPABILITY_MATRIX[adapterId];
    assert.ok(row, `capability matrix has a row for ${adapterId}`);
    for (const capabilityId of CAPABILITY_IDS) {
      assert.deepEqual(row[capabilityId], adapter.capabilities[capabilityId], capabilityId);
      assert.equal(row.defaults[capabilityId], adapter.capabilities.defaults[capabilityId]);
    }
    assert.deepEqual(row.generators, adapter.generators, "generators");
    assert.equal(row.defaults.packageManager, "npm");
    assert.deepEqual(
      row.packageManager,
      adapter.inspectionOnly ? ["npm"] : ["npm", "pnpm", "yarn", "bun"],
      "package managers"
    );
  });

  test(`${adapterId} config round-trips through normalize, migrate, inspect and configure`, () => {
    const { root, config } = scaffoldTemplateProject(adapter);
    try {
      assert.deepEqual(migrateProjectConfig(config), config, "config survives migration");
      assert.throws(
        () => normalizeProjectConfig(adapterId, { apiClient: "__not-an-option__" }),
        /Unsupported apiClient/,
        "unknown capability options are rejected"
      );
      assert.equal(
        inspectProject(root).checks.every((check) => check.ok),
        true,
        "template-shaped project inspects cleanly"
      );

      configureProject(root, config);
      const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
      const managed = managedDependencyNames(adapter);
      for (const base of adapter.baseDependencies ?? []) {
        assert.equal(
          packageJson.dependencies?.[base],
          adapter.dependencyVersions[base],
          `base dependency ${base} is installed at its pinned version`
        );
      }
      for (const [name, range] of Object.entries(packageJson.dependencies ?? {})) {
        assert.ok(managed.has(name), `installed dependency ${name} is managed by the adapter`);
        assert.equal(range, adapter.dependencyVersions[name], `${name} uses its pinned version`);
      }

      const { files } = getManagedProjectArtifacts(config);
      assert.ok(Object.keys(files).length > 0, "adapter manages project artifacts");
      for (const [file, content] of Object.entries(files)) {
        assert.equal(
          fs.readFileSync(path.join(root, file), "utf8"),
          content,
          `${file} is written by configureProject`
        );
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test(`${adapterId} generates every declared generator type`, () => {
    const { root, config } = scaffoldTemplateProject(adapter);
    try {
      for (const type of adapter.generators) {
        if (type === "shared") {
          for (const segment of SHARED_SEGMENTS) {
            const plan = createSharedLayerPlan({ cwd: root, segment, config });
            assert.ok(plan.creates.length > 0, `shared ${segment} creates files`);
            generateSharedLayer(plan);
            for (const item of plan.creates) {
              assert.equal(
                fs.existsSync(item.target),
                true,
                `shared ${segment} writes ${path.relative(root, item.target)}`
              );
            }
          }
          continue;
        }
        const plan =
          type === "page"
            ? planPage(root, config)
            : createGeneratorPlan({ cwd: root, type, name: "probe", config });
        assert.ok(plan.files.length > 0, `${type} plans files`);
        for (const generated of plan.generatedFiles) {
          assert.ok(
            generated.startsWith(`${adapter.sourceDirectory}${path.sep}`),
            `${type} generates under ${adapter.sourceDirectory}: ${generated}`
          );
        }
        if (type === "page") {
          generateSlice({ cwd: root, type, name: "probe", config });
          for (const generated of plan.generatedFiles) {
            assert.equal(
              fs.existsSync(path.join(root, generated)),
              true,
              `page writes ${generated}`
            );
          }
        }
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test(`${adapterId} template is pinned to an immutable commit`, () => {
    const template = getTemplate(adapterId);
    assert.ok(template, `template registry has ${adapterId}`);
    assert.match(template.repo, /^FSD-CLI\/[A-Za-z0-9_.-]+$/, "template repo is under FSD-CLI");
    assert.match(template.ref, /^[a-f0-9]{40}$/, "template ref is a full commit");
    assert.equal(template.status, "stable");
    assert.equal(template.available, true);
    assert.equal(getAvailableTemplate(adapterId).repo, template.repo);
    assert.deepEqual(getTemplateProvenance(template), {
      schemaVersion: 1,
      framework: adapterId,
      repository: template.repo,
      requestedRef: template.ref,
      resolvedCommit: template.ref,
    });
    assert.ok(
      listTemplates({ includePlanned: false }).some((listed) => listed.value === adapterId),
      `${adapterId} is listed among available templates`
    );
  });

  if (options.detectDependencies) {
    test(`${adapterId} projects are detected from package.json`, () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), `fsd-${adapterId}-detect-`));
      try {
        fs.writeFileSync(
          path.join(root, "package.json"),
          `${JSON.stringify({ dependencies: options.detectDependencies })}\n`
        );
        assert.equal(loadProjectConfig(root).framework, adapterId);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
}
