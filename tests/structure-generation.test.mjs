import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { generateBatch } from "../bin/generators/structure.mjs";

const entry = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));
function fixture(t) {
  const cwd = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "fsd-structure-")),
  );
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, "package.json"),
    JSON.stringify({ dependencies: { react: "19" } }),
  );
  return {
    cwd,
    run: (...args) =>
      spawnSync(process.execPath, [entry, ...args], { cwd, encoding: "utf8" }),
  };
}
test("CLI adds custom-root segments to existing slices without overwriting public APIs", (t) => {
  const { cwd, run } = fixture(t);
  const index = path.join(cwd, "custom/features/cart/index.ts");
  fs.mkdirSync(path.dirname(index), { recursive: true });
  fs.writeFileSync(index, "export const sentinel = 1;\n");
  assert.equal(
    run("-g", "feature", "cart", "--segments", "ui,api", "--root", "custom")
      .status,
    0,
  );
  assert.equal(fs.readFileSync(index, "utf8"), "export const sentinel = 1;\n");
  assert(fs.statSync(path.join(cwd, "custom/features/cart/api")).isDirectory());
  assert.equal(
    run("-g", "feature", "cart", "--segments", "ui,api", "--root", "custom")
      .status,
    0,
  );
});
test("CLI batch segments, shared/app and preview avoid unintended writes", (t) => {
  const { cwd, run } = fixture(t);
  assert.equal(
    run(
      "-g",
      "entity",
      "product",
      "customer",
      "--segments=ui,model",
      "--root=lib",
      "--dry-run",
    ).status,
    0,
  );
  assert(!fs.existsSync(path.join(cwd, "lib")));
  assert.equal(
    run(
      "-g",
      "entity",
      "product",
      "customer",
      "--segments=ui,model",
      "--root=lib",
    ).status,
    0,
  );
  for (const name of ["product", "customer"])
    assert(fs.existsSync(path.join(cwd, "lib/entities", name, "index.ts")));
  for (const layer of ["shared", "app"]) {
    assert.equal(run("-g", layer, "--segments", "ui,lib").status, 0);
    assert(fs.existsSync(path.join(cwd, "src", layer, "lib/index.ts")));
  }
});
test("segment failures and symlinks are rejected before any structure writes", (t) => {
  const { cwd, run } = fixture(t);
  fs.mkdirSync(path.join(cwd, "src/features/cart"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "src/features/cart/api"), "sentinel");
  assert.equal(run("-g", "feature", "cart", "--segments=ui,api").status, 1);
  assert(!fs.existsSync(path.join(cwd, "src/features/cart/ui")));
  for (const args of [
    ["--segments=../escape"],
    ["--segments=ui", "--force"],
    ["--root=custom"],
    ["--segments=ui", "--auth-provider=supabase"],
  ]) {
    assert.equal(run("-g", "feature", "cart", ...args).status, 1);
  }
  fs.symlinkSync(
    path.join(cwd, "src"),
    path.join(cwd, "linked"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(
    run("-g", "feature", "new-cart", "--segments=ui", "--root=linked").status,
    1,
  );
  assert(!fs.existsSync(path.join(cwd, "src/features/new-cart")));
});
test("native batch preflight prevents partial writes when a later slice exists", (t) => {
  const { cwd, run } = fixture(t);
  fs.mkdirSync(path.join(cwd, "src/entities/customer"), { recursive: true });
  assert.equal(run("-g", "entity", "product", "customer").status, 1);
  assert(!fs.existsSync(path.join(cwd, "src/entities/product")));
  assert.equal(run("-g", "entity", "product", "Product").status, 1);
});
test("native batch generates both slices through the real CLI", (t) => {
  const { cwd, run } = fixture(t);
  assert.equal(run("-g", "entity", "product", "customer").status, 0);
  for (const name of ["product", "customer"])
    assert(
      fs
        .readFileSync(path.join(cwd, "entities", name, "index.ts"), "utf8")
        .includes("export"),
    );
});
test("native batch restores earlier writes and manifest bytes after a later runtime failure", (t) => {
  const { cwd } = fixture(t);
  const original = process.cwd();
  process.chdir(cwd);
  try {
    fs.mkdirSync(path.join(cwd, ".fsd"));
    fs.writeFileSync(path.join(cwd, ".fsd/manifest.json"), "original");
    let count = 0;
    assert.throws(
      () =>
        generateBatch(
          { type: "entity", names: ["first", "second"] },
          {
            loadProjectConfig: () => ({}),
            createGeneratorPlan: ({ name }) => ({
              name,
              sliceDir: path.join(cwd, "src/entities", name),
              changedFiles: [],
            }),
            generateSlice: ({ name }) => {
              if (++count === 2) throw new Error("injected failure");
              const p = path.join(cwd, "src/entities", name);
              fs.mkdirSync(p, { recursive: true });
              fs.writeFileSync(path.join(p, "index.ts"), "new");
              fs.writeFileSync(
                path.join(cwd, ".fsd/manifest.json"),
                "modified",
              );
              return [];
            },
            printSuccess: () => {},
          },
        ),
      /injected failure/,
    );
    assert.equal(
      fs.readFileSync(path.join(cwd, ".fsd/manifest.json"), "utf8"),
      "original",
    );
    assert(!fs.existsSync(path.join(cwd, "src")));
  } finally {
    process.chdir(original);
  }
});
test("Supabase option reaches the generator through the public CLI entrypoint", (t) => {
  const { cwd, run } = fixture(t);
  const result = run("-g", "feature", "auth", "--auth-provider=supabase");
  assert.equal(result.status, 0, result.stderr);
  assert(
    fs.existsSync(path.join(cwd, "features/auth/api/supabase.adapter.js")),
  );
  assert(
    fs
      .readFileSync(path.join(cwd, "features/auth/index.ts"), "utf8")
      .includes("./api/supabase"),
  );
  assert(
    fs
      .readFileSync(path.join(cwd, "features/auth/api/supabase.ts"), "utf8")
      .includes("configureSupabaseAuth"),
  );
});
test("architecture mode fails explicitly when Steiger is absent and ordinary inspection reports its scope", (t) => {
  const { cwd, run } = fixture(t);
  for (const layer of ["app", "pages", "widgets", "features", "entities", "shared"]) fs.mkdirSync(path.join(cwd, "src", layer), { recursive: true });
  const normal = run("check");
  assert.equal(normal.status, 0);
  assert.match(normal.stdout, /Scope: configuration/);
  const architecture = run("check", "--architecture");
  assert.equal(architecture.status, 1);
  assert.match(architecture.stderr, /Install steiger/);
  assert(!fs.existsSync(path.join(cwd, "node_modules")));
});
