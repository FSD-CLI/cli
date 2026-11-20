import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { normalizeProjectConfig, configureProject, getManagedProjectArtifacts } from '../bin/project-config.mjs';
import { inspectProject } from '../bin/commands/inspect-project.mjs';
import { createGeneratorPlan, generateSlice, loadProjectConfig } from '../bin/generator.mjs';
import { createSharedLayerPlan, generateSharedLayer } from '../bin/generators/shared-layer.mjs';
import { getAvailableTemplate, getTemplate, getTemplateProvenance, listTemplates } from '../bin/core/template-registry.mjs';
import { migrateProjectConfig } from '../bin/upgrade/config.mjs';

test('Angular config is valid, inspectable and available for scaffolding', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsd-angular-contract-'));
  try {
    const config = normalizeProjectConfig('angular');
    assert.deepEqual(migrateProjectConfig(config), config);
    fs.writeFileSync(path.join(root, 'fsd.config.json'), JSON.stringify(config));
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    for (const layer of ['app', 'pages', 'widgets', 'features', 'entities', 'shared']) fs.mkdirSync(path.join(root, 'src', layer), { recursive: true });
    assert.equal(inspectProject(root).checks.every(check => check.ok), true);
    assert.equal(listTemplates({ includePlanned: false }).length, 6);
    assert.equal(getAvailableTemplate('angular').repo, 'FSD-CLI/fsd-angular');
    assert.throws(() => normalizeProjectConfig('angular', { clientState: 'redux' }), /Unsupported clientState/);
    assert.throws(() => normalizeProjectConfig('react-vite', { apiClient: 'angular-http' }), /Unsupported apiClient/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Angular configuration writes Angular artifacts and adapter dependencies only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsd-angular-write-'));
  try {
    const config = normalizeProjectConfig('angular');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      name: 'sentinel',
      dependencies: { '@angular/core': '^22.2.2', '@ngrx/signals': '^1.0.0', axios: '^1.0.0', 'react-hook-form': '^7.0.0' },
    }));
    configureProject(root, config);

    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.name, 'sentinel');
    assert.deepEqual(pkg.dependencies, {
      '@angular/core': '^22.2.2',
      '@angular/forms': '^22.2.2',
      '@ngrx/signals': '^22.0.1',
      '@tanstack/angular-query-experimental': '^5.103.1',
      zod: '^4.6.7',
    });

    const { files } = getManagedProjectArtifacts(config);
    assert.deepEqual(Object.keys(files).sort(), [
      'src/app/providers/index.ts',
      'src/app/providers/query/index.ts',
      'src/app/providers/query/query-provider.ts',
      'src/shared/api/api-client.ts',
      'src/shared/api/index.ts',
      'src/shared/config/fsd-stack.ts',
    ]);
    for (const [file, content] of Object.entries(files)) {
      assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), content, file);
    }
    assert.match(files['src/shared/api/api-client.ts'], /export class ApiClient/);
    assert.match(files['src/app/providers/query/query-provider.ts'], /provideTanStackQuery/);
    assert.match(files['src/shared/config/fsd-stack.ts'], /frameworkLabel: "Angular"/);
    for (const reactArtifact of ['src/app/providers/AppProviders.tsx', 'src/shared/api/client.ts']) {
      assert.equal(fs.existsSync(path.join(root, reactArtifact)), false, reactArtifact);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Angular pnpm projects only approve Angular build dependencies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsd-angular-pnpm-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), '{"packageManager":"npm@11.12.1"}');
    configureProject(root, normalizeProjectConfig('angular', { packageManager: 'pnpm' }));
    assert.equal('packageManager' in JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')), false);
    const workspace = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
    for (const name of ['@parcel/watcher', 'esbuild', 'lmdb', 'msgpackr-extract']) assert.match(workspace, new RegExp(`"${name}": true`));
    assert.match(workspace, /strictDepBuilds: true/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Angular template source is pinned to an immutable fsd-angular commit', () => {
  const template = getTemplate('angular');
  assert.equal(template.repo, 'FSD-CLI/fsd-angular');
  assert.match(template.ref, /^[a-f0-9]{40}$/);
  assert.equal(template.status, 'stable');
  assert.equal(template.available, true);
  assert.deepEqual(getTemplateProvenance(template), {
    schemaVersion: 1, framework: 'angular', repository: 'FSD-CLI/fsd-angular',
    requestedRef: template.ref, resolvedCommit: template.ref,
  });
});

function angularProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsd-angular-gen-'));
  const config = normalizeProjectConfig('angular');
  fs.writeFileSync(path.join(root, 'fsd.config.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(root, 'package.json'), '{"dependencies":{"@angular/core":"^22.2.2"}}');
  fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app', 'app.routes.ts'), [
    "import { Routes } from '@angular/router';",
    '',
    'export const routes: Routes = [',
    '  // fsd-cli:routes:start',
    '  // fsd-cli:routes:end',
    "  { path: '**', redirectTo: '' },",
    '];',
    '',
  ].join('\n'));
  return { root, config };
}

