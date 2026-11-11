# TanStack Oracles

Oracle-based testing for TypeScript: state a law, generate the histories where
it matters, and check production against an independent model.

This package is under construction while it is extracted from TanStack DB's
oracle suite. It is not published to npm yet; previews are published from
every commit with [pkg.pr.new](https://pkg.pr.new).

## Packages

- `packages/oracles` (`@tanstack/oracles`): the oracle framework, and the
  `oracle-gaps` CLI. The CLI lists the production behaviour that a
  project's owning oracles leave unexercised or unjudged. A project runs it as
  `oracle-gaps --package <dir> --source <src/x.ts,...>`, with
  `--env-prefix` set to the prefix that the project passes to
  `configureOracles`. `--config <file>`, relative to `--package`, selects the
  Vitest config; without it, the run loads the config that Vitest discovers,
  and the baseline output names the config it loaded. Each run writes its report to
  `<dir>/.oracle-gaps/out/<run>/` (or to `--out`), and keeps its state in
  `<dir>/.oracle-gaps/`, and keeps the last five run directories there. Add
  `.oracle-gaps/` to the project's `.gitignore`. The runner writes nothing
  beside the tests: its copies of the test files exist only in memory, and
  its capture setup and Vitest configs are in `<dir>/.oracle-gaps/session-<pid>/`,
  so a Vitest run started during a check finds none of them. A run that is
  killed before it cleans up leaves that directory.

  While a copy of a test file runs for 30 s or more, the CLI prints
  `busy: <mutant id> in <test file> for <n>s` every 30 s. The runs that
  confirm a mutant's cut-off copies share one budget: the larger of
  `--mutant-limit` (30 s by default) and ten times the owner files' unmutated
  time. A mutant whose confirmations pass it is a `timeout` gap. To give one
  copy more time with `--hang-limit`, raise `--mutant-limit` too.

  The report, on stdout and in `summary.md`, leads with the baseline: each
  test file's result with its test counts (ordinary files too), and for a
  failing file its failing test, its error, the law and counterexample of a
  law violation, and a `replay:` command. An oracle file that fails with no
  mutant active blocks only the mutants it owns: each that no passing owner
  kills is a `blocked` gap, a `blocked:` line names the file and its failing
  test, the rest are judged, and the report says it is provisional. With
  `--only <id,...>`, the baseline runs only the owners of the selected
  mutants. A `crashed` gap is not a kill: production threw where no law
  judged it, and the error is on the gap's Detail line in `summary.md` and
  in its `detail` in `results.json`. Record the error in the driver, and
  state the law that decides that input's outcome.

  Exit codes: 0 the check completed, whatever its gaps (the last stdout line
  is `completed: <n> gaps`); 2 the run was refused, with `refused:` and
  `fix:` on stderr; 3 an internal error of the CLI; 130 or 143 stopped by
  SIGINT or SIGTERM.

  The check runs in a process group of its own, with every Vitest worker and
  every process that a test starts. On SIGINT or SIGTERM the CLI signals the
  whole group, kills what is left 2 s later, and exits 130 or 143. A check
  through the daemon (`--daemon`) runs in the daemon's process; stop it with
  `oracle-gaps --stop-daemon --package <dir>`.

- `packages/eslint-plugin-oracles` (`@tanstack/eslint-plugin-oracles`): the
  `oracle/*` lint rules. The rules recognize the framework by its package
  specifier and by a relative module with its file name. A project names its
  variable prefix and its replay-selection modules in `settings.oracles`.

The `recommended` and `production` configs leave out tool config files: the
configs of ESLint, Vite, and Vitest (`vite.config.ts`, `vitest.unit.config.mjs`)
and any config named for oracles (`*.oracle.config.*`, such as
`eslint.oracle.config.mjs`). A config file is never an oracle file or
production source. A companion oracle module, such as `foo-oracle.ts`, keeps
the oracle rules, and so does a source module named `src/foo.config.ts`.

A config that spreads a preset and sets its own `ignores` replaces the
preset's, so merge them:

```js
{
  ...oracles.configs.production,
  ignores: [...oracles.configs.production.ignores, 'packages/x/src/machinery/**'],
}
```

## The `oracle/no-unit-test` rule

Each test in an oracle file must reach a part that the file declares: its
check, model, or grammar. A test that reaches none compares production with a
hand-written value, so the rule reports it as a unit test that belongs in an
ordinary test file.

A test whose body is empty, such as `it('x', () => {})`, `test('x', async
() => {})`, or a skipped placeholder `it.skip('x', () => {})`, checks
nothing. The rule reports it whatever the file declares: remove it, or use
`it.todo`.

## The `oracle/no-oracle-disable` rule

An ESLint directive that would silence an `oracle/*` rule is reported: a
directive whose rule list names an oracle rule, a directive with no rule list
(it silences every rule), and an inline config comment that names an oracle
rule. Rule names may be quoted. The forms are the line, next-line, and block
forms, with or without a `-- description`. Oracle rules cannot be disabled
inline, so the directive is the report.

A report sits on the directive's own line. A directive that names this rule or
has no rule list can hide its own report, and so can a directive under an
earlier block directive. Those reports sit at line 1, column 0 instead.

Residuals the rule cannot close:

- A directive on line 1 that names this rule or has no rule list covers the
  file's start, so no report can sit there.
- In production source, a config comment that turns this rule off
  (`eslint oracle/no-oracle-disable: "off"`) switches the rule off for the file.
  ESLint then runs no rule, and none reports it.
- `noInlineConfig` in the `recommended` config makes ESLint ignore every
  directive of every rule in an oracle file, not only the oracle rules. A
  directive for another rule in an oracle file has no effect.

## The `oracle/oracle-property-only` rule

In an oracle file, a generated-history campaign must run through
`oracleProperty`, whose constructed histories make each declared state's reach
required. The rule reports:

- a raw campaign: `fc.assert` or `fc.check` on a fast-check binding, from
  `fast-check` or `@fast-check/vitest`, and a `.prop` registration of a test
  root;
- an import of `createOracleReach` or `runOracleCampaign`, from any module.

A framework implementation module is exempt.

No other configuration exempts a file. `settings.oracles.legacyCampaigns`, the
old list of files that kept their raw campaigns while they migrated, is removed.
A configuration that still sets it, to any value, exempts nothing. The rule
reports it as `removedSetting` at line 1 of each oracle file that the
configuration reaches, since ESLint runs a rule once per file. Convert the
listed files to `oracleProperty`, then delete the setting.

A non-array `settings.oracles.implementationModules` or `replayWitnessModules` is
reported at line 1 as `malformedSetting`, and it is read as an empty list.
