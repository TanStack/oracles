---
'@tanstack/oracles': patch
---

The `oracle-gaps` CLI takes `--config <file>`, relative to `--package`, to select the package's Vitest config. Without it, the run loads the config that Vitest discovers, as before. The baseline output now starts with `config: <file>`, or `no config file: Vitest's default discovery`. A `--config` that names no file of the package refuses the run. A run names its config once its contexts have loaded it, also when the analysis or the baseline then refuses the run. A failing owner's `replay:` command names the `--config` file too, so it runs the failing test under the same config, even when Vitest would discover another one.

The runner's wrapper config now has the module format that Vite gives the package's own config, so Vite bundles that config as Vitest loads it. An `.mjs` or `.mts` config, or a `.js` or `.ts` config in a package with `"type": "module"`, gets an `.mts` wrapper, where a top-level `await` works. A `.cjs` or `.cts` config, or a `.js` or `.ts` config in a package without that type, gets a `.cts` wrapper, where `require` and `require.resolve` work. Before, every wrapper was a `.ts` file. In a package without `"type": "module"`, Vite bundled such a wrapper as CommonJS, so an `.mjs` config with a top-level `await` refused the run, and older Vite versions printed their CommonJS deprecation warning.

A run with more than ten warm contexts (`--contexts`, which defaults to up to 16) no longer prints `MaxListenersExceededWarning`. Each context is a Vitest instance that listens on the process until it closes; the runner now raises the process's listener limit by one for each open context and lowers it when the context closes.
