---
'@tanstack/oracles': patch
---

The `oracle-gaps` CLI now writes the lines it streams on stderr to `stream.log` in the output directory too, in order, cold and through `--daemon`, and the first line of a check on both streams names that file: `oracle-gaps: note log <out>/stream.log`. An agent that starts a cold check in the background can read the run's progress and its done line there while it runs. A check through `--daemon` prints its lines at the end of its check, so its progress is readable there only after it ends.

A run takes its output directory's claim in `run.pid` before it starts, and a second run on a live directory refuses without writing into it. A `run.pid` that names no running process (stale), that is empty, or that cannot be read also refuses the run, and the refusal's fix line tells you to delete `<out>/run.pid` if no run uses that directory. The CLI never takes over another run's claim. A refusal of a run with no `--out` is written to the default output directory the run would have used.
