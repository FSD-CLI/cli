# Consolidated CLI 2.6 QA assessment — 10 October 2026

Task 7 delivers a dated, reviewable baseline with raw evidence and explicit gaps. It does not certify that every release, platform, application or security condition is satisfied.

## Identity and assessment

| Source | Exact identity | Evidence and supported conclusion |
|---|---|---|
| Current executable source | `fcde52a0b801a6d57b4d5914596dde72bf490ae9`, package version `2.6.1` | Current main after QA PR #5 and pinning/Windows fixes. New macOS regression/lifecycle runs and all 22 CI job logs below refer to this SHA. |
| Published npm package | `create-fsd-architecture@2.6.1`, gitHead `4c83d0a75ec20117edc8880aba065bdb21edfa6d` | [Registry identity and actual artifact smoke](evidence/npm-published/manifest.json). React/Next install, slice generation, doctor/check and generated quality/build passed on macOS/npm. Source fixes have not been published merely because main's version field also says 2.6.1. |
| Historical Windows audit | `9640dcc6ab47ebfaedda60ff80572a3ce08e9562` | [Original report](../2.6.1/CLI-QA-REPORT.md), r1/r2 matrices and logs remain intact. The nine r2 doctor failures belong to that older code/environment, not to current source. |
| Documentation-only follow-up | The commit containing this report | Produces the reviewable evidence snapshot; it is not a new npm release or a retest of unmerged CLI feature branches. |

