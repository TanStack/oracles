---
'@tanstack/oracles': patch
---

A check through `--daemon` now treats every read as an input of the runs that made it, so after any of these changes it reports what a cold run reports. Before, the daemon reused a run that read the old input. The new inputs are a file that a test reads through `fs` outside the package or under `node_modules`, or through `createReadStream`; a directory that a test lists (`readdir`, `opendir`, and their sync and `fs/promises` forms), by its entries; an environment variable that a test reads (or the set of variable names, when a test lists them); and a file or variable that Vitest, Vite, or the config reads in the CLI's process, while it loads or in a hook of any plugin, Vite's own included, such as the `tsconfig.json` that Vite's esbuild plugin reads or a sidecar file that a plugin writes into the code it transforms.

The daemon now runs each check in the environment of the CLI that asked for it. A check from another environment, or after a file that Vitest, the config, or a plugin read or wrote has changed, starts a new daemon. Because Vitest and Vite read every environment variable while they start, any change to the environment runs every unit again, as a cold run does.

Each check now hashes every file input from its content, so an edit that keeps a file's size and modification time, as `cp -p`, `rsync -t`, or `touch -r` leave it, is no longer missed.

A file that a test, or a Node process it started at any depth, wrote before the test read it is the test's own output and no input, so a test whose child writes a temporary file is reused on an unchanged check. The daemon's evidence store is now written and read one row per line, so a large suite's store no longer fails every check with "Invalid string length".
