# Runtime requirements

This document records the **verified** minimum runtime for the CLI and for
every project it generates. Every number below is derived from a published
`engines.node` field rather than from a CI run on "the latest minor", and each
one is enforced by the CLI itself.

The single source of truth is `bin/core/runtime-requirements.mjs`. The
`engines` field in `package.json`, the `doctor` command, the project creation
preflight, and this document all read from it.

## CLI runtime

| Requirement | Value | Evidence |
| --- | --- | --- |
| Node.js | `>=22.12.0` | `chalk@6.0.1` requires `>=22` (CLI runtime dependency); `vite@8.3.0` requires `^20.19.0 \|\| >=22.12.0` and `@sveltejs/vite-plugin-svelte@6.2.1` requires `^20.19 \|\| ^22.12 \|\| >=24` (both shipped templates) |

`22.12.0` is the lowest Node that runs the CLI **and** every shipped Vite based
template. The CLI dependency floor alone is Node 22, and the template floor
alone is Node 22.12.0.

`package.json` declares `engines.node: ">=22.12.0"`, so `npm` warns on install
when the runtime is too old, and CI installs with `--engine-strict` to prove
the published field.

## Generated project runtime

| Template | Required Node.js | Evidence |
| --- | --- | --- |
| React + Vite | `>=22.12.0` | `vite@8.3.0` requires `^20.19.0 \|\| >=22.12.0` |
| Vue + Vite | `>=22.12.0` | `vite@8.3.0` requires `^20.19.0 \|\| >=22.12.0` |
| Next.js | `>=22.12.0` | `next@16.4.3` requires `>=20.9.0`; the CLI floor is stricter |
| Nuxt | `^22.22.2 \|\| ^24.11.0 \|\| >=26.0.0` | the `FSD-NUXT` template requires `>=22.22.2` and `nuxt@4.5.2` requires `^22.19.0 \|\| ^24.11.0 \|\| >=26.0.0` |
| SvelteKit | `^22.22.2 \|\| >=24.0.0` | the `fsd-sveltekit` template requires `>=22.22.2` and `@sveltejs/vite-plugin-svelte@6.2.1` requires `^20.19 \|\| ^22.12 \|\| >=24` |

The Nuxt and SvelteKit templates declare a stricter floor than the CLI itself,
so the CLI checks the template requirement separately. A Node runtime that
satisfies the CLI floor can still be rejected for a specific template, and the
failure message names the exact range that was not satisfied.

### Why the ranges are not single minimums

`nuxt@4.5.2` requires `^22.19.0 || ^24.11.0 || >=26.0.0`. That excludes
Node 23 and the 24.0.0 - 24.10.0 band, so "22.22.2 or later" is not an
accurate description of a Nuxt project. The same applies to the SvelteKit
range. The CLI reports the real range instead of a flattened minimum.

## Package manager runtime

| Package manager | Minimum | Evidence |
| --- | --- | --- |
| npm | `10.9.0` | the npm bundled with Node 22.12.0, the supported CLI runtime |
| pnpm | `10.26.0` | the lowest pnpm release exercised by the CI build policy matrix, and the release that introduced the `allowBuilds` policy the generated workspace uses |
| yarn | `4.18.0` | the Yarn 4 release pinned by the CI package manager matrix |
| bun | `1.2.0` | the oldest Bun release line supported by the CI package manager matrix |

Each minimum is the version the CI matrix exercises, so a documented minimum
is always backed by a green run rather than by an assumption.

## How the requirements are enforced

| Surface | Behaviour |
| --- | --- |
| `package.json` | `engines.node: ">=22.12.0"`; `npm` warns on an unsupported runtime |
| `create-fsd-architecture <name>` | refuses before downloading or writing anything when the running Node does not satisfy the selected template's range |
| `create-fsd-architecture doctor` | reports the Node.js and package manager checks, and names the exact required version on failure |
| `create-fsd-architecture --help`, `--version`, `list-templates` | always available, including on an unsupported runtime, so the diagnostic path stays reachable |

A failure message always states the required range and the detected version:

```text
Node.js >=22.12.0 is required by the CLI (found 20.19.0).
Node.js ^22.22.2 || ^24.11.0 || >=26.0.0 is required by nuxt projects (found 22.13.0).
pnpm 9.15.0 is installed, but pnpm >=10.26.0 is required.
```

## CI coverage

| Job | What it proves |
| --- | --- |
| `cli` (Node `22.12.0`, `22`, `24`) | the tests and the packed artifact pass on the supported runtime floor and on the current majors, with `npm ci --engine-strict` |
| `unsupported-runtime` (Node `20`, `22.11.0`) | the CLI refuses the unsupported runtime, and the failure message contains `>=22.12.0` |
| `package-manager-smoke` (npm, pnpm, yarn, bun) | a generated project installs and builds on Node 22.12.0 with npm 10.9.0, pnpm 10.26.0, yarn 4.18.0 and bun 1.2.0 |
| `framework-smoke` (all five templates) | every template still scaffolds, generates and builds |

## Changing a requirement

1. Update the constant in `bin/core/runtime-requirements.mjs` and record the
   new evidence string next to it.
2. Update `package.json` `engines.node` if the CLI floor changed.
3. Update the CI matrix so the new floor is exercised with `--engine-strict`.
4. Update this document and the README requirements section.
5. `npm test` asserts that `package.json` and the module constants agree, so a
   partial update fails the suite.
