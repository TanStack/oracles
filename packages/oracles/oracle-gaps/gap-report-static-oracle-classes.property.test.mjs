/**
 * # A class is a unit: an owns entry may name it, and it owns all of it
 *
 * The law: a named class declaration is a unit of its own, named by its
 * class, as a function and module-level data are. Its own text, the code
 * of the class that no member holds (an instance or static field's
 * initializer, a static block, and its `extends` clause), belongs to it.
 * An owns entry may name it (`src/x.ts#C`), and owning it owns its own
 * text, every member defined in it (constructor, methods, accessors, field
 * functions), and the static reference tree of each: whatever the class's
 * own text and its members refer to. A class used as a value
 * (`make(C)`) brings the whole class, its own text with its members, on
 * the reasoning that already brings all its methods: which one runs is
 * unknown statically. `new C()` still brings only C's constructor, and an
 * entry that names a member (`#C.constructor`, `#C.m`) owns that member
 * and its tree, not the class's own text (the maintainer decision that
 * `new C()` brings only the constructor). A statement at the top of a module
 * that is neither a function nor data, such as one after the class that
 * assigns to its prototype, belongs to no unit: it is the module's
 * (`<module>`), and only an entry that names the whole file owns it.
 *
 * Authority: the ownership law of owners.mjs (the static call tree of each
 * owns entry, unioned over oracle files; maintainer decisions of 2026-11-05
 * and 2026-11-08: owning a unit owns its whole text and every function
 * defined in it); the class precedent of gap-report-oracle.property.test.mjs
 * law 3 ("a class passed as a value brings all its methods"; "`new C()`
 * brings only C's constructor"); the module-data law (F10), whose unit an
 * owns entry may name; and a downstream user's finding that `#Class` was
 * refused while `#Class.constructor` was accepted. Pending the maintainers'
 * approval as a law (listed in the pull request that adds it).
 *
 * Law: for every generated module and every entry (the class, its
 * constructor, its method, or a function `run` that constructs the class,
 * passes it as a value, or does not use it), the run is not refused, each
 * marked piece of code belongs to the unit the rule names, and it is owned
 * exactly when the model's closure from the entry reaches that unit.
 *
 * History: a module with six module functions (`fa` to `ff`), a `make`
 * helper that takes a class as a value, an optional base class `Base` (a
 * field and a method) that the class `C` extends, and the class `C` with
 * any of: an instance field whose initializer calls `fa`, a static field
 * whose initializer calls `fb`, a static block that calls `fc`, a field
 * whose initializer calls an unnamed arrow that calls `fg`, a
 * constructor that calls `fd`, a method `m` that calls `fe`, a getter `g`,
 * and a field arrow `h`. A statement after the class calls `ff` and sets a
 * property of C's prototype. The entry is `#C`, `#C.constructor`, `#C.m`,
 * or `#run`; an entry that names a member brings that member into the
 * module.
 *
 * Model: an independent graph over the history's flags, not over the text:
 * the class reaches each member it has, the module function its own text
 * calls, and, when it extends `Base`, `Base` and its method; each member
 * reaches the module function it calls; `run` reaches `make` and the whole
 * class for a value use, and C's constructor for `new`. The closure from the
 * entry is the owed ownership. The unit of each marker is the rule's: the
 * class's own text is `C`'s, a member's text is the member's, and the
 * statement is `<module>`'s.
 *
 * Driver: writes the module and an oracle file that names the entry, runs
 * the production `analyze` on it (as the gap CLI does), and reads each
 * marker's unit and owners through `owned.at`. A refusal is observed.
 *
 * Limits: one class per module, named, declared at the top of the module;
 * no class expression (`const C = class {}`, which is module data), no
 * unnamed default-exported class, no class nested in a function, no
 * decorators, no static method, and no static property read (`C.s()`) as a
 * use. A class whose own text holds a function (`static make = () => …`) is
 * not generated beyond the field arrow `h`. The observation is ownership
 * and unit names, not the gap report's mutant outcomes: those are the
 * end-to-end oracle's, which generates no class entry.
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
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { differs, oracleProperty, pass } from '../src/oracle-property.ts'
import { analyze } from './analysis.mjs'
import { Refusal } from './ending.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(here, `../package.json`))(
  `typescript-for-tanstack-oracles`,
)

const LAW = `a class is a unit that an owns entry may name`
const FUNCTIONS = [`fa`, `fb`, `fc`, `fd`, `fe`, `ff`, `fg`]
// The module function each piece of the class calls.
const CALLS = {
  field: `fa`,
  staticField: `fb`,
  staticBlock: `fc`,
  // A field whose initializer calls an unnamed arrow, which is no unit:
  // the arrow's code is the class's, and so is what it calls.
  iife: `fg`,
  ctor: `fd`,
  method: `fe`,
}

const historyArbitrary = fc.record({
  base: fc.boolean(),
  field: fc.boolean(),
  staticField: fc.boolean(),
  staticBlock: fc.boolean(),
  iife: fc.boolean(),
  ctor: fc.boolean(),
  method: fc.boolean(),
  getter: fc.boolean(),
  arrow: fc.boolean(),
  entry: fc.constantFrom(`class`, `class`, `ctor`, `method`, `run`),
  use: fc.constantFrom(`new`, `value`, `none`),
})

/** The history with the member its entry names. */
const effective = (history) => ({
  ...history,
  ctor: history.ctor || history.entry === `ctor`,
  method: history.method || history.entry === `method`,
})

