---
'@tanstack/oracles': patch
---

`oracle-gaps` adds a cluster note for each function where survivors cluster: at least 5 of its mutants survived with no observation changed (every survivor class but `not-judged` and `indeterminate`), and they are at least half of its operator mutants that the run judged. The note goes on stdout after every function's gap lines (`oracle-gaps: note cluster fn <name> (<source>): <n> of <m> mutants survived with no observation changed (<class> <count>, …). …`) and under `## Survivors clustered in one function` in `summary.md`. It says that such a function may be performance machinery or redundant design, and it asks the maintainer whether the function is needed before histories are added for it or it is removed. Before, a downstream project read 73 such survivors in one algorithm only as gaps to close. The gaps keep their classes and directives.
