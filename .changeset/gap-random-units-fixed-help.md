---
'@tanstack/oracles': patch
---

`oracle-gaps --help` now says what `--seed` does to the random campaign. With `--seed <n>`, every random unit runs at seed n, and a mutant that only a random unit kills is reported as killed. Without it, each random unit runs at a seed fixed by its test name, and such a mutant is a `random-only-kill` gap. A check never draws a new seed, so its random units run the same histories in every check. The README and the design skill say the same.
