---
'@tanstack/oracles': minor
---

Every line the `oracle-gaps` CLI writes for a check now starts with `oracle-gaps: ` and its kind, on stdout and stderr alike, cold and through `--daemon`, so an agent can act on the results as they stream with `grep '^oracle-gaps: '` and filter one kind by the word after the prefix:

- `oracle-gaps: config <file>`, or `oracle-gaps: config none, Vitest's default discovery`
- `oracle-gaps: baseline pass <file>: <n> tests` and `oracle-gaps: baseline fail <file>: …`, with the failing test, law, counterexample, and replay indented under it
- one decisive line before any mutant runs: `oracle-gaps: baseline all <n> oracle files pass`, or `oracle-gaps: baseline <k> of <n> oracle files failed (provisional)`
- `oracle-gaps: blocked <file> …` for each failing oracle file
- `oracle-gaps: gap <kind> L<line> <id> <change>`, streamed and in the stdout summary
- `oracle-gaps: progress …`, `oracle-gaps: busy <mutant id> in <file> for <n>s`, and `oracle-gaps: note …`
- a last line for every run: `oracle-gaps: done completed, <n> gaps, report <path>` (with `(provisional)` after the count when an oracle file failed), `oracle-gaps: done refused[, report <path>]` after a refusal's `refused:` and `fix:` block, `oracle-gaps: done error, log <path>`, or `oracle-gaps: done stopped (<signal>)`

The stdout summary's `output: <dir>`, `Full report:`, and `completed: <n> gaps` lines are replaced by the done line, and the refusal's `output: <dir>` line by `oracle-gaps: done refused, report <path>`. Exit codes do not change.
