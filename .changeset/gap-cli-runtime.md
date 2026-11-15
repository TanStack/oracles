---
'@tanstack/oracles': minor
---

The `oracle-gaps` CLI bounds a mutant's copies by counts, not by wall-clock limits, reports long runs, stops the processes it started, and writes nothing beside the tests.

- A mutant's copies share a work budget, counted in site evaluations and not in time: the larger of 100,000 and ten times their owner files' unmutated work. A mutant past it is a `timeout` gap. No wall-clock limit decides an outcome. A copy cut by its call count (`spin`) or by no progress ends only itself, a copy cut by the backstop (`--hang-limit`, 60 s by default, plus 3 s per second of its file's time) ends the mutant's later copies, and every timeout names its cause in `results.json` and on its gap line. `--mutant-limit` and `--first-limit` are retired: they are checked and noted, and change nothing.
- While one copy of a test file runs for 30 s or more, the CLI prints `busy: <mutant id> in <test file> for <n>s` every 30 s (`baseline` for a run with no mutant). Through `--daemon` the heartbeats arrive when the check ends.
- The check runs in a process group of its own, with every Vitest worker and every process a test starts, except one started detached in a session of its own. On SIGINT or SIGTERM the CLI signals the group, kills what is left 2 s later, and exits 130 or 143. Before, a SIGTERM left `forks` workers running. On Windows the run is not supervised.
- The runner's copies of the test files exist only in memory. Vitest's read of a copy for its per-file pragmas (`@vitest-environment`, `@module-tag`) is served its text, so a copy runs in its file's environment. The capture setup and Vitest configs are in a session directory of its own while it runs, and one that a stopped run left is removed by the next run. Before, the copies and configs sat beside the tests and the package's config, where a Vitest run started during a check found them and then failed when they were removed.
