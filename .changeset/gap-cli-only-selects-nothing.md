---
'@tanstack/oracles': patch
---

`oracle-gaps --only` refuses a selection that judges nothing, before any test runs, where it used to end as a completed run with `baseline all 0 oracle files pass`, no gap, and exit 0. An id that names no mutant of the run (an id of a source that `--source` does not name, of an edited source, an oracle file's path, or a typo) refuses with `refused: --only names no mutant of this run: <ids>`, naming each such id, even beside ids that do name a mutant. A selection whose every mutant no oracle file owns refuses with `refused: --only selects no mutant that an oracle file owns: <ids>`, as a run that owns nothing already does. Both exit 2 with one `fix:` line. A selected authored mutant whose `find` does not apply still runs, and is reported as `does-not-apply`.
