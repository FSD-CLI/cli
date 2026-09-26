# Public Documentation Outline: Safe Project Upgrades

This outline is ready to copy into the public documentation repository. It does
not require edits to that repository as part of this CLI change.

## Page Title

Safely upgrading an existing FSD CLI project

## Introduction

- Explain that `upgrade` migrates only CLI-owned configuration and tooling.
- State that it never re-scaffolds a project or rewrites business code.
- Link to Feature-Sliced Design ownership boundaries.

## Command Reference

- `npx create-fsd-architecture@latest upgrade`
- `upgrade --dry-run`
- `upgrade --check`
- `upgrade --yes`
- `upgrade --no-install`
- `upgrade --allow-dirty`
- State explicitly that there is no `--force`, `--adopt`, or downgrade mode.

## Plan Output

- Explain `CREATE`, `UPDATE`, `ALREADY_APPLIED`, `PRESERVE`, `CONFLICT`, `MANUAL`, and `DELETE`.
- Include one safe dry-run terminal example.
- Include one managed-file conflict terminal example and manual resolution steps.
- Explain that `--yes` never overrides conflicts.

## Ownership and Safety

- Introduce `.fsd/manifest.json` and SHA-256 ownership checks.
- List CLI-owned surfaces: generated stack/API/provider files, precise marker regions, managed dependency keys, verified hooks, Commitlint, and package-manager policy.
- List user-owned surfaces: slices, routes, components, styles, environment files, custom scripts, unrelated dependencies, and Git history.
- Explain why unknown ownership is treated as a conflict.

## Legacy Projects

- Explain visible conservative legacy mode for projects without a manifest.
- List tested release/signature starting states by framework.
- Explain that exact signatures can be adopted into a new manifest, while customized generated files require manual work.
- Include a legacy success example and an ambiguous legacy example.

## CI and Exit Codes

- Show `upgrade --check` usage in CI.
- Document exit codes: `0` current, `2` safe upgrade available, `3` blocked by conflicts/manual work, `4` invalid/unsupported state.
- State that check and dry-run do not mutate the filesystem or Git status.

## Git, Backup, and Recovery

- Explain clean-worktree default and `--allow-dirty` warning.
- State that the command never reset/stashes/commits/switches branches.
- Explain internal `.fsd/backups/` snapshots, atomic writes, rollback, and symlink/traversal refusal.
- Provide recovery steps: read printed backup path, inspect the error, run `<package-manager> install` after an install failure, then re-run `upgrade --dry-run`.
- State that `node_modules` is not promised to be perfectly restored.

## Compatibility Matrix

- React + Vite, Next.js, Vue + Vite, Nuxt, and SvelteKit rows.
- npm, pnpm, Yarn, and Bun columns.
- Distinguish unit signature coverage from real install/build E2E coverage.
- Document blocked states and no-downgrade policy.

## Troubleshooting

- Missing `fsd.config.json` or `package.json`.
- Nested conflicting project roots.
- Future/invalid schema version.
- Changed managed file or dependency entry.
- Missing/duplicate Nuxt markers.
- Dirty Git worktree.
- Symlinked managed path.
