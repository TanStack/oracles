---
'@tanstack/oracles': patch
---

`oracle-gaps --refactor-base <rev>` runs every oracle file again on the sources as a commit holds them and as they are now, with the same seeds, and lists each test whose observations or result differ, with its first differing observation, even where every law accepts both: a `note` per test on stdout, a section of `summary.md`, and `refactor` in `results.json`. A `--refactor-base` that names no commit refuses the run.
