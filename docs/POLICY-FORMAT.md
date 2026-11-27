# Policy as Code — `fsd.policy.ts` format (INT-35)

This document specifies the policy file format, its loader, and how
`fsd check` evaluates a project against it (INT-36). `fsd policy` only
loads and validates the file; `fsd check` enforces the rules.

## File location and shape

Create `fsd.policy.ts` in the project root. It must have an ESM default
export of a plain object:

```ts
export default {
  version: 1,
  rules: [
    {
      id: "layer-boundaries",
      severity: "error",
      allow: {
        features: ["entities", "shared"],
        entities: ["shared"],
      },
    },
    { id: "no-slice-cross-imports", severity: "error" },
    { id: "no-public-api-bypass", severity: "warn" },
  ],
};
```

The loader also accepts `fsd.policy.mjs` and `fsd.policy.js` (first file
found wins, in the order `fsd.policy.ts`, `fsd.policy.mjs`,
`fsd.policy.js`). The `.mjs`/`.js` spellings are the portable alternative
on Node 22.12–22.17, where type stripping for `.ts` files is not enabled
by default; loading a `.ts` policy needs Node >= 22.18. The policy file
itself must use only erasable TypeScript (no enums, namespaces, or
parameter properties) so Node can load it without a build step.

## Top-level fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `version` | number | yes | Must be `1` — the only version the loader supports today. |
| `rules` | array | yes | May be empty. Unknown keys are rejected. |

## Rules

Every rule is an object with `id` (string, required) and `severity`
(`"error"` or `"warn"`, optional, defaults to `"error"`). Rule ids must
be unique; unknown ids and unknown keys are rejected so typos fail loudly
instead of silently doing nothing.

| Rule id | Options | Meaning (proposed) |
| --- | --- | --- |
| `layer-boundaries` | `allow` (optional): map of layer → layers it may import | Restricts which layers a layer may import from. Layers: `app`, `pages`, `widgets`, `features`, `entities`, `shared`. When `allow` is omitted, the standard FSD order applies: a layer may import only layers below it (`app → pages → widgets → features → entities → shared`). A layer cannot allow itself. |
| `no-slice-cross-imports` | none | Slices in the same layer must not import each other. |
| `no-public-api-bypass` | none | Imports must go through a slice's public API instead of reaching into its internals. |

## Evaluation (`fsd check`, INT-36)

When a policy file is present, `fsd check` loads it and evaluates the
project source (the framework's source root, usually `src/`) against
every declared rule. When no policy file exists, `check` behaves exactly
as before — no policy output at all. An invalid policy file fails the
check instead of being silently skipped.

How the evaluation works (`bin/core/policy-evaluate.mjs`, no dependency
on the INT-01 graph engine):

- Every source file (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.vue`,
  `.svelte`) under the source root is scanned for import specifiers
  (`import` / `export ... from` / dynamic `import()` / `require()`).
- Only relative imports (`./`, `../`) and the `@/` alias (the source
  root, as generated code uses it, e.g. `@/shared/api`) are resolved.
  Bare package specifiers are ignored, and imports that cannot be
  resolved to a file under the source root are skipped, not reported.
- Each resolved import is classified by FSD layer and slice from its
  path under the source root (`features/auth`, `shared/ui`, ...).

Rule semantics:

- `layer-boundaries` — an import from one layer to a different layer
  must be allowed by the rule's `allow` map for the importing layer, or
  by the standard FSD order when `allow` does not mention that layer
  (`app → pages → widgets → features → entities → shared`; a layer may
  import only layers below it, never itself or above). Imports inside
  the same layer are not layer-boundary violations.
- `no-slice-cross-imports` — slices in the same layer must not import
  each other. The `app` and `shared` layers are exempt: app segments
  compose the application, and shared segments are low-level building
  blocks that legitimately compose each other.
- `no-public-api-bypass` — an import into another slice must target the
  slice's public API (the slice directory itself, which resolves to its
  index file, or an index file directly inside it), not a file nested
  inside the slice. Imports within the same slice are always allowed,
  and imports into the `app` layer are exempt (app is the composition
  root and has no per-slice public API).

Reporting: each `error`-severity violation is a failing `check` line
(`FAIL  Policy: <rule-id> — <message>`) and makes `fsd check` exit
non-zero. `warn`-severity violations print as `WARN  Policy: ...` lines
and do not fail the run. A clean policy prints one passing line
(`PASS  Policy — <file>: N rules evaluated, M files, K imports, W
warnings`).

## Loader behaviour

- `bin/core/policy.mjs` exports `findPolicyFile`, `validatePolicy`, and
  `loadPolicy`. `loadPolicy` returns `{ found, path, policy, errors }`;
  when no policy file exists, `found` is `false` and that is not an
  error.
- Validation is strict: wrong version, a non-array `rules`, unknown rule
  ids or keys, invalid severities, unknown layers in `allow`, and
  self-allow all produce errors with the rule number and the offending
  value.
- `fsd policy` prints the loaded policy (file, version, rules with
  severities) and exits non-zero when the file exists but is invalid.
  When no policy file exists it prints a note and exits successfully.
- `fsd check` evaluates the loaded policy against the project source
  (see Evaluation above) and exits non-zero on `error`-severity
  violations or an invalid policy file.

## Open questions

- Whether `layer-boundaries` should also cover cross-framework imports.
- Whether presets (for example a `strict` preset that turns every rule
  on) belong in the format — that is INT-38.
- Whether ownership (`CODEOWNERS`-style per-slice owners) belongs in the
  policy file — that is INT-37.
