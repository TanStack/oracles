---
'@tanstack/oracles': minor
---

An authored mutant can edit any file of the package that a test reads through `fs`, not only a module it imports. The gap check now serves an authored mutant's patch to each owner copy's own reads of the file, `readFileSync` (to a string or a buffer), `readFile`, and `fs.promises.readFile`, for that copy alone, as it serves the patch to the copy's module loads. So a wrong version of a data file, or of a built declaration file that a type oracle compiles against with the TypeScript compiler API, is applied and judged, where before it was never applied. No file is written: copies that run at once in other contexts each see their own text. `existsSync` and `statSync` see the file as it is, and so does a child process, such as a `tsc` the test spawns. An authored mutant whose file no owner's copy loaded or read is still `unreached`.
