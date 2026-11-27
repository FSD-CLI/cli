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
| `preset` | string | no | Name of a built-in preset (`recommended`, `strict`) — see Presets below. |
| `owners` | object | no | Map of layer or `layer/slice` → owner(s) — see Ownership below. |

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

## Presets (INT-38)

A policy can extend a built-in preset instead of declaring every rule:

```ts
export default {
  version: 1,
  preset: "recommended",
  rules: [], // rules declared here override the preset, field by field
};
```

| Preset | `layer-boundaries` | `no-slice-cross-imports` | `no-public-api-bypass` |
| --- | --- | --- | --- |
| `recommended` | error, standard FSD import order | error | warn |
| `strict` | error, standard order except widgets may not import features | error | error |

Presets are plain data in `bin/core/policy.mjs` (`POLICY_PRESETS`): rule
severities plus the default `allow` list for `layer-boundaries` — nothing
else, no new rule engine. The loader returns the policy with the preset
applied, so `fsd policy` prints the effective rules and marks the preset
used. A declared rule overrides the preset rule with the same id: an
explicit severity or `allow` wins, the preset supplies the rest; rules the
preset does not cover are appended unchanged. An unknown preset name is a
validation error.

Scaffold a starter policy from a preset (writes `fsd.policy.mjs`, the
portable spelling on Node 22.12+; refuses to overwrite an existing policy
file unless `--force` is passed):

```sh
fsd policy --preset recommended
fsd policy --preset strict
```

## Ownership and CODEOWNERS (INT-37)

A policy can declare owners per layer or per slice:

```ts
export default {
  version: 1,
  rules: [],
  owners: {
    shared: "@team-platform",
    features: ["@team-frontend", "lead@example.com"],
    "features/auth": "@team-auth",
  },
};
```

Keys are a layer (`app`, `pages`, `widgets`, `features`, `entities`,
`shared`) or `layer/slice` with a lowercase kebab-case slice name. Values
are one owner or a non-empty list of owners; each owner is a handle
(`@team` or `@org/team`) or an email address. Anything else is a
validation error, in the same style as the rule errors.

Generate `.github/CODEOWNERS` from the policy:

```sh
fsd policy codeowners
```

Each owned layer maps to `src/<layer>/` and each owned slice to
`src/<layer>/<slice>/`, ordered by layer (app → shared) with a bare layer
before its slices. The generated file carries a header comment marking it
as generated. A hand-written `CODEOWNERS` is never overwritten silently:
regenerating refuses unless `--force` is passed, while a file generated by
this command is overwritten freely. `fsd policy codeowners` fails when the
policy declares no owners.

## Loader behaviour

- `bin/core/policy.mjs` exports `findPolicyFile`, `validatePolicy`, and
  `loadPolicy`. `loadPolicy` returns `{ found, path, policy, errors }`;
  when no policy file exists, `found` is `false` and that is not an
  error. When the policy declares a valid `preset`, the returned policy
  has the preset applied (see Presets above); when validation fails the
  raw policy is returned untouched, with the errors.
- Validation is strict: wrong version, a non-array `rules`, unknown rule
  ids or keys, invalid severities, unknown layers in `allow`, and
  self-allow all produce errors with the rule number and the offending
  value. Unknown preset names and invalid `owners` entries are rejected
  the same way.
- `fsd policy` prints the loaded policy (file, version, preset when set,
  rules with severities, owners when declared) and exits non-zero when
  the file exists but is invalid. When no policy file exists it prints a
  note and exits successfully.
- `fsd policy codeowners [--force]` writes `.github/CODEOWNERS` from the
  policy's `owners` (INT-37); `fsd policy --preset <name> [--force]`
  scaffolds a starter policy file from a preset (INT-38).

## Open questions (for INT-36)

- Whether `layer-boundaries` should also cover `app`/`shared` segments
  and cross-framework imports.