/** The owns entry's unit name. */
const entryOf = (history) =>
  ({ class: `C`, ctor: `C.constructor`, method: `C.m`, run: `run` })[
    history.entry
  ]

/** C's members, by unit name. */
const membersOf = (h) => [
  ...(h.ctor ? [`C.constructor`] : []),
  ...(h.method ? [`C.m`] : []),
  ...(h.getter ? [`C.g`] : []),
  ...(h.arrow ? [`C.h`] : []),
]

/** Each marker and the unit the rule puts it in. */
function markersOf(raw) {
  const h = effective(raw)
  return {
    run: `run`,
    make: `make`,
    ...Object.fromEntries(FUNCTIONS.map((name) => [name, name])),
    ...(h.base ? { Base: `Base`, 'Base.bm': `Base.bm` } : {}),
    ...(h.field ? { 'C:field': `C` } : {}),
    ...(h.staticField ? { 'C:static': `C` } : {}),
    ...(h.staticBlock ? { 'C:block': `C` } : {}),
    ...(h.iife ? { 'C:iife': `C` } : {}),
    ...Object.fromEntries(membersOf(h).map((unit) => [unit, unit])),
    statement: `<module>`,
  }
}

/** The module's text, with a marker comment in each piece. */
function sourceOf(raw) {
  const h = effective(raw)
  const lines = []
  for (const name of FUNCTIONS)
    lines.push(
      `function ${name}(): number {`,
      `  /*@${name}*/`,
      `  return 1`,
      `}`,
    )
  lines.push(
    `function make(k: unknown): unknown {`,
    `  /*@make*/`,
    `  return k`,
    `}`,
  )
  if (h.base)
    lines.push(
      `export class Base {`,
      `  k = /*@Base*/ 1`,
      `  bm(): number {`,
      `    /*@Base.bm*/`,
      `    return 1`,
      `  }`,
      `}`,
    )
  lines.push(`export class C${h.base ? ` extends Base` : ``} {`)
  if (h.field) lines.push(`  n = /*@C:field*/ ${CALLS.field}()`)
  if (h.staticField)
    lines.push(`  static s = /*@C:static*/ ${CALLS.staticField}()`)
  if (h.staticBlock)
    lines.push(`  static {`, `    /*@C:block*/ ${CALLS.staticBlock}()`, `  }`)
  if (h.iife) lines.push(`  t = (() => /*@C:iife*/ ${CALLS.iife}())()`)
  if (h.ctor)
    lines.push(
      `  constructor() {`,
      ...(h.base ? [`    super()`] : []),
      `    /*@C.constructor*/ ${CALLS.ctor}()`,
      `  }`,
    )
  if (h.method)
    lines.push(
      `  m(): number {`,
      `    /*@C.m*/`,
      `    return ${CALLS.method}()`,
      `  }`,
    )
  if (h.getter)
    lines.push(`  get g(): number {`, `    /*@C.g*/`, `    return 2`, `  }`)
  if (h.arrow)
    lines.push(`  h = (): number => {`, `    /*@C.h*/`, `    return 3`, `  }`)
  lines.push(`}`)
  lines.push(
    `Object.defineProperty(C.prototype, 'tag', { value: /*@statement*/ ff() })`,
  )
  lines.push(`export function run(): unknown {`, `  /*@run*/`)
  if (h.use === `new`) lines.push(`  return new C()`)
  if (h.use === `value`) lines.push(`  return make(C)`)
  if (h.use === `none`) lines.push(`  return 0`)
  lines.push(`}`)
  return `${lines.join(`\n`)}\n`
}

