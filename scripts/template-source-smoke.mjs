import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cloneTemplate } from "../bin/core/project-lifecycle.mjs";
import { listTemplates } from "../bin/core/template-registry.mjs";

function treeHash(directory) {
  const hash = crypto.createHash("sha256");
  function visit(relative = "") {
    for (const name of fs.readdirSync(path.join(directory, relative)).sort()) {
      const file = path.join(relative, name);
      const absolute = path.join(directory, file);
      const stat = fs.lstatSync(absolute);
      hash.update(file.replaceAll(path.sep, "/") + "\0");
      if (stat.isSymbolicLink()) hash.update(fs.readlinkSync(absolute));
      else if (stat.isDirectory()) visit(file);
      else hash.update(fs.readFileSync(absolute));
      hash.update("\0");
    }
  }
  visit();
  return hash.digest("hex");
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "fsd pinned sources-"));
try {
  for (const template of listTemplates({ includePlanned: false })) {
    const hashes = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const destination = path.join(root, `${template.value}-${attempt}`);
      await cloneTemplate(template, destination);
      const provenance = JSON.parse(fs.readFileSync(path.join(destination, ".fsd", "template.json"), "utf8"));
      assert.equal(provenance.resolvedCommit, template.ref);
      assert.equal(provenance.requestedRef, template.ref);
      assert.equal(fs.existsSync(path.join(destination, ".git")), false);
      hashes.push(treeHash(destination));
    }
    assert.equal(hashes[0], hashes[1], `${template.value}: repeated source downloads differ`);
    console.log(JSON.stringify({ framework: template.value, commit: template.ref, treeSha256: hashes[0], status: "PASS" }));
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
