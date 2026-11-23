/**
 * # A module object literal's functions are owned by how the literal is used
 *
 * The law (the maintainer's ruling of 2026-11-23, decisions register, "Object-
 * literal functions used dynamically are owned"): a function defined inside a
 * module-level object literal is owned when the literal is used dynamically
 * (`table[key]()`) or as a whole value (passed to a function, spread, or read
 * with `Object.values`). A static property read (`table.a()`) owns that one
 * member and leaves its siblings unowned. A function that the literal's
 * initializer names by shorthand (`{ helper }`) belongs to the literal's tree,
 * because the initializer refers to it (F10). An owns entry that names the
 * literal reaches the literal and its shorthand targets, but no member. A
 * property name in the literal declares a property; it never refers to a
 * binding of the same name, so a called function of that name is owned on its
 * own account and the property is owned only through the rule above.
 *
 * The rule is an application of the ownership law of owners.mjs (P6, R6, I10):
 * ownership is the static call tree of each `owns` entry, unioned over the
 * oracle files, and a reference is an edge. Which member a dynamic lookup calls
 * is unknown statically, so every member is in the tree. A class passed as a
 * value brings all its methods on the same reasoning (the class precedent).
 *
 * Law: for every generated module, every reference-usage shape (dynamic,
 * passed, spread, Object.values, static read, none), and every entry (the
 * function that reads the literal, or the literal itself), a unit is owned
 * exactly when the model's closure from the entry reaches it. The units are the
 * run function, the literal, the pass-through helper, each module function, and
 * each member the literal declares.
 *
 * History: a module with three module functions (`fa`, `fb`, `fc`) and a
 * `pass` helper, a literal of one to four members (arrows and methods whose
 * names may shadow the module functions `fa` and `fb`, and optionally call one
 * module function), a `run` function that calls up to two module functions and
 * uses the literal in one shape, and an entry that is `run` or the literal
 * itself. Two primitive flags add a shorthand member (`{ fb }`) and an arrow
 * `fa` that shadows the module function `fa`, which `run` calls. The flags,
 * rather than the members, are what the constructed histories set, so their
 * shrinking stays on the generated values. Each state of the reach list has a
 * constructed history that forces its feature.
 *
 * Model: an independent graph over the history's structure (not over the
 * generated text), closed from the entry. The model does not read owners.mjs.
 * Its edges are the rule's: `run` reaches the literal, and for a dynamic,
 * passed, spread, or Object.values use, every member; for a static read, the
 * literal and the member read; `pass` for a passed use; each module function
 * `run` calls; the literal reaches its shorthand targets; a member reaches the
 * module function it calls.
 *
 * Driver: writes the module and an oracle file that names the entry, runs the
 * production `analyze` on the module (as the gap CLI does), and reads each
 * unit's ownership at a marker comment inside its text through `owned.at`.
 *
 * Limits: one literal per module, one level of member calls, one usage per
 * run; no literal inside a function, no computed or numeric property names, no
 * `Object.freeze` or other wrappers around the literal, no `keyof typeof`, no
 * import of the literal from another file, and no nesting of literals. The
 * observation is ownership of each unit, not a gap report's mutant outcomes:
 * those are the end-to-end oracle's. Whether the shapes cover every call form
 * the TypeScript checker resolves is not claimed; the generated shapes are the
 * ones the rule names.
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

const here = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(here, `../package.json`))(
  `typescript-for-tanstack-oracles`,
)

// Module functions (each returns 1), and the pass-through helper of a passed use.
const FUNCTIONS = [`fa`, `fb`, `fc`]
// Usage shapes of the literal in `run`.
const USES = [`dynamic`, `passed`, `builtin`, `spread`, `direct`, `none`]

const memberArbitrary = fc.oneof(
  fc.record({
    kind: fc.constant(`shorthand`),
    name: fc.constantFrom(...FUNCTIONS),
    calls: fc.constant(undefined),
  }),
  fc.record({
    kind: fc.constantFrom(`arrow`, `method`),
    // `fa` and `fb` shadow the module functions of the same names.
    name: fc.constantFrom(`fa`, `fb`, `pa`, `pb`),
    calls: fc.option(fc.constantFrom(...FUNCTIONS), { nil: undefined }),
  }),
)

const historyArbitrary = fc.record({
  members: fc.uniqueArray(memberArbitrary, {
    selector: (member) => member.name,
    minLength: 1,
    maxLength: 4,
  }),
  use: fc.constantFrom(...USES),
  // Which member a static read names, by index into the members.
  target: fc.nat(3),
  calls: fc.uniqueArray(fc.constantFrom(...FUNCTIONS), { maxLength: 2 }),
  entry: fc.constantFrom(`run`, `run`, `data`),
  // A shorthand member naming a module function, added to the members.
  shorthand: fc.option(fc.constantFrom(`fb`, `fc`), { nil: undefined }),
  // An arrow member named `fa`, which shadows the module function `fa`, that
  // run calls.
  shadow: fc.boolean(),
})

/**
 * The members and calls a history's module has: the generated ones, with its
 * shorthand member and its shadowing member added (each replacing a member of
 * its name). The flags are primitives, so a constructed history can set them.
 */
