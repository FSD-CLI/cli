# CLI QA Report, create-fsd-architecture 2.6.1

Evidence index: [README.md](README.md). Case rows: [CLI-QA-MATRIX.md](CLI-QA-MATRIX.md) (run r1) and [CLI-QA-MATRIX-r2.md](CLI-QA-MATRIX-r2.md) (run r2). Raw logs: [evidence/logs/](evidence/logs/) and [evidence/validation-r2/](evidence/validation-r2/).
The historical 2.5.0 audit in `docs/` is unchanged.

**Two SHAs are kept apart.** The CLI under test is `9640dcc6ab47ebfaedda60ff80572a3ce08e9562` (version 2.6.1, `main`). The QA documents, evidence and scripts are later commits on branch `qa/2.6.1-baseline`. The audit run r2 checks that nothing outside `docs/` differs between them (R2-PROV-02, PASS). The final QA commit SHA is given in the pull request, not in these files.

## 1. Assessment of the audited commit (scoped to the evidence)

| Area | Status | Evidence |
|---|---|---|
| Unit test suite on Linux, Node 22 | **Supported**: 74 of 74 pass | CI run #20, Node 22 job log inspected |
| Linux, npm: create with install, 5 generators, `npm run ci`, all five frameworks | **Supported by the CI run summary only** (success) | CI run #20; the five job logs were not inspected |
| Linux, React create and build with npm, pnpm, Yarn 4.18.0, Bun; pnpm 10.26.0 and 11 on React and Nuxt | **Supported by the CI run summary only** | CI run #20; logs not inspected |
| Windows, no dependency install: create (5 frameworks, six FSD layers, default stack), 25 generator runs, `check`, `config`, `upgrade --check` and `--dry-run` on fresh projects | **Supported** (executed twice: r1 and r2) | matrices r1 and r2 |
| Upgrade of a project that lost its ownership manifest (**simulation**, not a historical project): check, dry-run, apply, recheck | **Supported for the simulation only** | LEGACY-SIM-01 (r1), R2-LEGACY-SIM (r2) |
| Packed tarball and published `2.6.1`: install, `--version`, React create with `--no-install` | **Supported for those steps only** (Windows) | PACK-01..04, PUB-01..04, R2-PACK, R2-PUB |
| Windows: create with automatic dependency install | **Demonstrated failure** (npm; rolled back) | CREATE-INSTALL-react-vite-npm; F-001 |
| Windows: `doctor` | **Demonstrated failure** for npm, pnpm, Yarn and Bun, all installed | INSPECT-doctor rows (r1, r2), R2-DOCTOR-* rows; F-001 |
| Generated-project install, lint, typecheck, build and runtime, run locally | **Not verified** | G-005, G-003 |
| Non-React framework with pnpm, Yarn or Bun (including SvelteKit with Yarn 4) | **Not verified** | G-002 |
| Upgrade of a real historical project followed by install and build | **Not verified** | G-001 |
| Install and build of a project created from the packed or published artifact | **Not verified** | G-006 |
| macOS | **Not verified** | G-007 |

What this supports: using the audited commit on Linux with npm for the paths above, and the install-free Windows workflow. What it does not support: any claim about Windows automatic install, about the unverified rows, or about the 15 CI jobs whose logs were not read. No single "ready" label is given, because the verified and unverified parts are not equivalent.
A successful package install, `--version`, or React creation with `--no-install` does not show that dependencies install, or that the generated project builds or runs.

## 2. What was tested, and on what

