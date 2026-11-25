/**
 * # The public entry points that reach a function, and who owns each
 *
 * A cluster note (report.mjs `clustersOf`) lists the public entry points
 * that statically reach its function, each with the oracle files that own
 * it (`reachedFrom`, owners.mjs). The analysis computes them; this oracle
 * judges that list. The note's text is the classify oracle's (law 8 of
 * gap-report-classify-oracle.property.test.mjs).
 *
 * Law: for every generated package and every function of it, `reachedFrom`
 * names exactly the units that a `--source` file exports, directly, through
 * an alias, or through a re-export of another file's function, whose static
 * call trees hold the function, each by its owns name (two units of one
 * name are one entry, owned by what owns either, as an owns entry of that
 * name owns both), and gives each one
 * exactly the oracle files whose `owns` trees hold it or that own its whole
 * file. A file that is not a `--source` file exports no entry point, though
 * its functions are in the trees. An exported class brings each of its
 * methods as an entry point of its own, as a class passed as a value brings
 * all its methods into a tree.
 *
 * Authority: a downstream project's report (2026-11-25, proposal 2): a
 * removal made on gap evidence changed the result of a second export that
 * no oracle owned, and the report had no way to show that the survivors'
 * function was that export's too. The trees are the ownership law of
 * owners.mjs (P6, R6, I10: the static call tree of each owns entry, unioned
 * over the oracle files), read in reverse.
 *
 * History: three files, `src/a.ts` and `src/b.ts` (the `--source` files)
 * and `src/lib.ts` (not one). `a.ts` has `a0`, `a1`, `a2` and a class `C`
 * with one method `m`; `b.ts` has `b0` and `b1`; `lib.ts` has `l0` and `l1`,
 * both exported. Each function of `a.ts` and `b.ts` may be exported, `C` may
 * be, `a2` may be exported only through an alias (`export { a2 as run }`),
 * and `b.ts` may re-export `l0`. Each unit calls up to two units; a call to
 * another file's unit that it does not export is dropped, and a call to
 * `C.m` is `new C().m()`. `a.ts` may also export module data `D` whose one
 * method is named `a0` too, so one owns name names two units, which may
 * have different owners, and `a1` may define a function `a1n` that nothing
 * calls, which its tree holds. Two oracle files own up to three entries each (the
 * first always a function of a `--source` file, so the run owns something),
 * and the second may also own `src/b.ts` whole. Calls may form cycles.
 *
 * Model: a graph over the history's structure, not over its text, and not
 * owners.mjs: the closure of each entry point over the calls, and of each
 * oracle file's entries.
 *
 * Driver: writes the package and the two oracle files, runs the production
 * `analyze` (as the gap CLI does), and asks `reachedFrom` for every unit.
 * The order of the list is the report's to decide (the classify oracle), so
 * the observation sorts it.
 *
 * Limits: no nested function but `a1n`, no module data but `D`, no other
 * object-literal method, no default
 * export, CommonJS export, `export *`, or dynamic lookup is generated; those
 * are the ownership walk's, which `reachedFrom` reads, and the static
 * oracles judge it. One class with one method; no constructor and no
 * class passed as a value.
 */
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { differs, oracleProperty, pass } from '../src/oracle-property.ts'
import { analyze } from './analysis.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(here, `../package.json`))(
  `typescript-for-tanstack-oracles`,
)

// The units, each with its file. The first five may be exported; `C.m` is
// exported with its class; `lib.ts` exports both of its functions.
const UNITS = [
  { id: `a0`, file: `a` },
  { id: `a1`, file: `a` },
  { id: `a2`, file: `a` },
  { id: `b0`, file: `b` },
  { id: `b1`, file: `b` },
  { id: `C.m`, file: `a` },
  { id: `l0`, file: `lib` },
  { id: `l1`, file: `lib` },
]
const ids = UNITS.map((unit) => unit.id)
// With `twin`, the module data `D` and its method, a second unit named `a0`.
const TWINS = [
  { id: `D`, file: `a` },
  { id: `D.a0`, file: `a`, name: `a0` },
]
// With `nested`, a function `a1n` defined inside `a1` and never called.
const NESTED = { id: `a1n`, file: `a` }
const unitsOf = (h) => [
  ...UNITS,
  ...(h.twin ? TWINS : []),
  ...(h.nested ? [NESTED] : []),
]
const fileOf = (id) =>
  [...UNITS, ...TWINS, NESTED].find((unit) => unit.id === id).file
