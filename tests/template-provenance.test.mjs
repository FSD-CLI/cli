import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
