---
'@tanstack/oracles': patch
---

The `oracle-gaps` CLI takes `--config <file>`, relative to `--package`, to select the package's Vitest config. Without it, the run loads the config that Vitest discovers, as before. The baseline output now starts with `config: <file>`, or `no config file: Vitest's default discovery`. A `--config` that names no file of the package refuses the run. A failing owner's `replay:` command names the `--config` file too, so it runs the failing test under the same config, even when Vitest would discover another one.

The runner's wrapper configs are `.mts` files, so Vite loads them, and the package's config through them, as ES modules in a package of any module type. Before, in a package without `"type": "module"`, Vite bundled them as CommonJS, so a config that Vitest itself loads, such as a `vite.config.mjs` with a top-level `await`, refused the run, and older Vite versions printed their CommonJS deprecation warning.

A run with more than ten warm contexts (`--contexts`, which defaults to up to 16) no longer prints `MaxListenersExceededWarning`. Each context is a Vitest instance that listens on the process until it closes; the runner now raises the process's listener limit by one for each open context and lowers it when the context closes.
