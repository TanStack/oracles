---
'@tanstack/oracles': patch
---

A mutant's copy of a test file now draws from `Math.random`, `crypto.getRandomValues`, and `crypto.randomUUID` what the original file draws. The `oracle-gaps` capture seeds these sources per test, by the test's key. It took the key from the copy's path, which names its batch, while the unmutated runs run the original file. A test that observes a draw therefore read as changed under a mutant that changed nothing. An `oracleProperty` campaign with no `--seed` draws its seed from `Math.random`, so its random units ran other histories under every mutant. A run with no `--seed` reported such mutants as `not-judged`, and its classes now match a seeded run's.
