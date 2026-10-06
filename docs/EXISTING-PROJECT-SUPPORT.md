# Existing-project support policy

Approved by the project owner on 2026-10-06. Owner: FSD CLI maintainers.

## Official support

Existing applications on React/Vite, Next.js App Router, Vue/Vite, Nuxt and
SvelteKit are supported for architecture audit, migration planning and guided,
incremental migration with a compatible coding agent. The application need not
have been created by FSD CLI. Angular CLI integration remains planned.

| Project state | Supported workflow | Write boundary |
| --- | --- | --- |
| Existing non-FSD application | Audit, migration map, guided refactor | Explicitly requested application scope; no blind adoption |
| Existing compatible FSD application | Inspect; preview compatible generators | Verified root/config/framework and explicit target slices |
| Project with a valid CLI ownership manifest | Managed upgrade | Only verified CLI-owned surfaces |
| Recognized historical CLI project | Conservative upgrade plan | Exact known signatures; conflicts remain manual |
| Unknown framework, ambiguous roots or failed baseline | Audit and diagnostics | Resolve uncertainty before dependent writes |

## Guided migration contract

1. Identify framework, source roots, workspace boundaries, routes, aliases,
   import graph, state, API clients, forms, public APIs and existing tests.
2. Record baseline commands, versions, working directory and exit codes for
   lint, types, tests and build. Existing failures remain visible; never claim
   preserved behavior without adequate verification.
3. Produce a migration map: current path, target layer/slice, business reason,
   consumers, route/API impact, risk and verification commands.
4. Work on one domain or route at a time, within the user's authorized scope.
   Ask about ambiguous ownership or behavior changes; do not repeatedly request
   permission already granted for the same scope.
5. Preserve application contracts, SSR/client boundaries, locale behavior,
   routes, state semantics and integrations. Add public APIs and update imports
   together; check circular/deep imports after each batch.
6. Validate the batch against the recorded baseline. Retain a reversible commit
   or backup; revert the batch if a regression cannot be resolved.
7. Report changed paths, passing/failing checks and remaining gaps separately.

## CLI boundaries

There is no arbitrary-application `init` or `migrate` command. Guided migration
uses reviewed agent edits, not an invented CLI operation. Never scaffold over
an existing application's root or use `--force` as an upgrade mechanism.

Do not create an ownership manifest for unverified business code. A compatible
`fsd.config.json` is configuration, not proof of ownership. Read-only `check`,
`config` and `doctor` can assist inspection, but inferred framework/defaults do
not certify arbitrary applications; verify their root and files independently.
Use generator dry-runs only after confirming the FSD contract. Managed upgrade
must preserve every unowned file and stop on conflicts.

## Delivery boundary

This policy defines official support and its current guided workflow. Expanded
root diagnostics are Task 17. A packaged migration planner and representative
legacy-project/rollback validation remain Task 37; no release date or one-click
conversion guarantee is implied.

## Verified compatible-project inspection

Five fixture tests cover non-CLI compatible FSD projects without a configuration
or ownership manifest: `config`, `doctor` and generator dry-runs agree on the
framework and preserve existing package/business files without adopting them.
These tests do not validate arbitrary application refactoring or custom roots;
those remain the guided-workflow and Task 17/37 boundaries above.
