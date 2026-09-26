# CLI exploratory QA report — 2026-09-23

> Historical pre-fix audit. For subsequent local fixes and their verification,
> see [QA-FIX-VERIFICATION.md](./QA-FIX-VERIFICATION.md).

## Release recommendation

**Not ready for another release claiming the audited flows are fully reliable.** The default npm projects build across all five frameworks, but forced replacement can discard the original target after a failed install, and the generated pre-commit hook can accept code that failed lint. Fix those two high-priority issues first. This is not a claim that every existing installation is broken.

Audit/report only: no CLI, template, documentation-site, dependency manifest, workflow, or release source was changed. No remote commit, push, or npm publication was performed. Disposable generated repositories received local test commits solely to exercise hooks.

## Executive summary

| Final matrix status | Rows |
| --- | ---: |
| PASS | 392 |
| FAIL | 37 |
| BLOCKED | 7 |
| NOT APPLICABLE | 1 |
| Total | 437 |

These are command/assertion rows, **not 437 independent end-to-end tests or 37 separate bugs**. The failures map to eight findings below. The CLI's own suite passed all 35 tests, both directly and through `npm run check`; those green tests do not cover the discovered integration failures.

Coverage achieved:

- Five real npm default installs, initial lint/typecheck/build, all four slice types plus auth, post-generation checks, Steiger, inspection commands, and browser visits to both `/` and `/account`.
- Explicit Redux React, minimal Fetch Next, Vue stack, Axios Nuxt, and Axios/no-server-state SvelteKit configurations. Managed dependencies and all six FSD layers were checked from generated files.
- Real Bun installs/builds/generation/runtime/hooks for React and Vue. Real pnpm attempts for React, Next, and Nuxt; the latter matrix is mixed, not green.
- Duplicate, force, dry-run hashes, numeric and normalized names, malformed configuration, no-config dependency detection, existing targets, invalid paths, six interactive cancellation points, no-install for all frameworks, caught clone/setup failures, install failures, and no-start flows.
- Packed artifact created and inspected; React and Next were scaffolded by its extracted CLI, manually installed and built, then packed generators/inspection commands were exercised.
- Seven deployed documentation routes fetched successfully and compared with local README, CLI help, generated configuration, paths, and observed behavior.

Remaining limitations are explicit below. In particular, Yarn 4 and real backend auth flows are **not validated**.

## Environment and provenance

| Item | Observed value |
| --- | --- |
| CLI repository | `/Users/ashraf/FSD-Platform/create-fsd-architecture` |
| CLI version | `2.5.0` from package.json and CLI output |
| Exact tested HEAD | `8f24a2812f3cd79099b1290dbb2cca1bb2a20386` |
| Branch | `gitbutler/workspace` |
| HEAD description | GitButler Workspace Commit; do not identify this audit with a different published version |
| Operating system | macOS 27.2, build 26B5086k; Darwin arm64 |
| Main Node | `v24.21.0`, explicit nvm binary |
| npm | `11.19.0` on main test PATH |
| pnpm | `11.19.0`; installed runtime wrapper invokes bundled Node `24.13.0` |
| Bun | `1.3.9` |
| Yarn | Missing executable, ENOENT |
| Browser | Playwright + installed Chromium 1243, headless |
| Main environment | CI=1, NUXT_TELEMETRY_DISABLED=1, NEXT_TELEMETRY_DISABLED=1, NO_COLOR=1 |
| PTY environment | CI unset; real terminal prompts exercised |
| Temporary fixtures | `/tmp/fsd-qa-20260923.4SpwQv` |

The CLI clones moving template refs using degit, not a version-pinned artifact. The observed remote HEADs are archived in `logs/TEMPLATE-REF-*.log`. Those observations were made after the clones, so they are provenance aids, not a guarantee that a future run downloads identical templates. npm installs also resolve dependency ranges. Keep the generated lockfiles if reproducing the exact dependency graph.

Initial working tree contained the user's untracked `TASK-CLI-END-TO-END-QA.md` and `TASK-SAFE-UPGRADE-COMMAND.md`. Both were preserved. Only the two requested QA Markdown deliverables were added to this repository.

## Evidence and reproduction conventions

