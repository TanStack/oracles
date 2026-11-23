import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import ts from 'typescript-for-tanstack-oracles'
import { parseArgs } from '../oracle-gaps/args.mjs'
import {
  typecheckOracleFiles,
  typecheckRefusal,
} from '../oracle-gaps/typecheck.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const cliPath = join(here, `../oracle-gaps/index.mjs`)
const scratchRoot = join(here, `../oracle-gaps`)

function makeScratch(prefix: string): string {
  return realpathSync.native(
    mkdtempSync(join(scratchRoot, `.scratch-${prefix}-`)),
  )
}

function writeFiles(dir: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
}

const cleanEnv = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) =>
        !name.startsWith(`VITEST`) &&
        !name.startsWith(`ORACLE_`) &&
        name !== `NODE_ENV` &&
        name !== `TEST`,
    ),
  )

function runCli(pkg: string, args: Array<string>) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: pkg,
    encoding: `utf8`,
    env: cleanEnv(),
    timeout: 120_000,
  })
}

const minimalSource = `export function add(a: number, b: number): number {
  return a + b
}
`

const minimalOracle = (body: string) => `import { expect, test } from 'vitest'
import { add } from '../src/math'

declare function oracleProperty(spec: { owns: Array<string> }): void
if (false) oracleProperty({ owns: ['src/math.ts#add'] })

test('adds numbers', () => {
${body}
})
`