| Item | Value |
|---|---|
| CLI source | `9640dcc6ab47ebfaedda60ff80572a3ce08e9562` (`main`, clean tree, "chore: add npm funding metadata", 2026-09-28 01:32:31 +0300), version 2.6.1 |
| Run r1 (batch scripts, commit `209bdda` in the history) | Windows 10.0.26200.9550 AMD64; Node v24.21.0; npm 11.19.0; pnpm 12.8.1; Yarn 1.22.22 (4.18.1 via corepack); Bun 1.4.2; Git 2.49.0.windows.1; 2026-10-01 and 2026-10-04 |
| Run r2 (`qa-evidence.mjs`, [manifest](evidence/validation-r2/manifest.json)) | same machine and tools; 2026-10-06; clean clone at `E:\qa clean 2\cli` (a path with spaces), checkout HEAD `bcde1c3`, script SHA-256 `2b5e4155bf5c2c8f12e5c54c2709785c3d2814820a1685e938010c0999e966e8` |
| Linux evidence | [CI run #20](https://github.com/FSD-CLI/cli/actions/runs/36355684306) on the same SHA, ubuntu-latest. Node 22 job [log](https://github.com/FSD-CLI/cli/actions/runs/36355684306/job/108722829987) inspected; the other 15 jobs read from the run summary |
| Packed artifact | `create-fsd-architecture-2.6.1.tgz`, SHA-256 `d5315921cb381bb6851271325236ef09eabe542ec8cdc4d9996624dff43c8bcd` (same value in r1 and r2) |
| Published package | npm `create-fsd-architecture@2.6.1`, shasum `6331b199d29b74ce763c6b9601c5ae42d740ad14`, modified 2026-09-27T16:51:43.780Z |

Template SHAs (recorded at the start of r1, the end of r1, and at the start and end of r2; never changed):

| Framework | Repository | SHA |
|---|---|---|
| react-vite | [FSD-CLI/FSD](https://github.com/FSD-CLI/FSD) | `ec8548bf2143c36f44c2475baddb8fa6bb90d016` |
| nextjs | [FSD-CLI/FSD-NEXTJS](https://github.com/FSD-CLI/FSD-NEXTJS) | `2d44f0bf9dcd030f2ddc48e0a869670ced485efc` |
| vue-vite | [FSD-CLI/FSD-VUE](https://github.com/FSD-CLI/FSD-VUE) | `b272c0b8995b63d4618a27164272888f07842629` |
| nuxt | [FSD-CLI/FSD-NUXT](https://github.com/FSD-CLI/FSD-NUXT) | `6b64241b712fb197db53503f2e097841ceb083bb` |
| sveltekit | [FSD-CLI/fsd-sveltekit](https://github.com/FSD-CLI/fsd-sveltekit) | `1825f50faa34bd965ce41bc0463d5ea1934519d5` |

Source labels are never mixed: **local checkout**, **packed artifact**, **published package**, **CI** (Linux, not run on the author's machine).
The published 2.6.1 package and the audited commit run the same code: 39 files each, only `package.json` (funding metadata) and `README.md` (1 line) differ, and all of `bin/` is byte-identical. Those two files changed in commit `9640dcc`, after the release commit `f20c495`.

## 3. Counts

Counts are per run and per row. They are not added across runs, because r2 re-executes many r1 cases.

**Run r1** (95 planned rows, one per case in the matrix):

| Measure | Value |
|---|---|
| Planned | 95 |
| Executed | 71 |
| PASS | 64 |
| FAIL | 7 |
| NOT TESTED | 24 |
| **Coverage** (executed / planned) | **71/95 = 74.7%** |
| **Pass rate** (PASS / executed) | **64/71 = 90.1%** |

Unexecuted cases are never counted as PASS and are not part of the pass rate. BLOCKED is not used.

By group:

| Group | PASS | FAIL | NOT TESTED |
|---|---|---|---|
| Baseline | 2 | 1 | 0 |
| Create with install | 0 | 1 | 4 |
| Create (no install) | 5 | 0 | 0 |
| Generators | 25 | 0 | 0 |
| Inspect | 10 | 5 | 0 |
| Upgrade (fresh project) | 10 | 0 | 0 |
| Upgrade (legacy simulation) | 4 | 0 | 0 |
| Packed artifact | 4 | 0 | 0 |
| Published package | 4 | 0 | 0 |
| Validation (install, lint, typecheck, build) | 0 | 0 | 5 |
| Runtime smoke | 0 | 0 | 5 |
| Package managers | 0 | 0 | 7 |
| Upgrade (historical) | 0 | 0 | 1 |
| Packed/published | 0 | 0 | 1 |
| Platform | 0 | 0 | 1 |

By framework:

| Framework | PASS | FAIL | NOT TESTED |
|---|---|---|---|
| react-vite | 16 | 2 | 5 |
| nextjs | 10 | 1 | 4 |
| vue-vite | 10 | 1 | 4 |
| nuxt | 10 | 1 | 4 |
| sveltekit | 10 | 1 | 4 |
| (not framework-specific) | 8 | 1 | 3 |

**Run r2** (from [SUMMARY.md](evidence/validation-r2/SUMMARY.md) and the [generated matrix](CLI-QA-MATRIX-r2.md)): 129 rows; 126 executed; 117 PASS; 9 FAIL; 1 NOT TESTED (the historical-upgrade case); 2 INFO. Its own coverage figure (126/127) only covers what the script plans to run and must not be read as the coverage of the QA scope; the scope coverage is the r1 figure above, with the r2 groups re-validating part of it.

**Rows are not defects.** The 7 FAIL rows of r1 have two causes: F-001 (6 rows: one create-with-install, five `doctor` runs) and the failing test suite (1 row), which F-005 classifies as test portability and not as a product defect. The 9 FAIL rows of r2 have one cause, F-001 (five `doctor` runs on the projects, four `doctor` runs per package manager). Independent product defects demonstrated: one on Windows (F-001) and one low-severity template file (F-002).

## 4. Findings

Classification: **Proven defect** (reproduced, with a log), **Test portability** (the test, not the product, is the issue), **Environmental**, **Hypothesis** (suspected, not reproduced), **Observation**.
No fix was attempted.

| ID | Summary | Classification | Platform |
|---|---|---|---|
| F-001 | Package-manager launch fails on Windows (`create` install for npm; `doctor` for npm, pnpm, Yarn, Bun) | Proven defect (create: npm only; doctor: all four). Create for pnpm, Yarn, Bun and the other call sites: Hypothesis | Windows |
| F-002 | `DEVTO-FSD-CLI-DRAFT.md` shipped in every generated React project | Proven defect, low (template content) | all |
| F-003 | `AGENTS.md` and `CLAUDE.md` in generated Next.js projects | Observation (probably inherited from the Next.js scaffold) | all |
| F-004 | The plan returned by the generators uses OS-native path separators | Observation; no downstream failure demonstrated | Windows |
| F-005 | 14 of 74 tests fail on Windows | Test portability and environmental; no product defect demonstrated by these failures | Windows |

### F-001: package managers cannot be launched on Windows

- **Reproductions.**
  - `create` with install, npm: `node <repo>\bin\index.mjs react-vite-npm --framework react-vite --yes --package-manager npm --no-start`, exit 1 (r1, 2026-10-01 21:51:57 to 21:52:45). The log shows the template downloaded and configured, then `Failed to install dependencies` with `spawnSync npm ENOENT`; the project was rolled back and the target folder was absent. Logs: [stdout](evidence/logs/create-react-vite-npm.stdout.log), [stderr](evidence/logs/create-react-vite-npm.stderr.log).
  - `doctor` for each manager (r2): a copy of a React project with `packageManager` set to the manager, then `doctor`. Exit 1 each time, with the failing line `FAIL <manager> - selected in fsd.config.json`, although the tool is installed: npm 11.19.0, pnpm 12.8.1, Yarn 1.22.22, Bun 1.4.2. Logs: `R2-DOCTOR-npm`, `-pnpm`, `-yarn`, `-bun` in [validation-r2/logs](evidence/validation-r2/logs/). The same false failure appears in the five `doctor` runs of r1 and r2 on the generated projects. (The Yarn tested here is 1.x, not Yarn 4.)
- **Not reproduced (hypothesis, from source reading).** `create` with install for pnpm, Yarn and Bun; `upgrade` with a dependency install; the dev-server start. They use the same pattern: no shell is used when starting the manager (`execFileSync` in `bin/core/project-lifecycle.mjs:20`; `spawnSync(..., { shell: false })` in `bin/commands/inspect-project.mjs:15` and `bin/upgrade/validation.mjs:68-80`; `spawn` with `shell: false` in `bin/commands/create-project.mjs:271`). `where npm` listed `npm` and `npm.cmd` only (terminal transcript saved in [windows-tool-listing.txt](evidence/logs/windows-tool-listing.txt)). Bun is installed and `doctor` still fails for it, so the cause is not limited to `.cmd` shims; the reason for Bun was not investigated.
- **Impact.** On Windows the default create flow fails and rolls back, and `doctor` reports a healthy toolchain as broken. The documentation makes no Windows support claim and CI is Ubuntu-only.
- **Suspected area.** The five call sites above.

### F-002: draft article shipped in the React template

`DEVTO-FSD-CLI-DRAFT.md` is at the root of every project created from the React + Vite template: [listing-rv-noinstall.txt](evidence/logs/listing-rv-noinstall.txt) (r1) and the r2 project. Its first lines are Dev.to front matter with `published: false` and the placeholder `cover_image: "{{COVER_IMAGE_URL}}"` ([template-file-heads.txt](evidence/logs/template-file-heads.txt)), so it is an unpublished article draft and not project content. Template repository: [FSD-CLI/FSD](https://github.com/FSD-CLI/FSD) at `ec8548bf2143c36f44c2475baddb8fa6bb90d016`. It reaches every generated project (the CLI copies the whole template) and breaks nothing.

### F-003: agent files in the Next.js template (observation)

`AGENTS.md` and `CLAUDE.md` are at the root of every project created from the Next.js template ([create-others.summary.txt](evidence/logs/create-others.summary.txt)). The first lines of `AGENTS.md` are the standard `nextjs-agent-rules` block, which suggests they come from the Next.js scaffold ([template-file-heads.txt](evidence/logs/template-file-heads.txt)); `CLAUDE.md` was not inspected. They may be intended, so this is not counted as a defect. Template repository: [FSD-CLI/FSD-NEXTJS](https://github.com/FSD-CLI/FSD-NEXTJS) at `2d44f0bf9dcd030f2ddc48e0a869670ced485efc`.

### F-004: OS-native separators in the generator plan (observation)

- **Observed.** On Windows `createGeneratorPlan` returns `src\pages\account\ui\account-page.tsx` style paths in `generatedFiles` and `changedFiles` ([probe-generator-paths.log](evidence/logs/probe-generator-paths.log); r2 `R2-PROBE-paths-separator`). Source: `path.relative(...)` results in `bin/generator.mjs` are returned unnormalised.
- **What it is not.** The r2 scan of every generated source file found no backslash inside an import or export specifier (R2-IMPORTS-* rows, five frameworks, PASS). No missing output and no downstream failure was demonstrated.
- **Contract.** No document states whether the plan uses POSIX or native separators. Eight tests assert POSIX-style strings; they fail on Windows, which makes the tests' expectation the visible problem.
- **Practical impact.** Output differs by OS for anything that reads the plan (messages, tests, tools). Whether it matters depends on a contract the project has not defined.

### F-005: classification of the 14 failing Windows tests

`npm test` on Windows: 74 tests, 60 pass, 14 fail (Linux CI, same SHA: 74 of 74). Logs: [baseline-npm-test.log](evidence/logs/baseline-npm-test.log), [baseline-failure-heads.txt](evidence/logs/baseline-failure-heads.txt). The 14 are not 14 independent bugs.

| Cause | Tests | Product or test? | How established |
|---|---|---|---|
| Expectations written with POSIX path strings | 9: `hardening` 2, `project-config` 6, `core-architecture` 1 | Test portability (see F-004 for the product side) | `core-architecture`: expected `/workspace/apps/store`, got `E:\workspace\apps\store` (confirmed). `hardening` dry-run: probe shows backslash lists (confirmed). The other 7 use the same `files.includes("a/b/c")` assertion; the cause is inferred |
| ESM loader given a raw `E:\` path, and a POSIX shell script as a fake `npm` | 3: `qa-regressions` | Test harness | `ERR_UNSUPPORTED_ESM_URL_SCHEME ... protocol 'e:'`; test code shown in the failure output. These tests exercise install-failure rollback and `--no-install`, so on Windows that behavior was not exercised by them (the rollback itself was observed in F-001) |
| Test asserts POSIX file mode `0o755` | 1: `upgrade` rollback | Test portability, environmental | `fs.statSync(...).mode & 0o777` compared with `0o755` in `tests/upgrade.test.mjs`; Windows reports `0o666` (438 vs 493) |
| Symlink creation needs a privilege | 1: `upgrade` symlink | Environmental | `EPERM: operation not permitted, symlink` |

## 5. Observations (not findings; not verified further)

- O-001: React and Vue templates' `ci` script is fsd:check, lint, build (no `typecheck`); Next.js, Nuxt and SvelteKit also run `typecheck` ([template-scripts.txt](evidence/logs/template-scripts.txt)). The build may include type checking.
- O-002: the Next.js page generator creates `src/app/account/page.route.tsx` and not `page.tsx`. It may be configured in `next.config.ts`; the CI Next.js build reported success.
- O-003: generator output differs across frameworks (for example the SvelteKit `feature profile` has no `lib/profile.helpers.ts`). It may be by design.
- O-004: npm shows the 2.6.1 publish at 16:51:43 UTC, about 3 minutes before the release commit's timestamp (16:54:51 UTC).
- O-005: templates are downloaded from their default branch on every `create` (unpinned), so a later run may produce different projects. The SHAs above did not change during this QA.
- O-006: each `create` took 27.9 to 31.9 seconds on Windows although a template is a few MB and generators take about 0.25 s. The cause was not investigated (hypothesis: the process waits after finishing).
- O-007: no template has a `test` script, so a test step does not apply to generated projects.

## 6. Coverage gaps

| ID | Gap |
|---|---|
| G-001 | No upgrade test on a real historical (2.5.x) project with install and build. Repository tests use synthetic fixtures; the simulation here only deletes `.fsd/` from a fresh project. |
| G-002 | Package managers: only React is tested with pnpm, Yarn 4 and Bun (CI), and only Nuxt with pnpm (CI). Next.js, Vue and SvelteKit with pnpm, Yarn and Bun, and Nuxt with Yarn and Bun, are not tested anywhere, including the "SvelteKit with Yarn 4" risk case. |
| G-003 | No runtime smoke (dev server, home page, a generated page): every create in CI and here uses `--no-start`. |
| G-004 | `check`, `doctor` and `config` ran only on Windows. Not run on Linux. |
| G-005 | Local install, lint, typecheck and build were not run for any framework (Windows install is blocked by F-001; no manual install was run because of a slow connection). Linux with npm is covered only by the CI run summary. |
| G-006 | Packed and published artifacts were tested on Windows with `--no-install` only. CI runs `npm pack --dry-run` and nothing more. |
| G-007 | No macOS evidence. CI is Ubuntu-only. |

## 7. Limitations of this evidence

- Run r1's batch scripts used the author's paths; they were replaced by `qa-evidence.mjs` after review. r1 logs are historical and unchanged. Some r1 listings are in files created afterwards from the same machine state ([listing-rv-noinstall.txt](evidence/logs/listing-rv-noinstall.txt), [provenance-and-tools.txt](evidence/logs/provenance-and-tools.txt), [windows-tool-listing.txt](evidence/logs/windows-tool-listing.txt), [template-file-heads.txt](evidence/logs/template-file-heads.txt)).
- r1 timestamps exist for creates, generator starts, the legacy apply, and the packed and published creates; other r1 rows have none. r2 records start, end and duration for every command.
- One run of each case; no retries.
- The evidence comes from one Windows machine. Linux comes only from CI.
- Fixes, Windows support, and the unverified rows are outside this documentation change.

## 8. Re-review checklist

| Item | Where |
|---|---|
| All three baseline documents are tracked | this folder: `README.md`, `CLI-QA-REPORT.md`, `CLI-QA-MATRIX.md` (plus generated `CLI-QA-MATRIX-r2.md`) |
| Counts reproducible from the rows | r1: computed from the rows of `CLI-QA-MATRIX.md`; r2: regenerate with `qa-matrix.mjs` |
| Scripts run from their committed location, with reproduction steps | README, r2 manifest and logs |
| Findings separate proven defects, test portability, environment, hypotheses | section 4 |
| Report and PR description agree | the PR description is updated to match this report |
| Final QA commit SHA and raw results for the evidence-tool validation | in the PR reply; audited CLI SHA kept separate |
