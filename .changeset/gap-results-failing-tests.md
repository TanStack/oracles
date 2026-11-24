---
'@tanstack/oracles': minor
---

`oracle-gaps` writes every failing test of a baseline file into `results.json`. Each file's baseline record gains `failing`: one entry per failing test, in file order, with its names (`test`), its error's first line (`error`), and the words of the command that replays that test alone (`replay`, such as `["vitest", "run", "tests/x.test.ts", "-t", "^x$"]`). A test that failed by a law violation also has its `law`, `checkpoint`, `difference`, `observed` and `owed` values (when the violation names them), and `counterexample`. These are the framework's text, with no 400-code-point cut and no `\uXXXX` escape. Before, `results.json` held a failing file's count, its first failure, and its failing laws' names; the rest was only in the printed baseline.
