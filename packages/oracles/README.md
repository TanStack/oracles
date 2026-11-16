# @tanstack/oracles

Oracle testing for TypeScript: an agent states what your code promises, then
checks your real code against an independent model of those promises.

```text
Show me what oracle testing with @tanstack/oracles can find in this repository.

1. Find the current commit of TanStack/oracles. Run
   `git ls-remote https://github.com/TanStack/oracles refs/heads/main`, and use
   the first 7 characters of the hash as <sha>.
2. Install https://pkg.pr.new/TanStack/oracles/@tanstack/oracles@<sha> as a dev
   dependency, with this repository's package manager.
3. Read node_modules/@tanstack/oracles/skills/oracles-explore/SKILL.md in full,
   and follow it. Use <sha> wherever a skill asks for the commit to pin.
```

## Test hooks

`ORACLE_GAPS_TEST_RETENTION` (a file path, unset in normal use) makes the gap CLI append one JSON line per mutant batch it runs, however the batch ends: settled, cut off, or rejected. It only observes: it never changes an outcome. The e2e oracle reads it to check bounded retention. The hook's code is in `oracle-gaps/retention-hook.mjs`, which the CLI loads only when this variable or `ORACLE_GAPS_TEST_REJECT_BATCH` is set, so a normal run never loads it.

Under the hook, each check also writes `check.pid` (the id of the process that runs the check: the CLI's supervised child, or a daemon) into its `--out` directory, after the CLI creates that directory. Each line has:

- `run`: the check's `--out` path.
- `pid`: the id of the process that wrote the line. The oracle compares it with `check.pid`.
- `batch`: the batch's own index within its check, from 0, taken when the batch starts.
- `before`: Vitest's and Vite's structure sizes before the batch, and the `stale*` counts. `staleIndexed` and `staleSpecs` count registry entries that name no live context. `staleOpen` counts contexts that left the live array and that Vitest has not started to close (its own close state). All three must be 0.
- `held`: how many of the entries the check gave its store are still reachable after a full garbage collection, which the hook runs before it writes the line. A cold check's store keeps none, so this must be 0 there. A daemon's store keeps its entries by design.
- For a settled or rejected batch: `after` (the sizes after its copies are retired), `copyNodes` (Vite module nodes that still name a copy, must be 0), and `nonCopyDup` (non-copy files with more than one module node in an environment, must be 0 beyond the measured plain-plus-`?raw` pair).
- For a cut batch: `cut: true` and no `after`. Its context is replaced, not retired.

`ORACLE_GAPS_TEST_HOLD_OVERLAP` (a file path, unset in normal use) makes a daemon hold the first check it runs, before the check starts, until the daemon has accepted a second check request. Then it writes the number of check requests it has accepted to the path, and the check runs. It holds once per daemon, and it is released by that count, never by time. The two checks then overlap in the daemon, as two checks started at once do when the second request arrives in time. The hook changes no outcome: the second request waits in the queue, as it always does while a check runs. The e2e oracle sets it for its two checks at once in the edit sequence through the daemon, so that the overlap is held, not left to the timing of two processes (issue #82).

`ORACLE_GAPS_TEST_REJECT_BATCH` (a batch number from 1, unset in normal use) makes the gap CLI's n-th batch run reject, as a crash in Vitest would. It is a test-only fault: the batch's run completes, so its copies are in Vitest's and Vite's state, and then the run's promise rejects, which takes the same path a real crash takes. The run then ends as an internal error: exit 3, the done error line, and `error.log` in its output directory. The batch's copies are still retired and its retention line is still written.