- [Full case matrix](./CLI-QA-MATRIX.md)
- Durable logs, browser screenshots, JSON results, and test harnesses: `/Users/ashraf/FSD-Platform/qa-reports/2026-09-23-cli-2.5.0/`.
- Disposable generated projects remain under the temporary root above; they are not included in the npm package. Temporary fixtures can be removed by the OS, but the copied logs/harnesses survive separately.
- `results.jsonl` retains all 446 raw execution entries. The matrix consolidates repeated IDs and adds explicit coverage/documentation assertions. Initial IPv4 readiness failures were harness errors: Vite/Nuxt listened on localhost. Reruns using localhost established the actual product results. Initial Next HMR errors on the IPv4 URL did not recur on localhost and are not reported as a product bug.
- Some retry log files reuse their stable case filename; the durable logs represent the final attempt. All raw statuses are retained, but not every superseded stdout stream. A repeated clean-Next commit log filename was shared by invalid and valid attempts; separately named default-Next logs retain both behavioral results.
- Do not rerun a destructive command in an existing personal project. The following examples assume the explicit Node PATH and a fresh disposable `QA_DIR` for each finding.

```sh
export PATH="/Users/ashraf/.nvm/versions/node/v24.21.0/bin:$PATH"
export NUXT_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
CLI=/Users/ashraf/FSD-Platform/create-fsd-architecture/bin/index.mjs
QA_DIR=$(mktemp -d /tmp/fsd-repro.XXXXXX)
cd "$QA_DIR"
```

## Framework results

| Framework | Default npm install / lint / types / build | After five generator calls | Browser home + generated account route | Git behavior |
| --- | --- | --- | --- | --- |
| React + Vite | PASS | PASS, including Steiger | Both HTTP 200; missing favicon only | Invalid message rejected; valid accepted |
| Next.js | PASS | Build/types/Steiger pass; Biome format fails | Both HTTP 200; no browser errors on final run | Invalid message rejected, but valid commit succeeds despite lint failure: QA-002 |
| Vue + Vite | PASS | PASS, including Steiger | Both HTTP 200; missing favicon only | Invalid message rejected; valid accepted |
| Nuxt | PASS | PASS, including Steiger | Both HTTP 200; no captured browser errors | Invalid message rejected; valid accepted |
| SvelteKit | PASS | PASS, including Steiger | Both HTTP 200; missing favicon only | Invalid message rejected; valid accepted |

All generators consumed saved configuration without re-prompting. Nuxt retained `app/pages` for FSD slices and `app/app/routes` for route wrappers; SvelteKit retained `src/pages` and `src/routes`, with its separate FSD app alias. Existing home routes remained accessible after account-page generation. No runtime exception was captured in the final five-framework browser pass; the three strict console-cleanliness failures are isolated in QA-008.

Auth results mean generated code passes the applicable compiler/build checks, **not** that login, email verification, password reset, sessions, cookies, or backend authorization were tested against a live service. Next's unrelated generic component formatting failures still make its full post-generation lint run fail.

## Package-manager results

| Manager | Projects exercised | Result |
| --- | --- | --- |
| npm 11.19.0 | Five defaults, five explicit-stack variants, five no-install/manual-install projects, packed React/Next | Real installs and builds successful; findings above still apply |
| Bun 1.3.9 | React and Vue | Install, lint/types/build, feature/auth generation, dev home, invalid/valid commits pass; `bun.lock` retained |
| pnpm 11.19.0 | React, Next, Nuxt | Next install/build/runtime/hooks pass, with known Next generated formatting failure. React/Nuxt install returns ERR_PNPM_IGNORED_BUILDS; retries and manager-run checks also fail |
| Yarn 4 | Planned React and SvelteKit cases | BLOCKED: executable absent. No Yarn integration success claimed |

pnpm failures are scoped to the exact installed pnpm version/configuration. Its wrapper uses a different but still sufficiently new Node runtime. Do not generalize these results to every pnpm release. No global build-script approval or security policy was changed to force a green result.

## Findings, ordered for triage

### QA-001 — High — Failed installation commits a forced replacement and reports success

