---
'@tanstack/oracles': patch
---

`oracle-gaps`: a run whose own process dies in its mutant phase (a native crash in a worker thread under `--pool threads`, or any other signal or exit that skips the run's own ending) no longer loses the mutants it had judged. The CLI writes them as a partial report: `results.json` with `status: "partial"`, the `cause` (`the run's process exited with <signal>`), the run's usual fields, the judged `results` in report order, and `unjudged`, the ids of every mutant it did not judge; and `summary.md`, which renders the judged mutants under a `**Partial report**` line that names the cause, the count judged of all, and the unjudged ids. The done line ends `; partial report <out>/summary.md`. A run whose process dies before its mutant phase writes no report, as before; a stopped run is unchanged.
