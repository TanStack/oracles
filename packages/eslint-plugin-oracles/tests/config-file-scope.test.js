/**
 * A tool's config file is never an oracle file, nor production source. The
 * `recommended` config selects files whose names contain `oracle`, and the
 * `production` config selects source under `src`, so without an exclusion a
 * config such as `eslint.oracle.config.mjs`, which the setup guide suggests,
 * gets the oracle rules (maintainer finding, 2026-11-10). Both configs ignore
 * the configs of ESLint, Vite, and Vitest (`vite.config.ts`,
 * `vitest.unit.config.mjs`) and any `*.oracle.config.*`. They still select
 * every other file: a companion oracle module such as `foo-oracle.ts`, an
 * `oracle-config.ts` module, and a source module named `src/foo.config.ts`
 * keep their rules. This repository's own eslint.config.js, which spreads the
 * production config with its own ignores, keeps the preset's ignores too.
 *
 * The law is over a finite set of names (each tool, each placement of
 * `oracle`, and each extension the configs select), so this test enumerates
 * it rather than generating names.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { afterAll, expect, test } from 'vitest'
import oracles from '../src/index.js'

const root = mkdtempSync(join(tmpdir(), `oracle-config-scope-`))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [oracles.configs.recommended, oracles.configs.production],
})
const oracleRules = async (path) =>
  Object.keys(
    (await eslint.calculateConfigForFile(join(root, path)))?.rules ?? {},
  ).filter((rule) => rule.startsWith(`oracle/`))

const extensions = [`js`, `mjs`, `cjs`, `ts`, `mts`, `cts`]
const configNames = [
  ...[`eslint`, `vitest`, `vite`].flatMap((tool) =>
    extensions.flatMap((ext) => [
      `${tool}.config.${ext}`,
      `${tool}.oracle.config.${ext}`,
      `${tool}.unit.config.${ext}`,
      `packages/app/src/${tool}.config.${ext}`,
      `src/${tool}.oracle.config.${ext}`,
    ]),
  ),
  `tests/playwright.oracle.config.ts`,
  `src/app.oracle.config.ts`,
]

test(`no oracle rule applies to a tool's config file`, async () => {
  const applied = []
  for (const name of configNames) {
    const rules = await oracleRules(name)
    if (rules.length > 0) applied.push(`${name}: ${rules.join(`, `)}`)
  }
  expect(applied).toEqual([])
})

test(`the oracle rules still apply to companion modules and production source`, async () => {
  for (const name of [
    `tests/foo-oracle.ts`,
    `foo-oracle.mjs`,
    `tests/oracle-config.ts`,
    `tests/config-oracle.test.js`,
  ])
    expect(await oracleRules(name)).toContain(`oracle/no-unit-test`)
  for (const name of [
    `src/x.ts`,
    `packages/app/src/config.ts`,
    `src/foo.config.ts`,
    `packages/app/src/routes.config.mjs`,
  ])
    expect(await oracleRules(name)).toContain(`oracle/probe-form`)
})

test(`this repository's eslint.config.js keeps the presets' ignores beside its own`, async () => {
  const repo = fileURLToPath(new URL(`../../../`, import.meta.url))
  const own = new ESLint({ cwd: repo })
  const rulesOf = async (path) =>
    Object.keys(
      (await own.calculateConfigForFile(join(repo, path)))?.rules ?? {},
    ).filter((rule) => rule.startsWith(`oracle/`))
  expect(await rulesOf(`packages/oracles/src/vite.config.ts`)).toEqual([])
  expect(
    await rulesOf(`packages/oracles/vitest.oracle-framework.config.mjs`),
  ).toEqual([])
  expect(await rulesOf(`packages/oracles/src/foo.config.ts`)).toContain(
    `oracle/probe-form`,
  )
})
