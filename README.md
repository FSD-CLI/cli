# create-fsd-architecture

Create production-ready frontend projects with a complete
[Feature-Sliced Design](https://feature-sliced.design/) structure.

[![npm](https://img.shields.io/npm/v/create-fsd-architecture)](https://www.npmjs.com/package/create-fsd-architecture)
[![downloads](https://img.shields.io/npm/dw/create-fsd-architecture)](https://www.npmjs.com/package/create-fsd-architecture)

- Documentation: https://fsd-docs.vercel.app
- GitHub: https://github.com/FSD-CLI/cli

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
```

Create options:

| Option | Purpose |
| --- | --- |
| `-f, --framework <id>` | Skip the framework prompt |
| `-y, --yes` | Accept the default stack and skip interactive prompts |
| `--package-manager <id>` | Select npm, pnpm, Yarn, or Bun non-interactively |
| `--api-client <id>` | Select Axios or native Fetch |
| `--server-state <id>` | Override the framework server-state choice |
| `--client-state <id>` | Override the framework client-state choice |
| `--forms <id>` | Override the framework forms choice |
| `--no-install` | Do not install dependencies |
| `--no-start` | Do not start the development server |
| `--dry-run` | Print the complete plan without changing files |
| `--force` | Replace an existing target with automatic rollback on failure |

Generator types:

- `feature`
- `entity`
- `widget`
- `page`

Existing slices are protected. Use `--force` only when you intentionally want
to replace a slice. Page generators also register framework-native routes:
React Router for React + Vite, Vue Router for Vue + Vite, and App Router route
files for Next.js.

## Templates

| Template ID | Framework | Status |
| --- | --- | --- |
| `react-vite` | React + Vite | Stable |
| `nextjs` | Next.js App Router | Stable |
| `vue-vite` | Vue + Vite | Stable |
| `nuxt` | Nuxt | Planned |
| `sveltekit` | SvelteKit | Planned |

Vue projects use Pinia, TanStack Vue Query, VeeValidate, and Zod through
framework-native providers and generators. Planned templates are registered in
the CLI without being presented as available.

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

This separation allows React, Next.js, and Vue to share one CLI lifecycle while
keeping framework-native providers and generated components. Nuxt and SvelteKit
remain planned.

## Requirements

- Node.js 20 or later

## Development

```bash
npm install
npm test
npm run check
```

## License

MIT
