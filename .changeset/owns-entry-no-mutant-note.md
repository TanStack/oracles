---
'@tanstack/oracles': patch
---

`oracle-gaps` names each `owns` entry that no mutant tests. When none of a run's mutants, operator or authored, lands in what an entry owns, the run prints `oracle-gaps: note no mutant for owns entry <entry> of <oracle file>: <reason>, so the gap check gives it no evidence`, once after its static analysis and again in its summary. `summary.md` lists the same entries under "Owns entries with no mutant (warnings)". The reason is that the entry's file is not a `--source`, that its file is a declaration file, which has no mutation site, or that nothing it owns has a mutation site. Before, an oracle that owned only a declaration file, or a file left out of `--source`, ran green with no word about it. The count is over the run's mutants before `--only` or `--sample` selects any. The design skill now says how to get evidence for a type contract: the gap check gives none, so the oracle's calibrations are its only evidence.
