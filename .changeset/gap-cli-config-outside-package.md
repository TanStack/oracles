---
'@tanstack/oracles': patch
---

`oracle-gaps --config` may name a Vitest config outside the package, so a temporary config (one that includes a single oracle file, say) can live in a scratch directory and not be written into the repository and removed again. The path is still relative to `--package`. The run loads the config by its path with the package as Vitest's root, so the config's `include` globs and setup files resolve against the package. The `config` line and a failing owner's replay name it relative to the package (`../…`), as they name a config that Vitest discovers in a parent directory. A `--config` that names no file, or a directory, still refuses, now with `refused: --config <x> is not a file`.