Affected: shared create flow, all frameworks/managers structurally; behavior reproduced with missing Yarn on forced React creation and ordinary failed pnpm installs on React/Nuxt.

Preconditions: a disposable target containing a sentinel; selected package manager cannot complete installation. Yarn must be absent for this exact reproduction.

```sh
mkdir target
printf 'original\n' > target/sentinel.txt
node "$CLI" target --framework react-vite --package-manager yarn --yes --force --no-start
echo "exit=$?"
test -f target/sentinel.txt
```

Expected: actionable install failure with nonzero exit; original directory restored according to the `--force` automatic-rollback contract.

Actual: CLI exits 0, prints `Failed to install dependencies.` followed by `Project created successfully!`; `sentinel.txt` is gone. The original backup is committed away, not restored. Only disposable test data was removed during this audit; no user project was targeted.

Evidence: `logs/FORCE-INSTALL-FAILURE.log`, `edge-snapshots.json`, `logs/VARIANT-CREATE-react-pnpm.log`, `logs/VARIANT-CREATE-nuxt-pnpm.log`. Forced data-loss path observed once; swallowed install failures independently observed in both pnpm projects. Caught clone/setup failures **did** restore the sentinel, as shown by `ROLLBACK-*-proof.log`; this is specifically an install-error policy gap.

Suspected area: `bin/commands/create-project.mjs:236` catches and discards the install error, then reaches `transaction.commit()`; `bin/core/project-lifecycle.mjs` deletes the backup at commit.

Impact: scripted consumers receive false success; users relying on rollback can lose the previous directory after unsuccessful replacement. The underlying installation diagnostic is hidden too.

Suggested direction: define failure vs intentional `--no-install` semantics separately; propagate stderr and exit status, and roll back a failed forced replacement. Add behavioral install-failure tests, including an existing sentinel.

### QA-002 — High — Pre-commit does not stop on failed lint

Affected: generated pre-commit hooks for every manager share the same sequential-command implementation. Behavior reproduced in npm Next; a fresh clone/install scenario behaves differently because Husky restores its wrapper.

Preconditions: newly created Next project whose generated checkout/cart-summary code fails Biome but still builds.

```sh
node "$CLI" app --framework nextjs --yes --no-start
cd app
node "$CLI" -g feature checkout
node "$CLI" -g widget cart-summary
npm run lint
git config user.name 'FSD QA'
git config user.email 'fsd-qa@example.invalid'
git add .
git commit -m 'test: verify generated project'
git commit --allow-empty -m 'test: lint should block this commit'
```

Expected: both commit attempts stop when lint exits 1.

Actual: lint prints `Found 2 errors`, build succeeds, and Git commits successfully with exit 0. Two named valid-commit runs reproduced this. Commitlint itself **does work**: the invalid message `test` is rejected. Do not confuse commit-message validation with code-quality enforcement.

Evidence: `logs/GENERATED-nextjs-lint.log`, `logs/GIT-VALID-nextjs.log`, `logs/HOOK-LINT-GATE.log`, and `logs/GIT-INVALID-nextjs.log`.

Suspected area: `bin/core/project-lifecycle.mjs:72` and `:77` set hooksPath directly to `.husky`; `:131` emits `lint`, `git diff --check`, and `build` without `set -e` or explicit short-circuiting. This bypasses Husky's `.husky/_` wrapper, leaving the shell to return the final command's result.

Impact: failing lint or whitespace checks can enter history despite advertised guards. A fresh local clone + npm install reset hooksPath to `.husky/_`; its valid/invalid commits passed the expected checks, so test both first creation and reinstall paths when fixing.

Suggested direction: use a consistent Husky entrypoint and fail-fast hook semantics; assert that an intentionally failing lint blocks a valid Conventional Commit. Keep commitlint tests separate.

### QA-003 — Medium — Numeric-leading slice names generate invalid TypeScript

Affected: shared name validation; reproduced with a React feature and a React/Redux entity. Other framework outputs were not all numerically stress-tested.

```sh
node "$CLI" app --framework react-vite --yes --no-start
cd app
node "$CLI" -g feature 123start
npm run typecheck
npm run build
```

Expected: reject the name before writing, or normalize it into valid identifiers and preserve compilability.

