import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = require("../package.json");

// @angular-devkit/schematics requires Node ^22.22.3, above the CLI's 22.12.0
// floor, so it is not a devDependency (the floor job installs with
// --engine-strict). The "Angular schematics / ng new" CI job installs it with
// `npm install --no-save @angular-devkit/schematics` and runs these tests.
let devkit = null;
try {
  devkit = {
    ...require("@angular-devkit/schematics/testing"),
    ...require("@angular-devkit/schematics"),
  };
} catch {
  devkit = null;
}
const skip = devkit ? false : "@angular-devkit/schematics is not installed";
const { SchematicTestRunner, UnitTestTree, HostTree } = devkit ?? {};
const runner = devkit
  ? new SchematicTestRunner("create-fsd-architecture", path.join(root, "schematics", "collection.json"))
  : null;

// The files `ng new demo` (Angular CLI 22.2.2) writes that ng-add touches.
function ngNewWorkspace() {
  const tree = new UnitTestTree(new HostTree());
  tree.create(
    "package.json",
    `${JSON.stringify(
      {
        name: "demo",
        private: true,
        dependencies: {
          "@angular/core": "^22.2.0",
          "@angular/forms": "^22.2.0",
          "@angular/router": "^22.2.0",
        },
        devDependencies: { "@angular/cli": "^22.2.2" },
      },
      null,
      2
    )}\n`
  );
  tree.create(
    "angular.json",
    `${JSON.stringify({ version: 1, projects: { demo: { projectType: "application", root: "", sourceRoot: "src" } } }, null, 2)}\n`
  );
  tree.create(
    "tsconfig.json",
    `/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "compileOnSave": false,
  "compilerOptions": {
    "strict": true,
    "module": "preserve"
  },
  "files": []
}
`
  );
  tree.create(
    "src/app/app.config.ts",
    `import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
};
`
  );
  tree.create("src/app/app.routes.ts", "import { Routes } from '@angular/router';\n\nexport const routes: Routes = [];\n");
  return tree;
}

test("package.json exposes the schematic collection, ng-add and ng-update", () => {
  assert.equal(packageJson.schematics, "./schematics/collection.json");
  assert.deepEqual(packageJson["ng-add"], { save: "devDependencies" });
  assert.equal(packageJson["ng-update"].migrations, "./schematics/migration-collection.json");
  assert.ok(packageJson.files.includes("schematics"));
  const migrations = require("../schematics/migration-collection.json").schematics;
  for (const migration of Object.values(migrations)) assert.match(migration.version, /^\d+\.\d+\.\d+$/);
});

