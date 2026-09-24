# Task: Full CLI Exploratory QA and Documentation Audit

## Objective

Perform a complete end-to-end exploratory test of `create-fsd-architecture` as a real user would use it.

The goal is to discover functional problems, confusing behavior, missing validation, broken generated code, installation failures, and documentation gaps across all supported frameworks and main CLI workflows.

This task is an **audit and reporting task first**. Do not start fixing discovered problems in the same branch unless a fix is separately assigned after triage. We need one trustworthy view of the current product before changing it.

## Repository and product scope

- Repository: `create-fsd-architecture`
- Test all currently advertised stable frameworks:
  - React + Vite
  - Next.js
  - Vue + Vite
  - Nuxt
  - SvelteKit
- Test project creation, dependency installation, project startup/build, generators, saved configuration, inspection commands, Git, Husky, Commitlint, package managers, and failure behavior.
- Compare observed behavior with the CLI `README.md`, `--help`, and the public documentation. Record every mismatch.

## Important rules

- Run all generated-project tests inside disposable test directories, never inside the CLI repository.
- Do not delete or overwrite an existing personal project.
- Use the current local CLI code for the main audit, for example `node /absolute/path/to/bin/index.mjs`.
- Also test the packed package once using `npm pack`, because package contents may differ from the repository checkout.
- Record the exact CLI commit SHA, operating system, Node version, and package-manager versions.
- Use Node.js `22.22.2` or later for the main generated-project matrix.
- Do not call a case passed if installation, build, typecheck, lint, runtime startup, or generated code was not actually verified.
- Use the statuses `PASS`, `FAIL`, `BLOCKED`, and `NOT APPLICABLE`.
- Save relevant logs for failed or blocked cases. Do not rely only on screenshots.

## Required deliverables

Create the following two files in the CLI repository:

### 1. `CLI-QA-MATRIX.md`

A table containing every test case with:

| Field | Required content |
| --- | --- |
| ID | Stable case ID such as `CREATE-01` |
| Area | Create, generate, install, Git, inspect, error handling, etc. |
| Framework | Framework under test or `all` |
| Package manager | npm, pnpm, Yarn, Bun, or N/A |
| Command/steps | Exact reproducible commands |
| Expected | Expected user-facing result |
| Actual | What really happened |
| Status | PASS, FAIL, BLOCKED, or NOT APPLICABLE |
| Evidence | Relevant log or generated file path |
| Issue ID | Link to the detailed finding when failed |

### 2. `CLI-QA-REPORT.md`

The report must contain:

1. Environment and tested commit.
2. Executive summary with counts by status.
3. Framework-by-framework result summary.
4. Package-manager result summary.
5. Detailed findings ordered by severity.
6. Documentation mismatches.
7. Untested or blocked areas and the exact reason.
8. Recommended triage order.
9. A clear release recommendation: ready, ready with known limitations, or not ready.

Each bug must include:

- Finding ID.
- Severity: `Critical`, `High`, `Medium`, or `Low`.
- Affected frameworks/package managers.
- Preconditions.
- Exact reproduction commands.
- Expected result.
- Actual result.
- Relevant error output.
- Whether the problem is consistently reproducible.
- Suspected area of the codebase, if known.
- User impact.
- Suggested direction, without implementing the fix.

## Phase 1 — Establish the baseline

Run and record:

```bash
node --version
npm --version
pnpm --version
yarn --version
bun --version
git rev-parse HEAD
npm ci
npm test
npm run check
node bin/index.mjs --help
node bin/index.mjs --version
node bin/index.mjs --list-templates
```

Validate that:

- Help output matches the available commands and flags.
- The reported CLI version matches `package.json`.
- Template names and statuses match the README.
- The package passes its own automated tests before generated projects are tested.
- Missing optional package managers are marked clearly instead of silently skipped.

## Phase 2 — Framework creation matrix

Create a real project for every framework using npm and the default stack.

### CREATE-01 — React + Vite default flow

