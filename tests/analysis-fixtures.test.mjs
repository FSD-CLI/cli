import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Guards the INT-04 analysis fixtures (tests/fixtures/analysis/) so the
// documented import edges and violations cannot drift silently before
// INT-01 (project graph engine) lands and starts consuming them.

const fixturesDir = fileURLToPath(new URL("fixtures/analysis", import.meta.url));

const MINIMAL_FILES = [
  "fsd.config.json",
  "package.json",
  "src/app/providers/index.ts",
  "src/pages/home/ui/home-page.tsx",
  "src/widgets/header/ui/header.tsx",
  "src/features/auth/model/auth.ts",
  "src/features/auth/ui/login-form.tsx",
  "src/features/cart/model/cart.ts",
  "src/entities/product/model/product.types.ts",
  "src/entities/product/ui/product-card.tsx",
  "src/entities/user/model/user.types.ts",
  "src/shared/api/http.ts",
  "src/shared/ui/button.tsx",
];

function read(fixture, relativePath) {
  return fs.readFileSync(
    path.join(fixturesDir, fixture, relativePath),
    "utf8",
  );
}

// Escapes every RegExp metacharacter, so an import path is matched literally.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function importPattern(to) {
  return new RegExp(`from\\s+"[^"]*${escapeRegExp(to)}"`);
}

function assertImport(content, from, to) {
  assert.match(
    content,
    importPattern(to),
    `${from} should import from ${to}`,
  );
}

function assertNoImport(content, from, to) {
  assert.doesNotMatch(
    content,
    importPattern(to),
    `${from} should not import from ${to}`,
  );
}

test("minimal fixture has the documented files and a valid config", () => {
  for (const file of MINIMAL_FILES) {
    assert.ok(
      fs.existsSync(path.join(fixturesDir, "minimal", file)),
      `minimal/${file} should exist`,
    );
  }
  const config = JSON.parse(read("minimal", "fsd.config.json"));
  assert.equal(config.framework, "react-vite");
  assert.equal(config.schemaVersion, 1);
  const pkg = JSON.parse(read("minimal", "package.json"));
  assert.equal(pkg.private, true);
});

test("minimal fixture imports follow the layer order", () => {
  assertImport(
    read("minimal", "src/app/providers/index.ts"),
    "app/providers",
    "shared/ui/button",
  );
  assertImport(
    read("minimal", "src/pages/home/ui/home-page.tsx"),
    "pages/home",
    "widgets/header/ui/header",
  );
  assertImport(
    read("minimal", "src/pages/home/ui/home-page.tsx"),
    "pages/home",
    "features/auth/ui/login-form",
  );
  assertImport(
    read("minimal", "src/widgets/header/ui/header.tsx"),
    "widgets/header",
    "shared/ui/button",
  );
  assertImport(
    read("minimal", "src/features/auth/model/auth.ts"),
    "features/auth",
    "entities/user/model/user.types",
  );
  assertImport(
    read("minimal", "src/features/auth/ui/login-form.tsx"),
    "features/auth",
    "entities/user/model/user.types",
  );
  assertImport(
    read("minimal", "src/features/auth/ui/login-form.tsx"),
    "features/auth",
    "shared/ui/button",
  );
  assertImport(
    read("minimal", "src/features/cart/model/cart.ts"),
    "features/cart",
    "entities/product/model/product.types",
  );
  assertImport(
    read("minimal", "src/entities/product/ui/product-card.tsx"),
    "entities/product",
    "shared/ui/button",
  );
  assertNoImport(
    read("minimal", "src/entities/product/model/product.types.ts"),
    "entities/product",
    "features/",
  );
  assertNoImport(
    read("minimal", "src/shared/ui/button.tsx"),
    "shared/ui",
    "features/",
  );
});

test("with-violations fixture has exactly the three documented violations", () => {
  // Same files as minimal.
  for (const file of MINIMAL_FILES) {
    assert.ok(
      fs.existsSync(path.join(fixturesDir, "with-violations", file)),
      `with-violations/${file} should exist`,
    );
  }
  assertImport(
    read("with-violations", "src/entities/product/model/product.types.ts"),
    "entities/product",
    "features/auth/model/auth",
  );
  assertImport(
    read("with-violations", "src/shared/ui/button.tsx"),
    "shared/ui",
    "features/cart/model/cart",
  );
  assertImport(
    read("with-violations", "src/features/auth/model/auth.ts"),
    "features/auth",
    "pages/home/ui/home-page",
  );
  // The clean edges from minimal are unchanged.
  assertImport(
    read("with-violations", "src/pages/home/ui/home-page.tsx"),
    "pages/home",
    "widgets/header/ui/header",
  );
  assertImport(
    read("with-violations", "src/features/cart/model/cart.ts"),
    "features/cart",
    "entities/product/model/product.types",
  );
});

test("empty fixture has a config but no slices", () => {
  const config = JSON.parse(read("empty", "fsd.config.json"));
  assert.equal(config.framework, "react-vite");
  const srcDir = path.join(fixturesDir, "empty", "src");
  assert.ok(fs.existsSync(srcDir));
  const entries = fs
    .readdirSync(srcDir)
    .filter((entry) => entry !== ".gitkeep");
  assert.deepEqual(entries, []);
});