const nameOf = (id) => (id === `D.a0` ? `a0` : id)
// The names a history's units have, each once, with its file.
const namesOf = (h) => [
  ...new Map(unitsOf(h).map((unit) => [nameOf(unit.id), unit.file])),
]
const SOURCES = [`src/a.ts`, `src/b.ts`]
const ORACLES = [`tests/t0.test.ts`, `tests/t1.test.ts`]
const entryName = (id) => `src/${fileOf(id)}.ts#${nameOf(id)}`
// The functions of a `--source` file, one of which the first oracle file
// always owns.
const sourceFunctions = [`a0`, `a1`, `a2`, `b0`, `b1`, `C.m`]

const historyArbitrary = fc.record({
  // Whether each of a0, a1, a2, b0, b1 is exported.
  exported: fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }),
  // Each unit's calls, by unit, in UNITS order.
  calls: fc.array(fc.uniqueArray(fc.constantFrom(...ids), { maxLength: 2 }), {
    minLength: UNITS.length,
    maxLength: UNITS.length,
  }),
  classExported: fc.boolean(),
  // `export { a2 as run }` in a.ts.
  alias: fc.boolean(),
  // `export { l0 } from './lib'` in b.ts.
  reexport: fc.boolean(),
  // The first oracle file's first entry, then each file's further entries.
  first: fc.constantFrom(...sourceFunctions),
  owns: fc.array(fc.uniqueArray(fc.constantFrom(...ids), { maxLength: 2 }), {
    minLength: 2,
    maxLength: 2,
  }),
  // The second oracle file also owns src/b.ts whole.
  wholeFile: fc.boolean(),
  // `export const D = { a0() {…} }` in a.ts: a second unit named `a0`.
  twin: fc.boolean(),
  // `a1` defines a function `a1n` that nothing calls.
  nested: fc.boolean(),
})

/** Whether a unit is visible outside its file, as an import would need. */
function visible(h, id) {
  const file = fileOf(id)
  if (file === `lib`) return true
  if (id === `D` || id === `D.a0`) return h.twin
  if (id === `a1n`) return false
  if (id === `C.m`) return h.classExported
  return h.exported[ids.indexOf(id)]
}

/** Each unit's calls, without calls to another file's hidden units. */
function callsOf(h) {
  return new Map([
    ...UNITS.map((unit, index) => [
      unit.id,
      h.calls[index].filter(
        (callee) => fileOf(callee) === unit.file || visible(h, callee),
      ),
    ]),
    ...TWINS.map((unit) => [unit.id, []]),
    [NESTED.id, []],
  ])
}

/** The oracle files' entries, by file. */
const ownsOf = (h) => [
  [...new Set([h.first, ...h.owns[0]])],
  [...new Set(h.owns[1])],
]

