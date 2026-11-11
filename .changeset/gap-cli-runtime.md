---
'@tanstack/oracles': minor
---

The `oracle-gaps` CLI bounds and reports long runs, stops every process it started, and writes nothing beside the tests.

- Each mutant has a budget for the runs that confirm its cut-off copies: the larger of the new `--mutant-limit` (30 s by default) and ten times its owner files' unmutated time. A confirmation gets at most what the budget has left, and a mutant whose confirmations pass it is a `timeout` gap, so a mutant that makes every test wait for its own timeout no longer runs for minutes. To give one copy more time with `--hang-limit`, raise `--mutant-limit` too.
- While a copy of a test file runs for 30 s or more, the CLI prints `busy: <mutant id> in <test file> for <n>s` every 30 s (`baseline` for a run with no mutant).
- The check runs in a process group of its own, with every Vitest worker and every process a test starts. On SIGINT or SIGTERM the CLI signals the group, kills what is left 2 s later, and exits 130 or 143. Before, a SIGTERM left `forks` workers running.
- The runner's copies of the test files exist only in memory, and its capture setup and Vitest configs are in a session directory of its own while it runs. Before, they sat beside the tests and the package's config, where a Vitest run started during a check found them and then failed when they were removed.