The old blockers describing missing README/report/matrix and unsafe/nonportable evidence tools are superseded: [QA PR #5](https://github.com/FSD-CLI/cli/pull/5) was merged at `fcde52a`. The historical documents are tracked; the updated evidence tools pass their four regression tests; all 323 historical relative links resolve. The old audit's executed failures and untested cases remain visible.

## Current executed evidence

| Run | Counting unit | Result | Raw evidence |
|---|---|---|---|
| Source regression, macOS | Command/assertion rows | 135 PASS, 0 FAIL, 2 NOT TESTED, 2 INFO; coverage 135/137 = 98.5%; executed pass rate 135/135 = 100% | [Matrix](SOURCE-MATRIX.md), [manifest](evidence/source-macos/manifest.json), [raw results](evidence/source-macos/results.jsonl) |
| Five frameworks × four package managers, macOS | Lifecycle pipelines and their command/assertion rows | 19/20 pipelines PASS; 1/20 FAIL. Command/assertion rows: 279 PASS, 1 FAIL, 0 NOT TESTED; coverage 280/280 = 100%; executed pass rate 279/280 = 99.6%. The SvelteKit/Yarn failure is preserved and triaged below. | [Matrix](LIFECYCLE-MATRIX.md), [manifest](evidence/lifecycle-macos/manifest.json), [raw results](evidence/lifecycle-macos/results.jsonl) |
| Main CI, Linux/macOS/Windows | Jobs in the exact workflow plan | 22/22 successful; all logs and step conclusions inspected, including the six jobs each running the same 93-test CLI suite | [CI matrix](CI-MATRIX.md), [run](https://github.com/FSD-CLI/cli/actions/runs/37682934668), [raw logs and manifest](evidence/ci/manifest.json) |
| Local CLI checks and evidence-tool checks | Separate suites | `npm run check`: 93/93 CLI tests and pack dry-run pass; QA tools: 4/4 pass; historical links: 323 checked, 0 broken | [Commands, exits, timestamps and log hashes](evidence/tooling/manifest.json) |
| Published npm 2.6.1 | Artifact/framework smoke pipelines | React/Vite PASS; Next.js PASS. Exact npm install, required package-content checks, create with dependency install, four slice generators, doctor/check, generated quality/build | [Artifact manifest](evidence/npm-published/manifest.json), [React result](evidence/npm-published/published-react-vite/result.json), [Next result](evidence/npm-published/published-nextjs/result.json) |
| Packed current source | Limited package smoke | npm pack, actual tarball install, version and React create without dependency install passed | [Rows and tarball SHA-256](SOURCE-MATRIX.md) |

These figures use different units and overlap. They are not added together, and their percentages are not product-wide coverage or a readiness percentage.

The source regression run uses Darwin 27.2.0 arm64, Node 24.13.0, npm 11.6.2, pnpm 11.25.0 and Bun 1.3.9. Yarn was absent from that run's PATH, so its doctor row is honestly NOT TESTED there. The separate lifecycle run supplies Yarn 4.18.0 and pnpm 10.26.0 from an isolated tool installation and records its own versions; a later run does not rewrite an earlier skipped row. The historical-upgrade skip is still open. All manifests are retained.

## Framework/package-manager plan

The lifecycle plan covers React/Vite, Next.js, Vue/Vite, Nuxt and SvelteKit with npm, pnpm, Yarn and Bun on macOS, using each framework's default stack selections. Each combination plans: create with real dependency install; feature/entity/widget/page/auth generation; doctor/check; fresh managed upgrade check/dry-run/apply/recheck; the template's own quality/build command; and immutable-template provenance verification. A failed prerequisite leaves its downstream rows NOT TESTED rather than turning them into false passes. Alternate API/state/forms selections are not certified by these default-stack runs.

| Framework | npm | pnpm | Yarn | Bun |
|---|---|---|---|---|
| react-vite | PASS | PASS | PASS | PASS |
| nextjs | PASS | PASS | PASS | PASS |
| vue-vite | PASS | PASS | PASS | PASS |
| nuxt | PASS | PASS | PASS | PASS |
| sveltekit | PASS | PASS | FAIL (quality/build) | PASS |

The runtime and actual manager versions are in the [manifest](evidence/lifecycle-macos/manifest.json). `HUSKY=0` isolates these lifecycle/build runs; the existing CLI suite separately exercises hook rejection/preservation behavior. A fresh current project normally has a no-op managed upgrade, so these rows do not prove a historical migration. The source regression includes a separately labelled manifest-removal simulation.

## Immutable template identity

Current source requests these full commits. The lifecycle run saves per-project `.fsd/template.json` files and compares `resolvedCommit` with each requested ref.

| Framework | Repository | Requested commit |
|---|---|---|
| React/Vite | FSD-CLI/FSD | `2f10a391e6677c739ceed3a5b030711d1fdf4454` |
| Next.js | FSD-CLI/FSD-NEXTJS | `b5b162a5bf3467b1cb559110cbbaa3878fd5f7a0` |
| Vue/Vite | FSD-CLI/FSD-VUE | `e66d99c616fe3cb1208e366a130939e7d02fffc1` |
| Nuxt | FSD-CLI/FSD-NUXT | `54bf042258f4628d7ee504bc3cf1d0f01afda611` |
| SvelteKit | FSD-CLI/fsd-sveltekit | `ca68a9f659c6e97c48cc24dfb6570502374fcba1` |

The older runner also snapshots each repository's default HEAD. Those snapshots show whether the default branch moved during that run; they are not evidence of the downloaded source now that the CLI pins commits. The published 2.6.1 package still uses its older template-resolution behavior. Template companion merges and repinning remain Task 8 release work.

## New finding: F-2026-10-10-01 — SvelteKit/Yarn cold quality check

The original SvelteKit/Yarn lifecycle pipeline fails at `yarn run ci`, exit 1, before lint/typecheck/build. `fsd:check` invokes Steiger before `.svelte-kit/tsconfig.json` exists; the root tsconfig extends that missing generated file. The [original stderr](evidence/lifecycle-macos/logs/sveltekit-yarn-quality-build.stderr.log) contains `TSConfckParseError`, `EXTENDS_RESOLVE` and the missing path. The other nineteen lifecycle pipelines pass. This failure remains in the matrix; there is no blanket readiness label.

[Focused triage](evidence/sveltekit-yarn-triage/manifest.json) reproduces the failure, then runs `yarn exec svelte-kit sync` successfully, then completes `yarn run ci` successfully. The package.json SHA-256 is identical before and after this manual workaround. The triage interpreter is Node 24.21.0; the original matrix uses Node 24.13.0, and both versions are recorded rather than treated as the same run.

A [one-line candidate patch](evidence/sveltekit-yarn-candidate-fix/package-json.patch) changes the template's `fsd:check` to `svelte-kit sync && steiger ./src`. To verify the patch, the generated `.svelte-kit` directory was removed from the dedicated QA fixture; the patched `yarn run ci` passed on the original Node 24.13.0/Yarn 4.18.0 combination and recreated the config. [Candidate validation](evidence/sveltekit-yarn-candidate-fix/manifest.json) records the original/candidate package hashes, commands, timestamps and logs. The original package.json was restored after testing.

This is a verified candidate fix on a generated fixture, not a merged template or new CLI/npm version. Task 15 owns integration and a fresh generated SvelteKit/Yarn regression after the template ref is updated; Task 8 owns release pinning. The original 279/280 row result and 19/20 pipeline result are unchanged by the successful workaround/candidate run.

## Historical findings reconciled

| Historical result | Current disposition |
|---|---|
| F-001: Windows automatic npm install/doctor fails on old 2.6.1 code | Source command-runner fixes have current unit and cross-OS smoke evidence. The published package is still the old artifact; there is no fresh Windows automatic-install test in this snapshot. Do not claim the published bug is fixed. Tasks 38/16 cover publication and exact-version verification. |
| Missing QA documents and unsafe/nonportable evidence scripts | Documents and fixes merged in PR #5; four QA-tool tests and 323 historical links pass. New output directories and manifests are preserved. |
| F-004: native separators in generator plans | Observation, not a demonstrated import defect. Current generated-source import assertions pass for the five frameworks; the macOS probe reports forward slashes. |
| F-005: old Windows test-harness/path/file-mode/symlink failures | Historical classifications remain intact. Current six unit-suite jobs across the supported Node/OS plan each pass 93 tests; this does not relabel the original failures. |
| Old CI jobs only read from a summary | Current 22-job run is now linked to saved raw logs and inspected step lists, with SHA binding for every job. |

The historical r2 has 129 rows: 117 PASS, 9 FAIL, 1 NOT TESTED, 2 INFO. Its coverage is 126/127 and executed pass rate is 117/126; these are historical metrics, not today's result. Its original Windows machine, script hash and audited SHA remain in the historical manifest.

## Remaining gaps and ownership

| Gap | Status in this baseline | Follow-up acceptance |
|---|---|---|
| Real historical 2.5.x application → upgrade → dependency install/build/runtime, conflict/rollback | NOT TESTED. The manifest-removal simulation and fresh no-op upgrade are explicitly different cases. | Task 11 |
| Exact minimum Node patch and package-manager versions per framework | NOT TESTED. Running recorded versions is not a minimum-version proof. | Task 10 |
| Every framework/PM on every OS, full Windows install/build, browser/runtime behavior | NOT TESTED beyond the explicitly recorded matrix and CI scope. Cross-OS smoke uses React/npm without install/start; framework builds run on Ubuntu. | Task 15 |
| SvelteKit/Yarn cold quality/build failure | Reproduced. Manual sync workaround and one-line candidate fix pass; original main/template pipeline still fails until the fix is integrated and repinned. | Tasks 15/8 |
| Full generated-project quality/build/runtime from the current packed tarball, and published-artifact combinations beyond macOS/npm React/Next | NOT TESTED beyond the limited packed smoke and two published pipelines above. | Tasks 15/16 |
| Publishing Windows fixes and confirming their presence in npm | Not performed; npm stays 2.6.1 at its earlier gitHead. | Task 38, then Task 16 |
| Supabase backend, SSR/session/RLS and authenticated application acceptance | Outside this CLI baseline's execution scope; generated auth is not backend certification. | Tasks 18/27–29 |
| Nuxt production security findings and per-template independent scans/required checks | No new dependency-audit clearance is claimed. A successful quality/build job is not a security pass; existing security follow-up remains separate. | Task 22 |

There is no claim that untested cases are blocked, passing or unnecessary. The Task 7 report can be reviewed independently from these follow-up tasks: it supplies one coherent baseline, raw/source-bound claims, and explicit gaps. Completing the baseline does not close those tasks or create a new npm release.
