import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import ts from 'typescript-for-tanstack-oracles'
import { analyze } from '../oracle-gaps/analysis.mjs'

// The gap report's refusal of a run whose selected sources no oracle owns. A
// source is owned when one of its functions is in an owned call tree, even
// when the entry that reaches it lives in another file. A fixed regression,
// kept outside the oracle files: the static oracle's grammar does not yet
// generate a history where the owning entry is in another file.
describe(`gap report ownership through the call trees`, () => {
  test(`a selected source owned only through another file's call tree is not refused`, () => {
    const pkg = realpathSync(mkdtempSync(join(tmpdir(), `owns-through-calls-`)))
    mkdirSync(join(pkg, `src`))
    mkdirSync(join(pkg, `tests`))
    writeFileSync(
      join(pkg, `src`, `a.ts`),
      `import { helper } from './b'\nexport function run(): number {\n  return helper()\n}\n`,
    )
    writeFileSync(
      join(pkg, `src`, `b.ts`),
      `export function helper(): number {\n  return 1\n}\n`,
    )
    const testFile = join(pkg, `tests`, `a.test.ts`)
    writeFileSync(testFile, `oracleProperty({ owns: ['src/a.ts#run'] })\n`)

    const { owned } = analyze(ts, pkg, [`src/b.ts`], [testFile])
    const position = readFileSync(join(pkg, `src`, `b.ts`), `utf8`).indexOf(
      `return 1`,
    )
    expect(owned.at(`src/b.ts`, position).owners).toEqual(new Set([testFile]))
  })
})