```bash
node bin/index.mjs qa-react \
  --framework react-vite \
  --package-manager npm \
  --yes \
  --no-start
```

Verify:

- The template is cloned successfully.
- Dependencies install successfully.
- `fsd.config.json` exists and contains the selected framework and stack.
- All primary FSD layers exist from the first creation.
- Only the selected stack dependencies are installed.
- Git is initialized.
- Husky and Commitlint are configured.
- Lint, typecheck, tests, and build scripts are run when present.
- The development server starts and the home page loads without runtime errors.

### CREATE-02 — Next.js default flow

Create a Next.js project with npm and defaults. Verify the same general requirements plus:

- App Router files remain valid.
- FSD pages are not incorrectly placed inside Next.js route directories.
- Generated route wrappers import from the correct aliases.
- Server/client boundaries do not produce build errors.
- Production build and development startup both succeed.

### CREATE-03 — Vue + Vite default flow

Create a Vue project with npm and defaults. Verify:

- Vue-native dependencies are used.
- Pinia, Vue Query, validation, router, and aliases are configured correctly.
- No React-only dependency or generated file leaks into the project.
- Build and development startup succeed.

### CREATE-04 — Nuxt default flow

Create a Nuxt project with npm and defaults. Verify:

- Installation completes without peer-dependency or module errors.
- FSD layers are created under the intended Nuxt source directory.
- File-based routes remain separate from the FSD pages layer.
- Selected Nuxt modules are registered exactly once.
- SSR-related providers build without runtime or hydration errors.
- Build and development startup succeed.

### CREATE-05 — SvelteKit default flow

Create a SvelteKit project with npm and defaults. Verify:

- Installation completes successfully.
- Svelte 5 output uses valid syntax.
- SvelteKit route wrappers are thin and import the FSD page correctly.
- `$app` is not incorrectly reused as the FSD app alias.
- Svelte Query, stores, Superforms, Zod, and environment variables are valid.
- Build and development startup succeed.

## Phase 3 — Complex stack combinations

The tester must use explicit non-default flags and confirm that the generated project contains only the chosen stack.

### STACK-01 — React with Axios, Redux, React Query, and forms

Create a React project using explicit flags for:

- Axios.
- React Query.
- Redux Toolkit.
- React Hook Form + Zod.

Generate an auth feature, build the project, and inspect dependencies and providers.

### STACK-02 — Next.js with native Fetch and minimal optional state

Select native Fetch and every supported `none` option that the capability matrix permits. Verify that unused packages, providers, and imports are absent and that the project still builds.

### STACK-03 — Vue with Axios and the supported Vue stack

Use explicit non-default selections, generate a normal feature and an auth feature, and validate the generated Vue code.

### STACK-04 — Nuxt with explicit stack flags

Test Axios versus native `$fetch` where supported. Confirm that Nuxt configuration, plugins, dependencies, and server behavior match the saved selection.

### STACK-05 — SvelteKit with explicit stack flags

Test Axios versus native Fetch where supported and test optional server state. Confirm that generated providers and environment access change correctly.

### STACK-06 — Invalid cross-framework combinations

Attempt unsupported combinations, such as React-only state in Vue/Svelte or Vue-only options in React. The CLI must reject them clearly before corrupting or partially creating a project.

Record the exact command and error for each attempted invalid combination.

## Phase 4 — Package-manager matrix

Test the same React + Vite default creation with:

- npm
- pnpm
- Yarn 4
- Bun

For every package manager:

1. Create the project with dependency installation enabled.
2. Verify that only the correct lockfile remains.
3. Run the generated project's build using that package manager.
4. Run the generated project's development server.
5. Generate one feature after installation and rebuild.
6. Verify Git hooks and Commitlint.

Then perform at least these additional non-React checks:

- Next.js with pnpm.
- Vue with Bun.
- Nuxt with pnpm.
- SvelteKit with Yarn 4.

