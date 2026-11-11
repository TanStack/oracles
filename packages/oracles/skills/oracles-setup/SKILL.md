---
name: oracles-setup
description: Set up @tanstack/oracles in a repository. Install the pinned packages, add the lint preset, and write the AGENTS.md block. Make the oracle skills findable by coding agents, and run a first oracle through the gap check. Use when a repository adopts @tanstack/oracles or upgrades its pinned commit.
---

# Set up @tanstack/oracles

You are setting up oracle testing in this repository. Do the steps in order.
Ask the user before each step that writes outside the repository. When no
user is available, choose the default this skill gives, record each choice in
your report, and continue. That default covers setup questions only. A law
sheet has no default: write it, report it, and stop.

Setup ends when one oracle passes on production and the gap check leaves no
gap open in that oracle's own contract, unless the user decides otherwise. A
stated limit does not close a gap. It does not end when the packages are installed.

## 1. Read the repository

Find out, and tell the user:

- The package manager, and whether the repository is one package or a
  workspace. For a workspace, ask which package to start in.
- The test runner. The framework runs on Vitest 4 or later, with fast-check 4.
  If the package uses another runner, oracles run in a separate Vitest config
  beside it. Do not change the existing suite.
- Where production source lives (for example `src/`).
- The lint setup: ESLint 9 or later with a flat config, an older ESLint with
  `.eslintrc`, or no ESLint (for example Biome only).
- The Node version that CI and the `engines` field use. The package needs
  Node 20 or later. If CI runs an older Node, tell the user, and offer a
  separate Node 20 job for the oracles. Do not change the existing jobs. With
  no user present, do not change CI: report the mismatch.
- The repository's TypeScript version. Do not change it (step 2).
- The package manager and its runner for package binaries: `pnpm exec`,
  `npx`, or `yarn`. Use them wherever this skill shows `pnpm add` or
  `pnpm exec`.
- Which coding agents the user works with. Look for `.claude/`, `.agents/`,
  `.codex/`, `AGENTS.md`, and `CLAUDE.md`, and ask.

## 2. Install two pinned packages

The packages are not on npm yet. Install both from pkg.pr.new, pinned to the
same commit of TanStack/oracles. Ask the user for the commit if you were not
given one.

```sh
pnpm add -D \
  https://pkg.pr.new/TanStack/oracles/@tanstack/oracles@<sha> \
  https://pkg.pr.new/TanStack/oracles/@tanstack/eslint-plugin-oracles@<sha> \
  fast-check vitest
```

Add `fast-check` and `vitest` beside them. For lint, also add `eslint@^9`
if the repository has no ESLint, and `@typescript-eslint/parser@^8` if
nothing parses TypeScript yet. Name those majors: a package manager can pick
a prerelease otherwise. If the repository's ESLint is older than 9 (xo
included), install every package here with `--legacy-peer-deps` (npm), and see
the fallback in step 3. With that flag, npm skips peers, so check that
Vitest's own peer `vite` is installed, and add it if it is not.

Never add, upgrade, or downgrade the repository's `typescript` for oracles.
The gap check uses its own TypeScript and never reads the project's, from
commit `d8adfee` on. Pin a commit at or after `d8adfee`. Oracle files need
TypeScript 5 or newer. If the repository's `tsc` is older, keep the oracle
files and the Vitest config out of its run (its `include` or `exclude`).
Report any typecheck errors that existed before setup as pre-existing.

The gap check's own TypeScript installs as `typescript-for-tanstack-oracles`,
so it does not replace the repository's. In a repository with no TypeScript,
or after an incremental npm install, npm can still link its `tsc` into
`node_modules/.bin` until the next `npm ci`. Do not treat that `tsc` as the
repository's TypeScript, and do not add a typecheck that uses it.

Use the repository's own package manager. With pnpm 11, an install that skips
a dependency's build script stops every later pnpm command
(`ERR_PNPM_IGNORED_BUILDS`), and pnpm writes an `allowBuilds` placeholder into
`pnpm-workspace.yaml`. Answer it, usually `false`, and tell the user.

To upgrade, change both URLs to the new commit at once. Then do step 4 and
step 5 again (copy each pointer's `name` and `description` again, since they
can change), and rerun the gap check (step 7).

## 3. Configure

**Framework.** The defaults use the `ORACLE` environment-variable prefix and
accept every property id. Call `configureOracles` only to change that, in a
Vitest setup file that runs before any oracle module is imported.