describe(`oracle-gaps typecheck`, () => {
  test(`does nothing when the package has no tsconfig.json, and refuses with --typecheck`, () => {
    const pkg = makeScratch(`no-tsconfig`)
    try {
      writeFiles(pkg, {
        'package.json': JSON.stringify({ name: `no-tsconfig`, private: true }),
        'src/math.ts': minimalSource,
        'tests/math.oracle.test.ts': `const x: number = 'not a number'\nexport { x }\n`,
      })
      const oracle = join(pkg, `tests/math.oracle.test.ts`)
      const result = typecheckOracleFiles(ts, pkg, [oracle])
      expect(result.found).toBe(false)
      expect(result.notes).toEqual([])
      expect(result.diagnostics).toEqual([])
      expect(result.uncovered).toEqual([])

      const refusal = typecheckRefusal(ts, result)
      expect(refusal).toBeDefined()
      expect(refusal?.message).toContain(`tsconfig.json`)
      expect(refusal?.fix).not.toMatch(/\b(ignore|equivalent|skip)/i)
    } finally {
      rmSync(pkg, { recursive: true, force: true })
    }
  })

  test(`checks covered TypeScript oracle files and ignores unrelated files' type errors`, () => {
    const pkg = makeScratch(`covered-errors`)
    try {
      writeFiles(pkg, {
        'package.json': JSON.stringify({
          name: `covered-errors`,
          private: true,
        }),
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: `ES2022`,
            module: `ESNext`,
            moduleResolution: `Bundler`,
            strict: true,
            types: [],
          },
          include: [`src`, `tests`],
        }),
        'src/math.ts': minimalSource,
        'src/unrelated.ts': `export const broken: number = 'unrelated error'\n`,
        'tests/math.oracle.test.ts': `import { add } from '../src/math'\nexport const result: number = add('bad', 2)\n`,
      })
      const oracle = join(pkg, `tests/math.oracle.test.ts`)
      const result = typecheckOracleFiles(ts, pkg, [oracle])
      expect(result.found).toBe(true)
      expect(result.checked).toEqual([`tests/math.oracle.test.ts`])
      expect(result.uncovered).toEqual([])
      expect(result.skipped).toEqual([])
      expect(result.diagnostics).toHaveLength(1)
      expect(result.diagnostics[0]).toMatchObject({
        file: `tests/math.oracle.test.ts`,
        line: 2,
        code: 2345,
      })
      expect(
        result.notes.some((line) =>
          line.startsWith(
            `oracle-gaps: note typecheck: tests/math.oracle.test.ts:2:`,
          ),
        ),
      ).toBe(true)
      expect(result.notes.some((line) => line.includes(`TS2345:`))).toBe(true)

      const refusal = typecheckRefusal(ts, result)
      expect(refusal).toBeDefined()
      expect(refusal?.message).toContain(`tests/math.oracle.test.ts:2:`)
      expect(refusal?.message).toContain(`TS2345`)
      expect(refusal?.fix).not.toMatch(/\b(ignore|equivalent|skip)/i)
    } finally {
      rmSync(pkg, { recursive: true, force: true })
    }
  })

  test(`reports uncovered TypeScript oracle files when excluded from tsconfig.json`, () => {
    const pkg = makeScratch(`uncovered`)
    try {
      writeFiles(pkg, {
        'package.json': JSON.stringify({ name: `uncovered`, private: true }),
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: `ES2022`,
            module: `ESNext`,
            moduleResolution: `Bundler`,
            strict: true,
            types: [],
          },
          include: [`src`],
        }),
        'tsconfig.test.json': JSON.stringify({
          extends: `./tsconfig.json`,
          include: [`src`, `tests`],
        }),
        'src/math.ts': minimalSource,
        'tests/math.oracle.test.ts': `import { add } from '../src/math'\nexport const ok: number = add(1, 2)\n`,
      })
      const oracle = join(pkg, `tests/math.oracle.test.ts`)
      const uncoveredResult = typecheckOracleFiles(ts, pkg, [oracle])
      expect(uncoveredResult.found).toBe(true)
      expect(uncoveredResult.uncovered).toEqual([`tests/math.oracle.test.ts`])
      expect(uncoveredResult.checked).toEqual([])
      expect(uncoveredResult.notes).toEqual([
        `oracle-gaps: note typecheck: tests/math.oracle.test.ts is not included in tsconfig.json; tsc will not typecheck it`,
      ])
      const refusal = typecheckRefusal(ts, uncoveredResult)
      expect(refusal?.message).toContain(`tests/math.oracle.test.ts`)
      expect(refusal?.fix).not.toMatch(/\b(ignore|equivalent|skip)/i)

      // Passing --tsconfig tsconfig.test.json covers and checks the file cleanly.
      const coveredResult = typecheckOracleFiles(ts, pkg, [oracle], {
        config: `tsconfig.test.json`,
      })
      expect(coveredResult.found).toBe(true)
      expect(coveredResult.uncovered).toEqual([])
      expect(coveredResult.checked).toEqual([`tests/math.oracle.test.ts`])
      expect(coveredResult.diagnostics).toEqual([])
      expect(coveredResult.notes).toEqual([])
      expect(typecheckRefusal(ts, coveredResult)).toBeUndefined()
    } finally {
      rmSync(pkg, { recursive: true, force: true })
    }
  })

  test(`follows solution-style project references (including directory references and cycles)`, () => {
    const pkg = makeScratch(`solution-refs`)
    try {
      writeFiles(pkg, {
        'package.json': JSON.stringify({
          name: `solution-refs`,
          private: true,
        }),
        'tsconfig.json': JSON.stringify({
          files: [],
          references: [{ path: `./tsconfig.app.json` }, { path: `./sub` }],
        }),
        'tsconfig.app.json': JSON.stringify({
          compilerOptions: {
            target: `ES2022`,
            module: `ESNext`,
            moduleResolution: `Bundler`,
            strict: true,
            types: [],
          },
          include: [`src`],
          references: [{ path: `./tsconfig.json` }],
        }),
        'sub/tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: `ES2022`,
            module: `ESNext`,
            moduleResolution: `Bundler`,
            strict: true,
            types: [],
          },
          include: [`../src`, `../tests`],
        }),
        'src/math.ts': minimalSource,
        'tests/ok.oracle.test.ts': `import { add } from '../src/math'\nexport const ok: number = add(1, 2)\n`,
        'tests/bad.oracle.test.ts': `import { add } from '../src/math'\nexport const bad: number = add(1, 'two')\n`,
      })
      const okFile = join(pkg, `tests/ok.oracle.test.ts`)
      const badFile = join(pkg, `tests/bad.oracle.test.ts`)

      const clean = typecheckOracleFiles(ts, pkg, [okFile])
      expect(clean.uncovered).toEqual([])
      expect(clean.skipped).toEqual([])
      expect(clean.checked).toEqual([`tests/ok.oracle.test.ts`])
      expect(clean.diagnostics).toEqual([])
      expect(clean.notes).toEqual([])

      const errored = typecheckOracleFiles(ts, pkg, [okFile, badFile])
      expect(errored.uncovered).toEqual([])
      expect(errored.diagnostics).toHaveLength(1)
      expect(errored.diagnostics[0]?.file).toBe(`tests/bad.oracle.test.ts`)
      expect(errored.diagnostics[0]?.code).toBe(2345)
    } finally {
      rmSync(pkg, { recursive: true, force: true })
    }
  })

  test(`gracefully skips TS 7-only tsconfig options while still checking coverage`, () => {
    const pkg = makeScratch(`ts7-config`)
    try {
      writeFiles(pkg, {
        'package.json': JSON.stringify({ name: `ts7-config`, private: true }),
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: `ES2022`,
            module: `ESNext`,
            moduleResolution: `Bundler`,
            strict: true,
            contentMappers: [`./mapper.mjs`],
          },
          include: [`src`, `tests/covered.oracle.test.ts`],
        }),
        'src/math.ts': minimalSource,
        'tests/covered.oracle.test.ts': `import { add } from '../src/math'\nexport const x: number = add('bad', 2)\n`,
        'tests/uncovered.oracle.test.ts': `export const y = 1\n`,
      })
      const covered = join(pkg, `tests/covered.oracle.test.ts`)
      const uncovered = join(pkg, `tests/uncovered.oracle.test.ts`)
      const result = typecheckOracleFiles(ts, pkg, [covered, uncovered])
      expect(result.found).toBe(true)
      expect(result.uncovered).toEqual([`tests/uncovered.oracle.test.ts`])
      expect(result.skipped).toHaveLength(1)
      expect(result.skipped[0]?.config).toBe(`tsconfig.json`)
      expect(result.skipped[0]?.reason).toContain(`contentMappers`)
      expect(result.diagnostics).toEqual([])
      expect(result.notes).toEqual([
        expect.stringContaining(
          `oracle-gaps: note typecheck: skipped tsconfig.json`,
        ),
        `oracle-gaps: note typecheck: tests/uncovered.oracle.test.ts is not included in tsconfig.json; tsc will not typecheck it`,
      ])

      const refusal = typecheckRefusal(ts, result)
      expect(refusal?.message).toContain(`contentMappers`)
      expect(refusal?.fix).not.toMatch(/\b(ignore|equivalent|skip)/i)
    } finally {
      rmSync(pkg, { recursive: true, force: true })
    }
  })

  test(`ignores non-TypeScript oracle files and handles invalid tsconfig JSON without crashing`, () => {
    const pkg = makeScratch(`js-and-invalid`)
    try {
      writeFiles(pkg, {
        'package.json': JSON.stringify({
          name: `js-and-invalid`,
          private: true,
        }),
        'tsconfig.json': `{ invalid json`,
        'src/math.ts': minimalSource,
        'tests/math.oracle.test.mjs': `export const ok = 1\n`,
        'tests/math.oracle.test.ts': `export const ok = 1\n`,
      })
      const jsOnly = typecheckOracleFiles(ts, pkg, [
        join(pkg, `tests/math.oracle.test.mjs`),
      ])
      expect(jsOnly.found).toBe(true)
      expect(jsOnly.notes).toEqual([])
      expect(typecheckRefusal(ts, jsOnly)).toBeUndefined()

      const badJson = typecheckOracleFiles(ts, pkg, [
        join(pkg, `tests/math.oracle.test.ts`),
      ])
      expect(badJson.found).toBe(true)
      expect(badJson.uncovered).toEqual([])
      expect(badJson.skipped).toHaveLength(1)
      expect(badJson.notes).toHaveLength(1)
      expect(badJson.notes[0]).toMatch(
        /^oracle-gaps: note typecheck: skipped tsconfig\.json/,
      )
    } finally {
      rmSync(pkg, { recursive: true, force: true })
    }
  })

  test(`parseArgs validates --typecheck and --tsconfig`, () => {
    const pkg = makeScratch(`args`)
    try {
      writeFiles(pkg, {
        'package.json': JSON.stringify({ name: `args`, private: true }),
        'src/math.ts': minimalSource,
        'tsconfig.test.json': `{}\n`,
      })
      const parsed = parseArgs(
        [
          `--package`,
          pkg,
          `--source`,
          `src/math.ts`,
          `--typecheck`,
          `--tsconfig`,
          `tsconfig.test.json`,
        ],
        pkg,
      )
      expect(parsed.typecheck).toBe(true)
      expect(parsed.tsconfig).toBe(`tsconfig.test.json`)

      expect(() =>
        parseArgs(
          [
            `--package`,
            pkg,
            `--source`,
            `src/math.ts`,
            `--tsconfig`,
            `missing.json`,
          ],
          pkg,
        ),
      ).toThrow(/--tsconfig missing\.json is not a file of the package/)
      expect(() =>
        parseArgs(
          [
            `--package`,
            pkg,
            `--source`,
            `src/math.ts`,
            `--tsconfig`,
            `../outside.json`,
          ],
          pkg,
        ),
      ).toThrow(/outside the package/)
    } finally {
      rmSync(pkg, { recursive: true, force: true })
    }
  })

  test(`CLI surfaces type errors by default, refuses with --typecheck, and stays consistent under --daemon`, () => {
    const pkg = makeScratch(`cli-e2e`)
    try {
      writeFiles(pkg, {
        'package.json': JSON.stringify({
          name: `cli-e2e`,
          private: true,
          type: `module`,
        }),
        'vitest.config.mjs': `export default { test: { include: ['tests/**/*.test.ts'] } }\n`,
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: `ES2022`,
            module: `ESNext`,
            moduleResolution: `Bundler`,
            strict: true,
            noEmit: true,
            skipLibCheck: true,
          },
          include: [`src`, `tests`],
        }),
        'src/math.ts': minimalSource,
        // Vitest strips types so this passes at runtime, while tsc rejects it.
        'tests/math.oracle.test.ts': minimalOracle(
          `  const wrong: string = add(1, 2)\n  expect(wrong).toBe(3)`,
        ),
      })

      // 1. Default run completes (exit 0) and emits greppable typecheck notes
      // on stderr, stream.log, stdout, summary.md, and results.json.
      const outDefault = join(pkg, `out-default`)
      const defaultRun = runCli(pkg, [
        `--package`,
        pkg,
        `--source`,
        `src/math.ts`,
        `--contexts`,
        `1`,
        `--out`,
        outDefault,
      ])
      expect(defaultRun.status, defaultRun.stderr).toBe(0)
      expect(defaultRun.stderr).toContain(
        `oracle-gaps: note typecheck: tests/math.oracle.test.ts:`,
      )
      expect(defaultRun.stderr).toContain(`TS2322:`)
      expect(defaultRun.stdout).toContain(
        `oracle-gaps: note typecheck: tests/math.oracle.test.ts:`,
      )
      expect(readFileSync(join(outDefault, `stream.log`), `utf8`)).toBe(
        defaultRun.stderr,
      )
      expect(readFileSync(join(outDefault, `summary.md`), `utf8`)).toContain(
        `## Typecheck notes`,
      )
      const defaultResults = JSON.parse(
        readFileSync(join(outDefault, `results.json`), `utf8`),
      ) as {
        typecheck?: {
          config: string
          diagnostics: Array<{ file: string; code: number }>
        }
      }
      expect(defaultResults.typecheck?.config).toBe(`tsconfig.json`)
      expect(defaultResults.typecheck?.diagnostics).toEqual([
        expect.objectContaining({
          file: `tests/math.oracle.test.ts`,
          code: 2322,
        }),
      ])

      // 2. With --typecheck, the same package refuses (exit 2) before baseline runs.
      const outStrict = join(pkg, `out-strict`)
      const strictRun = runCli(pkg, [
        `--package`,
        pkg,
        `--source`,
        `src/math.ts`,
        `--typecheck`,
        `--contexts`,
        `1`,
        `--out`,
        outStrict,
      ])
      expect(strictRun.status, strictRun.stderr).toBe(2)
      expect(strictRun.stderr).toContain(
        `oracle-gaps: note typecheck: tests/math.oracle.test.ts:`,
      )
      expect(strictRun.stderr).toContain(`refused: tests/math.oracle.test.ts:`)
      expect(strictRun.stderr).toContain(`TS2322`)
      expect(strictRun.stderr).toContain(`fix: `)
      expect(strictRun.stderr).toContain(`oracle-gaps: done refused, report `)
      expect(strictRun.stdout).toContain(`oracle-gaps: done refused, report `)
      expect(readFileSync(join(outStrict, `stream.log`), `utf8`)).toBe(
        strictRun.stderr,
      )
      const strictResults = JSON.parse(
        readFileSync(join(outStrict, `results.json`), `utf8`),
      ) as { status: string; cause: string }
      expect(strictResults.status).toBe(`refused`)
      expect(strictResults.cause).toContain(`TS2322`)

      // 3. Through --daemon: refuses while broken, then passes once fixed.
      const outDaemonBroken = join(pkg, `out-daemon-broken`)
      const daemonBroken = runCli(pkg, [
        `--package`,
        pkg,
        `--source`,
        `src/math.ts`,
        `--typecheck`,
        `--daemon`,
        `--contexts`,
        `1`,
        `--out`,
        outDaemonBroken,
      ])
      expect(daemonBroken.status, daemonBroken.stderr).toBe(2)
      expect(daemonBroken.stderr).toContain(`TS2322`)

      // Fix the type error and verify daemon sees the fresh file and passes.
      writeFiles(pkg, {
        'tests/math.oracle.test.ts': minimalOracle(
          `  const right: number = add(1, 2)\n  expect(right).toBe(3)`,
        ),
      })
      const outDaemonFixed = join(pkg, `out-daemon-fixed`)
      const daemonFixed = runCli(pkg, [
        `--package`,
        pkg,
        `--source`,
        `src/math.ts`,
        `--typecheck`,
        `--daemon`,
        `--contexts`,
        `1`,
        `--out`,
        outDaemonFixed,
      ])
      expect(daemonFixed.status, daemonFixed.stderr).toBe(0)
      expect(daemonFixed.stderr).not.toContain(`oracle-gaps: note typecheck:`)
      expect(daemonFixed.stdout).not.toContain(`oracle-gaps: note typecheck:`)
      expect(existsSync(join(outDaemonFixed, `results.json`))).toBe(true)
    } finally {
      runCli(pkg, [`--stop-daemon`, `--package`, pkg])
      rmSync(pkg, { recursive: true, force: true })
    }
  }, 120_000)
})
