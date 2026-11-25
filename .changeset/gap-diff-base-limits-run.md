---
'@tanstack/oracles': minor
---

`oracle-gaps --diff-base <rev>` now judges only the mutants on lines changed since `<rev>`, for fast feedback after a change. Operator and authored mutants both count, and every line of a source file that git does not track is changed. The baseline still runs every test file that the run without the option runs, and each judged mutant gets the outcome it gets in the full run. The run says so on its stream before the baseline, `oracle-gaps: note --diff-base <rev>: <n> of <m> mutants are on changed lines; the others are not judged in this run`, and in the same sentence in `summary.md`. Its `results.json` and `summary.md` inputs say `a partial run (--only, --sample, or --diff-base)`, as an `--only` or `--sample` run's do (their text used to read `(--only or --sample)`). Authored mutants are marked `inDiff` too.

Before, `--diff-base` only added `inDiff` to each operator mutant in `results.json`, and every mutant still ran. Finish with a full check without `--diff-base`: gaps on the other lines still count.
