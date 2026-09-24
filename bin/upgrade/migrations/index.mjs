import { UpgradeStateError } from "../config.mjs";

export const CURRENT_UPGRADE_STATE_VERSION = 2;
export const SUPPORTED_FRAMEWORKS = Object.freeze([
  "react-vite",
  "nextjs",
  "vue-vite",
  "nuxt",
  "sveltekit",
]);

export const MIGRATIONS = Object.freeze([
  {
    id: "managed-state-v1",
    from: 0,
    to: 1,
    frameworks: SUPPORTED_FRAMEWORKS,
    preconditions: ["A strictly valid fsd.config.json and package.json are present."],
    manualActionMayBeRequired: true,
    plan: () => [],
  },
  {
    id: "tooling-hardening-v1",
    from: 1,
    to: 2,
    frameworks: SUPPORTED_FRAMEWORKS,
    preconditions: ["Managed hook content and package-manager ownership are unambiguous."],
    manualActionMayBeRequired: true,
    plan: (context) => context.planToolingMigration(),
  },
]);

export function validateMigrationGraph(migrations = MIGRATIONS) {
  const ids = new Set();
  const transitions = new Map();
  for (const migration of migrations) {
    if (!migration.id || ids.has(migration.id)) {
      throw new UpgradeStateError(`Duplicate or missing migration ID: ${migration.id ?? "<missing>"}.`);
    }
    if (!Number.isInteger(migration.from) || !Number.isInteger(migration.to) || migration.to <= migration.from) {
      throw new UpgradeStateError(`Migration ${migration.id} has an invalid state transition.`);
    }
    if (transitions.has(migration.from)) {
      throw new UpgradeStateError(`Multiple migrations start at state ${migration.from}.`);
    }
    ids.add(migration.id);
    transitions.set(migration.from, migration);
  }
  for (const migration of migrations) {
    const visited = new Set();
    let state = migration.from;
    while (transitions.has(state)) {
      if (visited.has(state)) throw new UpgradeStateError("Migration graph contains a cycle.");
      visited.add(state);
      state = transitions.get(state).to;
    }
  }
  return transitions;
}

export function selectMigrationPath(from, target = CURRENT_UPGRADE_STATE_VERSION, migrations = MIGRATIONS) {
  const transitions = validateMigrationGraph(migrations);
  if (from > target) {
    throw new UpgradeStateError(
      `Project upgrade state ${from} is newer than this CLI supports (${target}); downgrades are not supported.`
    );
  }
  const path = [];
  let state = from;
  while (state < target) {
    const migration = transitions.get(state);
    if (!migration) {
      throw new UpgradeStateError(`No migration path exists from upgrade state ${state} to ${target}.`);
    }
    path.push(migration);
    state = migration.to;
  }
  return path;
}