**Where oracle files go.** Put oracle files in a test directory, named
`*oracle*.test.ts`, for example `tests/parse.oracle.property.test.ts`. If the
repository's main runner is not Vitest, check that it does not also pick up
the oracle files:

- If the runner loads every file in its test directory (uvu, mocha), put the
  oracle files in their own directory, such as `oracles/`.
- If its default glob matches `*.test.ts` (better-node-test, Jest), name the
  oracle files `*.oracle.ts`, and include that name in the Vitest config.

The gap check finds oracle files by their `oracleProperty` call, so the name
only has to match the Vitest config and the lint glob.

- If the repository has no Vitest config, create `vitest.config.ts` for the
  oracle files. Jest and mocha ignore that name.
- If another tool would pick up `vitest.config.ts`, name it
  `vitest.oracle.config.ts`, and pass `--config vitest.oracle.config.ts` to
  the gap check (step 7) and to the Vitest script.
- If the repository has a Vitest config, add the oracle glob to its existing
  `include`. Keep the globs that are there: replacing them drops the
  existing suite, since an `include` replaces Vitest's default.

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['tests/**/*oracle*.test.ts'] },
})
```

Add a script for it, such as `test:oracles`. Leave the existing suite
unchanged. In a published package, keep the new files out of the published
package (its `files` field or `.npmignore`): the configs, `AGENTS.md`,
`.agents/`, and `.claude/`.

If the repository's own lint or formatter covers the oracle files (for
example, an older ESLint with Prettier over `test/`), keep the oracle files
out of its globs, or match its style. Say which in your report.

**Lint.** Add both presets to the ESLint flat config:

```js
import oracles from '@tanstack/eslint-plugin-oracles'

