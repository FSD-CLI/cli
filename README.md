# create-fsd-architecture

Create production-ready frontend projects with a complete
[Feature-Sliced Design](https://feature-sliced.design/) structure.

[![npm](https://img.shields.io/npm/v/create-fsd-architecture)](https://www.npmjs.com/package/create-fsd-architecture)
[![downloads](https://img.shields.io/npm/dw/create-fsd-architecture)](https://www.npmjs.com/package/create-fsd-architecture)

- Documentation: https://fsd-docs.vercel.app
- GitHub: https://github.com/FSD-CLI/cli

## Repository documentation

- [Changelog](./docs/CHANGELOG.md)
- [Safe upgrade architecture](./docs/UPGRADE-ARCHITECTURE.md)
- [Public documentation outline](./docs/PUBLIC-DOCUMENTATION-OUTLINE.md)
- [Security policy](./SECURITY.md)

## Quick start

```bash
npx create-fsd-architecture@latest my-app
```

The interactive flow selects the framework, API client, server state, client
state, forms stack, package manager, dependency installation, and optional dev
server startup.

For CI, demos, and repeatable local automation:

```bash
npx create-fsd-architecture@latest my-app \
  --framework react-vite \
  --yes \
  --no-install \
  --no-start
```

## Commands

```bash
# Show all options
npx create-fsd-architecture@latest --help

# Show the installed CLI version
npx create-fsd-architecture@latest --version

# Discover stable and planned templates
npx create-fsd-architecture@latest --list-templates

# Generate inside an existing project
npx create-fsd-architecture@latest --generate feature auth
npx create-fsd-architecture@latest -g entity product

# Preview creation or generation without writing files
npx create-fsd-architecture@latest my-app --framework vue-vite --yes --dry-run
npx create-fsd-architecture@latest -g page settings --dry-run

# Inspect an existing FSD project
npx create-fsd-architecture@latest check
npx create-fsd-architecture@latest doctor
npx create-fsd-architecture@latest config

# Safely inspect or migrate CLI-owned tooling in an existing project
npx create-fsd-architecture@latest upgrade --dry-run
npx create-fsd-architecture@latest upgrade --check
npx create-fsd-architecture@latest upgrade --yes --no-install
```

Create options:

| Option | Purpose |
| --- | --- |
| `-f, --framework <id>` | Skip the framework prompt |
| `-y, --yes` | Accept framework defaults without prompts; requires a project name and `--framework` |
| `--package-manager <id>` | Select npm, pnpm, Yarn, or Bun non-interactively |
| `--api-client <id>` | Select Axios or native Fetch |
| `--server-state <id>` | Override the framework server-state choice |
| `--client-state <id>` | Override the framework client-state choice |
| `--forms <id>` | Override the framework forms choice |
| `--no-install` | Do not install dependencies |
| `--no-start` | Do not start the development server |
| `--dry-run` | Print the complete plan without changing files |
| `--force` | Replace an existing target; restore it if cloning, setup, or installation fails |

## Safe upgrades

`upgrade` evolves only tooling that the CLI can prove it owns. It never
re-scaffolds a project and never rewrites feature, entity, widget, page,
component, style, route implementation, environment file, secret, custom script,
or unrelated dependency.

```bash
# Inspect the complete plan. This is always read-only.
npx create-fsd-architecture@latest upgrade --dry-run

# CI status check. It is always non-interactive and read-only.
npx create-fsd-architecture@latest upgrade --check

# Apply only a conflict-free plan without prompting.
npx create-fsd-architecture@latest upgrade --yes

# Apply source/configuration changes without dependency installation.
npx create-fsd-architecture@latest upgrade --yes --no-install

# Apply after explicitly accepting the risk of a dirty Git worktree.
npx create-fsd-architecture@latest upgrade --allow-dirty
```

The command locates the nearest reliable project root from nested directories,
then prints the selected root, migration path, every create/update/preserve/
conflict/manual action, and validations. `--dry-run` and `--check` do not create
backups, manifests, logs, lockfiles, or temporary project files.

New projects contain `.fsd/manifest.json`, an atomically written ownership
manifest. It records SHA-256 hashes only for CLI-owned files, marker regions, and
specific managed dependency entries. It contains no environment values, secrets,
or `node_modules` data. A changed tracked file or marker is a conflict, not an
overwrite permission. There is intentionally no `--force` or blind `--adopt`
mode for upgrades.

Projects created before the manifest use conservative legacy mode. The CLI adopts
only exact released signatures for generated artifacts, managed dependencies, and
Nuxt marker regions. Missing, custom, or ambiguous managed paths are reported as
`CONFLICT` or `MANUAL`; resolve them before retrying. Application code outside
CLI-owned surfaces remains untouched byte-for-byte.

By default an apply is refused in a dirty Git worktree. `--dry-run` and `--check`
remain available. `--allow-dirty` prints a warning and uses the internal
affected-path backup; the command never resets, stashes, commits, switches
branches, or otherwise changes Git state. Projects without Git are supported.

Before writes, upgrade snapshots every affected regular file under
`.fsd/backups/`. Writes use sibling temporary files and atomic rename, preserve
hook permissions, reject traversal and symlinked managed paths, and roll back in
reverse order on an error. The backup is retained after a failed upgrade and its
location is printed. If dependency installation failed, source/configuration,
manifest, and lockfile paths are restored; run the selected package manager's
`install` command to restore `node_modules`.

`upgrade --check` exit codes are stable for CI:

| Code | Meaning |
| --- | --- |
| `0` | Project is current |
| `2` | A conflict-free upgrade is available |
| `3` | Conflicts or manual work block an upgrade |
| `4` | Project state or configuration is unsupported or invalid |

The first managed-state release supports clean signature-matching projects from
the tested React + Vite, Next.js, Vue + Vite, Nuxt, and SvelteKit stacks using
npm, pnpm, Yarn, or Bun. It installs the ownership manifest, hardens verified
legacy Husky hooks, and adds the CLI-owned pnpm build policy only when the path
does not already exist. No dependency version migration is currently declared;
the installer runs only when a future migration changes managed dependencies.
See [the upgrade architecture](./docs/UPGRADE-ARCHITECTURE.md) for the exact
compatibility table, recovery guidance, and extension rules.

For pnpm, use **10.26 or newer** (pnpm 11 also requires Node 22+).
New pnpm projects receive a framework-specific `allowBuilds` list in
`pnpm-workspace.yaml`. Only the listed build dependencies may execute scripts;
unreviewed scripts fail installation instead of being silently trusted.
An existing template-owned workspace policy is preserved. Review additional
dependencies with `pnpm approve-builds`; no global approval settings are changed.
See the [pnpm build settings](https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md#allowbuilds).

If installation fails, the CLI exits nonzero and rolls back the target. To review
package-manager policy before installing, create with `--no-install`, then run
the selected manager manually inside the generated project.

Generator types:

- `feature`
- `entity`
- `widget`
- `page`

Existing slices are protected. Use `--force` only when you intentionally want
to replace a slice. Page generators also register framework-native routes:
React Router for React + Vite, Vue Router for Vue + Vite, and App Router route
files for Next.js. Nuxt and SvelteKit pages get thin file-based route wrappers
without turning FSD page slices into route directories.

## Templates

| Template ID | Framework | Status |
| --- | --- | --- |
| `react-vite` | React + Vite | Stable |
| `nextjs` | Next.js App Router | Stable |
| `vue-vite` | Vue + Vite | Stable |
| `nuxt` | Nuxt 4 | Stable |
| `sveltekit` | SvelteKit | Stable |

Vue and Nuxt projects use Pinia, TanStack Vue Query, VeeValidate, and Zod
through framework-native modules, providers, and generators. Nuxt defaults to
its native `$fetch` client and includes SSR hydration for Vue Query.

SvelteKit projects use Svelte 5 runes, TanStack Svelte Query, Svelte stores,
SvelteKit Superforms, and Zod 4. They default to native Fetch and use
`PUBLIC_API_BASE` for public runtime API configuration.

## Generated architecture

```text
src/
├── app/          # App-level setup, providers, routing, and styles
├── pages/        # Route-level compositions
├── widgets/      # Large reusable UI blocks
├── features/     # User interactions and business actions
├── entities/     # Business entities and their representations
└── shared/       # API, assets, config, utilities, types, and UI
```

Nuxt uses the same complete layers under its official `app/` source directory.
Its file-based route wrappers live in `app/app/routes`, separate from the FSD
`app/pages` layer.

SvelteKit keeps the layers under `src/` and reserves `src/routes` for thin
file-based route wrappers. Because SvelteKit owns the `$app` alias, generated
projects use `$fsd-app` for the FSD app layer and layer-specific aliases such as
`$pages` and `$shared` everywhere else.

Every layer and its core segments exist from day one. Documentation placeholders
keep empty architectural folders present across Git clones.

## Project configuration

The selected stack is saved once in `fsd.config.json`. Generators read this file
automatically and do not ask the developer to choose the stack again.

```json
{
  "$schema": "https://raw.githubusercontent.com/FSD-CLI/cli/main/schema/fsd.config.schema.json",
  "schemaVersion": 1,
  "packageManager": "npm",
  "apiClient": "axios",
  "serverState": "react-query",
  "clientState": "zustand",
  "forms": "react-hook-form-zod",
  "ui": "shared-ui",
  "framework": "react-vite"
}
```

Generating `feature auth` creates login, registration, forgot-password,
reset-password, and verification-code flows together. With the default stack it
also generates typed React Hook Form components, Zod schemas, React Query
mutations, and the selected client-state integration.

## Core architecture in 2.2

The CLI runtime is split into stable boundaries:

```text
bin/
├── cli/                  # Argument parsing and terminal output
├── commands/             # User-facing workflows
├── core/
│   ├── frameworks/       # Runtime-specific adapters
│   ├── capability-matrix.mjs
│   ├── template-registry.mjs
│   ├── package-managers.mjs
│   └── project-lifecycle.mjs
└── generators/           # Reusable generator building blocks
```

- The Template Registry is the single source of truth for template identity,
  repository, and release status.
- The Capability Matrix prevents invalid cross-framework stack combinations.
- Framework Adapters own environment variables and client-component behavior.
- Project Lifecycle owns cloning, configuration, Git, Husky, Commitlint, and
  installation behavior.
- The CLI entrypoint only parses and routes commands.

This separation allows React, Next.js, Vue, Nuxt, and SvelteKit to share one CLI
lifecycle while keeping framework-native providers and generated components.

## Requirements

- Node.js 20 or later for the CLI
- Node.js 22.22.2 or later for generated Nuxt and SvelteKit projects

## Development

```bash
npm install
npm test
npm run check
```

## Releases

npm publishing is a manual maintainer-only step. Pushing a version tag runs the
release checks and creates a GitHub Release, but it never publishes to npm.

## License

MIT

## Support FSD CLI

If this project helps you, you can optionally support its development:

- [Buy Me a Coffee](https://buymeacoffee.com/ashrafqopiah)
- **InstaPay (Egypt):** `ashrafmo-1`

For InstaPay, use the username exactly as shown and verify the recipient details
in the app before confirming a transfer. Donations are optional.
