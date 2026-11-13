---
'@tanstack/oracles': minor
---

Every line the `oracle-gaps` CLI writes for a check now starts with `oracle-gaps: ` and its kind, on stdout and stderr alike, cold and through `--daemon`, so an agent can act on the results as they stream with `grep '^oracle-gaps: '` and filter one kind by the word after the prefix:

- `oracle-gaps: config <file>`, or `oracle-gaps: config none, Vitest's default discovery`
- `oracle-gaps: baseline pass <file>: <n> tests` and `oracle-gaps: baseline fail <file>: …`, with the failing test, law, counterexample, and replay indented under it
- one decisive line before any mutant runs: `oracle-gaps: baseline all <n> oracle files pass`, or `oracle-gaps: baseline <k> of <n> oracle files failed (provisional)`
- `oracle-gaps: blocked <file> …` for each failing oracle file
- `oracle-gaps: gap <kind> L<line> <id> <change>`, streamed and in the stdout summary
- `oracle-gaps: progress …`, `oracle-gaps: busy <mutant id> in <file> for <n>s`, and `oracle-gaps: note …` (Vite's own messages as `note vite: …`)
- the stdout summary as lines too: `oracle-gaps: summary …` for the totals, `oracle-gaps: legend <class>: …` for each directive, and `oracle-gaps: function …` for each function's heading over its gap lines
- a last line for every run: `oracle-gaps: done completed, <n> gaps, report <path>` (with `(provisional)` after the count when an oracle file failed), `oracle-gaps: done refused[, report <path>]` after a refusal's `refused:` and `fix:` block, `oracle-gaps: done error, log <path>`, or `oracle-gaps: done stopped (<signal>)`

The done line is the last line of both stdout and stderr, once each, and its status matches the exit code. Only the lines indented under a failing baseline file and a refusal's `refused:` and `fix:` block have no prefix, and no line is blank. A test's own writes to the process's stdout and stderr go to `test-output.log` in the output directory, which a note names. The stdout summary's `output: <dir>`, `Full report:`, and `completed: <n> gaps` lines are replaced by the done line, and the refusal's `output: <dir>` line by `oracle-gaps: done refused, report <path>`. Exit codes do not change.

The wrapper config now reads the package's config as Vite does: it awaits a promise default and refuses a default that is not an object. A config with a syntax error is refused with its first error, before Vite bundles it.