// The independent model: units and the rule's edges, closed from the entry.
function model(raw) {
  const h = effective(raw)
  const edges = new Map()
  const link = (from, ...to) =>
    edges.set(from, [...(edges.get(from) ?? []), ...to])
  // The class holds its members, and its own text calls what it calls.
  link(`C`, ...membersOf(h))
  if (h.field) link(`C`, CALLS.field)
  if (h.staticField) link(`C`, CALLS.staticField)
  if (h.staticBlock) link(`C`, CALLS.staticBlock)
  if (h.iife) link(`C`, CALLS.iife)
  // `extends Base` uses Base as a value: the whole class.
  if (h.base) {
    link(`C`, `Base`)
    link(`Base`, `Base.bm`)
  }
  if (h.ctor) link(`C.constructor`, CALLS.ctor)
  if (h.method) link(`C.m`, CALLS.method)
  if (h.use === `value`) link(`run`, `make`, `C`)
  if (h.use === `new` && h.ctor) link(`run`, `C.constructor`)
  const owned = new Set()
  const visit = (unit) => {
    if (owned.has(unit)) return
    owned.add(unit)
    for (const next of edges.get(unit) ?? []) visit(next)
  }
  visit(entryOf(h))
  return {
    refused: undefined,
    units: Object.fromEntries(
      Object.entries(markersOf(h))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([marker, unit]) => [marker, { unit, owned: owned.has(unit) }]),
    ),
  }
}

/** The states a history enters, for the reach counts. */
function statesOf(raw) {
  const h = effective(raw)
  const own = h.field || h.staticField || h.staticBlock || h.iife
  const states = []
  if (h.entry === `class` && (h.field || h.staticField)) states.push(STATES[0])
  if (h.entry === `class` && h.iife) states.push(STATES[10])
  if (h.entry === `class` && h.staticBlock) states.push(STATES[1])
  if (h.entry === `class` && membersOf(h).length > 0) states.push(STATES[2])
  if (h.entry === `class` && h.base) states.push(STATES[3])
  if (h.entry === `ctor` && own) states.push(STATES[4])
  if (h.entry === `method`) states.push(STATES[5])
  if (h.entry === `run` && h.use === `new` && h.ctor) states.push(STATES[6])
  if (h.entry === `run` && h.use === `value`) states.push(STATES[7])
  if (h.entry === `run` && h.use === `none`) states.push(STATES[8])
  states.push(STATES[9])
  return states
}

const STATES = [
  `a class entry owns its field initializers`,
  `a class entry owns its static block`,
  `a class entry owns its members`,
  `a class entry owns its base class through extends`,
  `a constructor entry leaves the class's own text unowned`,
  `a method entry owns its method alone`,
  `new brings only the constructor`,
  `a class passed as a value brings the whole class`,
  `an unused class stays unowned`,
  `a statement after the class is the module's`,
  `a class entry owns what an unnamed function in its field calls`,
]

const full = {
  field: true,
  staticField: true,
  staticBlock: true,
  iife: true,
  getter: true,
  arrow: true,
}
const constructed = [
  {
    name: `class entry`,
    enters: [STATES[0], STATES[1], STATES[2], STATES[9], STATES[10]],
    build: (g) => ({ ...g, ...full, ctor: true, method: true, entry: `class` }),
  },
  {
    name: `class entry with a base`,
    enters: [STATES[0], STATES[1], STATES[2], STATES[3], STATES[9], STATES[10]],
    build: (g) => ({ ...g, ...full, base: true, ctor: true, entry: `class` }),
  },
  {
    name: `constructor entry`,
    enters: [STATES[4], STATES[9]],
    build: (g) => ({ ...g, ...full, entry: `ctor` }),
  },
  {
    name: `method entry`,
    enters: [STATES[5], STATES[9]],
    build: (g) => ({ ...g, ...full, entry: `method` }),
  },
  {
    name: `new`,
    enters: [STATES[6], STATES[9]],
    build: (g) => ({ ...g, ...full, ctor: true, entry: `run`, use: `new` }),
  },
  {
    name: `value`,
    enters: [STATES[7], STATES[9]],
    build: (g) => ({ ...g, ...full, entry: `run`, use: `value` }),
  },
  {
    name: `unused`,
    enters: [STATES[8], STATES[9]],
    build: (g) => ({ ...g, ...full, entry: `run`, use: `none` }),
  },
]

