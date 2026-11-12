---
name: oracles-setup
description: Finish setting up a repository for oracles with @tanstack/oracles. Pin the packages, add the lint preset and the Vitest config, write the AGENTS.md block, make the oracle skills findable by coding agents, and run the oracle through the gap check. Use when the developer wants to keep the work of a first session (a commit, or a pull request), when a repository adopts @tanstack/oracles, or when it upgrades its pinned commit. Its install and file-placement sections also cover the minimal setup that a first session needs.
---

# Finish setting up a repository for oracles

You are setting up oracle testing in this repository. Do the steps in order.
Ask the developer before each step that writes outside the repository. When no
developer is available, choose the default this skill gives, record each choice in
your report, and continue. That default covers setup questions only.
Potential laws have no default: propose them, report them, and stop.

This skill has two uses. A first session (`oracles-explore`) uses only its
install section and its "where oracle files go" section, for the minimal
setup that an oracle needs to run, and step 7's command, when its oracle
passes and it runs the gap check. Finishing the setup uses all of it. That
usually starts after a first session, when the developer wants to keep the
work: to commit it, or to open a pull request. If there is
no oracle yet, load `oracles-explore` first.

Setup ends when one oracle passes on production and the gap check leaves no
gap open in that oracle's own contract, unless the developer decides otherwise. A
stated limit does not close a gap. It does not end when the packages are installed.

## 1. Read the repository

Find out, and tell the developer:

- The package manager, and whether the repository is one package or a
  workspace. For a workspace, ask which package to start in.
- The test runner. The framework runs on Vitest 4.1 or later, with fast-check 4.
  If the package uses another runner, oracles run in a separate Vitest config
  beside it. Do not change the existing suite.
- Where production source lives (for example `src/`).
- The lint setup: ESLint 9 or later with a flat config, an older ESLint with
  `.eslintrc`, or no ESLint (for example Biome only).
- The Node version that CI and the `engines` field use. The package needs
  Node 20 or later. If CI runs an older Node, tell the developer, and offer a
  separate Node 20 job for the oracles. Do not change the existing jobs. With
  no developer present, do not change CI: report the mismatch.
- The repository's TypeScript version. Do not change it (step 2).
- The package manager and its runner for package binaries: `pnpm exec`,
  `npx`, or `yarn`. Use them wherever this skill shows `pnpm add` or
  `pnpm exec`.
- Which coding agents the developer works with. Look for `.claude/`, `.agents/`,
  `.codex/`, `AGENTS.md`, and `CLAUDE.md`, and ask.

## 2. Install two pinned packages

The packages are not on npm yet. Install both from pkg.pr.new, pinned to the
same commit of TanStack/oracles. If you were not given one, use the current
commit on main: the first 7 characters of the hash that
`git ls-remote https://github.com/TanStack/oracles refs/heads/main` prints.
Tell the developer which commit you pinned.

```sh
pnpm add -D \
  https://pkg.pr.new/TanStack/oracles/@tanstack/oracles@<sha> \
  https://pkg.pr.new/TanStack/oracles/@tanstack/eslint-plugin-oracles@<sha> \
  fast-check@^4 vitest@^4.1
```

Add `fast-check` and `vitest` beside them. The framework needs Vitest 4.1 or
later. If the repository already runs an older Vitest, upgrading it is the
developer's decision: ask, and with no developer present, do not upgrade. Report it as
a blocker. For lint, also add `eslint@^9`
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
`pnpm-workspace.yaml`. Answer it, usually `false`, and tell the developer.

A run that installs from a local tarball has no commit to pin or check. Say
which tarball you installed, and note that `package.json` now points at a
local path that must be replaced before anything is committed.

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
- If the repository's own Vitest run would also pick them up (a config with
  no `include`, or one whose setup needs a server), name the oracle files
  `*.oracle.ts`, and give them their own `vitest.oracle.config.ts`.

