---
'@tanstack/oracles': patch
---

Without `--config`, the `oracle-gaps` CLI now loads the Vitest config that Vitest itself would load for the package: the first of Vitest's config names in the package's directory, or else in the nearest parent directory that has one. Before, it looked only in the package's directory and ran Vitest's defaults when the config was in a parent. The baseline's replay command then ran under the parent's config, which Vitest found, and could find no test. A parent's config that defines `test.projects` now refuses the run, as the package's own does.
