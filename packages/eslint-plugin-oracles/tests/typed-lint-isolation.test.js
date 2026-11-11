/**
 * The rule's parse of an imported module does not change what the consumer's
 * type-aware rules read.
 *
 * `oracle/no-unit-test` parses each module that an oracle file imports with
 * that file's parser. In a repository that lints with typescript-eslint and a
 * `project`, a parse that names the project builds a type-checked program for
 * the module. Under typescript-eslint's single-run mode, which it turns on for
 * the ESLint CLI and in CI, ESLint's later lint of that module then read a
 * program without the project's `strict` options: its type-aware rules
 * reported that `strictNullChecks` was off, and reported conditions as always
 * true. The repository's own `eslint` run found this, with
 * @typescript-eslint/no-unnecessary-condition.
 *
 * This is a focused test of one configuration, not an oracle: the
 * registration-only oracle lints without type information, so it cannot see
 * a type-aware rule's input. The witness rule here reports the compiler options that a
 * type-aware rule reads for each file. It runs in a child process, because
 * typescript-eslint keeps its programs in the process, across test files.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, expect, it } from 'vitest'

const root = mkdtempSync(join(tmpdir(), `typed-lint-isolation-`))
afterAll(() => rmSync(root, { recursive: true, force: true }))

writeFileSync(
  join(root, `tsconfig.json`),
  JSON.stringify({
    compilerOptions: {
      strict: true,
      noEmit: true,
      allowJs: true,
      checkJs: false,
    },
    include: [`*.js`],
  }),
)
writeFileSync(
  join(root, `a-oracle.test.js`),
  [`import { drive } from './b-driver.js'`, `drive()`, ``].join(`\n`),
)
// The rule reads the module to learn whether its helper registers tests.
writeFileSync(join(root, `b-driver.js`), `export function drive() {}\n`)

const plugin = pathToFileURL(join(import.meta.dirname, `..`, `src`, `index.js`))
const eslint = import.meta.resolve(`eslint`)
const parser = import.meta.resolve(`@typescript-eslint/parser`)

// The witness rule reports whether the program that a type-aware rule reads for
// its file has the project's `strict`, which turns on the strictNullChecks that
// @typescript-eslint/no-unnecessary-condition requires. The oracle file is
// linted first, so its rule parses the module before ESLint lints it.
const script = `
  const { default: oracles } = await import(${JSON.stringify(plugin.href)})
  const { ESLint } = await import(${JSON.stringify(eslint)})
  const { default: parser } = await import(${JSON.stringify(parser)})
  const witness = {
    meta: { type: 'problem', schema: [], messages: { options: '{{strict}}' } },
    create(context) {
      const strict = context.sourceCode.parserServices.program.getCompilerOptions().strict === true
      context.report({ loc: { line: 1, column: 0 }, messageId: 'options', data: { strict: 'strict ' + strict } })
      return {}
    },
  }
  const linter = new ESLint({
    cwd: ${JSON.stringify(root)},
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.js'],
        languageOptions: { parser, parserOptions: { project: true, tsconfigRootDir: ${JSON.stringify(root)} } },
        plugins: { witness: { rules: { options: witness } } },
        rules: { 'witness/options': 'error' },
      },
      oracles.configs.recommended,
    ],
  })
  const results = await linter.lintFiles(['a-oracle.test.js', 'b-driver.js'])
  console.log(JSON.stringify(results.map((result) => result.messages.filter((message) => message.ruleId === 'witness/options').map((message) => message.message))))
`

it(`a type-aware rule reads the project's options for a module that an oracle file imports, in single-run mode`, () => {
  const run = spawnSync(
    process.execPath,
    [`--input-type=module`, `-e`, script],
    {
      encoding: `utf8`,
      // typescript-eslint's single-run mode, which it infers for the ESLint CLI and in CI.
      env: { ...process.env, TSESTREE_SINGLE_RUN: `true` },
    },
  )
  expect(run.stderr).toBe(``)
  expect(JSON.parse(run.stdout)).toEqual([[`strict true`], [`strict true`]])
})
