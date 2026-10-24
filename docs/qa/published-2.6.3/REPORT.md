# Published 2.6.3 artifact verification — 11 October 2026

The owner published 2.6.3. Registry gitHead is `9d37a154fd9476ff416941463c6f60c77bab55de`; integrity matches the prepared tarball:
`sha512-rXD8GOrY3cQ4jvRwsBINMqqTg8DQHwhWbjgHFEV+4kopUWbLIEK9wOSE7cdCh4fL3Gm85t/ljL2FjCzoYENm/g==`.

| Platform/runtime | React/Vite + npm | Next.js + npm |
| --- | --- | --- |
| macOS arm64 / Node 24.13.0 / npm 11.6.2 | PASS | PASS |
| Ubuntu 24.04.5 / Node 22.23.0 / npm 10.9.8 | PASS | PASS |

Each smoke installed the exact published CLI, checked its runtime files and version, created an application with dependency installation, generated all four slice types, ran doctor/check, and ran the generated project's quality/build command. Local raw logs and result metadata are in [macos](macos/manifest.json). Ubuntu raw job logs and job conclusions are in [ubuntu](ubuntu/jobs.json).

[GitHub Actions run](https://github.com/FSD-CLI/cli/actions/runs/38154161694) passed both jobs. Logs explicitly record `CLI_SMOKE_VERSION: 2.6.3` and `Published 2.6.3 / <framework>: PASS`. Raw command/registry metadata artifacts were retained successfully by each job.

Immutable refs for all five templates were refreshed in PR #13 and are included in this exact published artifact. Earlier source evidence verified repeated byte-identical downloads and five-framework lifecycle smokes. This report closes publication validation for Task #8; it does not claim all framework/package-manager/runtime combinations, historical upgrades, application runtime/deployment or published Windows lifecycle coverage. Nuxt production audit findings remain independently open.
