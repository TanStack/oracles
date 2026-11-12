// Focused examples of oracle/no-unit-test that the generated oracle
// (registration-only-oracle.property.test.js) does not vary: which modules
// the rule reads to classify a helper, and the files and calls that are not
// test registrations at all.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'vitest'
import { RuleTester } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import noUnitTest from '../src/rules/no-unit-test.js'

RuleTester.describe = describe
RuleTester.it = it

// Modules on disk, so that the rule resolves real imports.
const root = mkdtempSync(join(tmpdir(), `oracle-no-unit-test-`))
const tests = join(root, `tests`)
mkdirSync(join(root, `src`), { recursive: true })
mkdirSync(tests, { recursive: true })
writeFileSync(join(root, `package.json`), JSON.stringify({ name: `published` }))
// A published package's src/ is production. Its function that registers a
// test is never read, so a call to it is not judged.
writeFileSync(
  join(root, `src`, `production.ts`),
  `import { it } from 'vitest'\nexport function registerProduction() { it('p', () => { void 0 }) }\n`,
)
// A private package, such as an end-to-end suite, keeps its test code in
// src/, which the rule reads.
const suite = join(root, `suite`)
mkdirSync(join(suite, `src`), { recursive: true })
writeFileSync(
  join(suite, `package.json`),
  JSON.stringify({ name: `suite`, private: true }),
)
writeFileSync(
  join(suite, `src`, `registrar.ts`),
  `import { it } from 'vitest'\nexport function registerPages() { it('pages', () => { void 0 }) }\n`,
)
// A project's shim of the framework module, at the framework's file name.
writeFileSync(
  join(tests, `oracle-property.ts`),
  `export { oracleProperty } from '@tanstack/oracles'\n`,
)
// A module that does not parse.
writeFileSync(join(tests, `broken.ts`), `export function helper() {\n`)
const filename = join(tests, `subject-oracle.test.ts`)
const suiteFilename = join(suite, `src`, `pages-oracle.suite.ts`)

const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, sourceType: `module` },
})

ruleTester.run(`oracle/no-unit-test`, noUnitTest, {
  valid: [
    // A file with no tests, and a file of only complete properties.
    { code: `export function fixture() { return [] }`, filename },
    {
      code: `import { oracleProperty } from '@tanstack/oracles'\noracleProperty({ id: 'p', check: () => undefined })`,
      filename,
    },
    // A project's relative shim of the framework module.
    {
      code: `import { oracleProperty } from './oracle-property.js'\noracleProperty({ id: 'p', check: () => undefined })`,
      filename,
    },
    // A test of the shared oracle machinery checks no law.
    {
      code: `it('rejects a retired variable', () => expect(1).toBe(1))`,
      filename: join(tests, `oracle-config.test.ts`),
    },
    // A suite is not a test, and a Playwright step is not a registration.
    {
      code: `describe('suite', () => {})\ntest.step('open', async () => { void 0 })`,
      filename,
    },
    // A published package's src/ is not read.
    {
      code: `import { registerProduction } from '../src/production.js'\nregisterProduction()`,
      filename,
    },
    // A module that does not parse classifies no helper, and never throws.
    {
      code: `import { helper } from './broken.js'\nhelper()`,
      filename,
    },
  ],
  invalid: [
    // The shim names the framework, so its incomplete call is reported.
    {
      code: `import { oracleProperty } from './oracle-property.js'\noracleProperty({ id: 'p' })`,
      filename,
      errors: [{ messageId: `incompleteProperty`, line: 2 }],
    },
    // A private package's src/ is read, so its registrar is judged.
    {
      code: `import { registerPages } from './registrar.js'\nregisterPages()`,
      filename: suiteFilename,
      errors: [{ messageId: `importedRegistration`, line: 2 }],
    },
    // A plain test is reported even when it calls the property's check.
    {
      code: `import { oracleProperty } from '@tanstack/oracles'\nfunction check() { return undefined }\noracleProperty({ id: 'p', check })\nit('replays a fixed history', () => check())`,
      filename,
      errors: [{ messageId: `unitTest`, line: 4 }],
    },
    // A registration through a renamed import, or a modifier, is still a
    // test.
    {
      code: `import { it as example } from 'vitest'\nexample('n', () => { void 0 })\nit.skipIf(true)('n', () => { void 0 })`,
      filename,
      errors: [
        { messageId: `unitTest`, line: 2 },
        { messageId: `unitTest`, line: 3 },
      ],
    },
  ],
})

