---
'@tanstack/oracles': minor
---

The `oracle-gaps` report no longer calls a deleted shortcut `not-observed` when the work it adds lands in a test whose count can follow the clock (it makes a timer, reads a clock, or holds I/O open). No work bound judges such a test, so the mutant used to fall through to `not-observed`, whose directive asks to observe a changed value in the first owner test that infected it, which for a cache or a skipped re-read is a test that did nothing different. Such a survivor is now `clocked-work`: its directive names the test whose work rose, with its work before and after, and asks for the saved cost as an observation of the driver judged by a law. Only a survivor that would otherwise be `not-observed` or `not-distinguished` changes class; one that changed no value keeps its class.
