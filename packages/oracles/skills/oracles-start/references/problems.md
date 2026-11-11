# Problems you may hit in a first session

Open this file when one of these happens. Each entry says what to do, and
what to tell the engineer.

## Installs

**The repository uses another test runner** (mocha, uvu, Jest, ava,
`node:test`). Add Vitest for the oracles only, with a config whose `include`
is only the oracle files. Their own suite and runner stay as they are. Tell
the engineer this in one line as you install.

**The repository runs a Vitest older than 4.1.** This is the engineer's
decision. Tell them that the oracle needs Vitest 4.1 or later, and that
upgrading changes the runner for their own suite too. Offer to upgrade and
then run their suite, to show whether it still passes. Do not upgrade until
they agree.

**npm installed `fast-check` and `vitest` already.** npm installs the peers
of `@tanstack/oracles` without listing them. Check `package.json`, not
`node_modules`, and add both to the dev dependencies.

**Which Vitest.** Install `vitest@^4.1`. It runs on Node 20 and later, and
Vitest 5 needs Node 22.12 or later. Which Node versions CI runs is a
question for production: do not raise it now.

**An install fails.** Show the error in a line or two, say what you think
caused it, and ask before you try anything that changes more than the
packages the oracle needs.

**Lint.** The oracles lint plugin waits for production. If the
repository's own lint already covers the oracle file's folder, run it on
the file, as `oracles-design` says.

## Probes

**The tests import a build that is not built yet.** Import the source that
the build comes from.

**Node warns about the module type.** Give the scratch directory a
`package.json` with `"type": "module"`.

**Node cannot load the source as it is** (for example, an extensionless ES
module). Copy it unchanged into the scratch directory, under a name that
Node can load, such as `index.mjs`, and tell the engineer that you did.

**The code is TypeScript.** Run the probe with `npx tsx`.