// The source settings (README, "Where a test function comes from") that the
// rule cannot use are reported at line 1 and read as unset. The generated
// oracle (test-source-recognition-oracle.property.test.js) varies only the
// legal values.
const settingsTester = new RuleTester({
  languageOptions: { parser: tsParser, sourceType: `module` },
})
const unknownCall = `import { test } from 'regex-lib'\ntest('n', () => { void 0 })`

settingsTester.run(`oracle/no-unit-test settings`, noUnitTest, {
  valid: [
    // A table of export roles, and a prefix pattern.
    {
      code: unknownCall,
      filename,
      settings: { oracles: { testPackages: { 'regex-*': { other: `test` } } } },
    },
  ],
  invalid: [
    {
      code: unknownCall,
      filename,
      settings: {
        oracles: { testPackages: { 'regex-lib': `no-such-framework` } },
      },
      errors: [
        {
          messageId: `malformedSetting`,
          line: 1,
          data: {
            path: `settings.oracles.testPackages`,
            detail: `\`testPackages\` maps a specifier to a framework's specifier or to a table of export roles (\`'test'\` or \`'suite'\`).`,
          },
        },
        { messageId: `unknownTestSource`, line: 1 },
      ],
    },
    {
      code: unknownCall,
      filename,
      settings: {
        oracles: { testPackages: { 'regex-lib': { test: `fixture` } } },
      },
      errors: [
        {
          messageId: `malformedSetting`,
          line: 1,
          data: {
            path: `settings.oracles.testPackages`,
            detail: `\`testPackages\` maps a specifier to a framework's specifier or to a table of export roles (\`'test'\` or \`'suite'\`).`,
          },
        },
        { messageId: `unknownTestSource`, line: 1 },
      ],
    },
    {
      code: unknownCall,
      filename,
      settings: { oracles: { nonTestPackages: `regex-lib` } },
      errors: [
        {
          messageId: `malformedSetting`,
          line: 1,
          data: {
            path: `settings.oracles.nonTestPackages`,
            detail: `\`nonTestPackages\` is an array of specifiers.`,
          },
        },
        { messageId: `unknownTestSource`, line: 1 },
      ],
    },
    // `ignore` is no mode (2026-11-12): it is malformed and read as `report`.
    {
      code: unknownCall,
      filename,
      settings: { oracles: { unknownSources: `ignore` } },
      errors: [
        {
          messageId: `malformedSetting`,
          line: 1,
          data: {
            path: `settings.oracles.unknownSources`,
            detail: `\`'ignore'\` is no longer a mode: to silence a package, list it in \`settings.oracles.nonTestPackages\`.`,
          },
        },
        { messageId: `unknownTestSource`, line: 1 },
      ],
    },
    // An unknown mode is read as the default, `report`.
    {
      code: unknownCall,
      filename,
      settings: { oracles: { unknownSources: `warn` } },
      errors: [
        {
          messageId: `malformedSetting`,
          line: 1,
          data: {
            path: `settings.oracles.unknownSources`,
            detail: `\`unknownSources\` is \`'report'\` or \`'test'\`.`,
          },
        },
        { messageId: `unknownTestSource`, line: 1 },
      ],
    },
    // A machinery file still gets the setting and unknown-source reports.
    {
      code: unknownCall,
      filename: join(tests, `oracle-config.test.ts`),
      settings: { oracles: { unknownSources: 3 } },
      errors: [
        {
          messageId: `malformedSetting`,
          line: 1,
          data: {
            path: `settings.oracles.unknownSources`,
            detail: `\`unknownSources\` is \`'report'\` or \`'test'\`.`,
          },
        },
        { messageId: `unknownTestSource`, line: 1 },
      ],
    },
  ],
})