If a package manager fails because it is not installed, record `BLOCKED` and the version/setup that is missing. Do not record `PASS` based only on the generated command.

## Phase 5 — Generator matrix

Inside generated projects, test every supported generator:

```bash
node /path/to/bin/index.mjs --generate feature checkout
node /path/to/bin/index.mjs --generate entity product
node /path/to/bin/index.mjs --generate widget cart-summary
node /path/to/bin/index.mjs --generate page account
node /path/to/bin/index.mjs --generate feature auth
```

Run this full generator matrix in at least:

- React + Vite.
- Next.js.
- Vue + Vite.
- Nuxt.
- SvelteKit.

For each framework, verify:

- Files are generated in the correct FSD layer and segment.
- Public API files export the correct modules.
- Imports obey the framework aliases and do not deep-import incorrectly.
- A generated page is registered through the correct framework-native router.
- Existing routes are preserved.
- The generated auth flow matches the selected stack.
- Generators read `fsd.config.json` and do not ask the user to select the stack again.
- The complete project still passes lint, typecheck, and build after all generators run.

## Phase 6 — Generator edge cases

Test all of the following:

### GEN-EDGE-01 — Duplicate slice

Generate the same slice twice. Confirm that the second attempt is rejected without changing the existing files.

### GEN-EDGE-02 — Force replacement

In a disposable project, modify a generated slice and regenerate it with `--force`. Record exactly what is replaced and confirm that unrelated slices remain unchanged.

### GEN-EDGE-03 — Dry run

Run creation and generation with `--dry-run`. Save a filesystem snapshot before and after and confirm that no file, directory, lockfile, or Git state changes.

### GEN-EDGE-04 — Unusual names

Try:

- `user-profile`
- `UserProfile`
- `user_profile`
- A name containing spaces.
- A name beginning with a number.
- An empty name.
- A reserved or route-sensitive name such as `app`, `api`, or `index`.

Document which values are accepted, normalized, or rejected. Accepted names must generate valid code that builds.

### GEN-EDGE-05 — Missing and damaged configuration

Test generation when:

- `fsd.config.json` is missing.
- The file contains invalid JSON.
- The framework field is unknown.
- A stack choice is unsupported.
- The schema version is unsupported.
- The saved package manager is unavailable.

The CLI must give an actionable message and avoid partial writes.

### GEN-EDGE-06 — Existing project without CLI configuration

Try generation inside manually created React, Next.js, Vue, Nuxt, and SvelteKit fixtures without `fsd.config.json`. Record framework detection, defaults, prompts, generated paths, and any incorrect assumptions.

## Phase 7 — Project-creation edge cases

### CREATE-EDGE-01 — Existing target directory

Try creation when the target directory already exists and contains a sentinel file. Confirm that creation stops and the sentinel remains untouched.

### CREATE-EDGE-02 — Forced replacement

Repeat only in a disposable directory with `--force`. Verify the replacement behavior and whether rollback restores the previous directory after a simulated setup failure.

### CREATE-EDGE-03 — No install

Create every framework with `--no-install --no-start`. Verify:

- No dependency installation occurs.
- The output prints the correct next command for the selected package manager.
- The generated project is otherwise complete.
- Installing manually afterward produces a valid build.

### CREATE-EDGE-04 — No start

Confirm `--no-start` never starts a long-running server but still installs and validates everything else expected.

### CREATE-EDGE-05 — Cancel interactive prompts

Cancel at the project-name, framework, stack, package-manager, install, and start prompts. Confirm that cancellation is clean and no partial target remains.

### CREATE-EDGE-06 — Invalid project paths and names

Safely test in a disposable parent directory:

- Existing nested path.
- `../` traversal attempt.
- Absolute path.
- Current-directory target.
- Name containing spaces.
- Name beginning with a dot.
- Very long name.

Do not run any destructive variation outside the disposable directory. Record whether path validation is clear and safe.

### CREATE-EDGE-07 — Interrupted or failed setup

