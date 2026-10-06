# Security coverage baseline

Reviewed 2026-10-06. Owner: FSD CLI maintainers (ashrafmo-1).
Scope: CLI, six separate template repositories, documentation and Agent Skill.

## Coverage map

All executable repositories add `.github/workflows/dependency-security.yml`: pull requests, main, weekly and manual runs; locked install; production high/critical audit; retained dependency inventory and raw audit output. Registry/installation failures fail the job. SvelteKit additionally enforces its narrow low-severity exception. Each repository adds weekly npm/GitHub Actions Dependabot updates; the skill uses GitHub Actions only.

| Repository | CodeQL coverage | Production audit candidate result | Owner / remaining action |
| --- | --- | --- | --- |
| FSD-CLI/cli | Existing GitHub automatic analysis | PASS, zero findings | Maintainers; verify new PR security job |
| FSD-CLI/FSD | Existing GitHub automatic analysis | PASS, zero findings | Maintainers; existing PRs #2/#3 remain separate |
| FSD-CLI/FSD-NEXTJS | Existing GitHub automatic analysis | PASS, zero findings | Maintainers; independent quality/security workflows need first PR run |
| FSD-CLI/FSD-VUE | Explicit CodeQL workflow added; first run pending | PASS, zero findings | Maintainers; confirm CodeQL execution |
| FSD-CLI/FSD-NUXT | Explicit CodeQL workflow added; first run pending | FAIL, 8 high / 6 critical aggregate entries | Maintainers; upstream dependency remediation below |
| FSD-CLI/fsd-sveltekit | Explicit CodeQL workflow added; first run pending | Accepted: 3 low entries for one cookie advisory | Maintainers; review exception by 2026-11-06 |
| FSD-CLI/fsd-angular | Explicit CodeQL workflow added; first run pending | FAIL, 5 critical aggregate entries | Maintainers; Seroval dependency remediation below |
| ashrafmo-1/fsd-docs | Explicit CodeQL workflow added; first run pending | PASS, zero findings | Maintainers; verify new jobs |
| FSD-CLI/create-fsd-architecture (Agent Skill) | Intentionally exempt: declarative Markdown/YAML; no executable JS/TS package | npm intentionally exempt; no package.json | Maintainers; reassess when executable tools are introduced |

Candidate means tested branch changes; it does not mean merged, deployed or published. CodeQL workflow presence is not a successful scan. Existing automatic coverage was verified in the project audit; future run outcomes must be recorded independently. Repository administrators must select required security checks in branch protection. This baseline does not claim those server-side settings are configured.

## Dependency changes

Next.js in its template and Docs is patched from 16.3.5 to 16.3.8, beyond the [16.3.6 fix](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j). React/Vue/Next/Docs lockfiles update affected source-map-js/fast-uri dependencies within their supported ranges. Angular packages are aligned at 22.2.1 to fix the router advisory, with compatible query/build dependency updates. These findings identify affected dependencies; application exploitability was not demonstrated.

## Unresolved high/critical findings — no approved exception

Nuxt 4.5.2 still pulls simple-git 3.36.0 through DevTools and node-forge 1.4.0 through listhen/Nitro. Its production audit also includes braces via its build dependency tree. npm's proposed forced Nuxt downgrade is not an acceptable remediation. simple-git's fix is a major 4.x update outside the upstream range; node-forge/braces had no fixed release available when checked. Owner: maintainers. Review by 2026-10-13; seek upstream releases or design and test a narrowly scoped compatible remediation. The Nuxt security job must remain failed; do not merge on a waived threshold.

Angular 22.2.1 fixes the router finding, but query-devtools/Solid still constrains Seroval to a vulnerable 1.5.x range. The fixed Seroval release is 1.6.8; a range override needs focused serialization and consumer compatibility verification before acceptance. Owner: maintainers. Review by 2026-10-13. The Angular security job remains failed. No major upgrade, forced downgrade or blanket audit exception is approved.

Sources: [simple-git advisory](https://github.com/advisories/GHSA-x6jw-m9v5-85vh), [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [Seroval advisory](https://github.com/advisories/GHSA-p6vx-979v-rg4c). Aggregate package counts are not distinct vulnerability counts.

## Evidence

Dated JSON reports under `qa/security-2026-10-06/` retain npm audit results, exit codes, Node/npm versions, base commits and candidate lockfile SHA-256 hashes. Re-run against the exact merged lockfiles before claiming merge/release security. Production checks exclude dev-only dependencies; development/build findings need separate triage even where this gate passes.