function effective(history) {
  let members = history.members
  let calls = history.calls
  if (history.shorthand !== undefined)
    members = [
      { kind: `shorthand`, name: history.shorthand },
      ...members.filter((m) => m.name !== history.shorthand),
    ]
  if (history.shadow) {
    members = [
      { kind: `arrow`, name: `fa`, calls: undefined },
      ...members.filter((m) => m.name !== `fa`),
    ]
    calls = [`fa`, ...calls.filter((c) => c !== `fa`)]
  }
  return { ...history, members, calls }
}

/** The entry's owns name: `run`, or the literal `D` itself. */
const entryOf = (history) => (history.entry === `run` ? `run` : `D`)

/** The member a static read names. */
const targetOf = (history) =>
  history.members[history.target % history.members.length]

/** Every unit the observation names, with its marker in the module text. */
function unitsOf(history) {
  return [
    `run`,
    `D`,
    `pass`,
    ...FUNCTIONS,
    ...history.members
      .filter((member) => member.kind !== `shorthand`)
      .map((member) => `D.${member.name}`),
  ]
}

/** The shape names a history enters, for the reach counts. */
function statesOf(raw) {
  const history = effective(raw)
  const states = []
  const { use } = history
  if (use === `dynamic`) states.push(STATES[0])
  if (use === `passed`) states.push(STATES[1])
  if (use === `builtin`) states.push(STATES[2])
  if (use === `spread`) states.push(STATES[3])
  if (use === `direct`) states.push(STATES[4])
  if (use === `none`) states.push(STATES[5])
  if (
    history.entry === `data` &&
    history.members.some((m) => m.kind !== `shorthand`)
  )
    states.push(STATES[6])
  if (history.members.some((m) => m.kind === `shorthand`))
    states.push(STATES[7])
  if (
    history.members.some(
      (m) =>
        m.kind !== `shorthand` &&
        FUNCTIONS.includes(m.name) &&
        history.calls.includes(m.name),
    )
  )
    states.push(STATES[8])
  return states
}

const STATES = [
  `dynamic lookup owns every member`,
  `a passed literal owns every member`,
  `Object.values owns every member`,
  `a spread literal owns every member`,
  `a static read owns one member`,
  `no use leaves the literal's members unowned`,
  `an owns entry on the literal leaves its members unowned`,
  `a shorthand member names a module function`,
  `a member named like a function that run calls`,
]

