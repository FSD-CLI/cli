# QA baseline for CLI 2.6.1

This folder is the current QA baseline for `create-fsd-architecture` 2.6.1. It sits next to the historical 2.5.0 audit in `docs/` (`CLI-QA-REPORT.md`, `CLI-QA-MATRIX.md`, `QA-FIX-VERIFICATION.md`, `TASK-CLI-END-TO-END-QA.md`), which it does not change.

| Item | Value |
|---|---|
| Audited CLI | commit `9640dcc6ab47ebfaedda60ff80572a3ce08e9562`, version 2.6.1, branch `main` |
| QA documents and scripts | later commits on `qa/2.6.1-baseline` (the final SHA is stated in the pull request) |
| Platform of the local runs | Windows 10.0.26200 x64, Node v24.21.0 |
| Linux evidence | CI run [#20](https://github.com/FSD-CLI/cli/actions/runs/36355684306) on the audited commit (Node 22 log inspected, other jobs from the run summary) |

The audited commit and the QA commits are different SHAs. Run r2 checks that nothing outside `docs/` differs between them.

## Files

| Path | What it is |
|---|---|
| [CLI-QA-REPORT.md](CLI-QA-REPORT.md) | Scoped assessment, environment, counts, findings, gaps, limitations |
| [CLI-QA-MATRIX.md](CLI-QA-MATRIX.md) | Run r1: one row per case with command, directory, exit code, timing, expected, observed, status and evidence links |
| [CLI-QA-MATRIX-r2.md](CLI-QA-MATRIX-r2.md) | Run r2: generated from `evidence/validation-r2/results.jsonl` |
| `evidence/logs/` | r1 raw logs, unchanged |
| `evidence/validation-r2/` | r2 raw logs, `results.jsonl`, `manifest.json`, `SUMMARY.md` |
| `evidence/scripts/` | `qa-evidence.mjs` (runner), `qa-matrix.mjs` (matrix renderer), `probe-paths.mjs` (path probe) |

## How to read the results

- **Statuses.** PASS: the command did what the row expected. FAIL: it did not. NOT TESTED: it was not run, so no claim is made. BLOCKED is used only with a documented blocker; none is used here. INFO rows are observations and are not counted.
- **Coverage and pass rate are different numbers.** Coverage is executed cases over planned cases. Pass rate is PASS over executed cases. NOT TESTED cases never count as PASS and never enter the pass rate.
- **A FAIL row is not a defect.** Several rows can share one cause. The report states the cause and its classification.
- **Four source labels, never mixed.** local checkout, packed artifact (`npm pack` tarball), published package (npm registry), CI (Linux, not run by the author).
- **Simulations are labelled.** The "legacy" upgrade rows delete `.fsd/` from a fresh project; they are not a historical project.
- **What the passes mean.** Most local passes cover creation, configuration, layers, generation and inspection commands. Dependency install, lint, typecheck, build and runtime of generated projects were not run locally (see the gaps in the report).
- **Templates are unpinned.** `create` downloads each template repository's default branch. The report records the template SHAs; run r2 checks them again at its end.

## Two runs

- **r1** was made with batch files that hardcoded the author's paths. They were replaced; they remain in the Git history (commit `209bdda`). Their logs are in `evidence/logs/`, unchanged.
- **r2** was made with the portable runner, from a clean clone in a path with spaces, and is the evidence for the scripts. Which script revision made which logs: `evidence/validation-r2/manifest.json` records the SHA-256 of `qa-evidence.mjs` and the commit of the checkout.

## Reproducing run r2

Prerequisites: Git; Node 22 or later (the main QA matrix asked for 22.22.2 or later; the CLI itself accepts Node 20 and later); npm. pnpm, Yarn and Bun are optional; a missing manager gives a NOT TESTED row. Network access is needed for the template downloads, `npm view` and the published-package test.

```text
git clone <repository> "<a clean path, may contain spaces>"
cd "<that path>"
git checkout qa/2.6.1-baseline
npm ci
node docs/qa/2.6.1/evidence/scripts/qa-evidence.mjs --work "<empty or dedicated folder outside the repository>" --out "<folder for the logs>"
node docs/qa/2.6.1/evidence/scripts/qa-matrix.mjs --in "<the --out folder>" --out "<markdown file>"
```

On Windows use backslashes and `cmd`; the commands are otherwise the same.

- `--work` (or `QA_WORK`) is required and must be outside the repository. The runner creates its marker file there, refuses non-empty folders without the marker, and deletes only inside that folder.
- `--out` must be a new or empty directory. Existing evidence is never overwritten. If omitted, each run creates a unique `evidence-<UUID>` folder inside the workspace and prints its path as `output` in the manifest. Use that folder with `qa-matrix.mjs --in`.
- Every run writes `manifest.json`, including runs with only one group. The matrix renderer accepts both Windows and POSIX evidence paths on any supported OS.
- `--groups a,b` runs part of the checks (default: provenance, create, generate, inspect, upgrade, legacy, doctor-managers, imports, probe, packed, published, templates-end). The `install` group creates projects with a real dependency install and runs each template's `ci` script; it is off by default because of the downloads.
- `--cmd-timeout <seconds>` limits each command (default 180). A command that does not finish is recorded as FAIL with its signal.
- `--audited <sha>` is the audited CLI commit (default is the one above).
- The exit code is 0 when no executed case failed, 1 when at least one failed (expected on Windows because of `doctor`), and 2 for a usage error.
- The runner does not modify the repository. Everything it creates is in the workspace and in the output folder.

Run the evidence-tool regression checks with:

```text
node --test docs/qa/2.6.1/evidence/scripts/qa-tools.test.mjs
```

The committed r1/r2 logs and r2 script hash remain historical evidence of the original runs. Updated scripts do not change which revision produced those logs; new runs record their own script hash and checkout SHA.

Verification of the updated tooling: [EVIDENCE-TOOLS-VERIFICATION.md](EVIDENCE-TOOLS-VERIFICATION.md).
