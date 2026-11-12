/**
 * The plugin loads and lints whatever TypeScript the consumer has.
 *
 * An adopter never changes their repository's TypeScript to use the plugin
 * (field report round 3, 2026-11-10: nanostores pins TypeScript 7.0.2). So
 * importing the plugin and its configs, and linting an oracle file with the
 * parser that the consumer configures, must not depend on the `typescript`
 * package that the consumer's install resolves: absent, the 5.x that this
 * workspace installs, or TypeScript 7's package, which exposes only `version`
 * and `versionMajorMinor` and no compiler API.
 *
 * The consumer's TypeScript is one fact of the environment, not an input that a
 * lint history varies, so this is a focused test over the three environments,
 * not an oracle. Each runs in a child process whose module resolution sends
 * every `typescript` request to that environment's package, as a hoisted
 * install, or pnpm's resolution of typescript-eslint's `typescript` peer, does.
 * The parser law over generated programs is in
 * registration-only-oracle.property.test.js.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, expect, it } from 'vitest'

const root = mkdtempSync(join(tmpdir(), `consumer-typescript-`))
afterAll(() => rmSync(root, { recursive: true, force: true }))

// TypeScript 7's package, as d8adfee's gap CLI test stubs it.
const stub = join(root, `node_modules`, `typescript`)
mkdirSync(stub, { recursive: true })
writeFileSync(
  join(stub, `package.json`),
  JSON.stringify({ name: `typescript`, version: `7.0.2`, main: `index.js` }),
)
writeFileSync(
  join(stub, `index.js`),
  `module.exports = { version: '7.0.2', versionMajorMinor: '7.0' }\n`,
)

// A JavaScript oracle file, linted with ESLint's default espree, as a
// repository that cannot run typescript-eslint configures it. Its complete
// property gets no report, its plain test is a unit test, and the helper of a
// module that does not parse classifies nothing.
const project = join(root, `project`)
mkdirSync(project)
writeFileSync(
  join(project, `case-oracle.test.js`),
  [
    `import { it } from 'vitest'`,
    `import { oracleProperty } from '@tanstack/oracles'`,
    `import { helper } from './broken.js'`,
    `function check() {}`,
    `oracleProperty({ id: 'p', check })`,
    `helper()`,
    `it('uses only the helper', () => {`,
    `  helper()`,
    `})`,
    ``,
  ].join(`\n`),
)
writeFileSync(join(project, `broken.js`), `export function helper() {\n`)

const plugin = pathToFileURL(join(import.meta.dirname, `..`, `src`, `index.js`))
const eslint = import.meta.resolve(`eslint`)

/** Imports the plugin and lints the oracle file with `typescript` resolving to `target`. */
function lintUnder(target) {
  const script = `
    import { registerHooks } from 'node:module'
    const target = ${JSON.stringify(target)}
    registerHooks({
      resolve(specifier, context, next) {
        if (specifier !== 'typescript' || target === 'installed') return next(specifier, context)
        if (target === 'absent') {
          throw Object.assign(new Error("Cannot find module 'typescript'"), { code: 'MODULE_NOT_FOUND' })
        }
        return { url: target, shortCircuit: true }
      },
    })
    const { default: oracles } = await import(${JSON.stringify(plugin.href)})
    const { ESLint } = await import(${JSON.stringify(eslint)})
    const linter = new ESLint({
      cwd: ${JSON.stringify(project)},
      overrideConfigFile: true,
      overrideConfig: [oracles.configs.recommended, oracles.configs.production],
    })
    const [result] = await linter.lintFiles(['case-oracle.test.js'])
    console.log(JSON.stringify(result.messages.map(({ ruleId, messageId, message }) => ({ ruleId, messageId, message }))))
  `
  const run = spawnSync(
    process.execPath,
    [`--input-type=module`, `-e`, script],
    {
      encoding: `utf8`,
    },
  )
  return { status: run.status, stderr: run.stderr, stdout: run.stdout }
}

it.for([
  [`no typescript`, `absent`],
  [
    `TypeScript 7's package, with no compiler API`,
    pathToFileURL(join(stub, `index.js`)).href,
  ],
  [`the workspace's TypeScript 5`, `installed`],
])(`loads and lints with %s`, ([, target]) => {
  const run = lintUnder(target)
  expect(run.stderr).toBe(``)
  expect(run.status).toBe(0)
  const messages = JSON.parse(run.stdout)
  // The plain test is a unit test, whatever it calls.
  expect(messages).toEqual([
    expect.objectContaining({
      ruleId: `oracle/no-unit-test`,
      messageId: `unitTest`,
    }),
  ])
})
