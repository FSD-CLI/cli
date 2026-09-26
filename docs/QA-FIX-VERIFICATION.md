# QA fixes — local verification, 2026-09-23

All eight findings from CLI-QA-REPORT.md now have local changes and targeted
verification. This is not a published release or a claim that every originally
blocked matrix case has been completed. The original audit remains a historical
baseline, not the current fix status.

Base commit: `8f24a2812f3cd79099b1290dbb2cca1bb2a20386`; changes are uncommitted.
Package version is prepared as `2.5.1`; release notes are under **2.5.1**.
This patch release is not yet published. The verification below originally ran
before the metadata bump, on the same fixes labeled locally as `2.5.0`.

| Finding | Local change | Verification |
| --- | --- | --- |
| QA-001: failed install / forced replacement | Installation errors restore the target, preserve manager diagnostics, and exit nonzero | Actual CLI subprocess tests with real setup/Git and controlled failing installer: both new target and forced sentinel target; no-install still succeeds |
| QA-002: lint ignored by Git hook | Fail-fast executable hooks; check staged and unstaged whitespace | Real Git commits with controlled manager commands for all four hook variants; real Next/npm lint failure rejected, invalid message rejected, corrected valid commit accepted |
| QA-003: numeric-leading slice identifiers | Reject before file planning/writes | All five frameworks × four generator types × force/dry-run; no partial writes |
| QA-004: Next formatter | Wrap generic view signatures at the template's 80-column width | Fresh Next checkout feature, product entity, cart-summary widget, account page, auth; npm run ci passes |
| QA-005: pnpm build approvals | Framework-scoped allowBuilds with strictDepBuilds; preserve existing workspace policy | Fresh React and Nuxt install/lint/typecheck/build with pnpm 11.19.0; additional fresh React install/build with minimum pnpm 10.26.0 |
| QA-006: interactive defaults | Initial selections derive from the same framework defaults used by --yes | All-five unit checks plus real PTY Enter-through Nuxt/SvelteKit creation: both save fetch |
| QA-007: --yes still prompts | Require explicit framework before any prompt or filesystem change | Closed-stdin CLI subprocess exits 1 with actionable message and preserves forced target; help and README updated |
| QA-008: favicon 404 | Icon files and base-aware explicit links in React, Vue, SvelteKit templates | Local template changes copied into disposable generated fixtures; all three build, browser icon HTTP 200, zero captured console/page errors |

## Test results

- `npm run check`: **55 tests passed**, 0 failed; npm package dry-run passed.
- New regression file also passed all **19 tests on Node 20**. This was not a
  claim to run the entire generated-project matrix on Node 20.
- Main generated-project runtime: Node 24.21.0. All five freshly downloaded npm
  projects installed; all four slice types and auth generated; `npm run ci`
  passed for React, Next, Vue, Nuxt, and SvelteKit.
- pnpm 11.19.0 wrapper uses bundled Node 24.13.0, as in the original audit.
  React/Nuxt failure reproductions now complete installation and build.
- Real Next first-create hooks were tested with a deliberately unformatted
  but syntactically valid TypeScript file, then with corrected formatting.
- Interactive Nuxt and SvelteKit defaults were tested through PTYs, not only
  by checking configuration constants.
- CI configuration now exercises every generator and includes pnpm 10.26/11
  React/Nuxt jobs. **Remote CI has not run for these unpushed changes.**

The explicit pnpm policy follows the official
[allowBuilds documentation](https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md#allowbuilds)
and [pnpm 11 migration notes](https://github.com/pnpm/pnpm.io/blob/main/blog/releases/11.0.md).
No global approvals, arbitrary dependency-script enablement, or changes to
release-age protections were made. Additional unreviewed build scripts still
fail closed. Existing template workspace configuration is not overwritten.

## Changed repositories

- `create-fsd-architecture`: CLI behavior, regression tests, documentation and CI.
- `FSD`: `index.html`, new `public/favicon.svg` only.
- `fsd-vue`: `index.html` only, linking the existing `public/favicon.svg` unchanged.
- `fsd-sveltekit`: `src/app.html`, new `static/favicon.svg` only.

Pre-existing README/FUNDING/content edits in the template repositories were
left untouched. No monorepo restructuring, remote writes, commits, or npm
publication took place. Existing user projects were not migrated automatically.
Do not use `--force` to upgrade a customized project; these fixes apply to new
creation/generation and require targeted migration for existing output.

## Evidence

Durable logs and test harnesses:
`/Users/ashraf/FSD-Platform/qa-reports/2026-09-23-cli-2.5.0/fix-verification/`

- `npm-check.log`: 55 tests and pack dry-run.
- `ci-{react-vite,nextjs,vue-vite,nuxt,sveltekit}.log`: five generated CI checks.
- `pnpm-*.log`, `pnpm10-minimum.log`: real package-manager installs/builds.
- `git-lint-blocked.log`, `git-message-blocked.log`, `git-valid.log`: real Next hooks.
- `interactive-{nuxt,sveltekit}.log`: terminal prompts and completed setup.
- `favicon-browser-*.json`, `favicon-build-*.log`: three template checks.
- `verify.mjs`, `pnpm.mjs`, `pnpm10.mjs`, `final-smoke.mjs`, `defaults.py`: exact
  local verification commands; scripts embed their disposable fixture root.

Disposable projects remain at `/tmp/fsd-fix-verification.vCVDl7`.

## Publication handoff and remaining limits

1. Commit/push the three template icon changes first, preserving unrelated user
   changes. Until then degit still downloads the old remote icon-less templates.
2. Commit/push the CLI changes and wait for the expanded CI jobs.
3. Commit the prepared `2.5.1` version metadata and changelog, then publish
   manually with the user's npm authentication after CI succeeds.
4. Recheck registry/remote template results after publication.

Full Yarn integration is still not locally verified: the hook tests use
controlled commands, not a real Yarn install. The original gaps for exhaustive
manual-project adaptation, real auth backends, hard interruption recovery,
Windows/Linux local testing and every minimum Node boundary remain. This fix
pass is not a repeat of every one of the original 437 matrix rows.
