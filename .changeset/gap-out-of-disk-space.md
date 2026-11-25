---
'@tanstack/oracles': patch
---

`oracle-gaps`: a run whose write finds no room on its disk (`ENOSPC`, or `EDQUOT` for a used-up quota) no longer reports "a bug in oracle-gaps, not in your oracle". It exits 3, as a run that ran out of memory does, and ends with one line that names the directory the write failed in and the step to take: `oracle-gaps: done error, out of disk space in <dir> (ENOSPC): free space there, or delete the <n> earlier runs in <the package's default run directories> (<size> MB)`. It writes no stack, and its results.json holds the same cause and step under status `out-of-space`. The same ending applies when the run cannot claim its output directory or open its stream log for lack of room (they used to refuse with a step that named `run.pid`), and to a check through the daemon, which now passes the error's code on. A run whose OS temp directory was full used to exit with no diagnosis at all (`the run's process exited with code 0`).