Actual: generation exits 0 and emits declarations such as `export type 123start` and `function 123startView`; TypeScript exits 2 with TS1003/TS1351. Independently, `-g entity 9product` in the Redux fixture also breaks typecheck.

Evidence: `logs/NUMERIC-GEN.log`, `logs/NUMERIC-TYPECHECK.log`, `logs/NUMERIC-BUILD.log`, `logs/NUMERIC-REPEAT-TYPECHECK.log`.

Suspected area: `bin/generator.mjs:78` only checks for a nonempty normalized string; identifier conversion in generator helpers assumes a valid leading character.

Impact: accepted input immediately breaks the project. Kebab/Pascal/snake and space-containing variants normalize consistently; duplicates are protected. `app`, `api`, and `index` feature names compiled in the tested React/Bun fixture. That does not establish safety for every reserved route name in every router.

Suggested direction: validate normalized slice/identifier names before planning writes and add compile-based edge tests, not only filename assertions.

### QA-004 — Medium — Next generic feature/widget output fails the template's formatter

Affected: Next template using Biome 2.2.0; reproduced under npm default, npm minimal optional stack, and pnpm.

```sh
node "$CLI" app --framework nextjs --yes --no-start
cd app
node "$CLI" -g feature checkout
node "$CLI" -g widget cart-summary
npm run lint
```

Expected: unedited generated files pass the template's own lint/format gate.

Actual: Biome exits 1 and requests multiline function parameter formatting in `checkout-view.tsx` and `cart-summary.tsx`. Typecheck and production build still pass. Reproduced in three distinct Next stack/manager fixtures; generic checkout alone is sufficient in the minimal fixture.

Evidence: `logs/GENERATED-nextjs-lint.log`, `logs/VARIANT-minimal-lint.log`, `logs/VARIANT-next-pnpm-lint.log`.

Suspected area: React-family generic component templates in `bin/generator.mjs` and `bin/generators/basic-slices.mjs`, matched against the Next Biome rules.

Impact: generated code needs manual formatting before a proper lint gate/CI can pass. QA-002 currently masks this in first-create Git hooks.

Suggested direction: align emitted formatting with the shipped template, or run a scoped deterministic formatter; test generated outputs with the actual formatter across representative name lengths.

### QA-005 — Medium — Current pnpm flow needs dependency build-script approvals

Affected: pnpm 11.19.0 in this environment, React and Nuxt; Next succeeded. Dependency versions matter.

```sh
node "$CLI" app --framework react-vite --package-manager pnpm --yes --no-start
cd app
pnpm install
pnpm run build
```

Repeat with `--framework nuxt` in a new disposable parent.

Expected: either supported unattended installation succeeds with a deliberate narrowly scoped policy, or CLI surfaces the actionable approval requirement and fails truthfully.

Actual: React reports `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @swc/core@1.16.2`. Nuxt lists `esbuild@0.28.2`, `unrs-resolver@1.12.2`, and `vue-demi@0.14.10`. pnpm advises `pnpm approve-builds`. Retries reproduce this; package-manager run commands and dev startup also fail in these fixtures. Initial CLI output hides the detailed pnpm error and exits 0 (QA-001).

Evidence: `logs/PNPM-RETRY-react.log`, `logs/PNPM-RETRY-nuxt.log`, `logs/PM-POSTFAIL-*-build.log`, `logs/PM-RUNTIME-*-pnpm.log`.

Suspected area: package-manager/template policy for current pnpm versions, plus error propagation in create flow. This is not proven to occur on older pnpm releases or every machine.

Impact: the advertised pnpm path is not unattended-successful for two tested frameworks. No blanket dependency-script trust was enabled by the audit.

Suggested direction: document/test supported manager versions, explicitly decide which dependency scripts are trusted, and preserve the manager's actionable diagnostic. Review any approval allowlist rather than disabling protections globally.

### QA-006 — Medium — Interactive defaults differ from `--yes` defaults

Affected: Nuxt and SvelteKit.

```sh
node "$CLI" app --framework sveltekit --no-install --no-start
# Press Enter at API, server state, client state, forms, and manager prompts.
node -p 'JSON.parse(require("fs").readFileSync("app/fsd.config.json", "utf8")).apiClient'
```

