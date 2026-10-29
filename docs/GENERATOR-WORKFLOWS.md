# Generator workflows — candidate, not in npm 2.6.1

## Framework-native batch generation

```sh
node /path/to/cli/bin/index.mjs -g entity product customer --dry-run
node /path/to/cli/bin/index.mjs -g entity product customer
```

All names are normalized and preflighted before writes. A duplicate name or
existing target blocks the complete batch. If a later operation fails, earlier
slices, affected routes/store files and ownership manifest are restored.
Batch `--force` is refused; review individual replacement instead.
Normal generation still uses framework adapters and configured source roots.

## Layout widget presets

```sh
node /path/to/cli/bin/index.mjs -g widget navbar sidebar footer bottom-bar
```

The widget names `navbar`, `sidebar`, `footer` and `bottom-bar` generate an
accessible layout component (landmark element, labelled `<nav>`, list of links)
instead of the empty placeholder. Links come from an `items` prop with sample
defaults; navbar and footer also take a `brand` prop. Next.js uses `next/link`,
Nuxt uses `NuxtLink`, other frameworks use plain anchors. Vue presets are named
`AppNavbar`, `AppSidebar`, `AppFooter` and `AppBottomBar` to satisfy Vue's
multi-word component rule. Styling, icons, active-route state and mounting the
widget in a layout stay with the project. Any other widget name keeps the
generic placeholder.

## Shared layer: ui and api

```sh
node /path/to/cli/bin/index.mjs -g shared ui                 # button, input, label, card
node /path/to/cli/bin/index.mjs -g shared ui button input
node /path/to/cli/bin/index.mjs -g shared api
node /path/to/cli/bin/index.mjs -g shared ui --dry-run
```

`shared ui` generates unstyled primitives into `<source>/shared/ui` (React:
`button.tsx` → `Button`; Vue/Svelte: `AppButton.vue`/`AppButton.svelte`).
`shared api` generates `<source>/shared/api/client.ts` exporting `apiClient` for
the configured client: Axios, a typed fetch wrapper, or `$fetch` with
`runtimeConfig.public.apiBase` on Nuxt. The base URL uses the framework's public
variable (`VITE_API_URL`, `NEXT_PUBLIC_API_URL`, `PUBLIC_API_BASE`).

Existing files are never overwritten: they are reported as `KEEP`, and only
export lines for newly created files are appended to the segment `index.ts`.
Starter templates already ship `shared/api/client.ts` and some ui files, so on a
fresh project these commands mainly fill gaps. `--force` is refused.

Forgot-password is part of `-g feature auth` (forgot, reset and verify-code
forms, schemas and API stubs on every supported framework); it is not a separate
generator.

## Structure-only segments and custom roots

```sh
node /path/to/cli/bin/index.mjs -g feature cart --segments ui,api,model --root src/lib
node /path/to/cli/bin/index.mjs -g entity product customer --segments ui,api --root src
node /path/to/cli/bin/index.mjs -g shared --segments ui,lib --root src
node /path/to/cli/bin/index.mjs -g app --segments providers --root src
```

`--segments` selects a separate structure-only mode: missing directories and empty
TypeScript public APIs are created. Existing files, index contents and segments
are preserved. This mode generates no framework components, routes, store
registration, API implementation, environment values or ownership adoption.
For shared/app, supply segments without slice names. Segment names and slice
names use lowercase letters, digits and hyphens, starting with a letter.
Specify comma-separated segments as one argument. Slice groups are not part of
this new contract. Add `--dry-run` to preview without writes.

`--root` is a source directory relative to the working directory or an explicit
absolute path. It requires `--segments`; custom-root framework-native route and
alias rewriting is not supported. Without a root, CLI config chooses the adapter
source directory; otherwise use src, or app when its existing features directory
identifies an app-rooted project. Symlink paths and file/directory collisions
are rejected before writes. `--force` and `--auth-provider` are incompatible
with this mode. Install and configure your own imports and tooling afterwards.

## Configuration inspection versus architectural linting

```sh
node /path/to/cli/bin/index.mjs check
node /path/to/cli/bin/index.mjs doctor
# Project-local dependencies; use your package manager:
npm install -D steiger @feature-sliced/steiger-plugin
node /path/to/cli/bin/index.mjs check --architecture
```

Normal check validates configuration and required layer presence. Doctor adds
toolchain probes. Neither analyzes import rules or guarantees correct domain
ownership. `--architecture` invokes only the project's installed Steiger binary
against its framework source root and propagates failure. It does not download
packages or write lint configuration. Rules and exceptions remain owned by the
project. Review actual Steiger diagnostics; a passing result is scoped to its
enabled rules, not production or business correctness.
