# Changelog

All notable changes to `create-fsd-architecture` are documented here.

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
