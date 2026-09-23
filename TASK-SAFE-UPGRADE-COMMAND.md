# Task: Safe Upgrade Command for Existing FSD CLI Projects

## Objective

Add a production-safe upgrade system for projects previously created by `create-fsd-architecture`.

The new command should let a developer run:

```bash
npx create-fsd-architecture@latest upgrade
```

and receive a clear upgrade plan for CLI-managed configuration and tooling without overwriting application code or silently destroying user changes.

This is not a project re-scaffold command. It must be a versioned, transactional migration system with ownership tracking, conflict detection, dry-run support, backups, rollback, and framework-aware validation.

## Why this is needed

Today, the CLI can create a project and generate slices, but it does not have a safe way to evolve an existing generated project when:

- The CLI configuration schema changes.
- Managed dependencies change.
- Generated tooling or provider contracts change.
- A framework adapter needs a compatible structural update.
- Husky, Commitlint, aliases, or package-manager configuration changes.
- A bug is fixed in a CLI-owned generated artifact.

Users must not be asked to create a fresh project and manually move their application code whenever the CLI evolves.

## Repository and architecture constraints

- Repository: `create-fsd-architecture`
- Preserve the existing separate-template-repository and clone-based creation architecture.
- Do not convert the ecosystem into a monorepo.
- Continue using `fsd.config.json` as the project's stack contract.
- Continue supporting:
  - React + Vite
  - Next.js
  - Vue + Vite
  - Nuxt
  - SvelteKit
- Continue supporting npm, pnpm, Yarn, and Bun.
- Reuse the current framework adapters, capability matrix, package-manager abstraction, and project lifecycle boundaries where appropriate.
- Do not implement upgrade behavior as one large framework-specific conditional inside `bin/index.mjs`.

## Core safety principles

The implementation must follow these rules:

1. **User application code is not CLI-owned.**
2. **No destructive write is allowed before a complete upgrade plan exists.**
3. **Dry-run must perform zero filesystem mutations.**
4. **Unknown or ambiguous ownership must be treated as a conflict, not as permission to overwrite.**
5. **A modified managed file must not be replaced silently.**
6. **Every migration must be versioned, deterministic, and testable in isolation.**
7. **Partial upgrades must roll back automatically.**
8. **The command must report exactly what changed, what was preserved, what conflicted, and what remains manual.**
9. **The command must never use Git as the only backup mechanism.**
10. **The first release must prefer refusing an unsafe change over guessing.**

## Required command interface

Support the following forms:

```bash
# Inspect and interactively apply an available upgrade
create-fsd-architecture upgrade

# Show the complete plan without changing files
create-fsd-architecture upgrade --dry-run

# Check whether the project is up to date; useful in CI
create-fsd-architecture upgrade --check

# Apply without interactive confirmation when there are no conflicts
create-fsd-architecture upgrade --yes

# Update files but do not install dependencies
create-fsd-architecture upgrade --no-install

# Allow operation in a dirty Git worktree after an explicit warning
create-fsd-architecture upgrade --allow-dirty
```

Optional only if the migration architecture genuinely supports it:

```bash
create-fsd-architecture upgrade --to <supported-version>
```

Do not expose `--to` if it gives a false impression that arbitrary historical versions are supported.

Do not add a generic `--force` flag to the first version of this command. Conflicts must remain explicit and safe.

## CLI behavior

### Default `upgrade`

The command should:

1. Locate the project root.
2. Load and validate `fsd.config.json`.
3. Read the upgrade ownership manifest when present.
4. Determine the project's known CLI/config state.
5. Select an ordered migration path to the version supported by the running CLI.
6. Inspect the current filesystem without writing.
7. Build a complete change plan.
8. Detect modified managed files and ownership conflicts.
9. Display the plan and warnings.
10. Refuse to apply while unresolved conflicts exist.
11. Ask for confirmation when interactive.
12. Create an internal backup of every affected path.
13. Apply migrations transactionally.
14. Validate the resulting project.
15. Install dependencies only when requested and safe.
16. Commit the migration state only after validation succeeds.
17. Roll back affected files if any required step fails.
18. Print a final summary and manual follow-up commands.

### `upgrade --dry-run`

Must:

- Produce the same plan and conflict analysis as a real upgrade.
- Show each proposed create, update, delete, dependency, and manual action.
- Show concise text diffs for managed text files where practical.
- Print the migration path.
- Print the validations that would run.
- Avoid creating backup directories, logs, manifests, lockfiles, temp files, or cache files.
- Leave Git status and filesystem metadata unchanged.

