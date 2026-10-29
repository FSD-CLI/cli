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
