# Evaluating translation of the CLI's own messages (I18N-09)

**Status:** evaluation only — no code changes in this PR.
**Evaluated against:** `create-fsd-architecture` 2.8.0 (`ad4710c`), `bin/` tree.
**Question:** should the strings the CLI itself prints (prompts, progress,
success/error messages, help) be translated into the five languages the docs
now support (ru, zh-CN, es, pt-BR, ja), and if so, how?

## Short answer

**Not yet. Recommend: do not translate the CLI messages now; revisit after
2.8.0 adoption, if non-English-speaking users ask for it.**

The docs and website translation (I18N-01–I18N-08) already covers the
surface users read before installing. The CLI's own output is a much smaller,
developer-facing surface, and English is the working language of the dev
tools it wraps (npm, git, Vite, commitlint). Translating it now would add a
permanent maintenance cost — every new string in every language, tested in
every language — for a benefit no user has asked for. The cheap preparatory
step (a central messages module) is worth doing only when a translation is
actually planned; doing it speculatively is also cost without benefit.

## 1. Inventory of the message surface

### 1.1 Chalk call sites: 42 across 9 files

The triage for this task counted 39 chalk call sites against 2.7.1. At 2.8.0
there are **42** — the 3 new ones are the section headings of the commands
added since (`explain`, `history`, `agent-rules`). Counted with
`grep -rn "chalk\." --include="*.mjs" bin/` (imports excluded).

| File | Sites | What is printed |
| --- | --- | --- |
| `bin/commands/create-project.mjs` | 22 | Cancelled notice, "Coming Soon" label, Next-steps block, dry-run plan, warnings, ora spinner success/fail lines (template download, FSD/Git/Husky setup, dependency install, commitlint check), dev-server start/failure, "Project created successfully!", star request |
| `bin/generator.mjs` | 5 | Dry-run file-plan heading, "No files were changed", "Slice generated successfully!", "Created files:" heading, file bullets |
| `bin/generators/shared-layer.mjs` | 4 | File-plan heading, `KEEP <file>` lines, "Nothing to generate", "No files were changed" |
| `bin/cli/output.mjs` | 3 | ASCII banner, `stable` / `planned` template status words |
| `bin/index.mjs` | 2 | Top-level `Error: <message>` passthrough, "Run with --help…" hint |
| `bin/commands/inspect-project.mjs` | 2 | `PASS` / `FAIL` check status, section heading |
| `bin/commands/history-project.mjs` | 2 | Section heading (normal + empty-history path) |
| `bin/commands/explain-project.mjs` | 1 | Section heading |
| `bin/commands/agent-rules.mjs` | 1 | "Regenerate with: fsd agent-rules --force" hint |

By category: section headings 6, success confirmations 7, failure lines 5,
warnings/dim informational lines 9, dry-run notices 5, status words 3,
next-steps/help hints 5, banner 1, error passthrough 1.

### 1.2 The wider surface beyond chalk

Chalk is only the styling layer. The full user-visible string surface is
bigger, and any translation has to cover all of it, not just the 42 sites:

| Surface | Size | Notes |
| --- | --- | --- |
| `console.log` / `console.error` / `console.warn` calls in `bin/` | 112 total, 84 without chalk | Plain output: help text, config dumps, check/doctor tables, upgrade plans, generated-file lists |
| Help text (`showHelp` in `bin/cli/output.mjs`) | ~90 lines, one block | The single most-read CLI string; plain text, no chalk |
| Interactive prompts (`prompts` 2.4.2) | 5 questions in `create-project.mjs` ("Project name", "Select framework", "Project target", "Install dependencies now?", "Start development server now?") + 1 confirm in `upgrade-project.mjs` | Question text, choices, validation and cancel messages come from the `prompts` library and from our code |
| Spinner text (`ora` 10) | ~8 spinner lines in `create-project.mjs` | Success/fail lines are chalk-styled (counted above); spinner labels are plain |
| Thrown errors | 99 `throw new Error` sites in `bin/` | Surfaced verbatim by the top-level handler in `bin/index.mjs`; many embed paths, command names and npm output |
| Template / generated-file content | out of scope | Generated projects contain English comments and docs; translating those is a separate, much larger job |

### 1.3 What is not translatable (and must stay as-is)

ASCII banner art, URLs (`https://github.com/FSD-CLI/cli`,
`https://fsdcli.me`), file paths, package/framework names, command names
(`fsd check`, `fsd explain`), FSD layer names (`app`, `pages`, `widgets`,
`features`, `entities`, `shared`), version numbers, and the `stable` /
`planned` / `PASS` / `FAIL` status words if they are kept as machine-readable
tokens. Roughly a third of the 42 chalk sites wrap strings that are mostly
these fixed tokens plus a few English words.

## 2. Options

| # | Option | Effort | Pros | Cons |
| --- | --- | --- | --- | --- |
| A | **Do nothing** | 0 | No cost, no new bugs, no per-language test burden | CLI stays English-only |
| B | **Central messages module, English only** (extract all user-facing strings into `bin/cli/messages.mjs`, keyed by id, English default) | ~1 day + tests | Prepares the codebase for translation without committing to any language; single place to audit strings; no new dependency | Pure refactoring cost with no user-visible benefit until a translation ships; churn in every command file |
| C | **Full i18n with a library** (e.g. `i18next` or a hand-rolled `t(key)` + `locales/{ru,zh-CN,es,pt-BR,ja}.json`, `--lang` flag + `LANG` detection) | 1–2 weeks incl. tests and per-language review | Real translated CLI; reuses the I18N-02 glossary (`docs/i18n-glossary.md` in fsd-docs) for FSD terms | New runtime dependency (or a loader to maintain); every new string needs 5 translations; tests must cover each locale; prompts/ora strings need special handling (library messages are not ours); error messages that embed command output cannot be translated cleanly |
| D | **Translate only help + prompts** (the two highest-visibility surfaces) | 2–3 days | Covers what a new user actually reads; small string count | Inconsistent experience — help in Japanese, errors in English; still needs the locale plumbing of C, so it saves little |

## 3. Recommendation

**Option A now, Option B only when a translation is actually planned.**

Reasons:

1. **No demand signal.** No issue, discussion or user request asks for a
   translated CLI. The docs translation (I18N-01–I18N-08) was driven by the
   same judgement — translate what users read *before* they run the tool.
2. **Low return.** The CLI's audience is developers who already work in
   English-language tooling; npm, git, Vite and commitlint output stays
   English regardless of what we translate, so a translated CLI would still
   be a mixed-language experience (see option C's cons).
3. **High recurring cost.** 42 chalk sites + ~90 lines of help + prompts +
   spinner text + 99 error sites is a small inventory to *translate once*
   and a permanent one to *maintain* — every feature PR would need five
   translations or would ship with English fallbacks.
4. **Sequencing.** The website translations (fsd-docs PRs #96, #98–#104)
   are still unmerged, so the localized docs are not live yet. Translating
   the CLI before the docs it points to are live puts effort in the wrong
   order. Revisit after those PRs merge and 2.8.0 adoption is visible.

If the decision later flips to translating, the order of work should be:
B (central messages module, English only) → D (help + prompts in one
language as a pilot, reusing the I18N-02 glossary) → C (remaining locales).
Do not start with C directly: the pilot validates the plumbing before five
languages are committed to.

## 4. What this evaluation does not cover

- Translating generated project content (templates, comments, scaffolded
  docs) — a separate, larger effort.
- Translating the website/docs — already done in I18N-01–I18N-08.
- RTL or CJK rendering in terminals — out of scope for the evaluation, but
  a real concern for a full implementation (banner width, alignment).
