---
'@tanstack/oracles': patch
---

`oracle-gaps --compare` prints one note when owned code shrank since the compared run (a function with fewer owned operator mutants than it had there): `owned code shrank by <n> mutants in <functions>; run an independent review (oracles-design step 10)`, and records the count and functions as `compare.shrank` in `results.json`.
