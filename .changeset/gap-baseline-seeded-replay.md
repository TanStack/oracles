---
'@tanstack/oracles': patch
---

`oracle-gaps` replays a failing random-seed campaign unit under its seed. The baseline's `replay:` line for a `random seed: <unit>` test was `vitest run <file> -t '<pattern>'`, which draws a new seed, so the replay ran other histories and could pass. It now sets the variables of the framework's own `Replay:` command first, with the seed and path the framework reported, the property, and the unit, as in `ORACLE_SEED=-256771964 ORACLE_PATH=0 ORACLE_PROPERTY=probe.twice ORACLE_UNIT='random seed: generated' vitest run tests/x.test.ts -t '...'`. On Windows the PowerShell line sets them with `$env:NAME='value';` and the cmd line with `set "NAME=value" &&`. In `results.json`, that test's record gains `env`, the variables by name in the framework's order. A fixed-seed unit and every other test replay as before.
