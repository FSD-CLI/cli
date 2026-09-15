# create-fsd-architecture

Scaffold production-ready projects with [Feature-Sliced Design](https://feature-sliced.design/) architecture in seconds.

![npm](https://img.shields.io/npm/v/create-fsd-architecture)

![downloads](https://img.shields.io/npm/dw/create-fsd-architecture)

📚 Documentation: https://fsd-docs.vercel.app

🚀 GitHub: https://github.com/FSD-CLI/cli


## Features

- **FSD Architecture** — Pre-configured layers: app, pages, widgets, features, entities, shared
- **One-time stack setup** — Choose API, state, forms, and package manager once
- **In-project Generators** — Add FSD slices to existing projects
- **Multiple Templates** — Choose from available project templates (more coming soon)
- **Zero Config** — Start coding immediately with sensible defaults
- **TypeScript** — Full TypeScript support out of the box

## Quick Start

```bash
npx create-fsd-architecture@latest my-app
```

Or with a specific package manager:

```bash
npm create fsd-architecture@latest my-app
```

Generate slices inside an existing project:

```bash
npx create-fsd-architecture --generate feature auth
```

## Usage

### Interactive Mode

```bash
npx create-fsd-architecture@latest
```

The CLI will guide you through:

1. **Project name** — Name your project
2. **Template selection** — Choose your framework
3. **Stack selection** — Axios or Fetch, React Query, Zustand or Redux, and forms
4. **Package manager** — npm, pnpm, Yarn, or Bun
5. **Install dependencies** — Optionally install packages
6. **Start dev server** — Optionally launch the development server

### With Arguments

```bash
npx create-fsd-architecture@latest my-app
```

Pass the project name directly to skip the name prompt.

### Generate FSD Slices

```bash
npx create-fsd-architecture --generate <type> <name>
npx create-fsd-architecture -g feature auth
```

Allowed types:

- `feature`
- `entity`
- `widget`
- `page`

The generator writes into `src/features`, `src/entities`, `src/widgets`, or `src/pages` when `src/` exists. Otherwise, it writes to root-level FSD folders. Existing slices are protected by default; pass `--force` to overwrite one.

The selected stack is stored in `fsd.config.json`. Generators read it
automatically, so they never ask which API or state tool to use again. Generating
`feature auth` creates login, registration, forgot-password, reset-password, and
verification-code flows together. With the default forms stack it also creates
typed React Hook Form components and Zod validation schemas wired to the generated
React Query mutations.

Examples:

```bash
npx create-fsd-architecture --generate feature auth
npx create-fsd-architecture --generate entity product
npx create-fsd-architecture --generate widget navbar
npx create-fsd-architecture --generate page checkout
```

## Available Templates

| Template | Status |
| --- | --- |
| React + Vite | Available |
| Next.js | Available |

## Project Structure

Projects are scaffolded with the FSD architecture:

```
src/
├── app/          # App-level setup: providers, routing, styles
├── pages/        # Full pages composed from widgets and features
├── widgets/      # Large self-contained UI blocks
├── features/     # User interactions and actions
├── entities/     # Business entities and their representations
└── shared/       # API, assets, config, utilities, types, and UI kit
```

Every layer and its core segments are created up front. Empty architectural
folders contain documentation placeholders so the complete structure survives
Git clones.

## Requirements

- Node.js 20 or later

## License

MIT
