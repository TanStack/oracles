---
'@tanstack/oracles': patch
'@tanstack/eslint-plugin-oracles': patch
---

**Breaking for consumers.** Test names of generated sources change, and a path replay of a generated source now needs `${prefix}_UNIT`. A command or script that sets only the seed, the path, and the property now fails when the property registers.

A generated source now registers each part of a campaign as its own test, so a runner can shard a long campaign across jobs. For each fixed seed N, `oracleProperty` registers `fixed seed N: <name>` for each constructed history and `fixed seed N: generated` for the generated histories. The random campaign registers `random seed: <name>` and `random seed: generated` in the same way. The determinism test becomes one test per history: `determinism: fixed history: <name>`, `determinism: constructed history: <name>`, and `determinism: generated 0` to `2`. The units of a seed run exactly the histories that the campaign ran. Each unit decides its own first failure, shrinks within its own timeout, and prints its own reach line, `<id> <unit> reach {...}`. A campaign's reach is the sum of its units' lines. A unit that fails or times out prints no reach line. An enumerated source keeps its one `determinism` test.

Test names change. A `-t "fixed seed"` filter still selects the fixed-seed units, and `-t "random seed"` the random units. A filter that names the old `determinism` test of a generated source now selects all its determinism units. The random units of a property share one seed, which the first random unit that runs selects and logs in the one `ORACLE_SEED` line.

A path replay now names its unit in the new `${prefix}_UNIT` variable, such as `ORACLE_UNIT='random seed: generated'`. `UNIT` requires `PROPERTY`. During a path replay, only the random unit of that name runs. A path replay of a generated source without `UNIT` fails when the property registers, with "`ORACLE_PATH` of a generated source requires `ORACLE_UNIT`". A `UNIT` that names no random unit of the replayed property also fails its registration. A failing unit prints its replay command, with the seed, the path, the property, the unit, and its `-t` pattern, under the configured prefix. A failing fixed-seed unit also prints `Rerun: -t '...'`, which reruns it. The retired-variable message names `${prefix}_UNIT`.

To migrate a recorded path, rebase it onto its unit. In the old campaign, the first index of a path selected the history: an index k below n, the number of constructed histories, was constructed history k, and an index k of n or more was generated history k − n. With `PATH=k:<rest>`:

- for k < n, set `${prefix}_UNIT='random seed: <name of constructed history k>'` and `${prefix}_PATH=0:<rest>`;
- for k ≥ n, set `${prefix}_UNIT='random seed: generated'` and `${prefix}_PATH=(k − n):<rest>`.

A path recorded from a fixed-seed campaign replays the same way, with that fixed seed as `${prefix}_SEED`. A new failure prints its replay command, so only paths recorded before this change need rebasing.

A generated source fails to load when two of its tests would share a name: a constructed history named `generated`, two constructed histories of one name, or two fixed histories of one name.

In `@tanstack/eslint-plugin-oracles`, `oracle/no-disabled` reads `${envPrefix}_UNIT` as a shared replay variable, and reports a `process.env` read of any other variable that ends in `_UNIT` as a private replay variable, as it does for `_SEED`, `_PATH`, `_PROPERTY`, and `_RUNS`.