### `upgrade --check`

Must be non-interactive and read-only.

It should distinguish:

- Project is already current.
- A safe upgrade is available.
- Upgrade is available but conflicts require human action.
- Project state/configuration is unsupported or invalid.

Define and document stable exit codes so CI can distinguish these states. Do not print an error and still return exit code `0`.

### `upgrade --yes`

- May apply only when the complete plan has no conflicts.
- Must fail instead of prompting if human input would be required.
- Must not imply consent to overwrite modified files.

## Project root discovery

The command should work when invoked from the project root or a nested directory.

Root discovery must:

- Walk upward looking for `fsd.config.json` and `package.json`.
- Stop at the filesystem root.
- Detect conflicting nested project roots.
- Print the selected project root before applying changes.
- Refuse to operate when no reliable project root exists.

Do not silently treat an arbitrary directory as React + Vite during an upgrade.

## Ownership manifest

Introduce a dedicated CLI-owned state file, proposed as:

```text
.fsd/manifest.json
```

The exact name may change during the design review, but the responsibility must remain separate from user-authored stack choices in `fsd.config.json`.

Suggested conceptual structure:

```json
{
  "manifestVersion": 1,
  "framework": "nextjs",
  "configSchemaVersion": 1,
  "createdWithCliVersion": "2.5.0",
  "lastUpgradedWithCliVersion": "2.5.0",
  "appliedMigrations": [],
  "managedFiles": {
    "src/shared/config/fsd-stack.ts": {
      "owner": "project-config/fsd-stack",
      "contentHash": "sha256:..."
    }
  }
}
```

The final schema must be documented and JSON-schema validated.

Requirements:

- Use stable normalized relative paths.
- Reject paths that escape the project root.
- Use a deterministic cryptographic content hash such as SHA-256.
- Record only CLI-owned files or precisely CLI-owned regions.
- Do not record secrets or environment values.
- Do not include `node_modules`.
- Do not use timestamps as part of deterministic change detection.
- Update the manifest only after the full upgrade succeeds.
- Write it atomically.

## What the CLI may manage

The design must explicitly classify project surfaces.

### Safe managed surfaces

These may be upgraded when ownership and current content are verified:

- `fsd.config.json` schema migrations.
- CLI-managed dependency entries in `package.json`.
- CLI-generated `fsd-stack.ts`.
- CLI-generated API client/provider files that are tracked by the manifest and unchanged since generation.
- CLI-owned marker blocks inside framework configuration or routing files.
- CLI-generated Husky hooks.
- A Commitlint config created and still owned by the CLI.
- Package-manager configuration created by the CLI.
- The ownership manifest itself.

### User-owned surfaces

The upgrade command must not rewrite these automatically:

- Feature, entity, widget, and page business logic.
- User-created components and styles.
- Route implementations authored by the user.
- Environment files and secrets.
- Application API contracts.
- Custom package scripts not explicitly owned by the CLI.
- Custom dependencies unrelated to the CLI-managed stack.
- Git history, remotes, branches, or commits.

### Shared or ambiguous surfaces

Examples include `package.json`, framework config files, route registries, providers, and existing hooks.

For these files:

- Modify only known keys or explicit marker-delimited regions.
- Preserve property ordering where possible.
- Preserve unknown fields and user dependencies.
- Detect user edits inside the managed region.
- Treat missing markers, duplicate markers, or malformed structure as conflicts.
- Never regenerate the whole file only to change one owned section.

## Change classification

Every planned operation must have one of these statuses:

- `CREATE` — new CLI-owned file with no existing path.
- `UPDATE` — existing managed content is unchanged from its recorded base and can be updated safely.
- `ALREADY_APPLIED` — current content already matches the target.
- `PRESERVE` — user-owned content will remain untouched.
- `CONFLICT` — current content differs from the known managed base or ownership is ambiguous.
- `MANUAL` — migration requires a documented human action.
- `DELETE` — removal of a verified CLI-owned path.

Deleting a path requires stronger proof than updating it. A non-empty directory or user-modified file must never be recursively removed based only on its name.

## Conflict detection

For a manifest-tracked file:

1. Calculate the current hash.
2. Compare it with the recorded managed hash.
3. Generate the target content in memory.
4. If current equals recorded base, update is safe.
5. If current equals target, mark it already applied.
6. If current differs from both, report a conflict and preserve the file.

For marker-managed regions:

