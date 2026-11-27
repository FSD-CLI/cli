import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseCliArgs } from "../bin/cli/args.mjs";
import { loadProjectConfig } from "../bin/generator.mjs";
import { moveSlice, planSliceMove } from "../bin/core/slice-move.mjs";

const CONFIG = {
  schemaVersion: 1,
  framework: "react-vite",
  projectName: "fixture",
  packageManager: "npm",
  apiClient: "fetch",
  serverState: "none",
  clientState: "zustand",
  forms: "react-hook-form-zod",
  target: "web",
};

function createFixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-move-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify(CONFIG, null, 2)
  );
  const files = {
    "src/features/auth/index.ts":
      'export { AuthForm } from "./ui/AuthForm";\n',
    "src/features/auth/ui/AuthForm.ts":
      'import { apiClient } from "@/shared/api";\nexport const AuthForm = apiClient;\n',
    "src/entities/product/index.ts": "export const product = {};\n",
    "src/widgets/header/ui/Header.ts":
      'import { AuthForm } from "../../../features/auth";\nimport { AuthForm as Form } from "../../../features/auth/ui/AuthForm";\nexport const Header = [AuthForm, Form];\n',
    "src/pages/home/ui/HomePage.ts":
      'import { AuthForm } from "@/features/auth";\nimport { product } from "@/entities/product";\nexport const HomePage = [AuthForm, product];\n',
    "src/shared/api/index.ts": "export const apiClient = {};\n",
  };
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(cwd, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return { cwd, config: loadProjectConfig(cwd) };
}

test("move renames a feature and rewrites relative and alias imports", (t) => {
  const { cwd, config } = createFixture(t);
  const result = moveSlice({
    cwd,
    config,
    type: "feature",
    oldName: "auth",
    newName: "account",
  });

  assert.equal(fs.existsSync(path.join(cwd, "src/features/auth")), false);
  assert.equal(
    fs.existsSync(path.join(cwd, "src/features/account/ui/AuthForm.ts")),
    true
  );
  // Relative imports from other slices point at the new location.
  assert.match(
    fs.readFileSync(path.join(cwd, "src/widgets/header/ui/Header.ts"), "utf8"),
    /from "\.\.\/\.\.\/\.\.\/features\/account"/
  );
  assert.match(
    fs.readFileSync(path.join(cwd, "src/widgets/header/ui/Header.ts"), "utf8"),
    /from "\.\.\/\.\.\/\.\.\/features\/account\/ui\/AuthForm"/
  );
  // Alias imports point at the new location; unrelated imports are untouched.
  const homePage = fs.readFileSync(
    path.join(cwd, "src/pages/home/ui/HomePage.ts"),
    "utf8"
  );
  assert.match(homePage, /from "@\/features\/account"/);
  assert.match(homePage, /from "@\/entities\/product"/);
  // Imports inside the moved slice keep their original relative form.
  assert.equal(
    fs.readFileSync(path.join(cwd, "src/features/account/index.ts"), "utf8"),
    'export { AuthForm } from "./ui/AuthForm";\n'
  );
  assert.match(
    fs.readFileSync(
      path.join(cwd, "src/features/account/ui/AuthForm.ts"),
      "utf8"
    ),
    /from "@\/shared\/api"/
  );
  assert.equal(result.rewrittenFiles.length, 2);
});

test("move --to relocates a slice across layers", (t) => {
  const { cwd, config } = createFixture(t);
  moveSlice({
    cwd,
    config,
    type: "feature",
    oldName: "auth",
    newName: "account",
    toType: "widget",
  });

  assert.equal(fs.existsSync(path.join(cwd, "src/features/auth")), false);
  assert.equal(
    fs.existsSync(path.join(cwd, "src/widgets/account/ui/AuthForm.ts")),
    true
  );
  assert.match(
    fs.readFileSync(path.join(cwd, "src/widgets/header/ui/Header.ts"), "utf8"),
    /from "\.\.\/\.\.\/account"/
  );
  assert.match(
    fs.readFileSync(path.join(cwd, "src/widgets/header/ui/Header.ts"), "utf8"),
    /from "\.\.\/\.\.\/account\/ui\/AuthForm"/
  );
  assert.match(
    fs.readFileSync(path.join(cwd, "src/pages/home/ui/HomePage.ts"), "utf8"),
    /from "@\/widgets\/account"/
  );
});

test("dry-run plan reports the move without writing anything", (t) => {
  const { cwd, config } = createFixture(t);
  const plan = planSliceMove({
    cwd,
    config,
    type: "feature",
    oldName: "auth",
    newName: "account",
  });

  assert.equal(
    path.relative(cwd, plan.oldSliceDir),
    path.join("src", "features", "auth")
  );
  assert.equal(
    path.relative(cwd, plan.newSliceDir),
    path.join("src", "features", "account")
  );
  assert.equal(plan.rewrites.length, 2);
  assert.equal(fs.existsSync(path.join(cwd, "src/features/auth")), true);
  assert.equal(fs.existsSync(path.join(cwd, "src/features/account")), false);
  assert.match(
    fs.readFileSync(path.join(cwd, "src/widgets/header/ui/Header.ts"), "utf8"),
    /from "\.\.\/\.\.\/\.\.\/features\/auth"/
  );
});

test("move rejects a missing slice, an existing destination and pages", (t) => {
  const { cwd, config } = createFixture(t);
  assert.throws(
    () =>
      moveSlice({ cwd, config, type: "feature", oldName: "missing", newName: "x" }),
    /does not exist/
  );
  assert.throws(
    () =>
      moveSlice({
        cwd,
        config,
        type: "feature",
        oldName: "auth",
        newName: "auth",
      }),
    /already named/
  );
  fs.mkdirSync(path.join(cwd, "src/features/account"));
  assert.throws(
    () =>
      moveSlice({ cwd, config, type: "feature", oldName: "auth", newName: "account" }),
    /already exists/
  );
  assert.throws(
    () =>
      moveSlice({ cwd, config, type: "page", oldName: "home", newName: "landing" }),
    /not supported yet/
  );
  assert.throws(
    () =>
      moveSlice({ cwd, config, type: "shared", oldName: "api", newName: "http" }),
    /Movable types/
  );
});

test("parseCliArgs accepts move and rename with --to and --dry-run", () => {
  assert.deepEqual(parseCliArgs(["move", "feature", "auth", "account"]), {
    command: "move",
    type: "feature",
    oldName: "auth",
    newName: "account",
    toType: undefined,
    dryRun: false,
  });
  assert.deepEqual(
    parseCliArgs(["rename", "entity", "product", "item", "--dry-run"]),
    {
      command: "move",
      type: "entity",
      oldName: "product",
      newName: "item",
      toType: undefined,
      dryRun: true,
    }
  );
  assert.deepEqual(
    parseCliArgs(["move", "feature", "auth", "account", "--to", "widget"]),
    {
      command: "move",
      type: "feature",
      oldName: "auth",
      newName: "account",
      toType: "widget",
      dryRun: false,
    }
  );
  assert.throws(
    () => parseCliArgs(["move", "feature", "auth"]),
    /Usage: fsd move/
  );
  assert.throws(
    () => parseCliArgs(["rename", "feature", "a", "b", "--to", "widget"]),
    /use `fsd move --to/
  );
  assert.throws(
    () => parseCliArgs(["move", "feature", "a", "b", "--force"]),
    /Unknown move option/
  );
});