test('Angular feature plan uses query inject helpers, a signal store and single-quoted exports', () => {
  const { root, config } = angularProject();
  try {
    const plan = createGeneratorPlan({ cwd: root, type: 'feature', name: 'checkout', config });
    const files = Object.fromEntries(plan.files.map((item) => [item.path, item.content]));
    assert.deepEqual(Object.keys(files).sort(), [
      'api/checkout.api.ts',
      'api/checkout.query.ts',
      'index.ts',
      'lib/checkout.keys.ts',
      'model/checkout.store.ts',
      'model/checkout.types.ts',
      'ui/checkout-view.ts',
    ]);
    assert.match(files['api/checkout.query.ts'], /export function injectCheckoutQuery\(\)/);
    assert.match(files['api/checkout.query.ts'], /injectQuery\(\(\) => \(\{/);
    assert.match(files['model/checkout.store.ts'], /export const CheckoutStore = signalStore\(/);
    assert.match(files['ui/checkout-view.ts'], /changeDetection: ChangeDetectionStrategy.OnPush/);
    assert.match(files['ui/checkout-view.ts'], /readonly title = input\('Checkout feature'\)/);
    assert.doesNotMatch(files['index.ts'], /"/);
    assert.match(files['index.ts'], /export \{ CheckoutView \} from '.\/ui\/checkout-view';/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Angular auth uses typed reactive forms validated by zod', () => {
  const { root, config } = angularProject();
  try {
    const plan = createGeneratorPlan({ cwd: root, type: 'feature', name: 'auth', config });
    const files = Object.fromEntries(plan.files.map((item) => [item.path, item.content]));
    for (const form of ['login', 'register', 'forgot-password', 'reset-password', 'verify-code']) {
      assert.ok(files[`ui/${form}-form.ts`], form);
      assert.ok(files[`model/${form}.schema.ts`], form);
      assert.ok(files[`api/${form}.api.ts`], form);
    }
    const login = files['ui/login-form.ts'];
    assert.match(login, /new FormControl\('', \{ nonNullable: true \}\)/);
    assert.match(login, /loginSchema\.safeParse\(this\.form\.getRawValue\(\)\)/);
    assert.match(login, /z\.flattenError/);
    assert.match(login, /<label for="login-email">Email<\/label>/);
    assert.match(files['model/auth.store.ts'], /withComputed/);
    assert.match(files['api/auth.query.ts'], /mutationFn: \(payload: LoginCredentials\) => login\(api, payload\)/);

    const supabase = createGeneratorPlan({ cwd: root, type: 'feature', name: 'auth', config, authProvider: 'supabase' });
    const query = supabase.files.find((item) => item.path === 'api/auth.query.ts').content;
    assert.match(query, /=> login\(payload\)/);
    assert.doesNotMatch(query, /inject\(ApiClient\)/);
    assert.ok(supabase.files.some((item) => item.path === 'api/supabase.adapter.js'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Angular page generation registers a lazy route between the markers', () => {
  const { root, config } = angularProject();
  try {
    generateSlice({ cwd: root, type: 'page', name: 'account', config });
    generateSlice({ cwd: root, type: 'page', name: 'about', config });
    const routes = fs.readFileSync(path.join(root, 'src/app/app.routes.ts'), 'utf8');
    assert.match(routes, /  \{ path: 'about', loadComponent: \(\) => import\('@pages\/about'\)\.then\(\(m\) => m\.AboutPage\) \},\n  \{ path: 'account',/);
    assert.ok(routes.indexOf("path: 'account'") < routes.indexOf("path: '**'"));
    assert.match(fs.readFileSync(path.join(root, 'src/pages/about/ui/about-page.ts'), 'utf8'), /<h1>About us<\/h1>/);

    fs.writeFileSync(path.join(root, 'src/app/app.routes.ts'), 'export const routes = [];\n');
    assert.throws(() => generateSlice({ cwd: root, type: 'page', name: 'settings', config }), /missing \/\/ fsd-cli:routes:start/);
    assert.equal(fs.existsSync(path.join(root, 'src/pages/settings')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Angular widget presets and shared layer follow template conventions', () => {
  const { root, config } = angularProject();
  try {
    const navbar = createGeneratorPlan({ cwd: root, type: 'widget', name: 'navbar', config });
    const navbarSource = navbar.files.find((item) => item.path === 'ui/navbar.ts').content;
    assert.match(navbarSource, /imports: \[RouterLink\]/);
    assert.match(navbarSource, /@for \(item of items\(\); track item\.href\)/);

    fs.mkdirSync(path.join(root, 'src/shared/ui/app-card'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/shared/ui/index.ts'), "export { AppCard } from './app-card';\n");
    const ui = createSharedLayerPlan({ cwd: root, segment: 'ui', config });
    assert.deepEqual(ui.creates.map((item) => item.path), ['app-button.ts', 'app-input.ts', 'app-label.ts']);
    assert.deepEqual(ui.kept.map((item) => item.path), ['app-card.ts']);
    generateSharedLayer(ui);
    assert.equal(
      fs.readFileSync(path.join(root, 'src/shared/ui/index.ts'), 'utf8'),
      "export { AppButton } from './app-button';\nexport { AppCard } from './app-card';\nexport { AppInput } from './app-input';\nexport { AppLabel } from './app-label';\n",
    );
    assert.equal(createSharedLayerPlan({ cwd: root, segment: 'api', config }).creates[0].exportName, 'ApiClient');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Angular projects without fsd.config.json are detected from @angular/core', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsd-angular-detect-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), '{"dependencies":{"@angular/core":"^22.2.2","zod":"^4.6.7"}}');
    assert.equal(loadProjectConfig(root).framework, 'angular');
    assert.equal(loadProjectConfig(root).serverState, 'angular-query');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