The gap check finds oracle files by their `oracleProperty` call, so the name
only has to match the Vitest config and the lint glob.

- If the repository has no Vitest config, create `vitest.config.ts` for the
  oracle files. Jest and mocha ignore that name. If its `package.json` has
  no `"type": "module"`, name it `vitest.config.mts`, so that Vitest loads
  it without a module-type warning.
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

If the production source uses syntax that Vite cannot parse (Flow types,
for example), add a Vite plugin to the oracle config that strips it, such as
one built on `flow-remove-types`.

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
- Do not add an exemption. There is none.

**An older ESLint (7 or 8, `.eslintrc`).** Do not upgrade the repository's
lint. Lint the oracle files with a separate ESLint 9:

1. Install the plugin with `--legacy-peer-deps` (npm), or the package
   manager's equivalent.
2. Write a flat `eslint.oracle.config.mjs` with both presets and a TypeScript
   parser for the oracle files and the production source.
3. Run it with an ESLint 9 that the plugin can find: the plugin loads
   `eslint` at run time, from where the plugin is installed. `npx -p eslint@9`
   is not enough, because npx runs the repository's local ESLint when one
   exists. With pnpm, use `pnpm dlx eslint@9 -c eslint.oracle.config.mjs
<oracle files> <production source>`. Otherwise, install `eslint@^9` in the
   workspace package that holds the plugin, if that does not replace the
   ESLint that the repository's own lint uses. If neither works, lint is an
   environment limit: report it. Add a `lint:oracles` script.

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
<!-- BEGIN @tanstack/oracles (template 4) -->

## Oracle tests

This repository tests its design with `@tanstack/oracles`. An oracle
captures the code's design as laws and enforces them against an independent
model. Work oracle first, production second.

**Who owns what.** The laws belong to the people who maintain this
repository: what the code promises, the authority for each promise, and its
limits. Propose a law, but do not adopt or change one without their
approval. The production code that the oracles own is yours. Whenever you
change it, do a good job, not a minimal or lazy one: the fast, small,
elegant version, as an optimizing compiler for the oracle would write it.
Anything that keeps every oracle passing is allowed, so a big refactor is
fine when it makes the code better; the oracle is the review. Keep it in
proportion to the task: improve the code the work touches, and when you see
a larger win elsewhere, offer it instead of turning the task into a long
optimization project.

**How the work goes.**

- **Probe first.** Before you propose anything, call the real code with
  small scripts and show what they print. Every law and every finding comes
  with a probe that can be rerun.
- **Propose the laws, then build only the approved ones.** Each law is a
  "For every …" sentence with where its promise is written: the docs, a
  test, or a maintainer's decision. A question nobody has decided is fine:
  state it as a limit.
- **Red first, like TDD, but the oracle goes red.** A bug becomes a law and
  a history that fail on the unchanged code. Then fix production at once,
  and show the run going green.
- **Never weaken or quarantine an oracle:** no skip, no `test.fails`, no
  loosened expectation, no switch that turns a check off.
- **Build the strongest model the laws need.** Compare every observable
  result they speak about. The model states the rule a user relies on,
  never the code's algorithm, even when the docs describe that algorithm.
  Give each law a calibration: a wrong answer the check must reject.
- **Run the oracles only through the gap check, never Vitest alone.** It
  prints each test file's result first, then each gap as it is judged. A run
  can take minutes: start it in the background with output to a log, and
  read the new lines every few seconds, acting on a failure first. Stop a
  run only by the process ID you recorded, never by name.
- **Green is not done.** A gap is a change to the owned code that no law
  notices. There are no equivalent mutants: never call one equivalent.
  Widen the histories or the check until the oracle sees it, and keep going
  until a bug or a design question turns up.
- **Report classes of bugs:** the rule broken, and the measured share of
  generated inputs that break it. Never call one minor.

**Skills.**

