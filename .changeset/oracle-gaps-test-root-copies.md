---
'@tanstack/oracles': patch
---

The `oracle-gaps` CLI judges the mutants of a package whose Vitest config sets `test.root` to a subdirectory. Vitest names each copy of a test file by its path from that root, but the copy resolver only tried the package, so every copy in the subdirectory failed to load with `Cannot find module '/.oracle-gaps-…'`, and every mutant of an owner there reported `setup-error`. The resolver now also tries the copy from the root Vitest names modules from, and it spells paths as the copies are keyed (on Windows, forward slashes and an uppercase drive letter; on POSIX, unchanged).
