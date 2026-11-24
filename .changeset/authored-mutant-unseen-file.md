---
'@tanstack/oracles': patch
---

An authored mutant that no owner test loaded is reported as `unreached`, not as a survivor. The gap check applies an authored mutant's patch only where a copy of an owner file loads the mutant's source as a module. A source that the owner tests read only through `fs` (a `.json` file, or a built `.d.ts` that a type oracle compiles against), or do not load at all, never received the patch, yet the mutant was reported as a `not-observed` gap whose directive asked for an observation of a change that never ran. Such a mutant is now `unreached`, with the unreached directive on its line.