test("ng-add sets up FSD in a fresh ng new workspace", { skip }, async () => {
  const tree = await runner.runSchematic("ng-add", { skipInstall: true }, ngNewWorkspace());

  const config = JSON.parse(tree.readContent("fsd.config.json"));
  assert.equal(config.framework, "angular");
  assert.equal(config.packageManager, "npm");

  const tsconfig = tree.readContent("tsconfig.json");
  assert.match(tsconfig, /^\/\* To learn more about Typescript/);
  const paths = JSON.parse(tsconfig.replace(/\/\*[\s\S]*?\*\//g, "")).compilerOptions.paths;
  for (const layer of ["app", "pages", "widgets", "features", "entities", "shared"]) {
    assert.deepEqual(paths[`@${layer}/*`], [`./src/${layer}/*`]);
  }

  assert.equal(
    tree.readContent("src/app/app.routes.ts"),
    "import { Routes } from '@angular/router';\n\nexport const routes: Routes = [\n  // fsd-cli:routes:start\n  // fsd-cli:routes:end\n];\n"
  );
  const appConfig = tree.readContent("src/app/app.config.ts");
  assert.match(appConfig, /import \{ provideHttpClient, withFetch \} from '@angular\/common\/http';/);
  assert.match(appConfig, /import \{ provideAppQuery \} from '.\/providers';/);
  assert.match(appConfig, /providers: \[\n    provideHttpClient\(withFetch\(\)\),\n    provideAppQuery\(\),\n    provideBrowserGlobalErrorListeners\(\)/);

  for (const file of [
    "src/shared/api/api-client.ts",
    "src/shared/api/index.ts",
    "src/shared/config/public-config.ts",
    "src/shared/config/index.ts",
    "src/app/providers/index.ts",
    "src/app/providers/query/query-provider.ts",
    "src/features/README.md",
    "src/pages/README.md",
  ]) {
    assert.ok(tree.exists(file), file);
  }

  const pkg = JSON.parse(tree.readContent("package.json"));
  assert.equal(pkg.dependencies["@tanstack/angular-query-experimental"], "^5.103.1");
  assert.equal(pkg.dependencies["@ngrx/signals"], "^22.0.1");
  assert.equal(pkg.dependencies.zod, "^4.6.7");
  assert.equal(pkg.dependencies["@angular/forms"], "^22.2.0", "existing versions are kept");
  assert.deepEqual(
    JSON.parse(tree.readContent("angular.json")).cli.schematicCollections,
    ["create-fsd-architecture"]
  );
  assert.equal(runner.tasks.length, 0, "skipInstall schedules no install");
});

test("ng-add is idempotent and schedules an install only for new dependencies", { skip }, async () => {
  const once = await runner.runSchematic("ng-add", {}, ngNewWorkspace());
  assert.equal(runner.tasks.filter((task) => task.name === "node-package").length, 1);
  const snapshot = Object.fromEntries(once.files.map((file) => [file, once.readContent(file)]));
  const twice = await runner.runSchematic("ng-add", {}, once);
  for (const file of twice.files) assert.equal(twice.readContent(file), snapshot[file], file);
  assert.equal(runner.tasks.filter((task) => task.name === "node-package").length, 0);
});

test("ng-add refuses non-Angular projects and other frameworks", { skip }, async () => {
  const tree = new UnitTestTree(new HostTree());
  tree.create("package.json", '{"dependencies":{"react":"^19.0.0"}}');
  tree.create("angular.json", '{"version":1,"projects":{}}');
  await assert.rejects(() => runner.runSchematic("ng-add", {}, tree), /@angular\/core is not a dependency/);

  const other = ngNewWorkspace();
  other.create("fsd.config.json", '{"schemaVersion":1,"framework":"react-vite"}');
  await assert.rejects(() => runner.runSchematic("ng-add", {}, other), /already targets "react-vite"/);
});

test("ng-add keeps wildcard routes last and detects the package manager", { skip }, async () => {
  const workspace = ngNewWorkspace();
  workspace.overwrite(
    "src/app/app.routes.ts",
    "import { Routes } from '@angular/router';\n\nexport const routes: Routes = [\n  { path: 'home', loadComponent: () => import('./home') },\n  { path: '**', redirectTo: 'home' },\n];\n"
  );
  workspace.create("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  const tree = await runner.runSchematic("ng-add", { skipInstall: true }, workspace);
  const routes = tree.readContent("src/app/app.routes.ts");
  assert.ok(routes.indexOf("// fsd-cli:routes:end") < routes.indexOf("path: '**'"));
  assert.ok(routes.indexOf("path: 'home'") < routes.indexOf("// fsd-cli:routes:start"));
  assert.equal(JSON.parse(tree.readContent("fsd.config.json")).packageManager, "pnpm");
});

test("slice schematics generate Angular slices and register page routes", { skip }, async () => {
  let tree = await runner.runSchematic("ng-add", { skipInstall: true }, ngNewWorkspace());
  tree = await runner.runSchematic("feature", { name: "Checkout" }, tree);
  tree = await runner.runSchematic("entity", { name: "product" }, tree);
  tree = await runner.runSchematic("widget", { name: "navbar" }, tree);
  tree = await runner.runSchematic("page", { name: "account" }, tree);
  tree = await runner.runSchematic("feature", { name: "auth", authProvider: "supabase" }, tree);

  assert.match(tree.readContent("src/features/checkout/api/checkout.query.ts"), /injectCheckoutQuery/);
  assert.match(tree.readContent("src/features/checkout/index.ts"), /export \{ CheckoutView \} from '.\/ui\/checkout-view';/);
  assert.match(tree.readContent("src/entities/product/ui/product-card.ts"), /input\.required<Product>\(\)/);
  assert.match(tree.readContent("src/widgets/navbar/ui/navbar.ts"), /RouterLink/);
  assert.match(tree.readContent("src/pages/account/ui/account-page.ts"), /export class AccountPage/);
  assert.match(
    tree.readContent("src/app/app.routes.ts"),
    /  \/\/ fsd-cli:routes:start\n  \{ path: 'account', loadComponent: \(\) => import\('@pages\/account'\)\.then\(\(m\) => m\.AccountPage\) \},\n  \/\/ fsd-cli:routes:end/
  );
  assert.ok(tree.exists("src/features/auth/api/supabase.adapter.js"));

  await assert.rejects(() => runner.runSchematic("feature", { name: "checkout" }, tree), /already exists/);
  const forced = await runner.runSchematic("feature", { name: "checkout", force: true }, tree);
  assert.ok(forced.exists("src/features/checkout/index.ts"));
});

test("slice schematics require ng-add first", { skip }, async () => {
  await assert.rejects(
    () => runner.runSchematic("feature", { name: "checkout" }, ngNewWorkspace()),
    /Run `ng add create-fsd-architecture` first/
  );
});

test("ng update refreshes an ng-add workspace without overwriting edits", { skip }, async () => {
  const migrations = new SchematicTestRunner(
    "create-fsd-architecture",
    path.join(root, "schematics", "migration-collection.json")
  );
  let tree = await runner.runSchematic("ng-add", { skipInstall: true }, ngNewWorkspace());
  tree.delete("src/app/providers/query/query-provider.ts");
  tree.overwrite("src/shared/api/api-client.ts", "// customized\n");
  const pkg = JSON.parse(tree.readContent("package.json"));
  delete pkg.dependencies["@ngrx/signals"];
  tree.overwrite("package.json", JSON.stringify(pkg));

  tree = await migrations.runSchematic("fsd-managed-upgrade", {}, tree);
  assert.match(tree.readContent("src/app/providers/query/query-provider.ts"), /provideTanStackQuery/);
  assert.equal(tree.readContent("src/shared/api/api-client.ts"), "// customized\n");
  assert.equal(JSON.parse(tree.readContent("package.json")).dependencies["@ngrx/signals"], "^22.0.1");
  assert.equal(migrations.tasks.filter((task) => task.name === "node-package").length, 1);

  const untouched = await migrations.runSchematic("fsd-managed-upgrade", {}, ngNewWorkspace());
  assert.equal(untouched.exists("fsd.config.json"), false, "workspaces without FSD are left alone");
});