Repeat with Nuxt. Compare with a fresh project using `--yes`.

Expected: accepting defaults saves `fetch`, matching the framework defaults and public SvelteKit documentation.

Actual: accepting the preselected options saves `axios` for both frameworks; `--yes` correctly saves `fetch`. Confirmed in both frameworks with actual PTY keypresses, not source inference alone.

Evidence: `logs/INTERACTIVE-DEFAULT-nuxt.log`, `logs/INTERACTIVE-DEFAULT-sveltekit.log`, generated configs in `interactive-*`, and archived public `DOC-frameworks-sveltekit.txt`.

Suspected area: `promptProjectConfig` uses `initial: 0` while the API choices are ordered Axios then Fetch; it does not derive the index from each framework's capability defaults.

Impact: two ostensibly equivalent ways to accept defaults produce different dependencies and clients.

Suggested direction: derive selection indices from the same default configuration used by `--yes`, and test interactive parity for every framework.

### QA-007 — Medium — `--yes` still prompts if the framework is omitted

Affected: create command without `--framework`.

```sh
node "$CLI" app --yes --no-install --no-start
```

Expected: the help text's promise to skip interactive prompts is honored, or a required-framework error is returned explicitly.

Actual: a real terminal receives `Select project type`. With stdin closed, the command prints the prompt, exits 0, and creates no project. Both PTY and noninteractive variants were tested.

Evidence: `logs/YES-STILL-PROMPTS.log`, `logs/YES-NONINTERACTIVE.log`, `logs/BASE-help.log`.

Suspected area: `selectTemplate(options.framework)` runs before the `options.yes` default-selection branch.

Impact: automation can observe a successful exit without an output project, or unexpectedly require input. `--framework <id> --yes` works and was used for the main matrix.

Suggested direction: make the no-framework behavior explicit and test closed stdin; either choose a documented default or return a nonzero usage error, then align help.

### QA-008 — Low — Missing favicon creates browser console noise

Affected: React, Vue, SvelteKit default templates on the tested browser; Next and Nuxt had no captured error.

Reproduction: create an affected default project, run `npm run dev`, open its home page in a fresh Chromium context, inspect the console/network request for `/favicon.ico`.

Expected: first page load has no missing shipped asset request.

Actual: home and generated `/account` both respond 200 with expected content; the browser records `/favicon.ico` 404. No uncaught application exception was observed. Reproduced across the three templates in two localhost browser passes.

Evidence: `logs/RUNTIME-react-vite.json`, `logs/RUNTIME-vue-vite.json`, `logs/RUNTIME-sveltekit.json`, corresponding screenshots/server logs.

Suspected area: template static assets/document head. This is a low-priority polish issue, not failed routing or a broken application.

Suggested direction: supply a real favicon or explicit icon link and include first-load console checks in template smoke tests.

## Documentation comparison and diagnostic limits

| Topic | Comparison |
| --- | --- |
| Stable frameworks and CLI version | README/help agree with the registry and local 2.5.0 CLI: five stable frameworks |
| FSD structure, saved config, slice reuse | Matches inspected generated files; all six layers present, choices persisted, generators did not re-prompt |
| Framework routes and aliases | Generated `/account` plus original home actually loaded across all five |
| Auth descriptions | File generation and stack choices exercised; backend claims are not end-to-end verified |
| Force rollback | README/help overpromise relative to install failure: QA-001 |
| `--yes` help | Skip-all-prompts wording is not true without `--framework`: QA-007 |
| SvelteKit interactive default | Public page says Fetch; pressing Enter selects Axios: QA-006. Nuxt default table also needs interactive/noninteractive parity |
| Package-manager support | npm/Bun observed successful; current pnpm needs an approval path, Yarn absent. Do not present the audit as a four-manager green matrix |
| Node requirements | Main tests exceed stated minima. Vite dependency engine reads `^20.19.0 || >=22.12.0`, so CLI Node >=20 is not a complete generated-project compatibility statement; exact lower boundaries not run |
| `check` and `doctor` | Detect missing primary layers and malformed config. They do not inspect installed dependencies or deep imports; copied projects without node_modules still pass. Use Steiger/compiler/package-manager checks for those concerns |
| `doctor` Node check | Source compares only major >=20, not framework/package-specific requirements. Lower-version runtime behavior not tested, so this is a diagnostic limitation, not a proven lower-version integration result |
| `config` outside a project | Exits 0 and infers React/Fetch/no-state defaults even without package.json; check/doctor correctly reject the nonproject for missing files/layers |
| Missing fsd.config.json | Framework inferred from dependency names in all five minimal fixtures; npm assumed and slices written at root when the source directory is absent. Does not prove arbitrary manual-project integration works |
| Git quality checks | Commitlint rejects invalid messages, but first-create code-quality guard can continue after lint failure: QA-002 |

