---
'@tanstack/oracles': patch
---

`oracle-gaps`: a run without `--out` now keeps the newest 10 of the package's default run directories in the OS temp directory, its own among them, and removes the older ones once it has claimed its own, as npm keeps its last 10 debug logs. `--keep-runs <n>` keeps another number. It never removes a directory a running check holds (its `run.pid` names a live process, or cannot be read), nor an entry whose name is not a run's, and a run with `--out` removes nothing. Before, nothing removed them, so a long session's runs could fill the disk. The run's identity, and so its report, does not depend on `--keep-runs`.
