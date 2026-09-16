import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectProject } from "../bin/commands/inspect-project.mjs";
import { getCapabilities, getDefaultStack } from "../bin/core/capability-matrix.mjs";
import { getInstallCommand, getRunScriptCommand } from "../bin/core/package-managers.mjs";
import { createGeneratorPlan, generateSlice, loadProjectConfig } from "../bin/generator.mjs";
import { configureProject, normalizeProjectConfig } from "../bin/project-config.mjs";

function fixture(framework) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `fsd-cli-${framework}-`));
  for (const layer of ["app", "pages", "widgets", "features", "entities", "shared"]) {
    fs.mkdirSync(path.join(cwd, "src", layer), { recursive: true });
  }
  fs.writeFileSync(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ dependencies: framework === "vue-vite" ? { vue: "latest" } : { react: "latest" } })}\n`
  );

  if (framework === "react-vite") {
    fs.mkdirSync(path.join(cwd, "src/app/routing"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, "src/app/routing/index.tsx"),
      `// fsd-cli:route-imports:start\n// fsd-cli:route-imports:end\nexport const routes = [\n  // fsd-cli:routes:start\n  // fsd-cli:routes:end\n];\n`
    );
  }
  if (framework === "vue-vite") {
    fs.mkdirSync(path.join(cwd, "src/app/routing"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, "src/app/routing/index.ts"),
      `// fsd-cli:route-imports:start\n// fsd-cli:route-imports:end\nexport const routes = [\n  // fsd-cli:routes:start\n  // fsd-cli:routes:end\n];\n`
    );
  }

  const config = normalizeProjectConfig(framework);
  configureProject(cwd, config);
  return { cwd, config };
}

for (const packageManager of ["npm", "pnpm", "yarn", "bun"]) {
  test(`package-manager contract supports ${packageManager}`, () => {
    assert.deepEqual(getInstallCommand(packageManager), {
      command: packageManager,
      args: ["install"],
    });
    const run = getRunScriptCommand(packageManager, "build");
    assert.equal(run.command, packageManager);
    assert.deepEqual(
      run.args,
      packageManager === "npm" || packageManager === "bun"
        ? ["run", "build"]
        : ["build"]
    );
  });
}

test("dry-run file plans are exact and do not write files", () => {
  const { cwd, config } = fixture("react-vite");
  try {
    const plan = createGeneratorPlan({ cwd, type: "page", name: "account", config });
    assert.ok(plan.generatedFiles.includes("src/pages/account/ui/account-page.tsx"));
    assert.ok(plan.changedFiles.includes("src/app/routing/index.tsx"));
    assert.equal(fs.existsSync(path.join(cwd, "src/pages/account")), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("page generators register framework-native routes", () => {
  for (const framework of ["react-vite", "vue-vite", "nextjs"]) {
    const { cwd, config } = fixture(framework);
    try {
      const files = generateSlice({ cwd, type: "page", name: "account", config });
      if (framework === "nextjs") {
        assert.ok(files.includes("src/app/account/page.route.tsx"));
        assert.match(
          fs.readFileSync(path.join(cwd, "src/app/account/page.route.tsx"), "utf8"),
          /AccountPage/
        );
      } else {
        const extension = framework === "vue-vite" ? "ts" : "tsx";
        const routing = fs.readFileSync(
          path.join(cwd, `src/app/routing/index.${extension}`),
          "utf8"
        );
        assert.match(routing, /@\/pages\/account/);
        assert.match(routing, /path: "\/account"/);
      }
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  }
});

test("generator conflicts fail without changing existing files", () => {
  const { cwd, config } = fixture("react-vite");
  try {
    generateSlice({ cwd, type: "page", name: "account", config });
    const routingPath = path.join(cwd, "src/app/routing/index.tsx");
    const routingBefore = fs.readFileSync(routingPath, "utf8");
    assert.throws(
      () => generateSlice({ cwd, type: "page", name: "account", config }),
      /already exists/
    );
    assert.equal(fs.readFileSync(routingPath, "utf8"), routingBefore);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("generator rollback removes partial slices and restores external files", () => {
  const { cwd, config } = fixture("react-vite");
  const routingPath = path.join(cwd, "src/app/routing/index.tsx");
  const invalidRouting = "export const routes = [];\n";
  fs.writeFileSync(routingPath, invalidRouting);
  try {
    assert.throws(
      () => generateSlice({ cwd, type: "page", name: "broken", config }),
      /missing \/\/ fsd-cli:route-imports:start/
    );
    assert.equal(fs.existsSync(path.join(cwd, "src/pages/broken")), false);
    assert.equal(fs.readFileSync(routingPath, "utf8"), invalidRouting);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("check validates the FSD structure and resolved configuration", () => {
  const { cwd } = fixture("vue-vite");
  try {
    const report = inspectProject(cwd);
    assert.equal(report.config.framework, "vue-vite");
    assert.equal(report.checks.every((item) => item.ok), true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("legacy Vue projects are detected without fsd.config.json", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-legacy-vue-"));
  try {
    fs.writeFileSync(
      path.join(cwd, "package.json"),
      `${JSON.stringify({
        dependencies: {
          vue: "latest",
          pinia: "latest",
          "@tanstack/vue-query": "latest",
          "vee-validate": "latest",
          zod: "latest",
        },
      })}\n`
    );
    const config = loadProjectConfig(cwd);
    assert.equal(config.framework, "vue-vite");
    assert.equal(config.clientState, "pinia");
    assert.equal(config.serverState, "vue-query");
    assert.equal(config.forms, "vee-validate-zod");
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("smart E2E matrix exercises every supported stack choice", () => {
  for (const framework of ["react-vite", "nextjs", "vue-vite"]) {
    const capabilities = getCapabilities(framework);
    const defaults = getDefaultStack(framework);
    for (const capability of [
      "apiClient",
      "serverState",
      "clientState",
      "forms",
      "packageManager",
    ]) {
      for (const value of capabilities[capability]) {
        const { cwd } = fixture(framework);
        try {
          const config = normalizeProjectConfig(framework, {
            ...defaults,
            [capability]: value,
          });
          configureProject(cwd, config);
          generateSlice({ cwd, type: "feature", name: "auth", config });
          generateSlice({ cwd, type: "entity", name: "product", config });
          generateSlice({ cwd, type: "widget", name: "header", config });
          generateSlice({ cwd, type: "page", name: "dashboard", config });
          assert.equal(loadProjectConfig(cwd)[capability], value);
        } finally {
          fs.rmSync(cwd, { recursive: true, force: true });
        }
      }
    }
  }
});
