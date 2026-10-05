# Cross-Platform CI

The Ubuntu `cli` matrix remains the full Node 20, 22, and 24 test and packed-artifact gate. Framework, package-manager, and pnpm build-policy matrices also remain Ubuntu-only while cross-platform coverage stabilizes.

`cross-os-cli` runs `npm ci`, `npm test`, and `npm pack --dry-run` on Node 22 for Ubuntu, macOS, and Windows.

`cross-os-smoke` runs the following contract on Node 22 for the same operating systems:

- Create a React Vite project without installing dependencies from a workspace whose absolute path contains spaces.
- Confirm `fsd.config.json` and all six FSD layers.
- Generate a feature, entity, widget, page, and auth feature.
- Run `check` and `doctor`, which verifies Git and the selected npm executable on the runner.
- Reject an escaping path and an existing target without changing files.
- Verify project transaction rollback restores the original target and removes partial files.

The smoke harness invokes Node with an absolute CLI path and separate argument arrays. It never uses `shell: true` or shell-specific syntax. Each command writes its arguments, working directory, exit code, stdout, and stderr to `ci-artifacts/os-smoke`. Failed smoke jobs upload those logs as a seven-day GitHub Actions artifact.

There are no OS-specific exclusions. Before making these checks required, observe successful GitHub runs for all three operating systems and record any future exclusion here with its case ID and reason.
