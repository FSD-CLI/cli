import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getTemplateProvenance, listTemplates } from "../bin/core/template-registry.mjs";
import { cloneTemplate } from "../bin/core/project-lifecycle.mjs";
test("all shipped template sources bind full immutable commits", () => {
  for (const template of listTemplates()) {
    const provenance = getTemplateProvenance(template);
    assert.match(provenance.resolvedCommit, /^[a-f0-9]{40}$/);
    assert.equal(provenance.requestedRef, provenance.resolvedCommit);
    assert.equal(provenance.framework, template.value);
  }
});

for (const force of [false, true]) {
  test(`unavailable pinned download rolls back ${force ? 'the existing target' : 'a new target'}`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fsd unavailable pin-"));
    const target = path.join(root, "app");
    const tools = path.join(root, "tools");
    const trace = path.join(root, "git-trace.txt");
    try {
      fs.mkdirSync(tools);
      fs.writeFileSync(path.join(tools, "git"), '#!/bin/sh\necho "$*" >> "$QA_GIT_TRACE"\ncase " $* " in\n  *" fetch "*) echo "pinned object unavailable" >&2; exit 128 ;;\n  *) exit 0 ;;\nesac\n', {mode:0o755});
      fs.writeFileSync(path.join(tools, "git.cmd"), '@echo off\r\necho %*>>"%QA_GIT_TRACE%"\r\necho %* | findstr /C:"fetch" >nul\r\nif %errorlevel%==0 (\r\n  echo pinned object unavailable 1>&2\r\n  exit /b 128\r\n)\r\nexit /b 0\r\n');
      if (force) {
        fs.mkdirSync(target);
        fs.writeFileSync(path.join(target, "business.txt"), "original business bytes\n");
      }
      const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));
      const result = spawnSync(process.execPath, [cli, "app", "--framework", "react-vite", "--yes", "--no-install", "--no-start", ...(force ? ["--force"] : [])], {
        cwd: root, encoding: "utf8", timeout: 10000,
        env: {...process.env, PATH: tools + path.delimiter + process.env.PATH, QA_GIT_TRACE: trace},
      });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /Cannot download template FSD-CLI\/FSD at pinned commit [a-f0-9]{40}/);
      assert.doesNotMatch(result.stdout, /Project created successfully/);
      assert.match(fs.readFileSync(trace, "utf8"), /fetch --depth=1 --no-tags https:\/\/github.com\/FSD-CLI\/FSD.git [a-f0-9]{40}/);
      assert.equal(fs.existsSync(path.join(target, ".fsd", "template.json")), false);
      if (force) {
        assert.deepEqual(fs.readdirSync(target), ["business.txt"]);
        assert.equal(fs.readFileSync(path.join(target, "business.txt"), "utf8"), "original business bytes\n");
      } else assert.equal(fs.existsSync(target), false);
      assert.equal(fs.readdirSync(root).some(name => name.includes("fsd-cli-backup")), false);
    } finally {
      fs.rmSync(root, {recursive:true,force:true});
    }
  });
}
test("moving names, shortened SHAs and malformed repository sources fail before writing", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fsd invalid source-"));
  try {
    for (const source of [
      {repo:"FSD-CLI/FSD",ref:"main"},
      {repo:"FSD-CLI/FSD",ref:"ec8548bf"},
      {repo:"../../outside",ref:"a".repeat(40)},
    ]) {
      const target = path.join(root,"app");
      await assert.rejects(() => cloneTemplate(source, target), /immutable commit/);
      assert.equal(fs.existsSync(target), false);
    }
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
