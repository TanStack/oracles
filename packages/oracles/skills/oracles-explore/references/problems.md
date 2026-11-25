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

**`pkg.pr.new` returns HTTP 404 for the tip of `main`.** `Publish preview`
runs only after the jobs in its `needs` list pass, so a red blocking job on
the tip (for example, the random-seed gap job on `7b6bae16`) leaves no
preview. Check recent
commits on `main` in `TanStack/oracles` for the latest one whose `Publish
preview` check succeeded (or whose `pkg.pr.new` URL returns HTTP 200 with
`curl -sI`), pin both packages to that commit, and tell the developer which
commit you pinned.

**A workspace package has no `node_modules`.** In a monorepo, a fresh git
worktree has nothing installed, and `pnpm add -w` installs only the root's
packages, so a probe that imports the package under test fails with
`Cannot find package`. Install that package and its workspace dependencies:
`pnpm install --filter <pkg>...`, with the name from its `package.json`.
Without the trailing `...`, the packages it depends on stay uninstalled.

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

**The gap check dies with "heap out of memory"** on a very large oracle
suite (thousands of tests). Run it again with
`NODE_OPTIONS=--max-old-space-size=8192`, or with `--contexts 2`. Keep
every test and history: do not shrink the oracle to make it fit.

**TypeScript reports untyped imports (`TS7016` / `TS7006`) on `.js` or `.mjs`
production files.** Import through the package's typed entry where one
exists instead of an untyped relative `.js` or `.mjs` path. When no typed
entry covers the module, enable `allowJs` in the test or oracle tsconfig
instead of hiding errors with `any` or `@ts-ignore`.

**TypeScript rejects `constructed[].build` on a union literal or tuple.**
Inside an unannotated `oracleProperty(...)` call, TypeScript can widen union
string literals or fixed-length tuples returned by `build`. Give `build` an
explicit return type (`build: (generated): History => ({ ... })`) or narrow
the literal with `as const`.

**The repository's `tsconfig.json` does not cover the oracle file.** Vitest
strips types without checking them, so an excluded oracle file can pass
`oracle-gaps` while failing `tsc --noEmit`. When the repository uses
TypeScript 5 or newer, check that the oracle file typechecks under the
repository's `tsc --noEmit` (or a test tsconfig that extends `tsconfig.json`).

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
