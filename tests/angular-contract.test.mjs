import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { normalizeProjectConfig, configureProject, getManagedProjectArtifacts } from '../bin/project-config.mjs';
import { inspectProject } from '../bin/commands/inspect-project.mjs';
import { createGeneratorPlan } from '../bin/generator.mjs';
import { getAvailableTemplate, getTemplate, getTemplateProvenance, listTemplates } from '../bin/core/template-registry.mjs';
import { migrateProjectConfig } from '../bin/upgrade/config.mjs';

test('Angular config is valid and inspectable without advertising scaffolding', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsd-angular-contract-'));
  try {
    const config = normalizeProjectConfig('angular');
    assert.deepEqual(migrateProjectConfig(config), config);
    fs.writeFileSync(path.join(root, 'fsd.config.json'), JSON.stringify(config));
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    for (const layer of ['app', 'pages', 'widgets', 'features', 'entities', 'shared']) fs.mkdirSync(path.join(root, 'src', layer), { recursive: true });
    assert.equal(inspectProject(root).checks.every(check => check.ok), true);
    assert.equal(listTemplates({ includePlanned: false }).length, 5);
    assert.throws(() => getAvailableTemplate('angular'), /planned but not available/);
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
    for (const type of ['feature', 'entity', 'widget', 'page']) assert.throws(() => createGeneratorPlan({ cwd: root, type, name: 'example', config }), /not supported/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Angular pnpm projects only approve Angular build dependencies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsd-angular-pnpm-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    configureProject(root, normalizeProjectConfig('angular', { packageManager: 'pnpm' }));
    const workspace = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
    for (const name of ['@parcel/watcher', 'esbuild', 'lmdb', 'msgpackr-extract']) assert.match(workspace, new RegExp(`"${name}": true`));
    assert.match(workspace, /strictDepBuilds: true/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Angular template source is pinned to an immutable fsd-angular commit', () => {
  const template = getTemplate('angular');
  assert.equal(template.repo, 'FSD-CLI/fsd-angular');
  assert.match(template.ref, /^[a-f0-9]{40}$/);
  assert.equal(template.status, 'planned');
  assert.equal(template.available, false);
  assert.deepEqual(getTemplateProvenance(template), {
    schemaVersion: 1, framework: 'angular', repository: 'FSD-CLI/fsd-angular',
    requestedRef: template.ref, resolvedCommit: template.ref,
  });
});