export default [
  // ...the repository's existing config
  oracles.configs.recommended,
  oracles.configs.production,
]
```

- If you spread a preset and set your own `ignores` on it, merge
  `...preset.ignores` into them. The presets ignore tool configs
  (`eslint.config.*`, `vite.config.*`, `vitest.config.*`, `*.oracle.config.*`).
- `recommended` applies to oracle files and turns off inline directives there,
  so a disable comment has no effect.
- `production` checks the probe form in `src/**` and `packages/*/src/**`. If
  production source lives elsewhere (for example `source/`, or a root-level
  `index.js`), add
  the rule with that glob. The config object must register the plugin itself:

  ```js
  { files: ['index.js'], plugins: { oracle: oracles }, rules: { 'oracle/probe-form': 'error' } }
  ```

- If the repository lints with xo, keep the oracle files and the new config
  files out of xo (its `ignores`), and lint them with the oracle ESLint
  config. Do not install `eslint@^9` as a dev dependency: xo loads ESLint
  from the hoisted copy, and a second major breaks it. Use the
  `npx -p eslint@9` fallback below instead, and run it with
  `--no-inline-config`:
  xo's own disable comments in production files name rules that this config
  does not load, and ESLint reports each one.
- **TypeScript 7:** typescript-eslint does not support TypeScript 7 yet. If the
  repository's ESLint config cannot parse TypeScript, the oracle lint cannot
  run. Installing `@typescript-eslint/parser` fails with `ERESOLVE`, since its
  TypeScript peer range ends before 7. Do not force the install. Report it as
  an environment limit, with that reason. Do not change the repository's
  TypeScript.
- **TypeScript older than 4.8:** `@typescript-eslint/parser` 8 fails to
  load, and the failure takes down the whole flat config. Treat it the same
  way: an environment limit, reported, with no parser in the config.
- The plugin parses the modules an oracle file imports with that file's
  parser. A `.js` oracle file that imports a TypeScript module gets an
  `unparsedModule` report: write the oracle file in TypeScript, with a
  TypeScript parser.
- If ESLint does not already parse TypeScript, add `@typescript-eslint/parser`
  as a dev dependency. Set it as `languageOptions.parser` for every TypeScript
  file that the presets cover: the oracle files, and the production source if
  it is TypeScript. Otherwise a typed production file fails to parse before
  the probe rule runs. For JavaScript production source, set the parser for
  the oracle files only.
- Do not add an exemption. There is none: `legacyCampaigns` is removed, and
  setting it is reported.

**An older ESLint (7 or 8, `.eslintrc`).** Do not upgrade the repository's
lint. Lint the oracle files with a separate ESLint 9:

1. Install the plugin with `--legacy-peer-deps` (npm), or the package
   manager's equivalent.
2. Write a flat `eslint.oracle.config.mjs` with both presets and a TypeScript
   parser for the oracle files and the production source.
3. Run it as `npx -y -p eslint@9 eslint -c eslint.oracle.config.mjs <oracle
files> <production source>`, and add a `lint:oracles` script.

The config's parser import resolves from the repository, so it uses the
repository's own `@typescript-eslint/parser`.

Run the linter once and confirm that it loads the rules. Then check that the
rules are live: a deliberately wrong line in an oracle file must produce an
error. Use `import fc from 'fast-check'` and then `fc.assert(...)`. The rule
follows the fast-check import, so an `fc` that is not imported passes.
Remove the probe again. Before the first oracle file exists, do this check through the linter's `--stdin` with
an oracle file name, since a glob with no files fails.

## 4. Write the AGENTS.md block

Add this block to `AGENTS.md` (create the file if needed). On an upgrade,
replace everything between the markers and keep the rest of the file.

```md
<!-- BEGIN @tanstack/oracles (template 2) -->

## Oracle tests

This repository tests its laws with `@tanstack/oracles`.

**Who owns what.** The laws belong to the people who maintain this
repository: what the code promises, the authority for each promise, and its
limits. Propose a law, but do not adopt or change one without their
approval. The production code that the oracles own is yours. How it is built
is your call, and you will keep building on it. Make it the smallest, clearest
code that satisfies the oracles: merge repeated code, remove code that no law
needs (after the checks in `oracles-design` step 8), and restructure freely while the oracles pass.

- Before you create or change an oracle, or change production code that an
  oracle owns, read `node_modules/@tanstack/oracles/skills/oracles-design/SKILL.md`
  in full and follow it.
- Before you review oracle work, read
  `node_modules/@tanstack/oracles/skills/oracles-review/SKILL.md` in full.
- Before you act on review findings, read
  `node_modules/@tanstack/oracles/skills/oracles-evaluate-review/SKILL.md` in
  full.
- Lint each oracle file and each changed production file after you edit it.
  Fix every report. Do not disable a rule.
- Oracle files: `<oracle file glob>`. Gap check: `<gap check command>`.

<!-- END @tanstack/oracles -->
```

If lint is an environment limit (step 3), replace the lint line with "Lint:
not available here (<the reason>)." Fill in the two placeholders in step 7,
once their values exist. A run that
stops before step 7 leaves them in place, and its report says so. If the repository has a
`CLAUDE.md` and no `AGENTS.md`, ask the user which file gets the block.

In a workspace with a package-local install, put the block in the package's
`AGENTS.md`, where its `node_modules` paths resolve. A root copy must use the
full paths, such as `packages/<name>/node_modules/@tanstack/oracles/...`.

## 5. Make the skills findable

The skills ship inside the package, so agents find them only through a
pointer. A pointer must read the copy that the chosen package installed:

- **One package, or a workspace with a root install:**
  `node_modules/@tanstack/oracles/skills/<name>/SKILL.md`.
- **A package-local install in a workspace:**
  `<package dir>/node_modules/@tanstack/oracles/skills/<name>/SKILL.md`,
  for the package chosen in step 1. Check that the file exists there.

Use that path in the `AGENTS.md` block (step 4) too. Offer the user these
choices. They can pick more than one.

| Choice                  | Writes                                                                                                                           | Use when                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **AGENTS.md only**      | Step 4's block                                                                                                                   | The user's agents read `AGENTS.md`. This is always done.                     |
| **Repository pointers** | A pointer skill per skill in `.agents/skills/` and `.claude/skills/`                                                             | Everyone who clones the repository gets the skills. Commit them.             |
| **Global pointers**     | A pointer skill per skill in `~/.agents/skills/` and `~/.claude/skills/` (and any other skills directory the user's agents read) | The user wants the skills in every repository that uses `@tanstack/oracles`. |

Write a pointer skill as `<directory>/<name>/SKILL.md` for each of
`oracles-design`, `oracles-review`, `oracles-evaluate-review`, and
`oracles-setup`.

- Copy `name` and `description` exactly from the package's `SKILL.md`, so the
  agent selects it for the same requests.
- The body says only where the real skill is:

```md
---
name: oracles-design
description: <PLACEHOLDER: the description line of the installed oracles-design SKILL.md>
---

Read `<installed path>/skills/oracles-design/SKILL.md` in full, and follow it.
It matches the installed version of `@tanstack/oracles`. If that file does not
exist, run the repository's install, then look again. If it is still missing,
`@tanstack/oracles` is not installed there: say so and stop.
```

- In a **repository pointer**, `<installed path>` is the path above, relative
  to the repository root, such as `packages/app/node_modules/@tanstack/oracles`.
- In a **global pointer**, write instead: "Find the nearest `package.json` at
  or above the files you are working on whose dependencies include
  `@tanstack/oracles`. Use the `node_modules/@tanstack/oracles` in that
  package's directory." Then the pointer loads the right version in every
  workspace package.

Use pointers, not copies or symbolic links: a pointer always reads the
installed version, and never breaks before install.

Before writing a global pointer:

- Show the user the exact paths.
- If a skill with the same name exists, show it and ask. Never overwrite it
  silently.

## 6. Write the first oracle

Choose one small, owned production function with a clear, documented
promise. If most of its laws would have no authority (no docs, only tests or
code), choose another one. Ask the user which one if it is not obvious.

If the first oracle fails on unchanged production under an adopted law, it
found a defect. The RED is the finding: report it with its replay line, and
tell the user. Never weaken the oracle to make it pass. The gap check cannot
judge a failing baseline yet, so make the smallest local fix on a scratch
copy or a local branch (never pushed or committed to the user's branch), run
the gap check there, and say in the report that it ran on the
patched code. With the user's approval, follow `oracles-design` step 7's
defect path for the real fix.

Then load `oracles-design` and follow it from its first step. The oracle
file's prose laws come first, and the user reviews them before you add code.
Setup does not skip that step to finish sooner.

Put the oracle's `owns` list on its `oracleProperty` call. An entry is a file
(`src/index.ts`) or one function in it (`src/index.ts#parse`, or
`src/x.ts#Class.method`). A function entry owns that function and its static
call tree, including the module-level data it reads. A default export is
`src/index.ts#default`. For a first oracle, own only the function it covers.
If the gap check refuses with "no oracle file", the oracle is not
declared: that is a setup failure.

In an oracle file, only `oracleProperty` registers tests. A plain Vitest test
there is not a kill, and the gap check reports it. Lint also reports an empty test
there: it checks nothing and looks like coverage. Remove it, or use `it.todo`. The driver records
production errors as observations: a mutant that crashes production is not a
kill until the check rejects the recorded error.

## 7. Run the gap check

Run the gap check on the owned source:

```sh
pnpm exec oracle-gaps --package <package dir> --source <src/file.ts> \
  --seed <n> --out <package dir>/.oracle-gaps/out
```

Add `--config <file>` (relative to the package) when the oracle Vitest config
is not Vite's default name. The baseline prints which config it used.

- `--source` selects files. `owns` can name a single function in a file, so
  the report judges only the owned functions. Code in the file that no oracle
  owns appears as unowned warnings.
- Pass `--seed`, so the baseline and every mutant run the same histories.
  Pass `--out` inside the repository. (Both become defaults later.)
- Add `.oracle-gaps/` to `.gitignore`.
- Read the exit code. **0:** the run completed; work from its report.
  **2:** refused. It prints `refused: <cause>` and one `fix: <directive>`.
  Do what the `fix:` line says, then run again. **3:** an internal error, "a
  bug in oracle-gaps", with the stack in `<out>/error.log`. Report it as a CLI
  bug with that file, and do not change the oracle to get around it.

Run it after the oracle passes on production. Each gap in the report comes
with one instruction. Follow
that instruction, and follow `oracles-design` for what a gap means. There
are no equivalent mutants and no exits. A surviving mutant shows only that
the current histories did not expose that code. If you believe the code is
dead, first follow `oracles-design` step 8 to rule out a missing history,
observation, or law. Removing it is a production change, so tell the user,
and rerun the oracle and the gap check. If a gap can be neither killed
nor removed, stop work on that gap and report its key and evidence to the
user.

Now fill in the two placeholders in the `AGENTS.md` block: the oracle file
glob and the gap check command you ran.

## 8. Report

Tell the user:

- what was installed (both pinned URLs) and where configuration changed
- which pointers were written, and where
- the first oracle's law and its result
- the gap check's totals, and every gap left, grouped as:
  - open because the inputs that expose it lie outside the law's stated
    limits: name those inputs, and recommend widening the grammar and the
    law. The user decides. Do not count these as closed.
  - allowed alternatives (`oracles-design` step 8), apart from the kills
  - framework or CLI limitations (for example a timeout from a synchronous
    infinite loop, or a guard that TypeScript narrowing makes constant)
  - other contracts that a whole-file entry pulled in, listed as outside
    this oracle's scope
  - every other gap, with its instruction
- any defect the oracle found, with its witness

Do not call setup done while a gap is open in the oracle's own contract,
unless the user decides otherwise.
