# Analysis fixture repos (INT-04)

Tiny, self-contained FSD projects for the future INT-01 project graph engine
tests. **Preparatory only — nothing in the CLI reads these fixtures yet.**
They exist so INT-01 (and the analysis commands built on it: adopt, heal,
impact, cost, history) can be tested against known project shapes instead of
building throwaway projects inline in every test.

All three fixtures are `react-vite` projects with a valid `fsd.config.json`
(the default stack: npm, axios, react-query, zustand, react-hook-form-zod)
and a minimal `package.json`. Source files are TypeScript (`.ts` / `.tsx`)
and use relative imports, matching what `fsd create` generates.

## Fixtures

### `minimal/` — a small, valid FSD project

Every import follows the layer order `app > pages > widgets > features >
entities > shared` (a layer may only import from layers below it).

| Layer | Slices / segments |
| --- | --- |
| app | providers (segment) |
| pages | home |
| widgets | header |
| features | auth, cart |
| entities | product, user |
| shared | api, ui (segments) |

Documented import edges (the graph INT-01 should build from this fixture):

- `app/providers` → `shared/ui`
- `pages/home` → `widgets/header`, `features/auth`
- `widgets/header` → `shared/ui`
- `features/auth` → `entities/user`, `shared/ui`
- `features/cart` → `entities/product`
- `entities/product` → `shared/ui`
- `entities/user`, `shared/api`, `shared/ui` → (no layer imports)

### `with-violations/` — same shape, three deliberate layer violations

Identical to `minimal/` except for the three files below. Each violation is
marked with a `// VIOLATION` comment in the file. A graph engine must report
exactly these three upward imports and no others:

1. `src/entities/product/model/product.types.ts` imports
   `features/auth/model/auth` — **entities → features** (upward).
2. `src/shared/ui/button.tsx` imports `features/cart/model/cart` —
   **shared → features** (upward).
3. `src/features/auth/model/auth.ts` imports `pages/home/ui/home-page` —
   **features → pages** (upward).

### `empty/` — a project with no slices

Only `fsd.config.json`, `package.json`, and an empty `src/` (kept tracked
via `.gitkeep`). The graph engine must handle a project with zero slices
without failing.

## Rules for changing these fixtures

- Keep them tiny: a handful of files per fixture, no real dependencies, no
  build step. They are test data, not example apps.
- If you add or remove an import edge, update this README and
  `tests/analysis-fixtures.test.mjs` in the same change — the test pins the
  documented edges and violations so drift is caught immediately.
- Do not point any CLI command at these fixtures until INT-01 lands; they
  have no consumer yet by design.
