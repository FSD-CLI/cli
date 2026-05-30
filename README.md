# create-fsd-architecture

Scaffold production-ready projects with [Feature-Sliced Design](https://feature-sliced.design/) architecture in seconds.

## Features

- **FSD Architecture** — Pre-configured layers: app, pages, widgets, features, entities, shared
- **Interactive CLI** — Guided setup with project name, template selection, and dependency installation
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
