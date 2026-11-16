---
'@tanstack/oracles': patch
---

The `oracle-gaps` CLI judges the mutants of a package whose Vitest config sets `test.root`. Before, the CLI resolved each in-memory copy of a test file to its path, so Vite named the copy from its root and imported it again by that name. Under a test root other than the package, that name (`/.oracle-gaps-…`) matched no copy, the copy failed to load, and the mutants of an owner there reported `setup-error`. The CLI now leaves a copy unresolved: Vite keeps the absolute path that Vitest imports it by, and the CLI serves the copy from that path. This works for a test root inside the package, above it, a root that holds no test file, and a root that is a symbolic link.
