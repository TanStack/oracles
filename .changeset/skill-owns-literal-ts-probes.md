---
'@tanstack/oracles': patch
---

The `oracles-design` skill says to write `owns` inline in each `oracleProperty` call, as an array of string literals: the gap check reads it without running the file, so it refuses a shared constant, a spread, and `as const`. The `oracles-explore` skill's problems reference says what Node's type stripping cannot run (enums, namespaces, constructor parameter properties), and which TypeScript runner to use for a probe, in order: one the repository already has, the package's rebuilt build, then `npx tsx`, after telling the developer that it downloads.
