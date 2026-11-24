import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import ts from 'typescript-for-tanstack-oracles'
import { analyze } from '../oracle-gaps/analysis.mjs'

function makePackage(files: Record<string, string>) {
  // The native real path, as the CLI takes it: JavaScript's keeps an 8.3 name.
  const pkg = realpathSync.native(
    mkdtempSync(join(tmpdir(), `owns-through-calls-`)),
  )
  mkdirSync(join(pkg, `src`), { recursive: true })
  mkdirSync(join(pkg, `tests`), { recursive: true })
  for (const [rel, content] of Object.entries(files))
    writeFileSync(join(pkg, rel), content)
  return pkg
}

function ownersAt(
  pkg: string,
  sources: Array<string>,
  testFile: string,
  source: string,
  snippet: string,
) {
  const { owned } = analyze(ts, pkg, sources, [testFile])
  const text = readFileSync(join(pkg, source), `utf8`)
  const position = text.indexOf(snippet)
  expect(position).toBeGreaterThanOrEqual(0)
  return owned.at(source, position).owners
}

// The gap report's refusal of a run whose selected sources no oracle owns. A
// source is owned when one of its functions is in an owned call tree, even
// when the entry that reaches it lives in another file. A fixed regression,
// kept outside the oracle files: the static oracle's grammar does not yet
// generate a history where the owning entry is in another file.
describe(`gap report ownership through the call trees`, () => {
  test(`a selected source owned only through another file's call tree is not refused`, () => {
    const pkg = makePackage({
      'src/a.ts': `import { helper } from './b'\nexport function run(): number {\n  return helper()\n}\n`,
      'src/b.ts': `export function helper(): number {\n  return 1\n}\n`,
      'tests/a.test.ts': `oracleProperty({ owns: ['src/a.ts#run'] })\n`,
    })
    try {
      const testFile = join(pkg, `tests`, `a.test.ts`)
      expect(
        ownersAt(pkg, [`src/b.ts`], testFile, `src/b.ts`, `return 1`),
      ).toEqual(new Set([testFile]))
    } finally {
      rmSync(pkg, { recursive: true, force: true })
    }
  })

  test(`dynamic lookup on an object-literal dispatch table owns all its functions and their callees`, () => {
    const pkg = makePackage({
      'src/content-mapper.mjs': [
        `function helper(x) { return x + 1 }`,
        `const handlers = {`,
        `  initialize: (params) => ({ ok: helper(params) }),`,
        `  openProject(params) { return params + 2 },`,
        `  transform: function (params) { return params + 3 },`,
        `  closeProject(params) { return params + 4 },`,
        `}`,
        `export function handleInputChunk(message) {`,
        `  const handler = handlers[message.method]`,
        `  return handler(message.params)`,
        `}`,
        ``,
      ].join(`\n`),
      'tests/a.test.ts': `oracleProperty({ owns: ['src/content-mapper.mjs#handleInputChunk'] })\n`,
    })
    try {
      const testFile = join(pkg, `tests`, `a.test.ts`)
      const expected = new Set([testFile])
      for (const snippet of [
        `return x + 1`,
        `ok: helper(params)`,
        `return params + 2`,
        `return params + 3`,
        `return params + 4`,
      ])
        expect(
          ownersAt(
            pkg,
            [`src/content-mapper.mjs`],
            testFile,
            `src/content-mapper.mjs`,
            snippet,
          ),
        ).toEqual(expected)
    } finally {
      rmSync(pkg, { recursive: true, force: true })
    }
  })

  test(`static property reads and direct data entries leave sibling object-literal methods and arrows unowned`, () => {
    const source = [
      `const handlers = {`,
      `  initialize: (params: number) => params + 1,`,
      `  openProject(params: number) { return params + 2 },`,
      `  transform: function (params: number) { return params + 3 },`,
      `  closeProject(params: number) { return params + 4 },`,
      `}`,
      `export function byDot(k: keyof typeof handlers, p: number) {`,
      `  void k`,
      `  return handlers.openProject(p)`,
      `}`,
      `export function byLiteralKey(p: number) {`,
      `  return handlers['openProject'](p)`,
      `}`,
      ``,
    ].join(`\n`)

    for (const entry of [`byDot`, `byLiteralKey`]) {
      const pkg = makePackage({
        'src/dispatch.ts': source,
        'tests/a.test.ts': `oracleProperty({ owns: ['src/dispatch.ts#${entry}'] })\n`,
      })
      try {
        const testFile = join(pkg, `tests`, `a.test.ts`)
        expect(
          ownersAt(
            pkg,
            [`src/dispatch.ts`],
            testFile,
            `src/dispatch.ts`,
            `return params + 2`,
          ),
        ).toEqual(new Set([testFile]))
        for (const unowned of [
          `params + 1`,
          `return params + 3`,
          `return params + 4`,
        ])
          expect(
            ownersAt(
              pkg,
              [`src/dispatch.ts`],
              testFile,
              `src/dispatch.ts`,
              unowned,
            ),
          ).toEqual(new Set())
      } finally {
        rmSync(pkg, { recursive: true, force: true })
      }
    }

    // Naming the data declaration directly leaves both method declarations
    // and arrow/function property assignments to their callers.
    const pkg = makePackage({
      'src/dispatch.ts': source,
      'tests/a.test.ts': `oracleProperty({ owns: ['src/dispatch.ts#handlers'] })\n`,
    })
    try {
      const testFile = join(pkg, `tests`, `a.test.ts`)
      for (const unowned of [
        `params + 1`,
        `return params + 2`,
        `return params + 3`,
        `return params + 4`,
      ])
        expect(
          ownersAt(
            pkg,
            [`src/dispatch.ts`],
            testFile,
            `src/dispatch.ts`,
            unowned,
          ),
        ).toEqual(new Set())
    } finally {
      rmSync(pkg, { recursive: true, force: true })
    }
  })

  test(`whole-value references, wrapped/nested dispatch tables, shorthand properties, and cross-file imports`, () => {
    const pkg = makePackage({
      'src/table.mjs': [
        `function shA() { return 10 }`,
        `function shB() { return 20 }`,
        `export const shorthand = { shA, shB }`,
        `export const frozen = Object.freeze({`,
        `  first() { return 30 },`,
        `  second: () => 40,`,
        `})`,
        `export const nested = {`,
        `  v1: {`,
        `    run() { return 50 },`,
        `    stop() { return 60 },`,
        `  },`,
        `  v2: {`,
        `    other() { return 70 },`,
        `  },`,
        `}`,
        `export default {`,
        `  defA() { return 80 },`,
        `  defB: () => 90,`,
        `}`,
        ``,
      ].join(`\n`),
      'src/entry.mjs': [
        `import defTable, { shorthand, frozen, nested } from './table.mjs'`,
        `import * as tables from './table.mjs'`,
        `function invokeAll(obj) { return Object.values(obj).map((fn) => fn()) }`,
        `export function run(k) {`,
        `  return [`,
        `    shorthand[k](),`,
        `    invokeAll(frozen),`,
        `    tables.nested.v1[k](),`,
        `    defTable[k](),`,
        `  ]`,
        `}`,
        ``,
      ].join(`\n`),
      'tests/a.test.ts': `oracleProperty({ owns: ['src/entry.mjs#run'] })\n`,
    })
    try {
      const testFile = join(pkg, `tests`, `a.test.ts`)
      const expected = new Set([testFile])
      for (const snippet of [
        `return 10`,
        `return 20`,
        `return 30`,
        `40`,
        `return 50`,
        `return 60`,
        `return 80`,
        `90`,
      ])
        expect(
          ownersAt(pkg, [`src/table.mjs`], testFile, `src/table.mjs`, snippet),
        ).toEqual(expected)
      // Only `nested.v1` was indexed dynamically; sibling `nested.v2.other` stays unowned.
      expect(
        ownersAt(
          pkg,
          [`src/table.mjs`],
          testFile,
          `src/table.mjs`,
          `return 70`,
        ),
      ).toEqual(new Set())
    } finally {
      rmSync(pkg, { recursive: true, force: true })
    }
  })
})
