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
  in the package's directory or else the nearest parent directory that has
  one, and the baseline output names the config it loaded. Each run writes its report to
  a directory of its own in the OS temp directory (or to `--out`), and
  prints its path. The daemon's state and the one-file bundles of workspace
  dependencies are in the OS temp directory too, keyed by the package, which
  the OS cleans: a state that is gone is a cold start. A run leaves nothing
  in the repository. While it runs, its capture setup and Vitest configs
  are in `<dir>/.oracle-gaps-<pid>/`, which it removes when it ends, and its
  copies of the test files exist only in memory, so a Vitest run started
  during a check finds none of them. A run that is killed before it cleans
  up leaves that directory, and the next run removes it.

  While one copy of a test file runs for 30 s or more, the CLI prints
  `busy: <mutant id> in <test file> for <n>s` every 30 s. A run of many fast
  copies prints none, and a check through `--daemon` prints its heartbeats
  only when the check ends. The runs that confirm a mutant's cut-off copies
  share one budget: the larger of `--mutant-limit` (30 s by default) and ten
  times the owner files' unmutated time. They run in the owner files'
  order, each with at most what its mutant's earlier confirmations left. A
  mutant whose confirmations pass the budget is a `timeout` gap. With the
  default limits one owner's confirmation always fits; the budget binds
  when several owners need long confirmations, or when `--hang-limit` is
  above it, which the run notes. To give one copy more time with
  `--hang-limit`, raise `--mutant-limit` too.

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
  every process that a test starts, except one started detached in a session
  of its own (as some browser drivers are). On SIGINT or SIGTERM the CLI
  signals the whole group, kills what is left 2 s later, and exits 130 or 143.
  A check through the daemon (`--daemon`) runs in the daemon's process; stop
  it with `oracle-gaps --stop-daemon --package <dir>`. On Windows, which has
  no process groups, the run is not supervised.

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

An oracle file registers its tests only through `oracleProperty`. Its
histories hold its fixed regressions and enumerated cases, its calibrations
show that the check rejects wrong answers, and its declared states hold its
reach. The rule reports every other test registration in an oracle file as a
unit test, whatever its body calls. Move such a test to an ordinary test file.

A registration is a call of a test function, with members such as `.each`,
`.skip`, or `.concurrent`. A call to an imported helper that registers its
caller's body is a registration too. `oracle/no-unit-test`,
`oracle/no-disabled`, and `oracle/oracle-property-only` share one account of
a test function, so they agree on every call. A callee's root is a test
function when its binding resolves to `it`, `test`, `describe`, `suite`, or
`bench` imported from any package or subpath alias (`vitest`,
`@playwright/test`, `node:test`, `#test/fixtures`), or to a fixture of one
(`test.extend(fixtures)`). The rules cannot read a package, so they fail
closed there, because a false negative would switch an oracle off. A
library function with one of those names (for example Ramda's `test` or
mitata's `bench`) is therefore reported in an oracle file and its relative
helpers. A rename does not help, because the rules resolve the imported
name. Use another function there, for example `re.test(s)` in place of
`R.test(re, s)`. The rules follow these bindings:

- a named, aliased, or namespace import (`vitest.it`), and an unbound name
  that Vitest's `globals` declares;
- a variable's initializer, a destructuring (`const { it: t } = vitest`),
  and each plain assignment (`let t; t = it`);
- a cast (`as`, `!`, `satisfies`), and either branch of a conditional or
  logical expression (`flag ? it.skip : it`), so a callee that may be a
  test function is reported;
- a fixture, a tagged-template `.each`, and `oracleReplayTest(it)`;
- an export of a relative test module: a constant, a re-export, `export *
as`, a default export, and a relay of an imported binding, through star
  exports. A cycle of modules or of variables resolves to nothing, and each
  export is resolved once per lint.

A binding that resolves to anything else is no test function, whatever its
name: a local function named `bench`, or a namespace of an ordinary relative
module (`patterns.test(...)`). A member that is no registration, such as
Playwright's `test.step`, registers nothing, bound or not. A `describe` or
`suite` is exempt by the function that it resolves to, not by its local
name. In a cycle of modules, the answer does not depend on which binding
the lint reads first.

The rules do not recognize these forms:

- a test function passed as a parameter to a local helper
  (`function reg(t) { t('n', fn) }`). `oracle/no-disabled` reports the
  `reg(it)` call instead;
- a fixture or test function that a package exports under another name,
  because the rules read only relative test modules;
- a computed member whose name is not a string literal, and a variable that
  a destructuring assignment (not a declaration) writes;
- a modifier call, such as `.skipIf(flag)`, that another module binds and
  exports. A relayed `.skip` is counted at the call.
  A call to an imported helper that registers a test of its own is reported
  too, because that test would appear under the oracle file. An
  `oracleProperty` call whose options are not an object literal with a `check`
  is reported, because the rule cannot see its check.

A test whose body is empty, such as `it('x', () => {})`, `test('x', async
() => {})`, or a skipped placeholder `it.skip('x', () => {})`, checks
nothing. The rule reports it: remove it, or use `it.todo`.

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
