---
'@tanstack/oracles': patch
---

`oracle-gaps --diff-base <rev>` refuses a revision that names no commit of the git repository that holds the package: a name git does not know, a range, a blob, an option such as `--cached`, an empty value, or a package in no repository. It exits 2 with `refused: --diff-base "<rev>" names no commit of the git repository that holds the package` and a `fix:` line, before any test runs. Before, the run went on and marked every mutant `inDiff: false`.

A source file that git does not track is now changed on every line, so each of its mutants is marked `inDiff: true`. Before, `git diff` left the file out and every mutant in it was marked `false` until `git add -N`. `results.json` records the commit as `options.diffBase: { rev, commit }` (it was the revision as given), so the run identity follows the commit and not the name.
