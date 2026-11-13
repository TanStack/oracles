---
'@tanstack/oracles': patch
---

The `oracle-gaps` CLI now writes the lines it streams on stderr to `stream.log` in the output directory too, in order, cold and through `--daemon`, and the first line of a check on both streams names that file: `oracle-gaps: note log <out>/stream.log`. An agent that starts a cold check in the background can read the run's progress and its done line there while it runs. A check through `--daemon` prints its lines at the end of its check, so its progress is readable there only after it ends.
