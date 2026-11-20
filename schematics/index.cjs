'use strict';
// Angular schematics for create-fsd-architecture. The CLI is ESM, so each
// factory loads the shared planners with a dynamic import and applies their
// result to the schematic Tree. No @angular-devkit code is required at load
// time; the install task comes from the workspace's own Angular CLI.
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function load(relative) {
  return import(pathToFileURL(path.join(__dirname, '..', 'bin', relative)).href);
}

function host(tree) {
  return {
    exists: (file) => tree.exists(file),
    read: (file) => {
      const buffer = tree.read(file);
      return buffer === null ? null : buffer.toString('utf8');
    },
  };
}

function apply(tree, writes) {
  for (const { path: file, content } of writes) {
    if (tree.exists(file)) tree.overwrite(file, content);
    else tree.create(file, content);
  }
}

function slice(type) {
  return (options) => async (tree, context) => {
    const { planAngularSlice } = await load('angular-schematics.mjs');
    const writes = planAngularSlice(host(tree), { type, ...options });
    apply(tree, writes);
    context.logger.info(`FSD ${type} "${options.name}": ${writes.length} file(s) planned.`);
  };
}

exports.feature = slice('feature');
exports.entity = slice('entity');
exports.widget = slice('widget');
exports.page = slice('page');

exports.ngAdd = (options = {}) => async (tree, context) => {
  const { planAngularAdd } = await load('angular-schematics.mjs');
  const plan = planAngularAdd(host(tree));
  apply(tree, plan.writes);
  for (const file of plan.kept) context.logger.info(`kept existing ${file}`);
  for (const step of plan.manual) context.logger.warn(`manual step: ${step}`);
  if (plan.installDependencies && !options.skipInstall) {
    const { NodePackageInstallTask } = require('@angular-devkit/schematics/tasks');
    context.addTask(new NodePackageInstallTask({ packageManager: plan.packageManager }));
  }
  context.logger.info('Feature-Sliced Design is set up. Generate slices with `ng g feature <name>`.');
};

// `ng update create-fsd-architecture`:
// - projects created by the FSD CLI (.fsd/manifest.json) run the CLI's managed
//   upgrade, which writes through its own transaction (backup + rollback) and
//   stops on conflicts with the CLI's message;
// - workspaces set up with `ng add` own no Git tooling, so the idempotent
//   ng-add plan runs again through the Tree: missing FSD files and new managed
//   dependencies are added, edited files are never overwritten.
exports.managedUpgrade = () => async (tree, context) => {
  if (!tree.exists('fsd.config.json')) {
    context.logger.info('No fsd.config.json; nothing to migrate for FSD.');
    return;
  }
  if (!tree.exists('.fsd/manifest.json')) {
    const { planAngularAdd } = await load('angular-schematics.mjs');
    const plan = planAngularAdd(host(tree));
    apply(tree, plan.writes);
    for (const step of plan.manual) context.logger.warn(`manual step: ${step}`);
    if (plan.installDependencies) {
      const { NodePackageInstallTask } = require('@angular-devkit/schematics/tasks');
      context.addTask(new NodePackageInstallTask({ packageManager: plan.packageManager }));
    }
    context.logger.info(`FSD setup refreshed (${plan.writes.length} change(s)).`);
    return;
  }
  if (context.engine.workflow && context.engine.workflow.dryRun === true) {
    context.logger.info('Dry run: run `npx create-fsd-architecture upgrade --dry-run` to preview the managed upgrade.');
    return;
  }
  const { runUpgradeProject } = await load('commands/upgrade-project.mjs');
  const { version } = require('../package.json');
  // ng update requires a clean Git tree itself and has already changed
  // package.json, so the CLI's own dirty-tree guard is relaxed here.
  await runUpgradeProject(
    { yes: true, noInstall: true, allowDirty: true },
    { cwd: process.cwd(), cliVersion: version },
  );
  context.logger.info('FSD managed upgrade finished. Install dependencies with your package manager.');
};
