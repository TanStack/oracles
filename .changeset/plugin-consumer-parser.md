---
'@tanstack/eslint-plugin-oracles': patch
---

Fix the plugin failing to load in a repository whose TypeScript is 7 or absent. `oracle/no-unit-test` imported `@typescript-eslint/parser` at load time, and that parser rejects TypeScript 7, so every config of the plugin failed to import. The rule now parses each imported test module with the parser and parser options that ESLint uses for the file it lints, through ESLint's own `Linter`, so it agrees with the consumer's config and needs no TypeScript of its own. `@typescript-eslint/parser` is no longer a dependency.

Two related fixes: under espree, the rule saw no references at all and reported every test as a unit test (or the file as undeclared); it now reads espree's scopes. And when a file has a test that reaches no part, an import of a module that its parser cannot read is reported (`unparsedModule`) with the parser's error, instead of being skipped silently. The rule never throws on such a module.