// Each state's constructed history: the generated one, with the flag that the
// state names set. Random histories reach the states too, and the reach counts
// show how often; the constructed ones make each state required.
const constructed = [
  {
    name: `dynamic`,
    enters: [STATES[0]],
    build: (g) => ({ ...g, use: `dynamic` }),
  },
  {
    name: `passed`,
    enters: [STATES[1]],
    build: (g) => ({ ...g, use: `passed` }),
  },
  {
    name: `Object.values`,
    enters: [STATES[2]],
    build: (g) => ({ ...g, use: `builtin` }),
  },
  {
    name: `spread`,
    enters: [STATES[3]],
    build: (g) => ({ ...g, use: `spread` }),
  },
  {
    name: `static read`,
    enters: [STATES[4]],
    build: (g) => ({ ...g, use: `direct` }),
  },
  {
    name: `no use`,
    enters: [STATES[5]],
    build: (g) => ({ ...g, use: `none` }),
  },
  {
    name: `owns entry on the literal`,
    enters: [STATES[6]],
    build: (g) => ({ ...g, entry: `data`, shadow: true }),
  },
  {
    name: `shorthand member`,
    enters: [STATES[7]],
    build: (g) => ({ ...g, shorthand: `fb` }),
  },
  {
    name: `member named like a called function`,
    enters: [STATES[8]],
    build: (g) => ({ ...g, shadow: true }),
  },
]

/** The module's text, with a marker comment in each unit. */
function sourceOf(raw) {
  const history = effective(raw)
  const lines = []
  for (const name of FUNCTIONS)
    lines.push(
      `function ${name}(): number {`,
      `  /*@${name}*/`,
      `  return 1`,
      `}`,
    )
  lines.push(
    `function pass(t: object): number {`,
    `  /*@pass*/`,
    `  return Object.keys(t).length`,
    `}`,
    `const D = { /*@D*/`,
  )
  for (const member of history.members) {
    if (member.kind === `shorthand`) {
      lines.push(`  ${member.name},`)
      continue
    }
    const body =
      member.calls === undefined ? `return 1` : `return ${member.calls}()`
    lines.push(
      member.kind === `arrow`
        ? `  ${member.name}: () => { /*@D.${member.name}*/ ${body} },`
        : `  ${member.name}() { /*@D.${member.name}*/ ${body} },`,
    )
  }
  lines.push(`}`, `export function run(key: string): string {`, `  /*@run*/`)
  lines.push(`  const out: Array<string> = []`)
  for (const name of history.calls) lines.push(`  out.push(String(${name}()))`)
  const use = {
    dynamic: `  out.push(String(D[key]()))`,
    passed: `  out.push(String(pass(D)))`,
    builtin: `  out.push(String(Object.values(D).length))`,
    spread: `  out.push(String(Object.keys({ ...D }).length))`,
    direct: `  out.push(String(D.${targetOf(history).name}()))`,
    none: undefined,
  }[history.use]
  if (use !== undefined) lines.push(use)
  lines.push(`  return out.join(',')`, `}`)
  return `${lines.join(`\n`)}\n`
}

// The independent model. Nodes are the units; an edge is a reference the rule
// makes. The closure from the entry is the owed ownership.
function model(raw) {
  const history = effective(raw)
  const members = history.members.filter((m) => m.kind !== `shorthand`)
  const shorthand = history.members
    .filter((m) => m.kind === `shorthand`)
    .map((m) => m.name)
  const edges = new Map()
  const link = (from, ...to) =>
    edges.set(from, [...(edges.get(from) ?? []), ...to])
  const memberUnit = (m) => `D.${m.name}`
  // A function's calls: its one module function, if any.
  link(`run`, ...history.calls)
  for (const m of members)
    if (m.calls !== undefined) link(memberUnit(m), m.calls)
  // The literal's initializer refers to its shorthand targets (F10).
  link(`D`, ...shorthand)
  if (
    history.use === `dynamic` ||
    history.use === `builtin` ||
    history.use === `spread`
  )
    link(`run`, `D`, ...members.map(memberUnit))
  if (history.use === `passed`)
    link(`run`, `pass`, `D`, ...members.map(memberUnit))
  if (history.use === `direct`) {
    const target = targetOf(history)
    link(
      `run`,
      `D`,
      ...(target.kind === `shorthand` ? [] : [memberUnit(target)]),
    )
  }
  // The entry: `run`, or the literal, which owns only its own tree.
  const start = history.entry === `run` ? `run` : `D`
  const owned = new Set()
  const visit = (unit) => {
    if (owned.has(unit)) return
    owned.add(unit)
    for (const next of edges.get(unit) ?? []) visit(next)
  }
  visit(start)
  return Object.fromEntries(
    unitsOf(history).map((unit) => [unit, owned.has(unit)]),
  )
}

