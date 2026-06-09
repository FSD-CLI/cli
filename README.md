# create-fsd-architecture

Scaffold production-ready projects with [Feature-Sliced Design](https://feature-sliced.design/) architecture in seconds.

![npm](https://img.shields.io/npm/v/create-fsd-architecture)

![downloads](https://img.shields.io/npm/dw/create-fsd-architecture)

📚 Documentation: https://fsd-docs.vercel.app

🚀 GitHub: https://github.com/FSD-architectures/cli


## Features

- **FSD Architecture** — Pre-configured layers: app, pages, widgets, features, entities, shared
- **Interactive CLI** — Guided setup with project name, template selection, and dependency installation
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
3. **Install dependencies** — Optionally install packages
4. **Start dev server** — Optionally launch the development server

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
| Next.js | Coming Soon |

## Project Structure

Projects are scaffolded with the FSD architecture:

```
src/
├── app/          # App-level setup: providers, routing, styles
├── pages/        # Full pages composed from widgets and features
├── widgets/      # Large self-contained UI blocks
├── features/     # User interactions and actions
├── entities/     # Business entities and their representations
└── shared/       # Reusable utilities, UI kit, configs
```

## Requirements

- Node.js 18 or later

## License

ISC
