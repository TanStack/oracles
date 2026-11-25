---
'@tanstack/oracles': patch
---

oracle-gaps keeps the reach lines that `oracleProperty` prints for each passing unit (`<id> <unit> reach {...}`) in `reach.log` in the output directory, named by a note `oracle-gaps: note reach counts in <path>`, instead of in `test-output.log`. These lines repeat in every run of a file, so with constructed histories and calibrations they used to bury what the tests wrote themselves; `test-output.log` now holds only that.
