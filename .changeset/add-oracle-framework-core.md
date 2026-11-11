---
'@tanstack/oracles': patch
---

Add the oracle framework core, extracted from TanStack DB: `oracleProperty`, the controlled clock, failure fidelity, and replay witnesses. `configureOracles({ envPrefix, registry, retiredVariables })` lets a project keep its own environment variable names and property registry. The main entry is ES modules only; `@tanstack/oracles/route` is a browser-safe entry for the route helpers (`oracleRoute`, `oracleRouteOf`, and `oracleFixedSeed`).