- Hash or otherwise version the managed region separately.
- Preserve all content outside the markers byte-for-byte where practical.
- A modified managed region is a conflict.
- Missing, reordered, nested, or duplicate markers are conflicts.

The first version does not need an automatic general-purpose three-way merge. A correct conflict is better than a destructive merge.

## Legacy projects without a manifest

Existing released projects may have `fsd.config.json` but no ownership manifest.

They must enter a conservative legacy mode.

Legacy mode must:

- Detect framework and stack from `fsd.config.json`.
- Inspect exact known generated signatures and marker blocks.
- Compare files with actual historical released fixtures when those fixtures are available.
- Mark a file safe only when its ownership can be proven.
- Treat edited, unknown, or ambiguous files as conflicts.
- Never assume that every file matching a familiar pathname is CLI-owned.
- Allow safe creation of new CLI-owned metadata after successful analysis.
- Clearly list files that require manual adoption or migration.

Do not add an `--adopt` mode that blindly records all existing content as CLI-owned. That would cause future upgrades to overwrite user-authored files.

## Versioned migration architecture

Create an explicit migration registry. A suggested structure is:

```text
bin/
  commands/
    upgrade-project.mjs
  upgrade/
    index.mjs
    project-root.mjs
    manifest.mjs
    planner.mjs
    transaction.mjs
    validation.mjs
    migrations/
      index.mjs
      <from>-to-<to>.mjs
```

This is a suggested boundary, not a requirement to use these exact filenames.

Each migration must declare:

- A stable migration ID.
- Source state/version range.
- Target state/version.
- Supported frameworks.
- Preconditions.
- A read-only planning function.
- The managed operations it may produce.
- Validation steps.
- Whether manual action may be required.

Migration rules:

- Migrations run in a deterministic order.
- Gaps, duplicate IDs, and cycles are rejected.
- An already-applied migration is idempotent.
- Re-running `upgrade` after success must produce an up-to-date result with no writes.
- A failed migration must not be recorded as applied.
- A newer unsupported project state must fail clearly instead of being downgraded.
- Framework-specific behavior belongs behind framework-aware migration boundaries, not scattered CLI conditionals.

## Configuration schema migrations

Build the mechanism required to migrate future `fsd.config.json` schema versions.

Do not invent a meaningless schema version bump only to demonstrate the feature. Use fixtures to test the migration engine if there is no real schema change ready to ship.

Requirements:

- Validate the source configuration before planning.
- Migrate one schema version at a time.
- Validate after each step.
- Preserve recognized user choices.
- Reject an unsupported future schema version.
- Never fall back silently to framework defaults when an old config is malformed.
- Keep the JSON Schema aligned with the accepted current configuration.

## Package dependency updates

When a migration changes managed dependencies:

- Modify only dependencies owned by the relevant framework adapter/capability.
- Preserve unrelated dependencies and devDependencies.
- Preserve unrelated scripts and package metadata.
- Explain every add, remove, move, or version change in the plan.
- Do not remove a package merely because it is no longer in the current default stack if the project config still selects it.
- Preserve the selected package manager.
- Do not leave foreign lockfiles after a successful package-manager migration.
- Treat a user modification to an explicitly managed dependency as a conflict unless the migration defines a safe compatible range.

Dependency installation must be a separate visible stage.

If installation fails:

- Report the exact command and exit status.
- Restore source/config/manifest/lockfile changes made by the upgrade where safe.
- Do not claim `node_modules` was perfectly restored unless it actually was.
- Tell the user the exact recovery command.
- Exit non-zero.

## Dirty Git worktree behavior

Default behavior:

- Detect whether the project is inside a Git repository.
- Print the current branch and dirty/clean status.
- Refuse to apply in a dirty worktree.
- Continue to allow `--check` and `--dry-run` because they are read-only.

With `--allow-dirty`:

- Print a strong warning.
- Continue only after the internal affected-path backup is ready.
- Preserve every pre-existing uncommitted change.
- Never run `git reset`, `git checkout`, `git clean`, stash, commit, or branch-changing commands.

Projects without Git must still be supported using the internal transaction and backup system.

## Transaction, backup, and rollback

Before applying any write:

- Resolve and validate every affected path.
- Reject path traversal and symlink escape outside the project root.
- Snapshot whether each affected path exists, its content, permissions, and relevant metadata.
- Create the backup inside a CLI-owned project directory or a validated temporary location.
- Ensure the backup itself is not treated as a migration input.

Application requirements:

