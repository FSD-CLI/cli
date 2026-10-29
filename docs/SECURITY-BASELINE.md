# Security coverage baseline

Reviewed 2026-10-29. Owner: FSD CLI maintainers (ashrafmo-1).
Scope: CLI, six separate template repositories, documentation and Agent Skill.

## Coverage map (2026-10-29)

Every executable template's `main` now carries Dependabot and a
`dependency-security` workflow (pull requests, main, weekly, manual). The
production gate fails on **high and critical** findings unless an owned,
expiring exception in that repository's `security/audit-exceptions.json` covers
them; low/moderate findings are printed. Nuxt, Vue and SvelteKit enforce it with
`npm run audit` plus `npm run test:audit-policy`; React and Next.js use
`npm audit --omit=dev --audit-level=high` and have no exceptions. The CLI pins
each template to the `main` commit below.

| Repository | Pinned `main` | CodeQL | Production audit | Exceptions |
| --- | --- | --- | --- | --- |
| FSD-CLI/cli | — | GitHub default setup | PASS, 0 findings | none |
| FSD-CLI/FSD (React) | `55530ec` | GitHub default setup | PASS, 0 findings | none |
| FSD-CLI/FSD-NEXTJS | `b360aef` | GitHub default setup | PASS | none |
| FSD-CLI/FSD-VUE | `82a1227` | `codeql.yml` | PASS via exception | zod GHSA-mrhx-c7xc-m3w5 + `@vee-validate/zod`, review by 2026-11-29 |
| FSD-CLI/FSD-NUXT | `533c5f9` | `codeql.yml` | PASS via exception; 0 critical; 7 low reported | zod GHSA-mrhx-c7xc-m3w5 + `@vee-validate/zod`, review by 2026-11-29 |
| FSD-CLI/fsd-sveltekit | `9ff28cf` | `codeql.yml` | PASS, 0 high/critical; 5 low reported (fixed only in SvelteKit 3) | none (cookie exception removed) |
| FSD-CLI/fsd-angular | — (inspection only) | `codeql.yml` | PASS at last review (2026-10-11) | none |
| ashrafmo-1/fsd-docs | — | `codeql.yml` / analyze | PASS after Next.js 16.4.3 and zod 4.6.7 | none |
| FSD-CLI/create-fsd-architecture (Agent Skill) | — | Exempt: declarative Markdown/YAML | Exempt: no package.json | — |

The zod exception exists because `@vee-validate/zod` 4.15.1 (latest stable)
supports only zod 3 and no zod 3 release is patched; zod 4 support via Standard
Schema exists only in vee-validate 5.0.0-beta.0. Remove both exceptions by
migrating the Vue/Nuxt forms layer (templates and CLI generator together) to
zod >= 4.6.6 once vee-validate 5 is stable.

Branch protection with required checks is a repository-administrator setting.
On 2026-10-29 only FSD-NEXTJS and fsd-docs had required checks; this baseline
does not claim the others are configured.

The 2026-10-06 baseline below is kept for history.

## 2026-10-06 baseline (history)

Reviewed 2026-10-06. Owner: FSD CLI maintainers (ashrafmo-1).
Scope: CLI, six separate template repositories, documentation and Agent Skill.

## Coverage map

All executable repositories add `.github/workflows/dependency-security.yml`: pull requests, main, weekly and manual runs; locked install; production high/critical audit; retained dependency inventory and raw audit output. Registry/installation failures fail the job. SvelteKit additionally enforces its narrow low-severity exception. Each repository adds weekly npm/GitHub Actions Dependabot updates; the skill uses GitHub Actions only.

