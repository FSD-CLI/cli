# Monorepo layout spec (MONO-01)

This document is the layout contract for FSD CLI workspaces: where apps and
packages live, what they are called, and what may import what. The root
workspace generator (MONO-03), the package-manager workspaces (MONO-04–06),
the task runner configs (MONO-07, MONO-09–10), `fsd add app` (MONO-13), the
shared packages (MONO-14–16), the boundary rules (MONO-17), workspace-wide
upgrade (MONO-18) and `fsd extract` (MONO-19) all implement this spec. Nothing
here is code yet: this spec is the deliverable of MONO-01.

Status: spec only. The `multi-web` target is still `available: false`
("monorepo workspaces are not supported yet",
`bin/core/project-target.mjs`), so no generator writes this layout today.

## The layout

```
my-workspace/
├── fsd.config.json            # target: "multi-web" (see "Root config")
├── package.json               # private: true; workspaces member list (npm/yarn/bun)
├── pnpm-workspace.yaml        # packages: ["apps/*", "packages/*"] (pnpm, MONO-03)
├── turbo.json                 # build/lint/test pipelines (MONO-07, optional)
├── nx.json                    # Nx workspace setup (MONO-09, optional; not with turbo.json)
├── apps/
│   ├── web/                   # @my-workspace/web — a full FSD project
│   │   ├── fsd.config.json    # target: "web", framework: react-vite, ...
│   │   ├── package.json
│   │   └── src/
│   │       ├── app/ pages/ widgets/ features/ entities/ shared/
│   └── admin/                 # @my-workspace/admin — another full FSD project
│       └── ...
└── packages/
    ├── shared-ui/             # @my-workspace/shared-ui (MONO-14)
    ├── shared-api/            # @my-workspace/shared-api (MONO-15)
    ├── shared-config/         # @my-workspace/shared-config (MONO-16)
    └── entities-product/      # @my-workspace/entities-product
```

## Members

There are exactly two kinds of workspace member. Nothing else is a member.

### `apps/*` — runnable applications

- Each directory under `apps/` is one complete FSD project: its own
  `fsd.config.json` (with its own `target: "web"` and framework), its own
  `package.json`, and its own `src/` with the full FSD layer structure
  (`app`, `pages`, `widgets`, `features`, `entities`, `shared`).
- Apps are the only members that run: `fsd check`, `fsd doctor`, `fsd
  generate`, `fsd move` and `fsd upgrade` run inside an app directory and
  behave exactly as they do in a single-project workspace.
- An app may depend on packages (below) and on nothing else in the
  workspace. An app never imports from another app.
- An app's own `src/shared/` stays its own: code used by two apps belongs in
  a `packages/shared-*` package instead of being duplicated or imported
  across apps.

### `packages/*` — libraries, never applications

- Each directory under `packages/` is a library: a `package.json` with a
  `name`, a `version`, and an entry point (`main`/`exports`), and no dev
  server, no routes, no `src/app/` layer.
- Packages are grouped by prefix, and the prefix states what the package may
  contain:
  - `packages/shared-ui/` — shared-layer UI primitives (buttons, inputs,
    layout). One package per concern, not one package for everything shared:
    `shared-ui`, `shared-api`, `shared-config`, … (MONO-14–16).
  - `packages/shared-api/` — shared-layer API clients and API types
    (MONO-15).
  - `packages/shared-config/` — shared tsconfig and ESLint config, extended
    by every member's own config (MONO-16).
  - `packages/entities-<name>/` — one package per shared entity, holding
    that entity's slices only (`model`, `ui`, `api` of the entity). An entity
    used by one app only stays in that app's `src/entities/`; it moves to
    `packages/entities-<name>/` when a second app needs it (MONO-19).
- A package never imports from an app, and never imports from another
  package except through that package's public entry point. A package may
  depend on `shared-config` and on `shared-ui`/`shared-api` where it needs
  their primitives; `shared-*` packages never depend on `entities-*`
  packages (the shared layer sits below entities in FSD).

## Naming

Every member's npm name is derived from the workspace project name with
`workspaceMemberName(projectName, member)` (`bin/core/package-name.mjs`,
MONO-02), which returns `@<project>/<member>`:

