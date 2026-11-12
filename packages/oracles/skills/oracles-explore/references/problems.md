# Problems you may hit

Open this file when one of these happens. Each entry says what to do, and
what to tell the developer.

## Installs

**The repository uses another test runner** (mocha, uvu, Jest, ava,
`node:test`). Add Vitest for the oracles only, with a config whose `include`
is only the oracle files. Their own suite and runner stay as they are. Tell
the developer this in one line as you install.

**The repository runs a Vitest older than 4.1.** This is the developer's
decision. Tell them that the oracle needs Vitest 4.1 or later, and that
upgrading changes the runner for their own suite too. Offer to upgrade and
then run their suite, to show whether it still passes. Do not upgrade until
they agree.

**npm installed `fast-check` and `vitest` already.** npm installs the peers
of `@tanstack/oracles` without listing them. Check `package.json`, not
`node_modules`, and add both to the dev dependencies.

**Which Vitest.** Install `vitest@^4.1`. It runs on Node 20 and later, and
Vitest 5 needs Node 22.12 or later. Which Node versions CI runs is a
question for when the repository's setup is finished: do not raise it
now.

**An install fails.** Show the error in a line or two, say what you think
caused it, and ask before you try anything that changes more than the
packages the oracle needs. Once the install works, go on from where you
were: the findings and the approved laws still stand, so do not probe or
propose again.

**Lint.** The oracles lint plugin comes when the repository's setup is
finished. If the
repository's own lint already covers the oracle file's folder, run it on
the file, as `oracles-design` says.

**The repository's other test runner picks up the oracle file.** ava, Jest,
or mocha may match `*.oracle.test.*` by default. Exclude only the oracle
folder from that runner (for ava, `files: ['!oracles/**']` in an
`ava.config.js`), and keep its other defaults, so their suite runs as
before. Tell the developer in one line.

**Lint autofix changes what an oracle observes.** An autofix can rewrite code
in ways that change behavior (for example `promise.then(ok, fail)` into
`promise.catch(fail).then(ok)`). Review each autofix in an oracle file before
you run it, and undo any that changes what the driver observes.

**The repository's lint picks up the oracle file.** If its lint (xo, ESLint
over every file) now fails on the oracle file or the Vitest config, tell the
developer in one line. Leaving them out of that lint is part of finishing
the setup. Do not change their lint config in a first session.

## Runs

**The oracle file throws before any test runs** (a syntax error, a failed
import, a generator that throws while it is built). The gap check reports
the file as failing, with the error but no law. Fix the oracle file, and
run the gap check again. This is the oracle's own setup, not a finding: say
so in a line.

## Probes

**The tests import a build that is not built yet.** Import the source that
the build comes from.

**Node warns about the module type.** If the warning names the scratch
directory, give it a `package.json` with `"type": "module"`. If it names the
repository's `package.json`, the warning is harmless: run the probe with
`node --no-warnings`, and do not change their `package.json`.

**Node cannot load the source as it is** (for example, an extensionless ES
module). Copy it unchanged into the scratch directory, under a name that
Node can load, such as `index.mjs`, and tell the developer that you did.

**The code is TypeScript.** Run the probe with `npx tsx`.

**A probe needs `fast-check` or another package from the repository.** A
probe in the scratch directory cannot import the repository's packages by
name. Load them from the repository with `createRequire`:
`const require = createRequire('<repo>/package.json')`, then
`require('fast-check')`.