Public evidence was fetched from `https://fsd-docs.vercel.app/docs/` routes: `getting-started`, `configuration`, `slice-generator`, `auth-generator`, `frameworks/vue`, `frameworks/nuxt`, `frameworks/sveltekit`. Archived body text is under `logs/DOC-*.txt`. This was a CLI-claim comparison, not a complete site accessibility, SEO, link, or content audit.

## Blocked, limited, or not applicable

1. **Yarn 4:** unavailable locally; baseline version probe and both planned framework integrations marked BLOCKED. Required next step: install/select a supported Yarn 4 executable, then run the complete React/SvelteKit manager matrix.
2. **Independent no-config applications:** package.json-only fixtures tested detection, defaults, paths, and no-prompt generation for five frameworks. Full independently configured manual apps with working aliases/router/provider integrations were not prepared; build/runtime integration is BLOCKED, not inferred from file writes.
3. **Exact minimum Node matrix:** not executed. Main tests use Node 24.21.0 and pnpm's bundled 24.13.0. Needs isolated supported-minimum runtimes and all template-specific engine boundaries.
4. **Real auth backend:** no test server/API contract or credentials supplied. No claim about successful authentication, session persistence, reset mail, or authorization. No credentials are needed for the generator/build checks already completed.
5. **Hard interruption:** process-local module-load injection safely reproduced caught clone/configuration exceptions and rollback. SIGKILL, machine shutdown, disk-full, filesystem-permission failure, and backup recovery on the next launch were not exercised. These are not equivalent to caught exceptions.
6. **Unit test scripts in generated apps:** none present in the five default manifests; marked NOT APPLICABLE, while lint, typecheck, build, and Steiger all ran. The CLI's own 35 tests did run.
7. **Scope limits:** no Windows/Linux execution, exhaustive combinatorial stack sweep, production deployment/load test, live auth transaction, or complete third-party dependency audit. Selected Axios/Fetch variants were compiled; browser SSR checks were on default stacks, not every alternative.
8. **Reserved names:** `app`, `api`, and `index` were feature names in the React build check, not an exhaustive framework-native page-route collision matrix. First-create Git hooks were tested across all five; fresh clone/install hook behavior was additionally exercised for React only.

## Recommended non-overlapping implementation tasks

1. **Creation transaction/error contract — QA-001:** own create flow error handling and rollback integration tests. Preserve the separate-template clone architecture. No broader redesign is required.
2. **Hook execution contract — QA-002:** own Husky setup/hooks and lint-failure/invalid-message/fresh-install regression tests. Coordinate with task 1 because both touch project lifecycle code; land sequentially if editing the same file.
3. **Generator correctness — QA-003 + QA-004:** name validation and formatter-compatible emitted code, with compile/lint tests across actual templates. This can be developed independently of create failure handling.
4. **Package-manager compatibility — QA-005:** pin/document the tested support range and decide a safe dependency build-approval policy. Re-run pnpm and obtain genuine Yarn 4 evidence. This depends on task 1 surfacing manager failures clearly.
5. **CLI prompt contract and documentation — QA-006 + QA-007:** unify interactive defaults and unattended behavior; update help/docs only after behavior is agreed and regression-tested.
6. **Template polish — QA-008:** fix missing icons in the affected template repositories and rerun first-load console checks.

After fixes, repeat the failed cases first, then the five-framework default/generator matrix and manager-specific integrations. Keep publication manual under the user's control. These QA artifacts alone do not require an npm version bump or publication.
