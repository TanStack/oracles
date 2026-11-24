---
'@tanstack/oracles': minor
---

`oracle-gaps` runs a package's authored mutants by default. With no `--mutants`, a run reads the authored mutants in the package's `authored-mutants/` directory, beside its `package.json`, when that directory exists, and judges them as it judges a directory that `--mutants` names; a bad file there refuses the run, as under `--mutants`. So a wrong version that someone once wrote down is asked again by every later run, with no flag to remember. `--no-authored-mutants` runs none, and passing it beside `--mutants` refuses the run. A package with no `authored-mutants/` directory runs as before.
