import { describe, expect, test } from 'vitest'
import ts from 'typescript-for-tanstack-oracles'
import { assignKeys } from '../oracle-gaps/report.mjs'
import { instrument } from '../oracle-gaps/schemata.mjs'

describe(`gap report mutant anchors`, () => {
  test(`default parameters and class fields get declaration-scoped anchors, not the whole file`, () => {
    const source = [
      `export function loadManifest(root = process.cwd(), nominal = false) {`,
      `  return root`,
      `}`,
      ``,
      `export class Config extends getBase(true) {`,
      `  flag = false`,
      `  count = compute() + 1`,
      `  accessor active = true`,
      `  handle = (x = false) => x || true`,
      `  constructor(a = false, public b = true) {`,
      `    super()`,
      `  }`,
      `  method(x = 1 + 2, { nested = false } = {}) {`,
      `    return x`,
      `  }`,
      `  set value(v = false) {}`,
      `  [getKey(true)]() {`,
      `    return 1`,
      `  }`,
      `}`,
      ``,
      `export enum Mode {`,
      `  Fast = 1 + 2,`,
      `}`,
      ``,
      `export default () => true`,
      ``,
      `export function unrelatedTail() {`,
      `  return 'should-never-appear-in-earlier-anchors'`,
      `}`,
      ``,
    ].join(`\n`)

    const { mutants } = instrument(ts, `src/sample.ts`, source, `src/sample.ts`)
    assignKeys(mutants)

    expect(mutants.length).toBeGreaterThan(0)
    // No mutant's anchor or key may dump the whole file.
    for (const mutant of mutants) {
      if (mutant.line < 28) {
        expect(mutant.anchor).not.toContain(`unrelatedTail`)
        expect(mutant.key).not.toContain(`unrelatedTail`)
      }
    }

    const anchorsAt = (line: number) =>
      mutants.filter((m) => m.line === line).map((m) => [m.operator, m.anchor])

    // Default parameters on a function declaration.
    expect(anchorsAt(1)).toEqual([
      [`value-undefined`, `root = process . cwd ( )`],
      [`bool-flip`, `nominal = false`],
    ])
    // Class heritage clause.
    expect(anchorsAt(5)).toEqual([
      [`value-undefined`, `extends getBase ( true )`],
      [`bool-flip`, `extends getBase ( true )`],
    ])
    // Class field initializers (plain, arithmetic + call, auto-accessor, concise arrow).
    expect(anchorsAt(6)).toEqual([[`bool-flip`, `flag = false`]])
    expect(anchorsAt(7)).toEqual([
      [`arithmetic-swap`, `count = compute ( ) + 1`],
      [`value-undefined`, `count = compute ( ) + 1`],
    ])
    expect(anchorsAt(8)).toEqual([[`bool-flip`, `accessor active = true`]])
    expect(anchorsAt(9)).toEqual([
      [`bool-flip`, `x = false`],
      [`binary-swap`, `handle = ( x = false ) => x || true`],
      [`bool-flip`, `handle = ( x = false ) => x || true`],
    ])
    // Method default parameters (plain and destructured) and setter parameter.
    expect(anchorsAt(13)).toEqual([
      [`arithmetic-swap`, `x = 1 + 2`],
      [`bool-flip`, `{ nested = false } = { }`],
    ])
    expect(anchorsAt(16)).toEqual([[`bool-flip`, `v = false`]])
    // Computed method name stays tight instead of dumping the method body.
    expect(anchorsAt(17)).toEqual([
      [`value-undefined`, `[ getKey ( true ) ]`],
      [`bool-flip`, `[ getKey ( true ) ]`],
    ])
    // Enum member initializer.
    expect(anchorsAt(23)).toEqual([[`arithmetic-swap`, `Fast = 1 + 2`]])
    // Export assignment.
    expect(anchorsAt(26)).toEqual([[`bool-flip`, `export default ( ) => true`]])
  })

  test(`decorators and non-derived constructor default parameters get tight anchors`, () => {
    const source = [
      `@dec(false)`,
      `export class Box {`,
      `  @fieldDec(true)`,
      `  flag = false`,
      `  constructor(a = false, public b = true) {}`,
      `  @methodDec(true)`,
      `  run(@paramDec(false) x = true) {`,
      `    return x`,
      `  }`,
      `}`,
      ``,
      `export const tail = 'unrelated-tail'`,
      ``,
    ].join(`\n`)

    const { mutants } = instrument(ts, `src/box.ts`, source, `src/box.ts`)

    for (const mutant of mutants)
      expect(mutant.anchor).not.toContain(`unrelated-tail`)

    const anchorsAt = (line: number) =>
      mutants.filter((m) => m.line === line).map((m) => [m.operator, m.anchor])

    expect(anchorsAt(1)).toEqual([
      [`value-undefined`, `@ dec ( false )`],
      [`bool-flip`, `@ dec ( false )`],
    ])
    expect(anchorsAt(3)).toEqual([
      [`value-undefined`, `@ fieldDec ( true )`],
      [`bool-flip`, `@ fieldDec ( true )`],
    ])
    expect(anchorsAt(4)).toEqual([
      [`bool-flip`, `@ fieldDec ( true ) flag = false`],
    ])
    expect(anchorsAt(5)).toEqual([
      [`bool-flip`, `a = false`],
      [`bool-flip`, `public b = true`],
    ])
    expect(anchorsAt(6)).toEqual([
      [`value-undefined`, `@ methodDec ( true )`],
      [`bool-flip`, `@ methodDec ( true )`],
    ])
    expect(anchorsAt(7)).toEqual([
      [`value-undefined`, `@ paramDec ( false )`],
      [`bool-flip`, `@ paramDec ( false )`],
      [`bool-flip`, `@ paramDec ( false ) x = true`],
    ])
  })

  test(`default-parameter and class-field anchors stay stable under unrelated edits and reformatting`, () => {
    const before = [
      `export function load(root = process.cwd(), nominal = false) {`,
      `  return root`,
      `}`,
      `export class State {`,
      `  flag = false`,
      `}`,
      ``,
    ].join(`\n`)
    const after = [
      `// An unrelated comment and helper added above.`,
      `export function helper() {`,
      `  return 42`,
      `}`,
      `export function load(`,
      `  root = process.cwd(),`,
      `  nominal =`,
      `    false,`,
      `) {`,
      `  return root`,
      `}`,
      `export class State {`,
      `  extra = 'added'`,
      `  flag =`,
      `    false`,
      `}`,
      ``,
    ].join(`\n`)

    const anchorsOf = (text: string) =>
      instrument(ts, `src/load.ts`, text, `src/load.ts`).mutants.map((m) => [
        m.operator,
        m.anchor,
      ])

    const beforeAnchors = anchorsOf(before)
    const afterAnchors = anchorsOf(after)
    for (const pair of beforeAnchors) expect(afterAnchors).toContainEqual(pair)
  })
})
