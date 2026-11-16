---
'@tanstack/oracles': patch
---

The `oracle-gaps` CLI's internal error now prints one prefixed line, `oracle-gaps: error <message>: a bug in oracle-gaps, not in your oracle; its stack is in <path>`, before its `oracle-gaps: done error, log <path>` line. Before, its two message lines had no `oracle-gaps:` prefix. A line break in the message prints as an escape, so the message stays on one line. The stack stays in `error.log`, and the exit code stays 3.
