---
'@tanstack/oracles': patch
---

A check through `--daemon` now treats every read as an input of the runs that made it, so after any of these changes it reports what a cold run reports. Before, the daemon reused a run that read the old input. The new inputs are a file that a test reads through `fs` outside the package or under `node_modules`, or through `createReadStream`; a directory that a test lists (`readdir`, `opendir`, and their sync and `fs/promises` forms), by its entries; an environment variable that a test reads (or the set of variable names, when a test lists them); and a file or variable that Vitest, the Vite config, or one of the config's own plugins reads while it loads or in one of its hooks, such as a sidecar file that a plugin writes into the code it transforms.

The daemon now runs each check in the environment of the CLI that asked for it. A check from another environment, or after a file that the config or a plugin read has changed, starts a new daemon, which still reuses every stored run whose inputs are unchanged.

Each check now hashes every file input from its content, so an edit that keeps a file's size and modification time, as `cp -p`, `rsync -t`, or `touch -r` leave it, is no longer missed.
