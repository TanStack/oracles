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

Every probe in a scratch directory needs these two from the start.

**Load the repository's packages with `createRequire`.** A probe in the
scratch directory cannot import the repository's packages by name:
`import fc from 'fast-check'` fails with `ERR_MODULE_NOT_FOUND`. Load them
from the package whose `package.json` lists them, and import the code under
test by its absolute path. `<pkg>` is an absolute path: `createRequire`
rejects a relative one (`ERR_INVALID_ARG_VALUE`). In a workspace, anchor at that package, not at
the root: `createRequire('<root>/package.json')` cannot find a dependency
that only a workspace package lists (`MODULE_NOT_FOUND`).

```js
// probe.mts
import { createRequire } from 'node:module'
const require = createRequire('<pkg>/package.json')
const fc = require('fast-check')
const { clamp } = await import('<pkg>/src/clamp.ts')
```

A package whose `exports` has only an `import` condition cannot be
required (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Import the file that its
`exports` names, by absolute path:
`await import('<pkg>/node_modules/<name>/<that file>')`.

**Run TypeScript with the repository's `tsx`, or with Node.** Name the
probe `probe.mts`: a `.ts` probe in a scratch directory with no
`"type": "module"` runs as CommonJS under `tsx`, and its top-level `await`
fails to compile. Then, in this order:

1. The repository's own `tsx`, when it is installed:
   `<pkg>/node_modules/.bin/tsx probe.mts`, or, in a workspace that
   installs it at the root, `<root>/node_modules/.bin/tsx probe.mts`. It runs any TypeScript, and
   resolves `./b` and `./b.js` to `b.ts`. Run from the scratch directory,
   it does not read the repository's `tsconfig.json`: when the source
   imports through `paths` aliases (`@/clamp`), add
   `--tsconfig <pkg>/tsconfig.json`.
2. Node's own type stripping. Plain `node probe.mts` strips types on Node
   22.18 and later 22 releases, and on 23.6 and later.
   `node --experimental-strip-types probe.mts` does it on Node 22.6 to 22.17,
   and on 23 before 23.6. Node 20 has neither: it rejects `.mts` and `.ts`
   as unknown file extensions, and the flag as a `bad option`. It has two
   limits:
   - It runs only TypeScript whose types can be erased. An enum or a
     parameter property (`constructor(private n: number)`) fails with
     "is not supported in strip-only mode". `--experimental-transform-types`
     runs them on Node 22.7 to 25. Node 26 no longer has that flag.
   - It resolves only imports that name the `.ts` file. Source that
     imports `./b`, `./b.js`, or a `paths` alias fails with
     `ERR_MODULE_NOT_FOUND`.
3. Otherwise `npx -y tsx probe.mts`. It downloads tsx from the registry into
   npx's cache, outside the repository's lockfile. Tell the developer in a
   line when you use it.

**The tests import a build that is not built yet.** Import the source that
the build comes from.

**Node warns about the module type.** If the warning names the scratch
directory, give it a `package.json` with `"type": "module"`. If it names the
repository's `package.json`, the warning is harmless: run the probe with
`node --no-warnings`, and do not change their `package.json`.

**Node cannot load the source as it is** (for example, an extensionless ES
module). Copy it unchanged into the scratch directory, under a name that
Node can load, such as `index.mjs`, and tell the developer that you did.
