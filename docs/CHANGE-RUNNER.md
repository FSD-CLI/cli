# Verified change runner (INT-03)

Internal engine for in-place project changes. It is **not a CLI command**:
other commands use it through the module API in `bin/core/change-runner.mjs`.

## Problem

Several commands rewrite files inside an existing project (upgrades,
generators, policy fixes). Before INT-03 each of them owned its own safety
story: the upgrade command has a full per-file transaction
(`bin/upgrade/transaction.mjs`), while scaffolding only backs up a whole
directory (`beginProjectTransaction` in `bin/core/project-lifecycle.mjs`).
A change that half-applied and then failed left the project in an unknown
state, and nothing verified the result before the change became permanent.

## Lifecycle

```
begin()  →  apply (write/delete)  →  verify()  →  commit() | rollback()
```

1. **Begin** — snapshot every declared file (content + mode) into
   `.fsd/backups/<run-id>/`, reusing the upgrade transaction's snapshot
   mechanics. Files must be declared up front; the runner refuses to touch
   anything it did not snapshot.
2. **Apply** — writes are atomic (temp file + rename). Paths are confined
   to the project root: absolute paths, `..` escapes and symlinks are
   refused.
3. **Verify** — run the project's checks against the changed tree. The
   default verifier is the `fsd check` semantics (`inspectProject`:
   configuration, `package.json`, all six FSD layers). Callers may add
   verifiers, e.g. `verifyAffectedTests({ files })`, which runs
   `node --test` on the tests covering the touched files when that is cheap.
   Every verifier runs, so a failure report lists all failures at once.
4. **Commit** — discard the snapshot; the change is permanent.
   **Rollback** — restore every snapshotted file (created files are
   removed, deleted files come back, modes are restored), in reverse order.

`commit` here means "make permanent". It never creates a Git commit.

## API

```js
import {
  ChangeRunner,
  runVerifiedChange,
  verifyProjectCheck,
  verifyAffectedTests,
} from "./bin/core/change-runner.mjs";

// One-shot form (recommended):
const result = await runVerifiedChange(root, {
  files: ["src/app/index.ts", "src/features/cart/index.ts"],
  apply: (runner) => {
    runner.write("src/app/index.ts", next);
    runner.delete("src/features/cart/index.ts");
  },
  verify: [verifyProjectCheck, verifyAffectedTests({ files: ["tests/cart.test.mjs"] })],
});
if (!result.ok) {
  // result.status === "rolled-back"; the project is as it was.
  // result.verification?.results lists the failing checks.
}

// Manual form, for callers that interleave their own steps:
const runner = new ChangeRunner(root, { files: ["src/app/index.ts"] });
runner.begin();
runner.write("src/app/index.ts", next);
const verification = await runner.verify();
if (verification.ok) runner.commit();
else runner.rollback();
```

`runVerifiedChange` never throws for a failed change: it returns
`{ ok, status: "committed" | "rolled-back", verification?, rollback?, error? }`.
`rollback()` returns `{ ok: false, error }` when the restore itself could
not complete — surface that, because the project may be half-restored.

## Guarantees and limits

- A change that fails verification, or whose `apply` throws, is rolled back
  to the exact pre-change snapshot (content and file mode).
- Verification runs against the changed files on disk, before commit.
- The runner is synchronous-file based and single-process: it does not guard
  against another process editing the same files mid-change.
- Backups live under `.fsd/backups/` inside the project and are removed on
  commit. A crash between begin and commit leaves a backup directory behind;
  it is inert (plain file copies + `metadata.json`) and safe to delete once
  the project state is confirmed.
