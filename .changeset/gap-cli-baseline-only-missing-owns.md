---
'@tanstack/oracles': minor
---

A `oracle-gaps --baseline-only` run no longer refuses an `owns` entry that names a function or file that does not exist, or a run in which nothing owns a selected source. It judges no mutant, so these can hide no gap there. Each prints an `oracle-gaps: note` that names it, is listed in `results.json`'s `notes`, and the run goes on. A law written before its function exists can now be run red first: the owner file's baseline shows the failing law. A full check still refuses all three, and every other refusal (a list that is not a literal, no oracle file, the arguments, Vitest and its config) stands in a baseline-only run too.
