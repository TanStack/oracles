---
'@tanstack/oracles': patch
---

A run of the `oracle-gaps` CLI that a stop ends, or whose check's process aborts, now removes its `<package>/.oracle-gaps-<pid>/` session directory. Before, it left the directory for the next run to remove, and a run stopped as or before it started removed nothing, so the directory stayed in the package. Only a run whose own process is killed leaves it now, and the next run removes it.
