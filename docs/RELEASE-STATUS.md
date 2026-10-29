# Current release and validation status

## Published 2.7.1 — 29 October 2026

The owner published `create-fsd-architecture@2.7.1` with gitHead
`287b61fc742d49e37b9c41f7c759aa1486b275d2` and integrity
`sha512-FNrVVa+ZrPKRSoeknRAXWh410/9GF8smyAj+LuM8c9F+x4EU8QY4/7WdLAOGHWDQ3B8Ries1IaQYrN4Rr6djWw==`;
the `v2.7.1` tag created the GitHub Release. It adds the global `fsd`
command ([PR #20](https://github.com/FSD-CLI/cli/pull/20)), page presets
([PR #21](https://github.com/FSD-CLI/cli/pull/21)), the historical upgrade E2E
with fixes for projects created before 2.6.1 and for Dependabot-raised managed
dependencies ([PR #22](https://github.com/FSD-CLI/cli/pull/22)), live Supabase
staging acceptance of the auth adapter
([PR #23](https://github.com/FSD-CLI/cli/pull/23)), and template pins on each
template's security-fixed `main` ([PR #24](https://github.com/FSD-CLI/cli/pull/24)).
Each merged with all CI checks green.

## Published 2.7.0 — 29 October 2026

The owner published `create-fsd-architecture@2.7.0` with gitHead
`561d7d94b5a20179e2246d216d4fc80e9236d4ae` and integrity
`sha512-F9ka7Ov2ImLFie8ZaBFyZbB5erByOiTf5pnwwHN396Q/spT3UfL/DHOiSPYmipKn287Me012by364XlAuS49hg==`;
the `v2.7.0` tag created the GitHub Release. It contains the runtime
contract ([PR #17](https://github.com/FSD-CLI/cli/pull/17)), the Supabase auth
adapter, batch and structure-only generation and `--architecture` checks
([PR #16](https://github.com/FSD-CLI/cli/pull/16)), and the layout widget
presets and shared ui/api generators
([PR #18](https://github.com/FSD-CLI/cli/pull/18)). Each merged with all CI
checks green.

## Published 2.6.3 — 11 October 2026

The owner published `create-fsd-architecture@2.6.3` with gitHead
`9d37a154fd9476ff416941463c6f60c77bab55de` and integrity
`sha512-rXD8GOrY3cQ4jvRwsBINMqqTg8DQHwhWbjgHFEV+4kopUWbLIEK9wOSE7cdCh4fL3Gm85t/ljL2FjCzoYENm/g==`.
Registry identity matches the prepared package. The agent did not publish npm.

Exact-artifact React/Vite and Next.js npm smoke passed on macOS/arm64,
Node 24.13.0/npm 11.6.2: CLI install/version/help/template listing, project
creation with dependency installation, four slice generators, doctor/check,
and generated-project quality/build. [Raw evidence](qa/published-2.6.3/macos/manifest.json)
records commands, tool versions, registry identity and outcomes.
The [Ubuntu artifact run](https://github.com/FSD-CLI/cli/actions/runs/38154161694)
also passed both jobs on Node 22.23.0/npm 10.9.8. [Job logs](qa/published-2.6.3/ubuntu/)
confirm the exact 2.6.3 input and successful artifact smokes.

[PR #13](https://github.com/FSD-CLI/cli/pull/13) added Angular inspection-only
configuration support, refreshed immutable main template pins and Chalk 5.x
for Node 20 compatibility. The source release head passed all 25 main checks
and 95 local tests; the earlier executable head also passed Node 20 locally.
Angular scaffolding/generators remain outside this release's support scope.

These artifact results cover React/Vite and Next.js with npm on the recorded
platforms, not all framework/package-manager/runtime/deployment combinations.
Nuxt's independent production audit remains failing; source builds and CLI
audit success do not clear that separate security hold.
The QA baseline below still describes its recorded source and package versions.

## Runtime contract — merged in PR #17

The supported runtime is now a declared contract instead of a documented
assumption. The published `engines.node` field, the `doctor` command, the
project creation preflight, the README and
[Runtime requirements](RUNTIME-REQUIREMENTS.md) all read the same constants
from `bin/core/runtime-requirements.mjs`.

- CLI runtime: Node.js `>=22.12.0`.
- Generated projects: React, Vue and Next.js follow the CLI floor; Nuxt
  requires `^22.22.2 || ^24.11.0 || >=26.0.0` and SvelteKit requires
  `^22.22.2 || >=24.0.0`.
- Package managers: npm `>=10.9.0`, pnpm `>=10.26.0`, yarn `>=4.18.0`,
  bun `>=1.2.0`.

This corrects `engines.node: ">=20"` on `main`, which contradicted the
resolved `chalk@6.0.1` dependency that requires Node `>=22`.

CI now defines a runtime matrix that installs with `--engine-strict` on Node
`22.12.0`, `22` and `24`, a job that asserts an unsupported runtime is refused
with the exact required version in the failure message, and a package manager
matrix pinned to each documented minimum. The
[PR #17 run](https://github.com/FSD-CLI/cli/actions/runs/40697034745) passed
all 27 jobs, including `CLI / Node 22.12.0` with `--engine-strict`, both
`Unsupported runtime` jobs, all five framework builds, and the npm, pnpm,
yarn and bun jobs at their documented minimums. Local verification on Node
22.12.0, 22.23.4 and 24.15.0 passes 104 tests, `npm ci --engine-strict` and
`npm pack --dry-run`.

This is source and CI evidence on the pull request. Nothing is published to
npm from this branch, `2.6.3` remains the published artifact, and merge and
publication stay separate owner steps. The historical "exact minimum runtime
patches" gap is closed for the CLI runtime and the package manager minimums;
the exact lower boundary of a *generated project* is still covered for
React/Vite only.

## Latest QA baseline — 10 October 2026

The [consolidated Task 7 baseline](https://github.com/FSD-CLI/cli/blob/main/docs/qa/current-2026-10-10/REPORT.md) is the current
QA assessment. It binds new macOS runs and the inspected 22-job Linux/macOS/Windows
CI run to executable source `fcde52a0b801a6d57b4d5914596dde72bf490ae9`.
QA PR #5 is merged; its historical report/matrices and repaired evidence tools
are present. Published npm remains `create-fsd-architecture@2.6.1` at
`4c83d0a75ec20117edc8880aba065bdb21edfa6d`, separately verified by exact-artifact
React/Next install/generate/quality/build smoke. New source validation does not
publish Windows fixes or close the report's explicit remaining gaps.

## Historical snapshot — 6 October 2026

The sections below preserve the 6 October snapshot, including its then-unmerged
PR #5 and candidate-branch wording. Use the current baseline above for later
merge state, source identity and evidence; do not read those older statements as
current repository status.

Reviewed: 2026-10-06. Owner: FSD CLI maintainers.

## Published package

- npm: `create-fsd-architecture@2.6.1`.
- Integrity: `sha512-X1StMp1ytT0g1A8H/5b1ok8HN+5yRSIhoOAoG5w1g7Wz+HxFLRfE364QXrkxyRT35WEZJp9wNYL2qCt+2XAoRg==`.
- Published gitHead: `4c83d0a75ec20117edc8880aba065bdb21edfa6d`.
- Product and documentation: https://fsdcli.me.
- [Registry package](https://www.npmjs.com/package/create-fsd-architecture).

## Source verification

The verified main baseline is `c05ef594e7d572247d5257791f275029b9dd9ea5`.
[CI](https://github.com/FSD-CLI/cli/actions/runs/37328162635) completed
22 successful jobs. Local macOS `npm run check` exited 0 with 84 passing
tests and a successful npm pack dry-run. These checks verify source, not a
new npm release. Windows command-runner fixes merged after the published
package's gitHead and are awaiting publication.

## Coverage boundaries

- Five supported frameworks: React/Vite, Next.js, Vue/Vite, Nuxt, SvelteKit.
- CLI tests run on Node 20/22/24 and Linux/macOS/Windows.
- Cross-OS lifecycle smoke uses React/npm on Node 22 without install/start.
- Framework builds run on Ubuntu; four package managers are exercised with
  React, and pnpm 10.26/11 with React/Nuxt.
- Generated application security, backend integration and deployment are
  application-specific. This evidence is not a production-readiness guarantee.

## Open verification gaps

Historical-project upgrade with real install/build/runtime, exact minimum
runtime patches, wider framework/package-manager combinations, browser/runtime
smoke, remain unverified unless a newer evidence entry explicitly closes them.
Published 2.6.1 artifact smoke passed locally on macOS with npm for React/Vite
and Next.js on 2026-10-06: install, create, all four slice types, doctor/check
and generated-project quality/build. Raw logs are in
[committed React evidence](https://github.com/FSD-CLI/cli/blob/main/docs/qa/published-2.6.1/react-vite/result.json) and
[committed Next.js evidence](https://github.com/FSD-CLI/cli/blob/main/docs/qa/published-2.6.1/nextjs/result.json), with raw
command logs in the same directories.
This closes those two local artifact/build combinations only. The follow-up
[Ubuntu published baseline run](https://github.com/FSD-CLI/cli/actions/runs/37402559746)
passed both React/Vite and Next.js jobs against the exact public 2.6.1 package.
Other OS/framework/package-manager combinations still require execution.

[QA PR #5](https://github.com/FSD-CLI/cli/pull/5) is an unmerged partial audit
of `9640dcc6ab47ebfaedda60ff80572a3ce08e9562`, before the Windows fixes.
Its report/matrix/README deliverables and evidence-tool corrections are pending.
Reported counts are author claims until the committed matrix can be reviewed.

## Candidate branch verification (unmerged)

The initial `a1d18b0` candidate passed local `npm run check`: 91 tests and the
npm pack dry-run, exit 0. The follow-up adds clear pinned-download failure
messages and verifies rollback for both new and existing destinations:
93 tests and npm pack dry-run passed. Node 24.21.0/npm 11.19.0 on macOS were used.
Repeated downloads of all five pinned source commits produced identical byte
trees, and actual CLI create-without-install, provenance, four slice generators
and configuration/layer checks passed for every registered framework.
All six template quality/build commands and Docs lint/types/tests/build/static
checks passed; the Docs production HTTP smoke also passed.

[Candidate evidence](https://github.com/FSD-CLI/cli/tree/codex/roadmap-quick-wins/docs/qa/quick-wins-2026-10-06)
records commits, lock hashes, commands and raw outputs.
[Security inventory](https://github.com/FSD-CLI/cli/blob/codex/roadmap-quick-wins/docs/SECURITY-BASELINE.md)
records the unresolved Nuxt production dependency findings and the follow-up
Angular serializer remediation. Nuxt's security gate stays failed; Angular's
patched production dependency audit passed. Quality/build success is not security clearance.
These branch changes are not yet merged, deployed or published.

## Reading evidence

PASS means the named assertion passed in its recorded environment. FAIL means
an executed assertion failed. NOT TESTED means no execution evidence exists.
BLOCKED identifies a specific prerequisite preventing execution. NOT APPLICABLE
requires a reason. Coverage and executed-case pass rate are separate metrics.

Every new record must name package version, source SHA, platform/tool versions,
command, working directory, exit code, timestamp and raw evidence path. Preserve
historical results; never relabel them as runs against newer source.

## Evidence index

| Material | Classification | Scope |
| --- | --- | --- |
| This page | Current dated snapshot | Published package and current verified source |
| [Cross-platform CI](https://github.com/FSD-CLI/cli/blob/main/docs/qa/CROSS-PLATFORM-CI.md) | Source evidence | CI implementation; not an npm release certification |
| [September report](https://github.com/FSD-CLI/cli/blob/main/docs/CLI-QA-REPORT.md) | Historical | CLI 2.5.0 exploratory evidence |
| [September matrix](https://github.com/FSD-CLI/cli/blob/main/docs/CLI-QA-MATRIX.md) | Historical | Original executed assertions and gaps |
| [Fix verification](https://github.com/FSD-CLI/cli/blob/main/docs/QA-FIX-VERIFICATION.md) | Historical | Local 2.5.1-era fixes before publication |
| [QA PR #5](https://github.com/FSD-CLI/cli/pull/5) | Pending review | Unmerged audit of 9640dcc6; missing deliverables |
| Task briefs | Planning | Requirements, never proof of implementation |

## Release verification checklist

1. Record the intended version and source commit.
2. Run source checks and retain their commands/exit codes.
3. Verify the real tarball contents and generated-project install/build.
4. Publish manually; verify registry version, integrity and gitHead.
5. Run the post-release smoke workflow against the exact published version.
6. Announce release verification only after that artifact smoke passes.
7. Update this dated snapshot and preserve old reports unchanged beneath their banners.

## Post-publish artifact smoke

Dispatch **Published package smoke** with the exact version already on npm.
Changes to this workflow or its scripts also run the public 2.6.1 baseline on PRs.
The job has read-only repository permissions and cannot publish. It verifies
registry integrity/gitHead, packaged runtime files, installed CLI version,
create/doctor/check, all four representative slice types and generated-project
quality/build for React/Vite and Next.js with npm on Ubuntu/Node 22.23.0.
Broader OS/package-manager/runtime coverage remains in the QA matrix.

For local reproduction, run from the CLI repo:

```bash
CLI_SMOKE_VERSION=2.6.1 CLI_SMOKE_FRAMEWORK=react-vite npm run smoke:published
CLI_SMOKE_VERSION=2.6.1 CLI_SMOKE_FRAMEWORK=nextjs npm run smoke:published
```

Raw commands, working directories, outputs and exit codes are saved under
`ci-artifacts/published-<framework>/`. Failed temporary workspaces are retained
for diagnosis; successful ones are removed. A failed result blocks the release
verification claim, not npm publishing authority. No automatic republish occurs.

## Approved decision follow-up (candidate)

October 6 follow-up adds opt-in `--auth-provider supabase`, with browser SDK
contract tests and generated lint/types/build across the five frameworks. Live
Supabase staging acceptance and SSR/RLS integration remain separate requirements.
The new light-hook policy uses internal managed state3 (`light-hooks-v1`) and
keeps customized hooks as conflicts. These changes are not in npm2.6.1.
Existing 0318943/93-test/28-check evidence above remains historical evidence of
that exact head; the follow-up head requires its own CI results.
