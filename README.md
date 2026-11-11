# TanStack Oracles

Oracle-based testing for TypeScript: state a law, generate the histories where
it matters, and check production against an independent model.

This package is under construction while it is extracted from TanStack DB's
oracle suite. It is not published to npm yet; previews are published from
every commit with [pkg.pr.new](https://pkg.pr.new).

## Packages

To adopt it, start with [`packages/oracles/README.md`](packages/oracles/README.md):
the package ships setup, design, and review skills for coding agents, the
oracle checklist, and a glossary.

- `packages/oracles` (`@tanstack/oracles`): the oracle framework, its skills
  and docs, and the `oracle-gaps` CLI. The CLI lists the production behavior that a
  project's owning oracles leave unexercised or unjudged. A project runs it as
  `oracle-gaps --package <dir> --source <src/x.ts,...>`, with
  `--env-prefix` set to the prefix that the project passes to
  `configureOracles`. Each run writes its report to
  `<dir>/.oracle-gaps/out/<run>/` (or to `--out`), and keeps its state in
  `<dir>/.oracle-gaps/`, and keeps the last five run directories there. Add
  `.oracle-gaps/` and `.oracle-gaps-*` to the project's `.gitignore`. The
  `.oracle-gaps-*` files are the runner's copies of the test files and its
  Vitest configs. They sit beside the package's config, because Vitest resolves
  each copy's imports from the directory the copy is in; a run that is killed
  before it cleans up leaves them there.
- `packages/eslint-plugin-oracles` (`@tanstack/eslint-plugin-oracles`): the
  `oracle/*` lint rules. The rules recognize the framework by its package
  specifier and by a relative module with its file name. A project names its
  variable prefix and its replay-selection modules in `settings.oracles`.

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

A TanStack DB file that still migrates can be listed in
`settings.oracles.legacyCampaigns`. The setting exists only for that
migration and will be removed; other repositories must not use it:

```js
settings: {
  oracles: {
    legacyCampaigns: [
      { file: 'packages/x/tests/some-oracle.test.ts', reason: 'why it still runs raw campaigns' },
    ],
  },
}
```

An entry exempts its file's raw campaigns and legacy imports only with a
non-empty `reason`. The rule also reports an entry that has no reason, and an
entry whose file has no legacy use left (a stale entry). An entry for a deleted
or renamed file is not reported, because no lint run sees that file. An entry
the rule cannot judge is reported, never thrown: a malformed entry
(`malformedEntry`), a `legacyCampaigns` value that is not an array
(`malformedList`), or an entry that names a file outside the oracle-file glob,
such as a README, or a framework implementation module (`refusedEntry`). The
report sits at line 1 of each oracle file that the configuration reaches, since
ESLint runs a rule once per file. Such an entry exempts nothing; the file's other
entries are judged as usual.

A non-array `settings.oracles.implementationModules` or `replayWitnessModules` is
reported at line 1 as `malformedSetting`, and it is read as an empty list.

The rule sees one file at a time, so it cannot tell a new entry from an old
one: a project that wants the baseline to shrink enforces that in its own diff
check.