- Write files atomically through a temporary sibling plus rename where supported.
- Never recursively delete an unresolved path.
- Preserve executable permissions for hooks.
- Do not follow symlinks outside the project.
- Roll back in reverse operation order.
- Restore created, updated, and deleted paths accurately.
- Remove the backup only after validation and manifest commit succeed.
- If rollback itself fails, retain the backup and print its exact location.

Add failure-injection tests for every transaction stage.

## Validation after upgrade

At minimum, validation must include:

- Current `fsd.config.json` validation.
- Manifest validation.
- Framework adapter availability.
- Capability matrix compatibility.
- Required FSD layers.
- Managed-file hashes.
- `package.json` readability and dependency consistency.
- Required marker integrity.
- Selected package-manager availability when installation is requested.

When dependencies are installed, run appropriate generated-project checks such as lint, typecheck, tests, and build when those scripts exist.

Validation commands must be printed before execution and their failures must be reported truthfully.

Do not mark the upgrade successful merely because files were written.

## Human-readable plan output

Example shape:

```text
FSD project upgrade

Project: /path/to/project
Framework: nextjs
Current state: CLI 2.3.x / config schema 1
Target state: CLI 2.6.x / config schema 1

UPDATE   package.json
UPDATE   src/shared/config/fsd-stack.ts
CREATE   .fsd/manifest.json
PRESERVE src/features/auth/model/auth.store.ts
CONFLICT src/shared/api/client.ts
MANUAL   Review the custom API client before continuing

0 creates, 2 safe updates, 1 preserved path, 1 conflict, 1 manual action
No files were changed.
```

Requirements:

- Use paths relative to the project root.
- Avoid dumping secrets or full environment files.
- Explain why each conflict exists.
- Show the source and target migration states.
- Clearly distinguish a successful dry-run from a successful applied upgrade.

## Test fixtures

Build representative fixtures from real released states rather than guessed folder structures.

The test set must include:

- A clean older React + Vite project.
- A clean older Next.js project.
- A Vue project.
- A Nuxt project from its first supported release.
- A SvelteKit project from its first supported release.
- A legacy project with `fsd.config.json` and no manifest.
- A project with modified managed files.
- A project with modified business code only.
- A project with malformed configuration.
- A project with an unsupported future schema version.
- A project with missing markers.
- A project with a dirty Git worktree.
- A project without Git.
- A project with symlinks attempting to escape the root.

Keep fixtures minimal enough for fast unit tests. Use a separate end-to-end matrix for real dependency installation and production builds.

## Required automated tests

### Parser and command routing

- `upgrade` is routed correctly.
- Supported upgrade flags work in either valid order.
- Unknown flags and unexpected arguments fail clearly.
- `--yes` never bypasses conflicts.
- Upgrade flags do not leak into create or generate flows.

### Root discovery

- Root invocation.
- Nested-directory invocation.
- No project root.
- Conflicting nested roots.
- Filesystem root boundary.

### Manifest

- Valid manifest read/write.
- Atomic writes.
- Schema validation.
- Stable hashes across runs.
- Invalid paths and traversal rejection.
- No secret/env capture.

### Planner

- Every operation classification.
- Deterministic ordering.
- No writes during planning.
- Exact plan equality between dry-run and apply before confirmation.
- Modified managed-file conflict.
- User-owned file preservation.
- Marker-region preservation.

### Migration graph

- Valid ordered chain.
- Missing migration step.
- Duplicate migration ID.
- Cycle detection.
- Idempotent re-run.
- Unsupported downgrade.
- Unsupported future version.

### Transaction and rollback

- Failure before first write.
- Failure after creating a file.
- Failure after updating a file.
- Failure after deleting a verified managed file.
- Failure while writing the manifest.
- Validation failure.
- Dependency-install failure.
- Rollback failure with retained recovery backup.
- Permissions restoration.
- Symlink escape prevention.

### Framework coverage

- React + Vite.
- Next.js.
- Vue + Vite.
- Nuxt.
- SvelteKit.

### Package-manager coverage

- npm.
- pnpm.
- Yarn 4.
- Bun.

## End-to-end acceptance scenarios

### Scenario 1 — Clean managed project

Given a clean project at a supported older state:

- `upgrade --dry-run` shows the correct plan and writes nothing.
- `upgrade --yes --no-install` applies the safe changes.
- The manifest records the applied migrations.
- A second run reports up to date.
- The project builds after dependency installation.

### Scenario 2 — Modified business code

Given a clean old project where feature/entity/page code was edited:

- The upgrade completes when managed surfaces are safe.
- Every edited business file remains byte-for-byte unchanged.
- The final report lists those paths as preserved or outside managed scope.

### Scenario 3 — Modified managed file

Given a CLI-generated API client or provider that the user changed:

- The plan marks a conflict.
- Default upgrade and `--yes` both refuse to overwrite it.
- No project file changes.
- The report explains the manual resolution options.

### Scenario 4 — Legacy project without manifest

- The command enters legacy mode visibly.
- Only provably owned content is considered safe.
- Ambiguous content is preserved and reported.
- No blind adoption occurs.

### Scenario 5 — Failure and rollback

Inject a failure after multiple operations:

- Every affected project file is restored.
- The old manifest/config remains authoritative.
- The migration is not recorded as applied.
- The command exits non-zero.
- Recovery information is printed.

### Scenario 6 — All frameworks

Upgrade one representative project for each supported framework, then run its real install and complete CI/build pipeline.

## Documentation requirements

Update the CLI repository documentation with:

- Upgrade command syntax.
- Read-only check and dry-run behavior.
- Ownership and conflict model.
- Dirty worktree behavior.
- Backup and rollback guarantees.
- Legacy project limitations.
- Supported starting states and framework matrix.
- Exit-code contract.
- Recovery instructions.
- Clear statement that application business code is not automatically migrated.

Do not edit the separate public documentation site in this task. Provide a ready-to-copy public documentation outline in the final handoff so that work can be assigned without creating cross-repository conflicts.

## Out of scope

- Replacing the separate template repositories with a monorepo.
- Automatically rewriting arbitrary business logic.
- Automatically resolving semantic merge conflicts.
- Framework major-version codemods unrelated to CLI-owned structure.
- Updating secrets or `.env` files.
- Changing Git remotes, branches, history, commits, or tags.
- Automatically publishing a new npm release.
- Background telemetry.
- A graphical upgrade dashboard.
- Supporting downgrade in the first release.
- Claiming support for historical versions that were not tested with real fixtures.

## Required deliverables

1. Upgrade architecture document explaining ownership, migrations, planning, transactions, and legacy mode.
2. CLI parser/help integration for the upgrade command.
3. Versioned migration registry.
4. Ownership manifest and its JSON Schema.
5. Read-only planner and conflict detector.
6. Transactional apply/backup/rollback implementation.
7. Framework-aware validation.
8. Unit and failure-injection tests.
9. End-to-end fixtures and validation matrix for all five frameworks.
10. CLI README updates.
11. Public documentation outline for the documentation team.
12. A final compatibility table listing every tested starting state and result.

## Definition of done

- [ ] `upgrade`, `upgrade --dry-run`, `upgrade --check`, `upgrade --yes`, `upgrade --no-install`, and `upgrade --allow-dirty` behave as documented.
- [ ] Dry-run and check modes cause zero filesystem mutations.
- [ ] Upgrade discovers the correct project root from nested directories.
- [ ] The ownership manifest is schema-validated and written atomically.
- [ ] Unknown ownership and modified managed files become conflicts.
- [ ] User business code is preserved byte-for-byte in automated tests.
- [ ] Package updates preserve unrelated dependencies, scripts, and metadata.
- [ ] Dirty worktrees are refused by default without changing Git state.
- [ ] Backups and rollback work under injected failures.
- [ ] Symlink and path-traversal escapes are rejected.
- [ ] A successful second run is idempotent and reports up to date.
- [ ] Legacy projects are handled conservatively without blind adoption.
- [ ] React, Next.js, Vue, Nuxt, and SvelteKit upgrade fixtures pass.
- [ ] npm, pnpm, Yarn, and Bun behavior is covered.
- [ ] Real generated projects pass their install and build pipelines after upgrade, or any unsupported starting state is explicitly documented.
- [ ] Existing create, generate, check, doctor, and config commands remain backward compatible.
- [ ] `npm test` passes.
- [ ] `npm run check` passes.
- [ ] Documentation and recovery instructions are complete.
- [ ] No unsupported capability is reported as complete.

## Final handoff

Provide:

1. Summary of architecture and user-visible behavior.
2. Exact supported starting states.
3. Exact unsupported or blocked starting states.
4. Upgrade test matrix by framework and package manager.
5. Failure-injection and rollback evidence.
6. Demonstration that modified business code is unchanged.
7. Demonstration that modified managed code becomes a conflict.
8. Example dry-run, conflict, success, and rollback terminal output.
9. Required follow-up tasks, separated by repository.
10. The public documentation outline for the documentation teammate.