/** The package's files. */
function filesOf(h) {
  const calls = callsOf(h)
  const callText = (callee) =>
    callee === `C.m` ? `new C().m()` : `${callee}()`
  const body = (id) =>
    `return 1${calls
      .get(id)
      .map((callee) => ` + ${callText(callee)}`)
      .join(``)}`
  const importsOf = (file) => {
    const byFile = new Map()
    for (const unit of UNITS.filter((u) => u.file === file))
      for (const callee of calls.get(unit.id))
        if (fileOf(callee) !== file) {
          const name = callee === `C.m` ? `C` : callee
          byFile.set(fileOf(callee), [
            ...new Set([...(byFile.get(fileOf(callee)) ?? []), name]),
          ])
        }
    return [...byFile].map(
      ([from, names]) => `import { ${names.join(`, `)} } from './${from}'`,
    )
  }
  const fn = (id, exported) =>
    `${exported ? `export ` : ``}function ${id}(): number {\n${id === `a1` && h.nested ? `  function a1n(): number {\n    return 1\n  }\n` : ``}  ${body(id)}\n}`
  const a = [
    ...importsOf(`a`),
    ...[`a0`, `a1`, `a2`].map((id) => fn(id, visible(h, id))),
    `${h.classExported ? `export ` : ``}class C {\n  m(): number {\n    ${body(`C.m`)}\n  }\n}`,
    ...(h.alias && !visible(h, `a2`) ? [`export { a2 as run }`] : []),
    ...(h.twin
      ? [`export const D = {\n  a0(): number {\n    return 1\n  },\n}`]
      : []),
  ]
  const b = [
    ...importsOf(`b`),
    ...[`b0`, `b1`].map((id) => fn(id, visible(h, id))),
    ...(h.reexport ? [`export { l0 } from './lib'`] : []),
  ]
  const lib = [...importsOf(`lib`), ...[`l0`, `l1`].map((id) => fn(id, true))]
  const [t0, t1] = ownsOf(h).map((entries) => entries.map(entryName))
  if (h.wholeFile) t1.push(`src/b.ts`)
  const ownsText = (entries) =>
    `oracleProperty({ owns: [${entries.map((e) => `'${e}'`).join(`, `)}] })\n`
  return {
    'src/a.ts': `${a.join(`\n`)}\n`,
    'src/b.ts': `${b.join(`\n`)}\n`,
    'src/lib.ts': `${lib.join(`\n`)}\n`,
    [ORACLES[0]]: ownsText(t0),
    [ORACLES[1]]: ownsText(t1),
  }
}

// The independent model: the entry points are what a.ts and b.ts export
// (a2 through its alias too, l0 through b's re-export, C.m with its class);
// each one reaches the closure of its calls; each is owned by the oracle
// files whose entries' closures hold it, and by the second when it owns
// b.ts whole and the entry is in b.ts.
function model(h) {
  const calls = callsOf(h)
  const closure = (roots) => {
    const seen = new Set()
    const visit = (id) => {
      if (seen.has(id)) return
      seen.add(id)
      for (const next of calls.get(id)) visit(next)
      // A function's tree holds the functions defined in it, called or not.
      if (id === `a1` && h.nested) visit(`a1n`)
    }
    for (const root of roots) visit(root)
    return seen
  }
  const entries = [
    ...[`a0`, `a1`, `a2`, `b0`, `b1`].filter((id) => visible(h, id)),
    ...(h.alias && !visible(h, `a2`) ? [`a2`] : []),
    ...(h.classExported ? [`C.m`] : []),
    ...(h.reexport ? [`l0`] : []),
    ...(h.twin ? [`D`, `D.a0`] : []),
  ]
  // An owns entry owns every unit of its name.
  const owned = ownsOf(h).map((names) =>
    closure(
      unitsOf(h)
        .map((unit) => unit.id)
        .filter((id) => names.includes(nameOf(id))),
    ),
  )
  const ownersOf = (id) =>
    ORACLES.filter(
      (_, index) =>
        owned[index].has(id) ||
        (index === 1 && h.wholeFile && fileOf(id) === `b`),
    )
  const reach = new Map(entries.map((id) => [id, closure([id])]))
  // For each name, the entries whose closures hold a unit of that name, one
  // per owns name, owned by what owns any unit of that name.
  return Object.fromEntries(
    namesOf(h).map(([name]) => {
      const points = new Map()
      for (const entry of new Set(entries))
        if ([...reach.get(entry)].some((id) => nameOf(id) === name))
          points.set(entryName(entry), [
            ...new Set([
              ...(points.get(entryName(entry)) ?? []),
              ...ownersOf(entry),
            ]),
          ])
      return [
        name,
        [...points]
          .map(([entry, owners]) => ({ entry, owners: owners.sort() }))
          .sort((x, y) => (x.entry < y.entry ? -1 : 1)),
      ]
    }),
  )
}

