---
'@tanstack/oracles': patch
---

A check through `--daemon` now reruns a test after an edit to a file in the package that the test reads through `fs` (`readFileSync`, `readFile`, `existsSync`, `statSync`, or `fs/promises` `readFile` or `stat`), such as a JSON fixture or a snapshot. Before, the daemon reused the run that read the old file, while a cold run saw the edit. A directory that a test stats is an input as a directory. Reads outside the package, under `node_modules`, through other APIs, or from a test's own worker threads or child processes are no inputs.
