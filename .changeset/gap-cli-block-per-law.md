---
'@tanstack/oracles': minor
---

A failing law no longer blocks the gap report for its whole file. In `oracle-gaps`, a test of an oracle file that fails with no mutant active judges nothing: it is left out per test, as a nondeterministic test is, and the passing tests of its file still judge the mutants the file owns. A mutant is `blocked` only when none of its owner tests passes, and its directive names the failing laws it waits for. The baseline prints one `oracle-gaps: blocked` line per failing law, named by its file and test names, and the report stays provisional. An oracle file that fails outside its tests (one that does not load, for example) is still left out whole, and its `blocked` line names the file. `results.json` marks such a file's baseline with `failedOutsideTests`.
