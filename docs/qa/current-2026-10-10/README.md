# Current CLI 2.6 QA baseline — 10 October 2026

This is the Task 7 evidence snapshot. It separates the published npm package, the tested source commit, historical audits and local versus CI runs. The executable CLI source under test is `fcde52a0b801a6d57b4d5914596dde72bf490ae9`; documentation added after that commit does not become evidence of a different executable.

- [Consolidated assessment](REPORT.md)
- [Source regression matrix](SOURCE-MATRIX.md)
- [Framework/package-manager lifecycle matrix](LIFECYCLE-MATRIX.md)
- [Current GitHub CI logs, job steps and identity](evidence/ci/manifest.json)
- [CI evidence matrix and its coverage boundaries](CI-MATRIX.md)
- [Exact npm 2.6.1 artifact smoke](evidence/npm-published/manifest.json)
- [CLI tests, QA-tool tests and historical-link verification](evidence/tooling/manifest.json)
- [Executable/configuration/test source files matched byte-for-byte](evidence/source-identity.json)
- [Reproduced SvelteKit/Yarn failure and workaround](evidence/sveltekit-yarn-triage/manifest.json)
- [Validated one-line candidate fix](evidence/sveltekit-yarn-candidate-fix/manifest.json)
- [Historical Windows baseline](../2.6.1/README.md)

## Counting rules

PASS means the named assertion or command met its expected result in the recorded environment. FAIL means an executed assertion did not. NOT TESTED means no execution was performed; it does not mean BLOCKED or PASS. INFO rows are observations and are excluded from both denominators.

Coverage is `(PASS + FAIL) / (PASS + FAIL + NOT TESTED)` within a declared plan. Pass rate is `PASS / (PASS + FAIL)`. The matrices count individual commands/assertions; the combination summary counts whole lifecycle pipelines; CI counts jobs. These units are kept separate. Overlapping runs are never added together.

All raw logs, command working directories, exit codes, manifests and timestamps are under `evidence/`. The lifecycle manifest records each immutable template ref. Its per-project provenance files verify the actual downloaded object. A repository's default-branch HEAD recorded by the older regression runner is not the template ref downloaded by current main.

## Reproduce

Use a fresh checkout of the tested source SHA and copy this directory's two scripts into the same relative directory. Source code must remain byte-identical to that SHA. Required tools: Git, Node, npm; the lifecycle run additionally needs pnpm, Yarn and Bun. The committed manifests record actual versions; exact minimum supported versions are a separate Task 10 acceptance condition.

```sh
npm ci
node docs/qa/2.6.1/evidence/scripts/qa-evidence.mjs \
  --work /absolute/new/workspace-outside-repository \
  --out docs/qa/current-2026-10-10/evidence/new-source-run \
  --audited fcde52a0b801a6d57b4d5914596dde72bf490ae9 \
  --groups provenance,create,generate,inspect,upgrade,legacy,doctor-managers,imports,probe,packed,published,templates-end,install \
  --cmd-timeout 600
node docs/qa/current-2026-10-10/run-matrix.mjs \
  --work /absolute/another-new/workspace-outside-repository \
  --out docs/qa/current-2026-10-10/evidence/new-lifecycle-run
```

Both runners refuse non-empty evidence destinations. The older runner uses `R2-` identifiers; the new source run's manifest, rather than its identifier prefix, identifies the 10 October run. Its preserved historical-upgrade skip text mentions unpinned templates; current source actually pins templates, and the remaining gap is the absent real historical-project install/build/runtime test.

Generate the committed matrices from the committed run directories:

```sh
node docs/qa/current-2026-10-10/render-matrices.mjs
node docs/qa/current-2026-10-10/verify-evidence.mjs
```

The exact published artifact smoke commands are:

```sh
CLI_SMOKE_VERSION=2.6.1 CLI_SMOKE_FRAMEWORK=react-vite CI_ARTIFACTS_DIR=/absolute/new/artifact-output npm run smoke:published
CLI_SMOKE_VERSION=2.6.1 CLI_SMOKE_FRAMEWORK=nextjs CI_ARTIFACTS_DIR=/absolute/new/artifact-output npm run smoke:published
```

These scripts do not publish a package, merge template changes or certify application/backend/security readiness. The framework/PM matrix uses `HUSKY=0` to isolate lifecycle/build checks; hook rejection behavior is covered separately by the CLI's existing unit tests. Fresh managed-project upgrades and manifest-removal simulations are not historical-project migrations.