function driver(history, observe) {
  const pkg = realpathSync.native(mkdtempSync(join(tmpdir(), `class-units-`)))
  try {
    mkdirSync(join(pkg, `src`), { recursive: true })
    mkdirSync(join(pkg, `tests`), { recursive: true })
    const source = sourceOf(history)
    writeFileSync(join(pkg, `src`, `sut.ts`), source)
    const testFile = join(pkg, `tests`, `classes.test.ts`)
    writeFileSync(
      testFile,
      `oracleProperty({ owns: ['src/sut.ts#${entryOf(effective(history))}'] })\n`,
    )
    let owned
    let refused
    try {
      ;({ owned } = analyze(ts, pkg, [`src/sut.ts`], [testFile]))
    } catch (error) {
      if (!(error instanceof Refusal)) throw error
      refused = error.message
    }
    const units = {}
    if (owned)
      for (const marker of Object.keys(markersOf(history)).sort((a, b) =>
        a.localeCompare(b),
      )) {
        const position = source.indexOf(`/*@${marker}*/`)
        if (position < 0) throw new Error(`no marker for ${marker}`)
        const at = owned.at(`src/sut.ts`, position)
        units[marker] = { unit: at.name, owned: at.owners.size > 0 }
      }
    observe(`owned`, { refused, units: owned ? units : {} })
    for (const state of statesOf(history)) observe(`reach`, state)
  } finally {
    rmSync(pkg, { recursive: true, force: true })
  }
}

const check = (history, trace, expected) =>
  differs(
    `owned`,
    LAW,
    trace.find((row) => row.checkpoint === `owned`)?.value,
    expected,
  ) ?? pass

// Wrong answers the check must reject: the class's own text left in the
// module, as before a class was a unit, and a member left out of the class's
// tree.
const corruptUnits = (trace, change) => {
  const index = trace.findIndex((row) => row.checkpoint === `owned`)
  if (index < 0) return undefined
  const value = structuredClone(trace[index].value)
  if (!change(value.units)) return undefined
  return trace.map((row, i) => (i === index ? { ...row, value } : row))
}
const calibrations = [
  {
    name: `the class's own text belongs to the module`,
    law: LAW,
    history: { constructed: `class entry` },
    corrupt: (trace) =>
      corruptUnits(trace, (units) => {
        if (!units[`C:field`]) return false
        units[`C:field`] = { unit: `<module>`, owned: false }
        return true
      }),
  },
  {
    name: `a class entry leaves its method unowned`,
    law: LAW,
    history: { constructed: `class entry` },
    corrupt: (trace) =>
      corruptUnits(trace, (units) => {
        if (!units[`C.m`]) return false
        units[`C.m`].owned = false
        return true
      }),
  },
  {
    name: `new brings the class's own text`,
    law: LAW,
    history: { constructed: `new` },
    corrupt: (trace) =>
      corruptUnits(trace, (units) => {
        if (!units[`C:field`]) return false
        units[`C:field`].owned = true
        return true
      }),
  },
]

oracleProperty({
  id: `oracle-gaps.report-static-classes`,
  law: {
    statement: `A named class declaration is a unit, named by its class: the code of the class that no member holds (field initializers, static blocks, its extends clause) belongs to it. An owns entry may name it, and owning it owns that code, every member, and what each refers to. A class used as a value brings the whole class; new C() brings only its constructor; an entry that names a member owns that member's tree, not the class's own code. A top-level statement that is neither a function nor data is the module's, owned only by a whole-file entry.`,
    authority: `The ownership law of owners.mjs (the static call tree of each owns entry; maintainer decisions of 2026-11-05 and 2026-11-08); the class precedent of gap-report-oracle.property.test.mjs law 3 (a class passed as a value brings all its methods; new C() brings only its constructor); the module-data law (F10), a unit that an owns entry may name; and a downstream finding that #Class was refused while #Class.constructor was accepted. Pending the maintainers' approval.`,
    limits: `One named class per module, at the top of the module, with an optional in-package base class. Not generated: class expressions (module data), unnamed default-exported classes, classes nested in functions, decorators, static methods, and a static property read as a use. The observation is each marked piece's unit and ownership, not the gap report's mutant outcomes.`,
  },
  histories: {
    arbitrary: historyArbitrary,
    runs: 60,
    fixedSeeds: [20261124],
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
