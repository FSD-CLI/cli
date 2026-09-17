# Changelog

All notable changes to `create-fsd-architecture` are documented here.

## 2.3.2 - 2026-09-17

### Fixed

- Generated `fsd-stack.ts` files now match Biome formatting, so freshly created
  Next.js projects pass their complete `npm run ci` pipeline.
- Yarn 4 projects now establish their own lockfile boundary and use the
  `node-modules` linker instead of Plug'n'Play, keeping nested project creation,
  Vite, and the generated developer tooling compatible in CI.

### Changed

- npm publishing is maintainer-only and manual. GitHub tags validate the release
  and create the GitHub Release without publishing to npm.
- CI pins Yarn 4 instead of installing the legacy Yarn Classic package.

## 2.3.1 - 2026-09-16

### Added

- `--dry-run` file and project plans that make no filesystem changes.
- Transactional `--force` replacement with rollback for projects and generated slices.
- `check`, `doctor`, and `config` project-inspection commands.
- Framework-native page route registration for React Router, Vue Router, and Next.js.
- Package-manager contract tests for npm, pnpm, Yarn, and Bun.
- Route generation, conflict protection, rollback, and structure validation tests.
- Tag-gated Trusted Publishing and automatic GitHub Release creation.

### Changed

- React + Vite projects now include React Router.
- Vue + Vite projects now include Vue Router.
- Project setup rolls back incomplete downloads, configuration, and Commitlint failures.

### Compatibility

- Node.js 20 remains the minimum supported runtime.
- Existing creation and generation syntax remains supported.
- Configuration schema version remains `1`.

## 2.3.0 - 2026-09-16

### Added

- Stable Vue 3 + Vite template support through `--framework vue-vite`.
- Vue framework adapter with Vite environment handling and dependency contracts.
- Pinia and TanStack Vue Query project configuration.
- VeeValidate 4 and Zod 3 form configuration.
- Vue-native feature, entity, widget, and page generators.
- Complete generated Vue authentication flow with five forms, API functions,
  Vue Query mutations, Zod schemas, and a Pinia auth store.
- Vue configuration and generator regression tests.

### Changed

- Framework adapters now own dependency selection and versions.
- Managed dependencies are removed and reinstalled per framework without leaking
  React packages into Vue projects.
- The project provider generator now emits Vue application plugins for Vue
  projects and React provider components for React projects.
- `fsd.config.json` schema now accepts the Vue stack values.

### Compatibility

- React + Vite and Next.js behavior remains unchanged.
- Configuration schema version remains `1`; Vue support is additive.

## 2.2.0 - 2026-09-15

### Added

- Central Template Registry for stable and planned framework templates.
- Framework Capability Matrix for API, server state, client state, forms,
  package manager, framework-owned defaults, and generator compatibility.
- React + Vite and Next.js framework adapters.
- Dedicated project lifecycle for cloning, configuration, Git, Husky,
  Commitlint, and dependency installation.
- `--help`, `--version`, and `--list-templates` commands.
- `--framework`, `--yes`, `--no-install`, and `--no-start` creation options.
- Planned registry entries for Vue + Vite, Nuxt, and SvelteKit.
- CLI, registry, capability, adapter, path-safety, and lifecycle tests.

### Changed

- Reduced the CLI entrypoint to command parsing and routing.
- Moved reusable generator primitives and basic slice generators into dedicated
  modules.
- Made generated API clients and client directives adapter-driven.
- Made the generator validate framework capabilities before writing files.
- Added path containment checks for generated project directories.
- Added cleanup for incomplete template clones.

### Compatibility

- Existing interactive project creation remains supported.
- Existing `--generate` and `-g` syntax remains supported.
- `fsd.config.json` stays on schema version 1.
- React + Vite and Next.js template repository contracts remain unchanged.
