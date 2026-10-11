import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { normalizeProjectConfig, configureProject, getManagedProjectArtifacts } from '../bin/project-config.mjs';
import { inspectProject } from '../bin/commands/inspect-project.mjs';
import { createGeneratorPlan } from '../bin/generator.mjs';
import { getAvailableTemplate, listTemplates } from '../bin/core/template-registry.mjs';
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
    assert.throws(() => getAvailableTemplate('angular'), /Unknown framework/);
    assert.throws(() => normalizeProjectConfig('angular', { clientState: 'redux' }), /Unsupported clientState/);
    assert.throws(() => normalizeProjectConfig('react-vite', { apiClient: 'angular-http' }), /Unsupported apiClient/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Angular writes and upgrades fail before creating React artifacts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsd-angular-write-'));
  try {
    const config = normalizeProjectConfig('angular');
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"sentinel"}');
    assert.throws(() => configureProject(root, config), /inspection only/);
    assert.throws(() => getManagedProjectArtifacts(config), /inspection only/);
    for (const type of ['feature', 'entity', 'widget', 'page']) assert.throws(() => createGeneratorPlan({ cwd: root, type, name: 'example', config }), /not supported/);
    assert.deepEqual(fs.readdirSync(root), ['package.json']);
    assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), '{"name":"sentinel"}');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
