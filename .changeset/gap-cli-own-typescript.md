---
'@tanstack/oracles': patch
---

Fix the `oracle-gaps` CLI crashing on a package whose TypeScript has no compiler API, as TypeScript 7's package has (it exposes only its version). The CLI now analyzes with its own TypeScript 5 dependency and never reads the package's TypeScript, so a package with no TypeScript, or with TypeScript 7, is analyzed instead of refused or crashed. The optional `typescript` peer dependency is removed for that reason. A copy of the CLI's own TypeScript without the compiler API is refused before any work, with a message that names the fix.
