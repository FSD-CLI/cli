# Current release and validation status

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
This closes those two artifact/build combinations only; Ubuntu workflow and
other OS/framework/package-manager combinations still require execution.

[QA PR #5](https://github.com/FSD-CLI/cli/pull/5) is an unmerged partial audit
of `9640dcc6ab47ebfaedda60ff80572a3ce08e9562`, before the Windows fixes.
Its report/matrix/README deliverables and evidence-tool corrections are pending.
Reported counts are author claims until the committed matrix can be reviewed.

## Candidate branch verification (unmerged)

The `codex/roadmap-quick-wins` candidate passed local `npm run check`: 91 tests
and the npm pack dry-run, exit 0. Node 24.21.0/npm 11.19.0 on macOS were used.
Repeated downloads of all five pinned source commits produced identical byte
trees, and actual CLI create-without-install, provenance, four slice generators
and configuration/layer checks passed for every registered framework.
All six template quality/build commands and Docs lint/types/tests/build/static
checks passed; the Docs production HTTP smoke also passed.

[Candidate evidence](https://github.com/FSD-CLI/cli/tree/codex/roadmap-quick-wins/docs/qa/quick-wins-2026-10-06)
records commits, lock hashes, commands and raw outputs.
[Security inventory](https://github.com/FSD-CLI/cli/blob/codex/roadmap-quick-wins/docs/SECURITY-BASELINE.md)
records the unresolved Nuxt/Angular production dependency findings. Their
security gates stay failed. Quality/build success is not security clearance.
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