Using a safe disposable fixture, test failure during clone, configuration, and dependency installation where practical. Verify rollback behavior and whether the CLI exits with a truthful non-zero status.

If a failure cannot be simulated safely, mark it `BLOCKED` and explain why.

## Phase 8 — Git, Husky, and Commitlint

For at least React, Next.js, Nuxt, and SvelteKit generated projects:

1. Confirm a Git repository exists.
2. Configure test-only local Git identity, never global identity.
3. Stage the generated files.
4. Attempt an invalid commit message such as `test`.
5. Confirm the invalid message is rejected.
6. Commit with a valid Conventional Commit message such as `test: verify generated project`.
7. Confirm the valid message succeeds.
8. Check that hooks work after a fresh clone/install scenario where practical.
9. Confirm package-manager-specific hook commands do not assume npm incorrectly.

Record whether Commitlint is truly executed. The presence of a config file alone is not a pass.

## Phase 9 — Inspection commands

Test the following in each supported framework:

```bash
node /path/to/bin/index.mjs check
node /path/to/bin/index.mjs doctor
node /path/to/bin/index.mjs config
```

Run them against:

- A clean generated project.
- A project missing one primary FSD layer.
- A project with an invalid `fsd.config.json`.
- A project with missing selected dependencies.
- A project with an unexpected deep import.
- A directory that is not a project.

Verify exit codes as well as printed messages. A command that prints an error but exits successfully must be recorded as a finding.

## Phase 10 — Packed-package test

Run `npm pack` and inspect the archive contents.

Verify:

- Every required runtime file is included.
- Tests, temporary QA projects, logs, and secrets are excluded.
- The executable has the correct path and permissions.
- The CLI can create at least one React project and one Next.js project when invoked from the packed tarball rather than directly from the repository.
- `--help`, `--version`, generators, and inspection commands still work from the packed package.

## Phase 11 — Documentation audit

Compare actual behavior against:

- `README.md`.
- `node bin/index.mjs --help`.
- The public documentation routes related to getting started, configuration, slice generation, auth generation, and frameworks.

Check at least:

- Supported framework names and status.
- Minimum Node versions.
- Available flags and defaults.
- Default stack for every framework.
- Package-manager support.
- Generated directory structure.
- Generator output and route behavior.
- Auth generator contents.
- `fsd.config.json` fields and reuse behavior.
- Git/Husky/Commitlint behavior.
- `check`, `doctor`, and `config` output.
- Failure behavior and rollback claims.

Every mismatch must be included in the QA report. Do not silently edit documentation during this audit.

## Minimum completion threshold

The task is complete only when:

- [ ] All five frameworks have been created with real dependency installation.
- [ ] All five generated projects have been built successfully or have a documented reproducible failure.
- [ ] Development startup has been smoke-tested for all five frameworks.
- [ ] Every generator type has been exercised for every framework.
- [ ] Auth generation has been tested for every framework.
- [ ] npm, pnpm, Yarn 4, and Bun have been genuinely exercised or explicitly marked blocked.
- [ ] Git and Commitlint have been behaviorally tested, not only inspected.
- [ ] `check`, `doctor`, and `config` have been tested on valid and broken projects.
- [ ] Dry-run, no-install, no-start, force, duplicate, cancellation, invalid input, and rollback behavior have been covered.
- [ ] The packed npm artifact has been tested.
- [ ] README/help/public-doc claims have been compared with actual behavior.
- [ ] `CLI-QA-MATRIX.md` contains exact reproducible evidence for every case.
- [ ] `CLI-QA-REPORT.md` clearly distinguishes pass, failure, blocked, and untested work.
- [ ] No product source code or documentation has been changed as part of the audit.

## Final handoff

When finished, send:

1. The two Markdown deliverables.
2. A short list of the five highest-priority findings.
3. The exact commands for every reproducible failure.
4. The location of relevant logs.
5. A list of cases that could not be completed and why.
6. A recommendation for how to split fixes into separate, non-overlapping tasks.

