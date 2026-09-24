# Safe Upgrade Architecture

## Scope

`create-fsd-architecture upgrade` is a versioned migration system for
CLI-owned project configuration and tooling. It is not a project scaffold or a
business-code codemod. The initial migration target is managed state `2` while
`fsd.config.json` remains at schema `1`.

The system is intentionally conservative: a refused upgrade is preferable to an
incorrect ownership assumption.

## Project Discovery

Upgrade walks upward from the invocation directory and requires both
`fsd.config.json` and `package.json` at the selected root. It stops at the
filesystem root, rejects incomplete roots, and rejects nested conflicting roots.
It does not infer a framework from `package.json`.

## Ownership Model

`.fsd/manifest.json` is separate from the user-authored stack contract in
`fsd.config.json`. The manifest is validated against
`schema/fsd.manifest.schema.json` and contains:

```json
{
  "manifestVersion": 1,
  "stateVersion": 2,
  "framework": "react-vite",
  "configSchemaVersion": 1,
  "createdWithCliVersion": "2.5.1",
  "lastUpgradedWithCliVersion": "2.5.1",
  "appliedMigrations": ["managed-state-v1", "tooling-hardening-v1"],
  "managedFiles": {},
  "managedPackageEntries": {},
  "markerRegions": {}
}
```

All paths are normalized relative paths. File and marker-region ownership uses
`sha256:<hex>` hashes. Shared `package.json` ownership is recorded by exact
dependency keys rather than a whole-file hash. The manifest never records
environment content, secrets, timestamps, or `node_modules`.

Safe managed surfaces are exact generated stack/API/provider artifacts,
`fsd.config.json`, verified Husky hooks, a CLI-created Commitlint config,
marker-delimited Nuxt module regions, and explicit managed package entries.
Business slices, user routes, styles, environment files, arbitrary scripts,
unrelated dependencies, and Git history are user-owned.

## Migration Registry

The registry is in `bin/upgrade/migrations/index.mjs`. Every entry has an ID,
source and target state, supported frameworks, preconditions, a pure planning
function, and a manual-action declaration. The graph rejects duplicate IDs,
invalid transitions, gaps, cycles, unsupported future states, and downgrades.

| ID | State | Effect |
| --- | --- | --- |
| `managed-state-v1` | `0 -> 1` | Establishes proven ownership metadata for legacy projects. |
| `tooling-hardening-v1` | `1 -> 2` | Updates exact legacy Husky hook signatures and creates the pnpm build policy only at an absent path. |

No configuration schema migration is declared merely to demonstrate the engine.
`bin/upgrade/config.mjs` provides one-step migration plumbing for a future
schema version and rejects malformed or future schema versions without applying
defaults.

## Planner and Conflicts

Planning is read-only. It validates the raw configuration, capability matrix,
adapter availability, manifest, managed paths, file hashes, dependency entries,
and marker structure before any backup or write is created.

Each item is classified as `CREATE`, `UPDATE`, `ALREADY_APPLIED`, `PRESERVE`,
`CONFLICT`, `MANUAL`, or `DELETE`. A tracked file is updated only when its
current hash equals the recorded hash. If it already equals the target it is
`ALREADY_APPLIED`; otherwise it is a `CONFLICT`. Marker blocks must occur exactly
once in order and without nesting. No general-purpose merge is attempted.

Legacy mode compares generated surfaces with known released renderer signatures.
It records only exact matches. An unknown dependency value, changed generated
file, missing required artifact, or malformed marker stays blocked for a human
to resolve. There is no blind adoption command.

## Transactions and Recovery

After confirmation, every affected regular file is snapshotted under a unique
`.fsd/backups/upgrade-*` directory before the first write. Paths that traverse
the root or contain a symlink are rejected. Writes are atomic sibling
temporary-file renames and preserve existing modes; hooks retain executable
permissions. Deletes are limited to verified regular files.

Validation runs before migration state is committed. If dependency changes are
introduced by a future migration, lockfiles are also snapshotted, package-manager
availability is checked, installation is shown as a separate stage, and existing
`lint`, `typecheck`, `test`, and `build` scripts are run. A failure rolls back
source, config, manifest, and snapshotted lockfiles in reverse order. A failed
rollback retains and prints the exact backup directory. `node_modules` is not
claimed to be perfectly restorable; run `<package-manager> install` afterwards.

## Compatibility

| Starting state | Frameworks | Package managers | Result |
| --- | --- | --- | --- |
| Manifest state `1` with unchanged recorded files | All five | npm, pnpm, Yarn, Bun | Applies `tooling-hardening-v1` where required. |
| Manifest state `2` with unchanged hashes | All five | npm, pnpm, Yarn, Bun | Up to date; no writes. |
| Legacy v2.3.2 renderer signatures | React + Vite, Next.js, Vue + Vite | npm, pnpm, Yarn, Bun | Creates manifest and upgrades only exact legacy Husky signatures. |
| Legacy v2.4.0 renderer signatures | Nuxt | npm, pnpm, Yarn, Bun | Same conservative manifest/tooling migration. |
| Legacy v2.5.0 renderer signatures | SvelteKit | npm, pnpm, Yarn, Bun | Same conservative manifest/tooling migration. |

Blocked or unsupported states: no reliable project root; malformed config;
schema newer than `1`; managed content whose hash/signature changed; missing or
duplicate markers; an existing non-CLI pnpm workspace policy; symlinked managed
paths; incomplete migration graph; project state newer than `2`; and downgrades.

The unit matrix covers all five framework fixtures and React + Vite under each
package manager. It covers dry-run/check read-only behavior, nested roots,
legacy mode, business-code preservation, managed-file conflicts, future/malformed
config, marker failures, dirty Git refusal, no-Git projects, path escape
rejection, manifest idempotence, and injected write rollback. Existing CI remains
the real install/build matrix for freshly generated projects. There is no real
dependency-version upgrade in this release, so an upgrade install/build E2E is
not claimed as completed.

## CLI Contract

| Invocation | Behavior |
| --- | --- |
| `upgrade` | Shows the plan and asks for confirmation when interactive. |
| `upgrade --dry-run` | Same plan and conflict analysis, zero mutations. |
| `upgrade --check` | Read-only non-interactive status: `0` current, `2` safe upgrade, `3` blocked, `4` invalid. |
| `upgrade --yes` | Applies only a conflict-free plan; never overwrites a modified file. |
| `upgrade --no-install` | Skips a future dependency-install stage. |
| `upgrade --allow-dirty` | Permits apply in a dirty Git worktree only after a warning and internal backup. |

## Extension Checklist

1. Add a deterministic renderer or marker transformation behind the relevant framework adapter boundary.
2. Add a migration with an explicit source state, target state, preconditions, and pure planner output.
3. Record only paths, regions, or package keys that the migration can prove it owns.
4. Add safe, modified, missing, malformed, symlink, and failure-injection tests.
5. Add a real released fixture and, when dependencies change, an install/build E2E row before documenting support.