| Repository | CodeQL coverage | Production audit candidate result | Owner / remaining action |
| --- | --- | --- | --- |
| FSD-CLI/cli | Existing GitHub automatic analysis | PASS, zero findings | PR #6 production-audit and CodeQL passed |
| FSD-CLI/FSD | Existing GitHub automatic analysis | PASS, zero findings | Maintainers; existing PRs #2/#3 remain separate |
| FSD-CLI/FSD-NEXTJS | Existing GitHub automatic analysis | PASS, zero findings | Maintainers; independent quality/security workflows need first PR run |
| FSD-CLI/FSD-VUE | Explicit CodeQL workflow added; first run pending | PASS, zero findings | Maintainers; confirm CodeQL execution |
| FSD-CLI/FSD-NUXT | Explicit CodeQL workflow added; first run pending | FAIL, 8 high / 6 critical aggregate entries | Maintainers; upstream dependency remediation below |
| FSD-CLI/fsd-sveltekit | Explicit CodeQL workflow added; first run pending | Accepted: 3 low entries for one cookie advisory | Maintainers; review exception by 2026-11-06 |
| FSD-CLI/fsd-angular | Explicit CodeQL workflow added; first run pending | PASS, zero production findings after scoped Seroval patch | Maintainers; confirm first PR security/quality runs |
| ashrafmo-1/fsd-docs | Explicit CodeQL workflow added; first run pending | PASS, zero findings | Maintainers; verify new jobs |
| FSD-CLI/create-fsd-architecture (Agent Skill) | Intentionally exempt: declarative Markdown/YAML; no executable JS/TS package | npm intentionally exempt; no package.json | Maintainers; reassess when executable tools are introduced |

Candidate means tested branch changes; it does not mean merged, deployed or published. CodeQL workflow presence is not a successful scan. Existing automatic coverage was verified in the project audit; future run outcomes must be recorded independently. Repository administrators must select required security checks in branch protection. This baseline does not claim those server-side settings are configured.

## Dependency changes

Next.js in its template and Docs is patched from 16.3.5 to 16.3.8, beyond the [16.3.6 fix](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j). React/Vue/Next/Docs lockfiles update affected source-map-js/fast-uri dependencies within their supported ranges. Angular packages are aligned at 22.2.1 to fix the router advisory, with compatible query/build dependency updates. These findings identify affected dependencies; application exploitability was not demonstrated.

## Unresolved high/critical findings — no approved exception

Nuxt 4.5.2 still pulls simple-git 3.36.0 through DevTools and node-forge 1.4.0 through listhen/Nitro. Its production audit also includes braces via its build dependency tree. npm's proposed forced Nuxt downgrade is not an acceptable remediation. simple-git's fixed 4.0.2 is outside the upstream range and removes the default export used by DevTools; a blind override would break its consumer. node-forge 1.4.0 and braces 3.0.3 still have no published fixed release as of the follow-up verification. Owner: maintainers. Review by 2026-10-13; seek upstream releases or design and test a narrowly scoped compatible remediation. The Nuxt security job must remain failed; do not merge on a waived threshold. Dependency advisories are confirmed; an exploitable application input path was not demonstrated.

Angular's follow-up candidate applies a Solid-scoped Seroval 1.6.8 override. The plugin-produced Promise thenable and two bounded fake-ArrayBuffer payloads fail the security assertions on 1.5.6 and are rejected on 1.6.8. Ordinary values, typed arrays, Promises, web plugins and Solid SSR serialization remain valid. Clean installs and full quality/tests/build passed on Node 24.15.0 and 24.21.0; production audit reports zero findings. Both quality and security jobs run the five regression/compatibility tests. Independent candidate review found no concrete bypass or consumer regression. Five development-only high aggregate entries remain in the Steiger/braces chain; they are not waived or included in the production-only PASS. Owner: maintainers; remove the scoped override only after a fixed upstream range is verified.

Sources: [simple-git advisory](https://github.com/advisories/GHSA-x6jw-m9v5-85vh), [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [Seroval advisory](https://github.com/advisories/GHSA-p6vx-979v-rg4c). Aggregate package counts are not distinct vulnerability counts.

## Evidence

Dated JSON reports under `qa/security-2026-10-06/` retain npm audit results, exit codes, Node/npm versions, base commits and candidate lockfile SHA-256 hashes. Re-run against the exact merged lockfiles before claiming merge/release security. Production checks exclude dev-only dependencies; development/build findings need separate triage even where this gate passes.
