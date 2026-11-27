# Architecture health score (INT-02)

A 0–100 score for a project's Feature-Sliced Design architecture, computed
from the import graph INT-01 builds (`bin/core/graph.mjs`). Implemented in
`bin/core/health-score.mjs` (`computeHealthScore(graph)`), surfaced only in
`fsd doctor` output. There is deliberately no `fsd score` command — that is
the separate future task INT-54.

The score is a diagnosis, not enforcement: a low score never fails
`doctor`, and the score never blocks any command. Enforcement of the
underlying rules inside `fsd check` is INT-36's job.

## Dimensions

Weights sum to 100, so the total is the weighted sum of the dimension
scores (rounded to an integer). Every dimension is computed from graph
facts only, so the score is deterministic for a given project.

| Dimension | Weight | What it measures | Formula |
| --- | --- | --- | --- |
| Layer boundaries | 40 | Share of resolved edges that respect the FSD layer order (app → pages → widgets → features → entities → shared) | `100 × (1 − violations / resolved edges)`; 100 when there are no resolved edges |
| Slice isolation | 25 | Share of same-layer resolved edges that stay inside one slice (cross-slice imports in one layer break slice independence) | `100 × (1 − cross-slice imports / same-layer resolved edges)`; 100 when there are no same-layer edges |
| Slice cycles | 15 | Slice-level import cycles (`findSliceCycles`) | `max(0, 100 − 50 × cycles)` |
| Orphan slices | 10 | Slices with no resolved edge to or from any *other* slice (nothing uses them and they use nothing; same-slice edges do not count) | `100 × (1 − orphans / slices)` |
| Layer coverage | 10 | FSD layers that contain at least one source file | `100 × layers present / 6` |

Violations use the same rule id (`layer-boundaries`) and the same default
allow list as `findViolations` in `bin/core/graph.mjs`; a project allow
list can be passed through `computeHealthScore(graph, { allow })` (the
INT-36 seam). Unresolved edges (bare packages, alias imports) cannot be
judged and score nothing in any dimension.

Not scored (yet): `no-public-api-bypass` — imports reaching into a slice's
internals instead of its public API — has no graph signal until a later
task adds one. It is not silently folded into another dimension.

## Grades

| Score | Grade |
| --- | --- |
| 90–100 | A |
| 75–89 | B |
| 60–74 | C |
| 40–59 | D |
| 0–39 | F |

## Issues

Alongside the score, `computeHealthScore` returns the worst issues,
sorted worst-first (severity, then dimension weight, then message) and
capped at 10; the full count is kept in `totals.issues` so the cap is
visible.

| Severity | Source |
| --- | --- |
| high | Each layer-boundary violation; each slice cycle |
| medium | Each same-layer cross-slice import |
| low | Each orphan slice; each layer with no source files |

## Empty projects

A project with no source files in its layers has no architecture to
score: the result is `0/F`, every dimension reads 0 with the detail "No
source files in the project layers", and the single issue explains why.
A vacuous near-perfect score would be dishonest.

## Doctor output

`fsd doctor` prints the score after the project metrics:

```text
  Architecture health score

  99/100 (A)
  Layer boundaries: 100/100 — 0 violations in 11 resolved edges
  Slice isolation: 100/100 — 0 cross-slice imports in 2 same-layer resolved edges
  Slice cycles: 100/100 — 0 cycles
  Orphan slices: 89/100 — 1 orphan slice of 9
  Layer coverage: 100/100 — 6 of 6 layers have source files

  Worst issues:
  [low] Slice shared/api has no imports to or from any other slice
```

(The example above is the `minimal` analysis fixture.) If the import
graph cannot be built, doctor prints `Unavailable — could not build the
import graph: …` instead of a score and keeps running. `fsd check` does
not print the score.
