# Evidence-tool fixes: verification

Verified on 2026-10-07 on macOS arm64 with Node v24.13.0. Tested script commit: `11355cfa1f34c16bd3a75205192d7f1de937a720`. SHA-256 of `qa-evidence.mjs`: `074e57ed8c68ec9b21ccd16ef056f6b641b8e028c693395a8918dd28b4be40da`.

This verifies the evidence tooling added to PR #5. It does not rerun the full CLI/framework QA matrix or change the coverage and findings of the historical Windows runs.

| Check | Result |
|---|---|
| Two default runs in a workspace whose path contains spaces | PASS: distinct output directories, all committed r2 evidence unchanged byte for byte |
| Explicit output directory containing existing evidence | PASS: exit 2; existing contents unchanged |
| `--groups probe` with a new output directory | PASS: exit 0; manifest records the run, platform and actual script hash; matrix generation succeeds |
| Regenerate the committed Windows results on macOS | PASS: generated Markdown is byte-identical to the committed matrix, and every evidence link resolves |
| Original baseline links | PASS: 320 checked, zero broken before adding this verification document |

Commands (run from the CLI checkout):

```text
node --test docs/qa/2.6.1/evidence/scripts/qa-tools.test.mjs
node docs/qa/2.6.1/evidence/scripts/check-links.mjs
```

Both commands exited 0. Raw output: [regression checks](evidence/tool-verification/qa-tools.log), [original baseline link check](evidence/tool-verification/links.log).

The historical r1/r2 logs, r2 manifest, matrices and recorded original script hash are preserved. Subsequent runs write new metadata and cannot overwrite existing evidence. This document and its logs are committed after the script revision above.