function statesOf(h) {
  const owed = model(h)
  const states = []
  const lists = Object.values(owed)
  if (lists.some((list) => list.some((point) => point.owners.length === 0)))
    states.push(STATES[0])
  if (lists.some((list) => list.length >= 2)) states.push(STATES[1])
  if (lists.some((list) => list.some((point) => point.owners.length === 2)))
    states.push(STATES[2])
  if (owed.l1.length > 0 || owed.l0.length > 0) states.push(STATES[3])
  if (h.alias && !visible(h, `a2`) && owed.a2.length > 0) states.push(STATES[4])
  if (h.reexport) states.push(STATES[5])
  if (h.classExported && owed[`C.m`].length > 0) states.push(STATES[6])
  if (
    h.wholeFile &&
    lists.some((list) => list.some((p) => p.entry.startsWith(`src/b.ts#`)))
  )
    states.push(STATES[7])
  if (lists.some((list) => list.length === 0)) states.push(STATES[8])
  if (h.nested && owed.a1n.length > 0) states.push(STATES[10])
  if (h.twin) {
    const point = owed.a0.find((p) => p.entry === `src/a.ts#a0`)
    const calls = callsOf(h)
    // Function a0 reached from another unit, so its owners can differ from
    // its twin's.
    if (
      point &&
      point.owners.length > 0 &&
      [...calls].some(([id, callees]) => id !== `a0` && callees.includes(`a0`))
    )
      states.push(STATES[9])
  }
  return states
}

const STATES = [
  `an entry point owned by nothing`,
  `a function reached from two entry points`,
  `an entry point owned by two files`,
  `a function of a file that is not a --source file reached from an export`,
  `an entry point exported only through an alias`,
  `a re-exported entry point`,
  `an exported class's method as an entry point`,
  `an entry point owned through its whole file`,
  `a function no export reaches`,
  `one owns name for two exported units`,
  `a nested function reached through its parent`,
]

// Each state's constructed history, from a generated one.
const constructed = [
  {
    name: `two exports share a helper, one owned`,
    enters: [STATES[0], STATES[1]],
    build: (g) => ({
      ...g,
      exported: [true, true, false, false, false],
      calls: [[`a2`], [`a2`], [], [], [], [], [], []],
      first: `a0`,
      owns: [[], []],
      wholeFile: false,
    }),
  },
  {
    name: `both oracle files own one export`,
    enters: [STATES[2]],
    build: (g) => ({
      ...g,
      exported: [true, false, false, false, false],
      first: `a0`,
      owns: [[], [`a0`]],
    }),
  },
  {
    name: `an export reaches a library function`,
    enters: [STATES[3]],
    build: (g) => ({
      ...g,
      exported: [true, ...g.exported.slice(1)],
      calls: [[`l1`], ...g.calls.slice(1)],
    }),
  },
  {
    name: `an alias exports a2`,
    enters: [STATES[4]],
    build: (g) => ({
      ...g,
      exported: [g.exported[0], g.exported[1], false, ...g.exported.slice(3)],
      alias: true,
    }),
  },
  {
    name: `b re-exports l0`,
    enters: [STATES[5]],
    build: (g) => ({ ...g, reexport: true }),
  },
  {
    name: `an exported class`,
    enters: [STATES[6]],
    build: (g) => ({ ...g, classExported: true }),
  },
  {
    name: `the second file owns b.ts whole`,
    enters: [STATES[7]],
    build: (g) => ({
      ...g,
      exported: [
        g.exported[0],
        g.exported[1],
        g.exported[2],
        true,
        g.exported[4],
      ],
      wholeFile: true,
    }),
  },
  {
    name: `two units named a0, one called by an owned export`,
    enters: [STATES[9]],
    build: (g) => ({
      ...g,
      exported: [true, false, false, true, false],
      calls: [[], [], [], [`a0`], [], [], [], []],
      first: `b0`,
      owns: [[], [`a0`]],
      twin: true,
    }),
  },
  {
    name: `an exported function defines one it never calls`,
    enters: [STATES[10]],
    build: (g) => ({
      ...g,
      exported: [g.exported[0], true, ...g.exported.slice(2)],
      nested: true,
    }),
  },
  {
    name: `nothing exported`,
    enters: [STATES[8]],
    build: (g) => ({
      ...g,
      exported: [false, false, false, false, false],
      classExported: false,
      alias: false,
      reexport: false,
      twin: false,
    }),
  },
]

