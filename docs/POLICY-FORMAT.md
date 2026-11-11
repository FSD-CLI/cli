# Policy as Code — `fsd.policy.ts` format (INT-35)

This document specifies the policy file format and its loader. It is a
**proposal**: the format is deliberately minimal and may change before
evaluation lands. Nothing in this document is enforced yet — `fsd policy`
only loads and validates the file; evaluating the project against the
rules is INT-36 (`fsd check`).

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

## Open questions (for INT-36)

- Whether `layer-boundaries` should also cover `app`/`shared` segments
  and cross-framework imports.
- Whether presets (for example a `strict` preset that turns every rule
  on) belong in the format — that is INT-38.
- Whether ownership (`CODEOWNERS`-style per-slice owners) belongs in the
  policy file — that is INT-37.