- To explore an area of the code (or the whole repository), find where an
  oracle would help, or propose a new one, read
  `node_modules/@tanstack/oracles/skills/oracles-explore/SKILL.md` in full
  and follow it.
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
once their values exist. A run that stops before step 7 leaves them in
place, and its report says so.

Check for both `AGENTS.md` and `CLAUDE.md`. Claude Code reads `CLAUDE.md`,
and most other agents read `AGENTS.md`. If both exist, put the block in
`AGENTS.md` and make sure `CLAUDE.md` refers to it (a line `@AGENTS.md`
imports it). If only `CLAUDE.md` exists, ask the developer which file gets the
block. If neither exists, create `AGENTS.md` and a `CLAUDE.md` that holds
only `@AGENTS.md`, after asking.

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

Use that path in the `AGENTS.md` block (step 4) too. Offer the developer these
choices. They can pick more than one.

| Choice                  | Writes                                                                                                                                | Use when                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **AGENTS.md only**      | Step 4's block                                                                                                                        | The developer's agents read `AGENTS.md`. This is always done.                     |
| **Repository pointers** | A pointer skill per skill in `.agents/skills/` and `.claude/skills/`                                                                  | Everyone who clones the repository gets the skills. Commit them.                  |
| **Global pointers**     | A pointer skill per skill in `~/.agents/skills/` and `~/.claude/skills/` (and any other skills directory the developer's agents read) | The developer wants the skills in every repository that uses `@tanstack/oracles`. |

Write a pointer skill as `<directory>/<name>/SKILL.md` for each of
`oracles-explore`, `oracles-design`, `oracles-review`,
`oracles-evaluate-review`, and `oracles-setup`.

Before you write repository pointers, check that git does not ignore their
directories (`git check-ignore .claude/skills .agents/skills`). If one is
ignored, tell the developer: they can commit the pointers in the other
directory, or add an exception to `.gitignore`.

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

- Show the developer the exact paths.
- If a skill with the same name exists, show it and ask. Never overwrite it
  silently.

## 6. Build the first oracle

Usually the oracle already exists from the first session. Keep it, and
continue with its gap check. If there is none, build it from the potential
laws that the developer approved: load `oracles-design`, and follow it from
its first step.

A first session fixes each bug the developer confirms right away, oracle
first, and runs the gap check only when its oracle passes (`oracles-explore`
step 5). When finishing the setup:

If the first oracle fails on unchanged production under an adopted law, it
found a defect. The RED is the finding: report it with its replay line, and
tell the developer. Never weaken the oracle to make it pass. While that
oracle fails, the gap check blocks the mutants it owns and judges the rest,
in a provisional report. Follow `oracles-design` step 7's defect path for
the fix, then run the gap check again for a full report.

Put the oracle's `owns` list on its `oracleProperty` call. An entry is a file
(`src/index.ts`) or one function in it (`src/index.ts#parse`, or
`src/x.ts#Class.method`). A function entry owns that function and its static
call tree, including the module-level data it reads. An unnamed default
export is `src/index.ts#default`; a named one keeps its name
(`src/index.ts#pLimit`). For a first oracle, own only the function it covers.
If the gap check refuses with "no oracle file", the oracle is not
declared: that is a setup failure.

In an oracle file, only `oracleProperty` registers tests, directly or
through a project helper that forwards a literal `owns` list to it. A plain Vitest test
there is not a kill, and the gap check reports it. Lint also reports an empty test
there: it checks nothing and looks like coverage. Remove it, or use `it.todo`. The driver records
production errors as observations: a mutant that crashes production is not a
kill until the check rejects the recorded error.

## 7. Run the gap check

The gap check is also how you run the oracles. It runs every test file
first and prints each one's result: `pass <file>: N tests`, or `fail <file>`
with the failing law, its counterexample, and a `replay:` command. A failing
oracle file blocks only the mutants it owns (a `blocked:` line says so); the
rest are judged, and the report is marked provisional. Then each gap prints
as one line as soon as it is judged (`<kind> L<line> <id> <change>`), with a
`judged N of M mutants` progress line every 25 mutants and a `busy:` line
while a slow test runs. Use it instead of running Vitest on its own, so that
every run gives you the test results and the gaps together.

**Act on results as they arrive.** A run can take minutes, and your shell
may hand you its output only when it ends. So start it in the background
with its output going to a log file, and every few seconds read the lines
that are new since you last looked, for example with
`grep -nE '^(pass|fail|blocked:|judged|busy:)|^[a-z-]+ L[0-9?]+ ' <log>`.
Act on a `fail` or `blocked:` line first: fix that oracle, because the
mutants it owns cannot be judged. Then start on the first gaps while the
run goes on. Stop the run early only when it is clearly wrong, for example
a gap count far beyond what the oracle owns. Record the run's process ID
when you start it (`$!`), and stop it by that ID. Never stop it by name
(`pkill -f oracle-gaps`, `killall`): that kills every matching process on
the machine, including other people's and other agents' runs.

Run the gap check on the owned source:

```sh
pnpm exec oracle-gaps --package <package dir> --source <src/file.ts> \
  --seed <n>
```

Add `--config <file>` (relative to the package) when the oracle Vitest config
is not Vite's default name. The baseline prints which config it used.

- `--source` selects files. `owns` can name a single function in a file, so
  the report judges only the owned functions. Code in the file that no oracle
  owns appears as unowned warnings.
- Pass `--seed`, so the baseline and every mutant run the same histories.
  The report goes to a directory in the OS temp directory, and its path is
  printed at the end. Nothing is written into the repository.
- Read the exit code. **0:** the run completed; work from its report.
  **2:** refused. It prints `refused: <cause>` and one `fix: <directive>`.
  Do what the `fix:` line says, then run again. **3:** an internal error, "a
  bug in oracle-gaps", with the stack in `<out>/error.log`. Report it as a CLI
  bug with that file, and do not change the oracle to get around it.
- A gap can also be a gap-check bug: the check reports a change as unnoticed,
  but the same change applied by hand to a copy makes the oracle fail, or
  the report shows it never ran (0 s, "unchanged"). Show the developer the
  evidence. If they agree, record it with that evidence in
  `oracles-feedback.md` while the package is in preview (or report it to the
  maintainers), and go on. Do not rewrite production or the oracle to make it
  go away.

Run it after the oracle passes on production. Each gap in the report comes
with one instruction. Follow
that instruction, and follow `oracles-design` for what a gap means. There
are no equivalent mutants and no exits. A surviving mutant shows only that
the current histories did not expose that code. If you believe the code is
dead, first follow `oracles-design` step 8 to rule out a missing history,
observation, or law. Removing it is a production change, so tell the developer,
and rerun the oracle and the gap check. If a gap can be neither killed
nor removed, stop work on that gap and report its key and evidence to the
developer.

Now fill in the two placeholders in the `AGENTS.md` block: the oracle file
glob and the gap check command you ran.

## 8. Report

Tell the developer:

- what was installed (both pinned URLs) and where configuration changed
- which pointers were written, and where
- the first oracle's law and its result
- the gap check's totals, and every gap left, grouped as:
  - open because the inputs that expose it lie outside the law's stated
    limits: name those inputs, and recommend widening the grammar and the
    law. The developer decides. Do not count these as closed.
  - allowed alternatives (`oracles-design` step 8), apart from the kills
  - framework or CLI limitations (for example a timeout from a synchronous
    infinite loop, or a guard that TypeScript narrowing makes constant)
  - other contracts that a whole-file entry pulled in, listed as outside
    this oracle's scope
  - every other gap, with its instruction
- any defect the oracle found, with its witness

Do not call setup done while a gap is open in the oracle's own contract,
unless the developer decides otherwise.