function driver(h, observe) {
  const pkg = realpathSync.native(mkdtempSync(join(tmpdir(), `entry-points-`)))
  try {
    mkdirSync(join(pkg, `src`))
    mkdirSync(join(pkg, `tests`))
    for (const [path, text] of Object.entries(filesOf(h)))
      writeFileSync(join(pkg, path), text)
    const { owned } = analyze(
      ts,
      pkg,
      SOURCES,
      ORACLES.map((file) => join(pkg, file)),
    )
    observe(
      `reached`,
      Object.fromEntries(
        namesOf(h).map(([name, file]) => [
          name,
          owned
            .reachedFrom(`src/${file}.ts`, name)
            .map(({ entry, owners }) => ({
              entry,
              owners: owners
                .map((file) => relative(pkg, file).split(sep).join(`/`))
                .sort(),
            }))
            .sort((x, y) => (x.entry < y.entry ? -1 : 1)),
        ]),
      ),
    )
    for (const state of statesOf(h)) observe(`reach`, state)
  } finally {
    rmSync(pkg, { recursive: true, force: true })
  }
}

const check = (h, trace, expected) =>
  differs(
    `reached`,
    `reached`,
    trace.find((row) => row.checkpoint === `reached`)?.value,
    expected,
    `the entry points that reach a function, or their owners, are not the model's`,
  ) ?? pass

// Wrong answers the check must reject: an entry point left out, an owner
// left out, and a library function listed as an entry point of its own.
const corrupt = (change) => (trace) => {
  const index = trace.findIndex((row) => row.checkpoint === `reached`)
  if (index < 0) return undefined
  const value = structuredClone(trace[index].value)
  if (change(value) === false) return undefined
  return trace.map((row, i) => (i === index ? { ...row, value } : row))
}
const calibrations = [
  {
    name: `an entry point is left out`,
    law: `reached`,
    corrupt: corrupt((value) => {
      const id = ids.find((unit) => value[unit].length > 0)
      if (id === undefined) return false
      value[id] = value[id].slice(1)
    }),
  },
  {
    name: `an entry point's owner is left out`,
    law: `reached`,
    corrupt: corrupt((value) => {
      const point = Object.values(value)
        .flat()
        .find((p) => p.owners.length > 0)
      if (point === undefined) return false
      point.owners = point.owners.slice(1)
    }),
  },
  {
    name: `a library function is its own entry point`,
    law: `reached`,
    corrupt: corrupt((value) => {
      if (value.l1.some((p) => p.entry === `src/lib.ts#l1`)) return false
      value.l1 = [...value.l1, { entry: `src/lib.ts#l1`, owners: [] }]
    }),
  },
]

oracleProperty({
  id: `oracle-gaps.report-entry-points`,
  law: {
    statement: `For every function, the gap report's analysis lists exactly the units that a --source file exports (directly, through an alias, or by re-exporting another file's function; an exported class's methods each count) whose static call trees hold the function, each by its owns name (two units of one name are one entry, owned by what owns either), with exactly the oracle files whose owns trees hold that unit or that own its whole file. A file that is not a --source file exports no entry point.`,
    authority: `A downstream project's report of 2026-11-25 (proposal 2: list every public entry point that reaches clustered survivors, and who owns each one); the ownership law of owners.mjs (P6, R6, I10: the static call tree of each owns entry, unioned over the oracle files), read in reverse.`,
    limits: `Three files, two of them --source files; one class with one method, reached by \`new C().m()\`; up to two calls per unit, cycles included. Module data is one exported literal \`D\` whose one method shares the name \`a0\` with a function, and one function defined inside another is never called. Not generated: other nested functions, other module data and object-literal methods, default and CommonJS exports, \`export *\`, dynamic lookups, a class passed as a value, and constructors; those are the ownership walk's, which this list reads, and the static oracles judge them. The order of the list is the report's (oracle-gaps.report-classify, law 8), so it is not judged here.`,
  },
  histories: {
    arbitrary: historyArbitrary,
    runs: 120,
    fixedSeeds: [20261125],
    states: STATES,
    measured: [],
    constructed,
  },
  timeout: 120_000,
  model,
  driver,
  check,
  calibrations,
})
