# Changelog

All notable changes to `create-fsd-architecture` are documented here.

## 2.6.0 - 2026-09-26

### Added

- Safe `upgrade` command with read-only planning, ownership manifests, conflict
  detection, transactional rollback, and CI-friendly status codes.
- Upgrade documentation, compatibility guidance, and a responsible disclosure
  policy.

### Fixed

- Revalidate every planned write immediately before applying it, preventing a
  stale interactive plan from overwriting files changed after review.
- Serialize ownership manifests in a format accepted by the Next.js template's
  Biome configuration.
- Refresh Redux store ownership after CLI-generated reducer registration.
- Allow an FSD project to live below a package-only workspace root while still
  rejecting conflicting nested FSD roots.
- Report missing required FSD layers as invalid during `upgrade --check`.
- Preserve dependency versions that the ownership manifest deliberately leaves
  unmanaged, including newer template-provided Commitlint releases.

## 2.5.1 - 2026-09-23

### Fixed

- Failed dependency installation now exits nonzero, preserves its diagnostic,
  and rolls back new or forced project creation.
- Generated Git hooks stop on lint, staged/unstaged whitespace, or build errors.
- Numeric-leading slice names are rejected before files are written.
- Generic React-family view formatting now matches the Next.js template's
  formatter for the audited feature and widget output.
- Interactive defaults match each framework's unattended defaults.
- `--yes` requires an explicit project name and framework rather than prompting
  or silently exiting without creating a project.
- New pnpm projects have framework-scoped build-script approvals for pnpm
  10.26+ and 11; existing workspace policies remain untouched.

### Tests

- Added rollback and behavioral Git-hook regression tests, numeric-name checks
  across all frameworks, and interactive-default parity checks.
- CI framework smoke tests now generate every slice type plus auth; added
  React/Nuxt build-policy coverage on pnpm 10.26 and 11.

## 2.5.0 - 2026-09-19

### Added

- Stable Svelte 5 and SvelteKit 2 template support through
  `--framework sveltekit`.
- SvelteKit framework adapter with Fetch and Axios clients backed by
  `PUBLIC_API_BASE`.
- Request-scoped TanStack Svelte Query v6 provider generation.
- Svelte store, SvelteKit Superforms, and Zod 4 capability contracts.
- Svelte-native feature, entity, widget, page, and complete auth generators.
- SvelteKit file-based page route wrappers in `src/routes`.
- SvelteKit coverage in the configuration schema, smart stack matrix, project
  inspection, and framework build CI.

### Changed

- SvelteKit is promoted from planned to stable in the Template Registry.
- The default SvelteKit API client is native Fetch while Axios remains optional.
- Framework build CI now validates all five stable templates.

### Compatibility

- React + Vite, Next.js, Vue + Vite, and Nuxt behavior remains unchanged.
- Configuration schema version remains `1`; SvelteKit support is additive.
- Generated SvelteKit projects require Node.js 22.22.2 or later.

## 2.4.0 - 2026-09-19

### Added

- Stable Nuxt 4 template support through `--framework nuxt`.
- Nuxt framework adapter with an `app/`-rooted Feature-Sliced Design structure.
- Nuxt-native `$fetch` and Axios API clients backed by public runtime config.
- Pinia and VeeValidate module configuration with deterministic marker updates.
- TanStack Vue Query SSR hydration through a generated Nuxt plugin.
- Nuxt-native page generation through file-based route wrappers in
  `app/app/routes`.
- Nuxt coverage in the capability matrix, configuration schema, smart stack
  matrix, project inspection, and framework build CI.

### Changed

- Framework-owned source directories now control generated shared config and API
  paths instead of assuming every framework uses `src/`.
- Nuxt defaults to native Fetch while retaining Axios as an opt-in choice.

### Compatibility

- React + Vite, Next.js, and Vue + Vite behavior remains unchanged.
- Configuration schema version remains `1`; Nuxt support is additive.
- Generated Nuxt projects require Node.js 22.22.2 or later.

## 2.3.2 - 2026-09-17

### Fixed

- Generated `fsd-stack.ts` files now match Biome formatting, so freshly created
  Next.js projects pass their complete `npm run ci` pipeline.
- Yarn 4 projects now establish their own lockfile boundary and use the
  `node-modules` linker instead of Plug'n'Play, keeping nested project creation,
  Vite, and the generated developer tooling compatible in CI.
- The initial Yarn install can populate a new lockfile even when the CLI itself
  runs inside an immutable CI environment.

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
