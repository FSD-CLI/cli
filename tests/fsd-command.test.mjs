import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeSubcommand, parseCliArgs } from "../bin/cli/args.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const entry = path.join(root, "bin/index.mjs");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("package exposes fsd and create-fsd-architecture as the same entry point", () => {
  assert.equal(packageJson.bin.fsd, "bin/index.mjs");
  assert.equal(packageJson.bin["create-fsd-architecture"], "bin/index.mjs");
});

test("fsd subcommands map onto the flag-based commands", () => {
  assert.deepEqual(normalizeSubcommand(["create", "my-app", "-y"]), ["my-app", "-y"]);
  assert.deepEqual(normalizeSubcommand(["g", "entity", "product"]), ["--generate", "entity", "product"]);
  assert.deepEqual(normalizeSubcommand(["generate", "page", "home"]), ["--generate", "page", "home"]);
  assert.deepEqual(normalizeSubcommand(["check"]), ["check"]);

  assert.deepEqual(parseCliArgs(["g", "entity", "product", "customer", "--dry-run"]), {
    ...parseCliArgs(["-g", "entity", "product", "customer", "--dry-run"]),
  });
  const create = parseCliArgs(["create", "my-app", "--framework", "vue-vite", "--yes"]);
  assert.equal(create.command, "create");
  assert.equal(create.projectName, "my-app");
  assert.equal(create.framework, "vue-vite");
});

test("a project named create or generate still needs the explicit subcommand", () => {
  assert.equal(parseCliArgs(["create", "generate"]).projectName, "generate");
});

test("help shows the program name it was invoked as", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-bin-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const link = path.join(dir, "fsd");
  try {
    fs.symlinkSync(entry, link);
  } catch {
    t.skip("symlinks unavailable on this platform");
    return;
  }
  const viaFsd = spawnSync(process.execPath, [link, "--help"], { encoding: "utf8" });
  assert.equal(viaFsd.status, 0, viaFsd.stderr);
  assert.match(viaFsd.stdout, /^fsd v\d+\.\d+\.\d+/);
  assert.match(viaFsd.stdout, /fsd generate <type> <name\.\.\.>/);

  const viaPackage = spawnSync(process.execPath, [entry, "--help"], { encoding: "utf8" });
  assert.match(viaPackage.stdout, /^create-fsd-architecture v\d+\.\d+\.\d+/);
});

test("fsd generate runs the generator in a project", (t) => {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fsd-gen-")));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ dependencies: { react: "19" } }));
  fs.mkdirSync(path.join(cwd, "src"));
  const result = spawnSync(process.execPath, [entry, "g", "entity", "product"], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert(fs.existsSync(path.join(cwd, "src/entities/product/index.ts")));
});
