import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadProjectConfig } from "../bin/generator.mjs";
import { inspectProject } from "../bin/commands/inspect-project.mjs";
import { getFrameworkAdapter } from "../bin/core/frameworks/index.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

for (const [framework, dependency] of [
  ["react-vite", "react"], ["nextjs", "next"], ["vue-vite", "vue"],
  ["nuxt", "nuxt"], ["sveltekit", "@sveltejs/kit"],
]) {
  test(`${framework}: compatible non-CLI inspection and generator preview preserve existing code`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fsd existing app-"));
    try {
      const packageContents = JSON.stringify({ dependencies: { [dependency]: "1.0.0" } });
      fs.writeFileSync(path.join(root, "package.json"), packageContents);
      const source = getFrameworkAdapter(framework).sourceDirectory;
      for (const layer of ["app", "pages", "widgets", "features", "entities", "shared"]) {
        fs.mkdirSync(path.join(root, source, layer), { recursive: true });
      }
      const sentinel = path.join(root, source, "features", "business.ts");
      fs.writeFileSync(sentinel, "// existing business integration\n");
      const config = loadProjectConfig(root);
      const inspection = inspectProject(root);
      assert.equal(config.framework, framework);
      assert.deepEqual(inspection.config, config);
      assert(inspection.checks.every(check => check.ok));
      const printedConfig = spawnSync(process.execPath, [cli, "config"], { cwd: root, encoding: "utf8" });
      assert.equal(printedConfig.status, 0, printedConfig.stderr);
      assert.deepEqual(JSON.parse(printedConfig.stdout), config);
      const doctor = spawnSync(process.execPath, [cli, "doctor"], { cwd: root, encoding: "utf8" });
      assert.equal(doctor.status, 0, doctor.stderr);
      const preview = spawnSync(process.execPath, [cli, "-g", "feature", "checkout", "--dry-run"], { cwd: root, encoding: "utf8" });
      assert.equal(preview.status, 0, preview.stderr);
      assert(preview.stdout.includes("checkout"));
      assert.equal(fs.existsSync(path.join(root, source, "features", "checkout")), false);
      assert.equal(fs.readFileSync(sentinel, "utf8"), "// existing business integration\n");
      assert.equal(fs.readFileSync(path.join(root, "package.json"), "utf8"), packageContents);
      assert.equal(fs.existsSync(path.join(root, "fsd.config.json")), false);
      assert.equal(fs.existsSync(path.join(root, ".fsd")), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