| Directory | Member name |
| --- | --- |
| `apps/web/` | `@my-workspace/web` |
| `apps/admin/` | `@my-workspace/admin` |
| `packages/shared-ui/` | `@my-workspace/shared-ui` |
| `packages/entities-product/` | `@my-workspace/entities-product` |

The member name is always the directory leaf: renaming a member directory
renames its package (see `fsd move`, PLAT-05, for the single-project
equivalent). Member names follow the same normalization as project names
(`toPackageName`, `docs/PACKAGE-NAMING.md`): lowercase, npm-safe, and never
a bare Node.js core module name.

Internal dependencies use the `workspace:*` protocol (`"@my-workspace/shared-ui":
"workspace:*"`), so the workspace always resolves the local package, never a
published version. Publishing packages to npm is out of scope for the
generator: members are private by default unless the user opts a package into
publishing.

## Root config

The workspace root carries one `fsd.config.json`:

```json
{
  "schemaVersion": 1,
  "framework": "react-vite",
  "projectName": "my-workspace",
  "packageManager": "pnpm",
  "target": "multi-web"
}
```

- `target` is `"multi-web"` (persisted in the config since CORE-19). The
  root has no `src/` of its own. Its `framework` is the workspace default,
  used when `fsd add app` (MONO-13) creates an app without `--framework`;
  each app's own config may override it. The root `package.json` is
  `private: true` and lists the workspace members (`"workspaces": ["apps/*",
  "packages/*"]` for npm/Yarn/Bun; pnpm uses `pnpm-workspace.yaml` instead,
  MONO-03–06).
- `fsd check` and `fsd doctor` at the root detect the workspace
  (`detectMonorepo` in `bin/commands/inspect-project.mjs`, CORE-20:
  `pnpm-workspace.yaml`, `package.json` workspaces, `turbo.json`, `nx.json`,
  `lerna.json`, `apps/` directory) and report it as a workspace, never as a
  failure. Per-app checks run inside the app directory.

## Import rules

The FSD layer rules still apply inside every app and inside every package.
Across the workspace, these rules apply in addition:

1. An app imports a package only by its workspace name
   (`@/…` aliases resolve inside the app; `@my-workspace/shared-ui`
   resolves to the package). Never a relative path out of the app directory
   (`../../packages/…`).
2. A package imports another package only through that package's public
   entry point, never its internals.
3. No member imports from `apps/` of another app.
4. `packages/entities-<name>/` holds entity slices only; it never holds a
   feature, widget or page.
5. `packages/shared-*` holds shared-layer primitives only; it never holds an
   entity, feature, widget or page.

MONO-17 turns rules 1–5 into ESLint boundary rules; until then they are
conventions the generators follow and reviewers check.

## What this spec does not decide

- Task pipelines (`turbo.json` contents, MONO-07) and Nx setup (`nx.json`,
  `project.json` per member, MONO-09–10): the layout only reserves the file
  names and requires that exactly one of Turborepo or Nx is chosen, not both.
- Versioning of packages (fixed vs independent versions) and any npm
  publishing flow.
- Mobile apps in the workspace (`universal` target): the layout reserves
  `apps/*` for any app kind, but no mobile adapter exists yet.
- Migration of an existing single project into a workspace (`fsd migrate`,
  PLAT-04) and extraction of a slice into a package (`fsd extract`,
  MONO-19): both consume this spec, neither is defined by it.

## Consumers

| Task | What it builds on this spec |
| --- | --- |
| MONO-03 | Root workspace generator with pnpm |
| MONO-04 / 05 / 06 | npm / Yarn / Bun workspaces |
| MONO-07 | `turbo.json` pipelines |
| MONO-09 / 10 | `nx.json`, `project.json` per member |
| MONO-12 | E2E: `nx run-many -t build` + `nx graph` |
| MONO-13 | `fsd add app <name> --framework=...` |
| MONO-14 / 15 / 16 | `shared-ui`, `shared-api`, `shared-config` packages |
| MONO-17 | ESLint boundary rules for the import rules above |
| MONO-18 | `upgrade` across every app in the workspace |
| MONO-19 | `fsd extract shared/ui --to packages/ui` |
