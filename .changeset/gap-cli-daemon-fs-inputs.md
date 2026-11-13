---
'@tanstack/oracles': patch
---

A check through `--daemon` now reruns a test after an edit to a file in the package that the test reads through `fs` (`readFileSync`, `readFile`, `existsSync`, `statSync`, or `fs/promises` `readFile` or `stat`), such as a JSON fixture or a snapshot. Before, the daemon reused the run that read the old file, while a cold run saw the edit. A directory that a test stats is an input as a directory. Reads outside the package, under `node_modules`, through other APIs, or from a test's own worker threads or child processes are no inputs.

The daemon also stores each run under the text that the run read. Before, it stored a run under each input's text at the end of the run, so a module or file that changed during the run that read it (a test that rewrites a fixture it read, or a helper edited mid-check) kept the old verdict for the new text, and the next check through the daemon reported that stale verdict. A run whose input changed after it read it is now run again.

A test that reads a source under test through `fs` (or as a `?raw` import) no longer makes each check through the daemon run its tests again. The test's read of the file and the instrumented module that the runner serves from it are now two inputs, each hashed by its own text.
