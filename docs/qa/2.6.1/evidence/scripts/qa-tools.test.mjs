import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QA = path.resolve(HERE, "..", "..");
const HISTORICAL = path.join(QA, "evidence", "validation-r2");
const runner = path.join(HERE, "qa-evidence.mjs");
const renderer = path.join(HERE, "qa-matrix.mjs");

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsd qa tools "));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function invoke(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8", timeout: 60_000, env: process.env,
  });
}

function snapshot(dir) {
  const files = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    files[entry.name] = entry.isDirectory()
      ? snapshot(file)
      : crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  }
  return files;
}

test("default runs preserve all historical evidence and use distinct outputs", (t) => {
  const dir = temp(t);
  const work = path.join(dir, "work with spaces");
  const before = snapshot(HISTORICAL);
  for (let n = 1; n <= 2; n++) {
    const result = invoke(runner, ["--work", work, "--groups", "probe"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const outputs = fs.readdirSync(work).filter((name) => name.startsWith("evidence-"));
    assert.equal(outputs.length, n);
    for (const output of outputs) {
      const manifest = JSON.parse(fs.readFileSync(path.join(work, output, "manifest.json"), "utf8"));
      assert.equal(fs.realpathSync(manifest.output), fs.realpathSync(path.join(work, output)));
      assert.deepEqual(manifest.groups, ["probe"]);
    }
  }
  assert.deepEqual(snapshot(HISTORICAL), before);
});

test("nonempty output is refused without changing its contents", (t) => {
  const dir = temp(t);
  const out = path.join(dir, "existing evidence");
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, "results.jsonl"), "preserve this evidence\n");
  const before = snapshot(out);
  const result = invoke(runner, ["--work", path.join(dir, "work"), "--out", out, "--groups", "probe"]);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /refusing to overwrite existing evidence/);
  assert.deepEqual(snapshot(out), before);
});

test("a partial run has its own manifest and can be rendered", (t) => {
  const dir = temp(t);
  const out = path.join(dir, "partial evidence");
  const result = invoke(runner, ["--work", path.join(dir, "work"), "--out", out, "--groups", "probe"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.groups, ["probe"]);
  assert.equal(manifest.node, process.version);
  assert.equal(manifest.scriptSha256, crypto.createHash("sha256").update(fs.readFileSync(runner)).digest("hex"));
  const matrix = path.join(dir, "partial.md");
  const rendered = invoke(renderer, ["--in", out, "--out", matrix]);
  assert.equal(rendered.status, 0, rendered.stderr);
  const text = fs.readFileSync(matrix, "utf8");
  assert.match(text, /R2-PROBE-paths/);
  assert.ok(text.includes(manifest.os));
});

test("committed Windows evidence regenerates identically with valid links on every OS", (t) => {
  const dir = temp(t);
  const input = path.join(dir, "evidence", "validation-r2");
  fs.cpSync(HISTORICAL, input, { recursive: true });
  const output = path.join(dir, "CLI-QA-MATRIX-r2.md");
  const result = invoke(renderer, ["--in", input, "--out", output]);
  assert.equal(result.status, 0, result.stderr);
  const matrix = fs.readFileSync(output, "utf8");
  assert.equal(matrix, fs.readFileSync(path.join(QA, "CLI-QA-MATRIX-r2.md"), "utf8"));
  for (const match of matrix.matchAll(/\]\(([^)\s]+)\)/g)) {
    assert.ok(fs.existsSync(path.resolve(dir, match[1])), `Broken evidence link: ${match[1]}`);
  }
});
