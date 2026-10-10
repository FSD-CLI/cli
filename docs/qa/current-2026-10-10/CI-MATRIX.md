# CI evidence matrix

Source SHA: `fcde52a0b801a6d57b4d5914596dde72bf490ae9`. [Run](https://github.com/FSD-CLI/cli/actions/runs/37682934668); 22/22 planned jobs completed successfully. Every job log and step list was inspected. This is job-level coverage of this workflow, not framework x PM x OS product coverage.

| Job | Expected | Observed | Unit-suite totals, where applicable | Raw log |
|---|---|---|---|---|
| [Cross-OS smoke / macos-latest](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338114) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338114.log) |
| [React / yarn](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338298) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338298.log) |
| [pnpm 11 / nuxt](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338315) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338315.log) |
| [Cross-OS smoke / ubuntu-latest](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338380) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338380.log) |
| [React / pnpm](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338392) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338392.log) |
| [pnpm 10.26.0 / nuxt](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338410) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338410.log) |
| [Cross-OS smoke / windows-latest](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338412) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338412.log) |
| [CLI / Node 22](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338443) | successful required steps | success | tests 93; pass 93; fail 0; skipped 0 | [log](evidence/ci/113003338443.log) |
| [nextjs build](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338448) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338448.log) |
| [React / npm](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338453) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338453.log) |
| [pnpm 11 / react-vite](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338508) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338508.log) |
| [CLI / Node 20](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338516) | successful required steps | success | tests 93; pass 93; fail 0; skipped 0 | [log](evidence/ci/113003338516.log) |
| [Cross-OS CLI / ubuntu-latest](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338519) | successful required steps | success | tests 93; pass 93; fail 0; skipped 0 | [log](evidence/ci/113003338519.log) |
| [React / bun](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338535) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338535.log) |
| [Cross-OS CLI / windows-latest](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338551) | successful required steps | success | tests 93; pass 93; fail 0; skipped 0 | [log](evidence/ci/113003338551.log) |
| [pnpm 10.26.0 / react-vite](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338553) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338553.log) |
| [react-vite build](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338574) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338574.log) |
| [vue-vite build](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338581) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338581.log) |
| [CLI / Node 24](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338603) | successful required steps | success | tests 93; pass 93; fail 0; skipped 0 | [log](evidence/ci/113003338603.log) |
| [sveltekit build](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338648) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338648.log) |
| [Cross-OS CLI / macos-latest](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338724) | successful required steps | success | tests 93; pass 93; fail 0; skipped 0 | [log](evidence/ci/113003338724.log) |
| [nuxt build](https://github.com/FSD-CLI/cli/actions/runs/37682934668/job/113003338818) | successful required steps | success | not a unit-suite job | [log](evidence/ci/113003338818.log) |

Exact shell commands, runner/tool versions and working directories are in the raw logs; start/completion timestamps and step conclusions are in [manifest.json](evidence/ci/manifest.json). No skipped unit-suite job is counted as passing.

The OS lifecycle jobs create React/npm without install/start. Generated builds for all five frameworks run on Ubuntu. React has npm/pnpm/Yarn/Bun build jobs; React and Nuxt additionally have pnpm 10.26/11 quality jobs. This workflow does not prove Windows automatic install, every framework/manager on every OS, browser behavior or real historical upgrades.