const expectedOwned = (history) =>
  Object.fromEntries(
    Object.entries(model(history)).sort(([a], [b]) => a.localeCompare(b)),
  )

function driver(history, observe) {
  const pkg = realpathSync.native(
    mkdtempSync(join(tmpdir(), `dispatch-ownership-`)),
  )
  const effectiveHistory = effective(history)
  try {
    mkdirSync(join(pkg, `src`), { recursive: true })
    mkdirSync(join(pkg, `tests`), { recursive: true })
    const source = sourceOf(history)
    writeFileSync(join(pkg, `src`, `sut.ts`), source)
    const testFile = join(pkg, `tests`, `dispatch.test.ts`)
    writeFileSync(
      testFile,
      `oracleProperty({ owns: ['src/sut.ts#${entryOf(history)}'] })\n`,
    )
    const { owned } = analyze(ts, pkg, [`src/sut.ts`], [testFile])
    const observed = {}
    for (const unit of unitsOf(effectiveHistory)) {
      const position = source.indexOf(`/*@${unit}*/`)
      if (position < 0) throw new Error(`no marker for ${unit}`)
      observed[unit] = owned.at(`src/sut.ts`, position).owners.size > 0
    }
    observe(
      `owned`,
      Object.fromEntries(
        Object.entries(observed).sort(([a], [b]) => a.localeCompare(b)),
      ),
    )
    for (const state of statesOf(history)) observe(`reach`, state)
  } finally {
    rmSync(pkg, { recursive: true, force: true })
  }
}

const check = (history, trace, expected) => {
  const observed = trace.find((row) => row.checkpoint === `owned`)?.value
  return (
    differs(
      `owned`,
      `the module's functions are owned as the literal is used`,
      observed,
      expected,
    ) ?? pass
  )
}

oracleProperty({
  id: `oracle-gaps.report-static-dispatch`,
  law: {
    statement: `A function defined in a module-level object literal is owned when the literal is used dynamically or as a whole value (passed, spread, or read with Object.values), and only its own member when it is read statically; a shorthand name in the literal is owned through the literal's initializer; an owns entry naming the literal owns no member; a property name in the literal refers to no binding.`,
    authority: `The maintainer's ruling of 2026-11-23 (decisions register, "Object-literal functions used dynamically are owned"), applied through the ownership law of owners.mjs (P6, R6, I10: the static call tree of owns, unioned over oracle files), the module-data law (F10: what an initializer refers to is in the declaration's tree), and the class precedent ("a class passed as a value brings all its methods").`,
    limits: `One literal per module, members that are arrows, methods, or shorthand names of module functions, one level of member calls, and one use per run. Not generated: literals inside functions, computed or numeric names, wrappers such as Object.freeze, keyof typeof, imported literals, and nested literals. The observation is each unit's ownership, not the gap report's mutant outcomes.`,
  },
  histories: {
    arbitrary: historyArbitrary,
    runs: 120,
    fixedSeeds: [20261123],
    states: STATES,
    measured: [],
    constructed,
  },
  timeout: 120_000,
  model: expectedOwned,
  driver,
  check,
})
