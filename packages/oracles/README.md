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

`ORACLE_GAPS_TEST_RETENTION` (a file path, unset in normal use) makes the gap CLI append one JSON line per mutant batch it runs, cut or not. It only observes: it never changes an outcome. The e2e oracle reads it to check bounded retention.

Each line has `run` (the run's `--out` path), `batch` (the batch count so far), and `before` (Vitest's and Vite's structure sizes before the batch). A settled batch also has `after` (the sizes after its copies are retired), `copyNodes` (Vite module nodes that still name a copy, must be 0), and `nonCopyDup` (non-copy files with more than one module node in an environment, must be 0 beyond the measured plain-plus-`?raw` pair). A cut batch has `cut: true` and no `after`. The `stale*` fields count registry entries that name no live context, and `staleOpen` counts open contexts beyond the live ones; all must be 0 before a batch.

`ORACLE_GAPS_TEST_REJECT_BATCH` (a batch number, unset in normal use) makes the gap CLI's n-th batch run reject, as a crash in Vitest would. It is a test-only fault: it triggers the same rejection path a real crash takes, and nothing else. The run then ends as an internal error: exit 3, the done error line on both streams, and `error.log` in its output directory. The batch's copies are still retired and its retention line is still written.
