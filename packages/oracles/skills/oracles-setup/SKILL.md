---
name: oracles-setup
description: Set up @tanstack/oracles in a repository. Install the pinned packages, add the lint preset, and write the AGENTS.md block. Make the oracle skills findable by coding agents, and run a first oracle through the gap check. Use when a repository adopts @tanstack/oracles or upgrades its pinned commit.
---

# Set up @tanstack/oracles

You are setting up oracle testing in this repository. Do the steps in order.
Ask the user before each step that writes outside the repository.

Setup ends when one oracle passes on production and the gap check has judged
it with no gap left open, unless the user decides otherwise. It does not end
when the packages are installed.

## 1. Read the repository

Find out, and tell the user:

- The package manager, and whether the repository is one package or a
  workspace. For a workspace, ask which package to start in.
- The test runner. The framework runs on Vitest 4 or later, with fast-check 4.
  If the package uses another runner, oracles run in a separate Vitest config
  beside it. Do not change the existing suite.
- Where production source lives (for example `src/`), and whether ESLint
  parses TypeScript already.
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

The only peers to add are `fast-check` and `vitest`. Never add, upgrade, or
downgrade the repository's `typescript` for oracles: the gap check uses its
own TypeScript and never reads the project's, from commit `d8adfee` on. Pin a
commit at or after `d8adfee`.

Use the repository's own package manager. To upgrade, change both URLs to
the new commit at once, then do step 4 again and rerun the gap check (step 7).

## 3. Configure

**Framework.** The defaults use the `ORACLE` environment-variable prefix and
accept every property id. Call `configureOracles` only to change that, in a
Vitest setup file that runs before any oracle module is imported.

**Lint.** Add both presets to the ESLint flat config:

```js
import oracles from '@tanstack/eslint-plugin-oracles'

export default [
  // ...the repository's existing config
  oracles.configs.recommended,
  oracles.configs.production,
]
```

- `recommended` applies to oracle files and turns off inline directives there,
  so a disable comment has no effect.
- `production` checks the probe form in `src/**` and `packages/*/src/**`. If
  production source lives elsewhere, add the `oracle/probe-form` rule with that
  glob.
- If ESLint does not already parse TypeScript, add `@typescript-eslint/parser`
  as a dev dependency and set it as `languageOptions.parser` for the oracle
  files.
- Do not add `legacyCampaigns` or any other exemption. Adopters have none.

Run the linter once and confirm that it loads the rules without an error.

## 4. Write the AGENTS.md block

Add this block to `AGENTS.md` (create the file if needed). On an upgrade,
replace everything between the markers and keep the rest of the file.

```md
<!-- BEGIN @tanstack/oracles (template 1) -->

## Oracle tests

This repository tests its laws with `@tanstack/oracles`.

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

Fill in the two placeholders in step 7, once their values exist. If the repository has a
`CLAUDE.md` and no `AGENTS.md`, ask the user which file gets the block.

## 5. Make the skills findable

The skills ship inside the package, so agents find them only through a
pointer. Offer the user these choices. They can pick more than one.

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
description: <copied exactly from node_modules/@tanstack/oracles/skills/oracles-design/SKILL.md>
---

Read `node_modules/@tanstack/oracles/skills/oracles-design/SKILL.md` from the
root of the current repository in full, and follow it. It matches the
installed version of `@tanstack/oracles`. If that file does not exist, this
repository does not have `@tanstack/oracles` installed: say so and stop.
```

Use pointers, not copies or symbolic links: a pointer always reads the
installed version, and never breaks before install.

Before writing a global pointer:

- Show the user the exact paths.
- If a skill with the same name exists, show it and ask. Never overwrite it
  silently.

## 6. Write the first oracle

Choose one small, owned production function with a clear promise. Ask the
user which one if it is not obvious.

Then load `oracles-design` and follow it from its first step. The law sheet
comes first, and the user reviews it before you write code. Setup does not
skip that step to finish sooner.

Oracle files must match the glob `*oracle*`, for example
`tests/clamp.oracle.property.test.ts`. Put the oracle's `owns` list on its
`oracleProperty` call. If the gap check counts **0 oracle files**, the
oracle is not declared. That is a setup failure, even when the report shows
0 gaps and the command exits 0.

In an oracle file, only `oracleProperty` registers tests. A plain Vitest test
there is not a kill, and the gap check reports it.

## 7. Run the gap check

Run the gap check on the owned source:

```sh
pnpm exec oracle-gaps --package <package dir> --source <src/file.ts>
```

Run it after the oracle passes on production. Each gap in the report comes
with one instruction. Follow
that instruction, and follow `oracles-design` for what a gap means. There
are no equivalent mutants and no exits. If a gap can be neither killed nor
removed, stop work on that gap and report its key and evidence to the user.

Now fill in the two placeholders in the `AGENTS.md` block: the oracle file
glob and the gap check command you ran.

## 8. Report

Tell the user:

- what was installed (both pinned URLs) and where configuration changed
- which pointers were written, and where
- the first oracle's law and its result
- the gap check's totals, and every gap left with its instruction

Do not call setup done while a gap is open, unless the user decides otherwise.
