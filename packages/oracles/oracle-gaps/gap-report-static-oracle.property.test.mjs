/**
 * # The gap report's static laws, checked in-process
 *
 * Laws 1, 2, 3 (its static part), 6, and 8 (its key part) of the gap report
 * (gap-report-oracle.property.test.mjs states them in full) decide what the
 * report owes before any test runs: which operator mutants exist, which are
 * probe-only code, which oracle files own each function's call tree, which
 * declarations refuse the run, and each mutant's key. The CLI computes all of
 * them in `analyze` (analysis.mjs) and `keyAndSelect` (report.mjs), from files
 * alone. This oracle writes each generated fixture to a scratch package and
 * calls those functions directly, without Vitest or a child process, so a
 * history costs tens of milliseconds and a campaign a few seconds. The
 * end-to-end oracle keeps the laws that need real test runs.
 *
 * Laws, checked in this order:
 *
 * - **Refusal.** An owns entry that names no function, an entry that names a
 *   missing file, and an owns list that is not a literal each refuse, naming
 *   the cause. A declaration fault is named even when the run also owns no
 *   selected source: the fault is the cause the author must fix first. An owner whose tests fail, and a Vitest config with
 *   `test.projects`, are runtime refusals, so here they must not refuse.
 * - **Rune placement.** Instrumenting a source does not change whether it
 *   compiles. In a Svelte module, every rune call stays where Svelte allows
 *   it: `$state` and `$derived` (and `.raw`, `.by`) as a variable's
 *   initializer, `$effect` (and `.pre`) as a statement. The judge is
 *   Svelte's placement rule (the compiler's `state_invalid_placement` and
 *   `effect_invalid_placement` errors), restated over the instrumented text.
 * - **Enumeration.** The mutant set is the model's: each site by its source,
 *   function, line, operator, and order on the line.
 * - **Probe-only code.** Each mutant is marked as probe code exactly when the
 *   model says its site is probe-only code.
 * - **Ownership.** A mutant's function has an owner exactly when the model
 *   says it is not `unowned`.
 * - **Keys.** Each mutant's key is the model's anchor.
 * - **Selected keys.** A run that selects mutants (`--only`, `--sample`)
 *   keys each selected mutant as the full run does: keys are numbered over
 *   the whole mutant list before any selection, so a partial run and a full
 *   run agree on every key they share.
 * - **Help.** `index.mjs --help` prints the usage text (args.mjs) for any
 *   package directory, with no `--package`, and exits 0.
 * - **Report-shaped ending** (law 11 of the end-to-end oracle, stated in
 *   gap-report-model-oracle.mjs). Bad arguments refuse the run through the
 *   real CLI, with or without `--daemon`: it exits 2 and prints a
 *   `refused:` block that names the bad option or path and a `fix:` line
 *   that offers no way around the fix, with no stack frames.
 * - **Key stability.** After the history's stability edit, every mutant
 *   that existed before keeps its key, its probe mark, and its ownership.
 *
 * Authority: as for the end-to-end oracle (the maintainer's gap-check
 * decisions in design runs v11, v14, and v19). The split itself follows the
 * frozen design's plan for the checker's oracle (v19 P10, F4: an oracle over
 * the checker's pure core, beside its process shell) and the maintainer's
 * budget of a few seconds for an incremental test run (2026-11-05).
 *
 * Each `--source` path comes from the history in one of its spellings
 * (`src/x.ts`, `./src/x.ts`, `src/../src/x.ts`, an absolute path through a
 * symbolic link to the package, and, only where the filesystem ignores
 * letter case, `src/X.ts`; a source may sit under `..gen/`, a directory of
 * the package whose name starts with `..`) through the CLI's own
 * argument parser, and the model names every source by its path in the
 * package whatever the spelling. Beside the end-to-end grammar, the witness
 * module here also holds functions that share a name in one file (a class
 * method and an object-literal method named alike, two nested helpers named
 * alike), a getter and setter pair, and a class-field arrow, and the
 * history may hold a Svelte module of rune statements (`src/state.svelte.ts`)
 * and a library call to a function named `$derived`, which outside Svelte is
 * an ordinary name.
 *
 * Limits: the grammar and model are the end-to-end oracle's
 * (gap-report-model-oracle.mjs), with its limits. Whether a mutant is
 * killed, and anything else that needs a test run, is the end-to-end
 * oracle's. A function defined inside an owned function is owned with it,
 * called or not (`w_dead`, `w_closure`; maintainer decision, 2026-11-08).
 * The same-line witness `w_pair` is unowned and judges names only. No test
 * calls the same-named functions, accessors, or field
 * arrows, so their outcomes beyond ownership are not judged. The rune
 * judge restates Svelte's rule; the Svelte compiler itself is not installed
 * here, so a rune placement the rule does not name (`$props`, `$bindable`,
 * `$inspect`, a class field's rune, a rune in a `.svelte` component) is not
 * generated. An owns entry that names two functions of one name owns both,
 * but only the getter and setter pair is generated as such an entry's
 * target. An authored mutant's `source` field is used as written.
 */
import {
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { declareOracle } from '../src/oracle-declaration.ts'
import { oracleProperty, pass, violation } from '../src/oracle-property.ts'
import { analyze, isRunnerCopy } from './analysis.mjs'
import {
  DERIVED,
  DERIVED_INPUTS,
  LIB,
  RUNES,
  SOURCE,
  derivedExpected,
  edited,
  endingOf,
  fixtureFiles,
  histories,
  interpret,
  model,
  ownersOf,
  probeHelpers,
  refusalBreach,
  resolveHistory,
  removePath,
  sourceArgument,
  caseless,
  writeFixture,
  written,
} from './gap-report-model-oracle.mjs'
import { parseArgs, usage } from './args.mjs'
import { keyAndSelect } from './report.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(here, `../package.json`))(`typescript`)

// ## Production driver
//
// The driver writes the fixture as the end-to-end driver does, lists the
// test files the fixture's Vitest config includes (`tests/**/*.test.ts`)
// less the runner copies, as the CLI's discovery does (`isRunnerCopy`; the
// end-to-end oracle checks that discovery), reads the source files from a
// `--source` argument in the history's spelling as the CLI does
// (`parseArgs`), and calls `analyze` and `keyAndSelect`. It records a
// refusal's message, or each mutant's site, probe mark, ownership, and key,
// and the instrumented text of the Svelte module, if there is one. For a
// stability history it rewrites the source and records the same again.
function analyzeFixture(dir, files, plan) {
  writeFixture(dir, files)
  const tests = readdirSync(join(dir, `tests`))
    .filter((name) => name.endsWith(`.test.ts`) && !isRunnerCopy(name))
    .map((name) => join(dir, `tests`, name))
  // `--help` names no package; the CLI itself must print the usage text.
  const help = helpOf(dir)
  try {
    const { sources } = parseArgs(
      [`--package`, dir, `--source`, sourceArgument(plan, `${dir}.link`)],
      dir,
    )
    const outputs = defaultOutputsOf(dir, sources)
    const { mutants, owned, instrumented } = analyze(ts, dir, sources, tests)
    // A run's keys come from the whole mutant list, whatever its selection
    // (--only, --sample). The full run's keys are the reference, read before
    // any selection runs; a selected run must key each mutant it selects the
    // same way.
    const full = keyAndSelect(mutants, { sources }).map((m) => ({
      id: m.id,
      source: m.source,
      function: m.function,
      line: m.line,
      operator: m.operator,
      probe: m.probeGuard === true,
      owned: owned.at(m.source, m.position).owners.size > 0,
      key: m.key,
    }))
    const only = new Set(mutants.filter((_, i) => i % 2 === 0).map((m) => m.id))
    const keyed = (selected) => selected.map((m) => ({ id: m.id, key: m.key }))
    return {
      outputs,
      help,
      selection: {
        only: keyed(keyAndSelect(mutants, { only, sources })),
        sample: keyed(keyAndSelect(mutants, { sample: 1, sources })),
      },
      mutants: full,
      runes: plan.runesSource
        ? instrumented.get(realpathSync(join(dir, RUNES)))
        : undefined,
      derived: plan.derived
        ? {
            code: instrumented.get(realpathSync(join(dir, DERIVED))),
            numbers: mutants
              .filter((m) => m.source === DERIVED)
              .map((m) => m.number),
          }
        : undefined,
    }
  } catch (error) {
    return { help, refusal: String(error?.message ?? error) }
  }
}

// The default output of three runs, two of this package and one of another
// package (a sibling, made for the run). The driver records relations, not
// the paths: whether each output is a directory under its own package's
// state, and which pairs of outputs are the same directory.
function defaultOutputsOf(dir, sources) {
  const other = realpathSync(mkdtempSync(join(here, `.scratch-`)))
  try {
    const run = (pkg) =>
      parseArgs([`--package`, pkg, `--source`, sources.join(`,`)], pkg).out
    const home = (pkg) => join(pkg, `.oracle-gaps`, `out`) + sep
    const outs = [run(dir), run(dir), run(other)]
    const homes = [home(dir), home(dir), home(other)]
    return {
      contained: outs.map((out, i) => out.startsWith(homes[i])),
      // Pairs: the two runs of one package, then each with the other package.
      same: [outs[0] === outs[1], outs[0] === outs[2], outs[1] === outs[2]],
    }
  } finally {
    rmSync(other, { recursive: true, force: true })
  }
}

// Each run's default output is a directory of its own under its package's
// state, so runs of one package and of two packages never collide.
function outputNamespace({ contained, same }) {
  if (!contained.every(Boolean))
    return violation(
      `static`,
      `a run's default output is not a directory under its package's .oracle-gaps/out`,
      `output namespace`,
    )
  if (same.some(Boolean))
    return violation(
      `static`,
      `two runs share one default output directory`,
      `output namespace`,
    )
  return undefined
}

/** What `index.mjs --help` prints when run in a directory, and its status. */
function helpOf(dir) {
  const run = spawnSync(process.execPath, [join(here, `index.mjs`), `--help`], {
    cwd: dir,
    encoding: `utf8`,
  })
  return { status: run.status, printed: run.stdout.trimEnd() }
}

// ## Argument refusals (law 11)
//
// The CLI's arguments are its documented interface (the usage text in
// args.mjs): `--package <dir>` and `--source <src/x.ts,...>` are required,
// each source lies inside the package, `--env-prefix` names an environment
// variable prefix, `--seed` is an integer (the framework's `${prefix}_SEED`
// rule), the counts and limits (`--contexts`, `--sample`, `--test-timeout`,
// `--hang-limit`, `--first-limit`) are positive integers, `--pool` is
// `threads` or `forks`, `--mutants` names a directory that exists, an option
// that takes a value has one, and no other option exists. Arguments that break one of these refuse the run (law 11,
// gap-report-model-oracle.mjs), and the cause names what the author wrote
// wrong: the option, or the path. Each history carries one such fault, made
// from its own fixture's valid arguments, and the driver runs the real CLI
// (index.mjs) with it, with `--daemon` or without: a daemon run parses its
// arguments in the CLI before it sends them, so both refuse alike. The
// arguments name no output directory the run could have used, so the law
// judges the block alone.
const countOptions = [
  `--contexts`,
  `--sample`,
  `--test-timeout`,
  `--hang-limit`,
  `--first-limit`,
]
const argumentKinds = [
  `noPackage`,
  `missingPackage`,
  `noSource`,
  `envPrefix`,
  `outsideSource`,
  `seed`,
  `count`,
  `pool`,
  `noValue`,
  `unknown`,
  `missingMutants`,
]
const argumentStates = [
  ...argumentKinds.map((kind) => `refused arguments: ${kind}`),
  `refused arguments through --daemon`,
]
const badArguments = fc.record({
  kind: fc.constantFrom(...argumentKinds),
  option: fc.constantFrom(...countOptions),
  value: fc.constantFrom(`0`, `-3`, `1.5`, `x`, ``),
  daemon: fc.boolean(),
})
// Each history of the shared grammar, with its argument fault.
const argumentHistories = fc.tuple(histories, badArguments).map(
  ([history, bad]) => ({ ...history, badArguments: bad }),
  (value) => {
    const { badArguments: bad, ...history } = value
    return [history, bad]
  },
)
// The model: each fault's arguments, built from the fixture's valid ones
// (`--package <dir> --source <sources>`), and what its cause must name.
function argumentFault(bad, dir, sources) {
  const valid = [`--package`, dir, `--source`, sources]
  const fault = {
    noPackage: [[`--source`, sources], `--package`],
    missingPackage: [
      [`--package`, join(dir, `missing`), `--source`, sources],
      `missing`,
    ],
    noSource: [[`--package`, dir], `--source`],
    envPrefix: [[...valid, `--env-prefix`, `1-x`], `--env-prefix`],
    outsideSource: [
      [`--package`, dir, `--source`, `../outside.ts`],
      `outside the package`,
    ],
    seed: [
      [...valid, `--seed`, bad.value === `` ? `` : `x${bad.value}`],
      `--seed`,
    ],
    count: [[...valid, bad.option, bad.value], bad.option],
    pool: [[...valid, `--pool`, `fibers`], `--pool`],
    // An option that takes a value, given last with none.
    noValue: [[...valid, bad.option], bad.option],
    unknown: [[...valid, `--sources`, sources], `--sources`],
    missingMutants: [
      [...valid, `--mutants`, join(dir, `no-mutants`)],
      `--mutants`,
    ],
  }[bad.kind]
  return {
    argv: [...(bad.daemon ? [`--daemon`] : []), ...fault[0]],
    cause: fault[1],
  }
}

/** How the real CLI ends on a history's bad arguments, run in its package. */
function argumentsRunOf(dir, plan) {
  const { argv } = argumentFault(
    plan.history.badArguments,
    dir,
    sourceArgument(plan, `${dir}.link`),
  )
  const run = spawnSync(process.execPath, [join(here, `index.mjs`), ...argv], {
    cwd: dir,
    encoding: `utf8`,
    timeout: 120_000,
  })
  return endingOf(run.status, run.stderr, undefined, (text) =>
    text.replaceAll(dir, `<package>`),
  )
}

// ## The derived class, run
//
// The derived file's text runs as a CommonJS module, first as written and then
// instrumented, for each input, and under each of the instrumented copy's
// mutants. A run uses the switch the instrumented copy calls: `m` is true for
// the active mutant's site, and each forced form (`cmp`, `not`, `b`, `cond`)
// takes the mutant's rewrite. This restates the switch's contract, the one
// schemata.mjs states per operator. A run returns what the constructor pushed,
// the fields it set, or the error it threw.
const opposite = {
  '<': '<=',
  '<=': '<',
  '>': '>=',
  '>=': '>',
  '===': '!==',
  '!==': '===',
}
const holdsFor = (a, op, b) =>
  op === '<'
    ? a < b
    : op === '<='
      ? a <= b
      : op === '>'
        ? a > b
        : op === '>='
          ? a >= b
          : op === '==='
            ? a === b
            : a !== b
function switchFor(active) {
  return {
    m: (id) => id === active,
    v: (value) => value,
    cmp: (id, a, b, op) => holdsFor(a, id === active ? opposite[op] : op, b),
    not: (id, value) => (id === active ? value : !value),
    b: (id, value) => (id === active ? !value : value),
    cond: (ifTrue, ifFalse, value) =>
      active === ifTrue ? true : active === ifFalse ? false : value,
  }
}
function runDerived(ts, code, active, x) {
  const js = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText
  const exported = {}
  const previous = globalThis.__oracleGaps
  globalThis.__oracleGaps = switchFor(active)
  try {
    new Function(`exports`, js)(exported)
    const out = []
    const made = exported.derivedMake(x, out)
    return { labels: out, tag: made.tag, n: made.n, count: made.count }
  } catch (error) {
    // A derived constructor that reads `this` before `super`, or returns
    // without it, throws a ReferenceError: that is the run's outcome. Any
    // other error is the harness's, and is not a result.
    if (!(error instanceof ReferenceError)) throw error
    return { error: error.message }
  } finally {
    globalThis.__oracleGaps = previous
  }
}
// The form of the instrumented copy's super call, read from its syntax:
// `and` and `or` for a logical operand, `arrow` for a call inside an arrow,
// and `plain` for a statement.
function superFormOf(ts, code) {
  const file = ts.createSourceFile(
    `derived.ts`,
    code,
    ts.ScriptTarget.Latest,
    true,
  )
  let form
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.SuperKeyword
    ) {
      const { parent } = node
      if (ts.isBinaryExpression(parent))
        form =
          parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
            ? `and`
            : `or`
      else if (ts.isArrowFunction(parent)) form = `arrow`
      else form ??= `plain`
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return form
}
function observeDerived(ts, source, code, numbers) {
  const runs = (text, active) =>
    DERIVED_INPUTS.map((x) => runDerived(ts, text, active, x))
  return {
    source: runs(source, null),
    instrumented: runs(code, null),
    form: superFormOf(ts, code),
    mutants: numbers.map((number) => ({ number, runs: runs(code, number) })),
  }
}
// The derived class's reach states, read from its observed runs: what the
// source's runs pushed and set, and the form its instrumented copy keeps.
const derivedStates = {
  constructed: `a derived class constructed`,
  property: `a derived class with a parameter property`,
  plain: `a derived class with a plain parameter`,
  field: `a derived class with a field initializer`,
  early: `a derived class returned early before super`,
  before: `a derived class ran a push before super`,
  conditionalBefore: `a derived class ran a conditional push before super`,
  after: `a derived class ran a push after super`,
  conditionalAfter: `a derived class ran a conditional push after super`,
  tag: `a derived class read this after super`,
  formPlain: `a derived class calls super as a statement`,
  arrow: `a derived class calls super in an arrow`,
  and: `a derived class calls super after &&`,
  or: `a derived class calls super after ||`,
}
function derivedReach(observed) {
  const runs = observed.source
  const labels = runs.flatMap((run) => run.labels ?? [])
  const states = new Set()
  if (runs.every((run) => run.error === undefined))
    states.add(derivedStates.constructed)
  if (runs.some((run) => run.n !== undefined))
    states.add(derivedStates.property)
  if (runs.some((run) => run.tag !== undefined && run.n === undefined))
    states.add(derivedStates.plain)
  if (runs.some((run) => run.count !== undefined))
    states.add(derivedStates.field)
  if (runs.some((run) => run.tag === undefined && run.error === undefined))
    states.add(derivedStates.early)
  if (labels.some((label) => /^b\d/.test(label)))
    states.add(derivedStates.before)
  if (labels.some((label) => /^c\d/.test(label)))
    states.add(derivedStates.conditionalBefore)
  if (labels.some((label) => /^a\d/.test(label)))
    states.add(derivedStates.after)
  if (labels.some((label) => /^d\d/.test(label)))
    states.add(derivedStates.conditionalAfter)
  if (labels.includes(`a`)) states.add(derivedStates.tag)
  const form = {
    plain: derivedStates.formPlain,
    arrow: derivedStates.arrow,
    and: derivedStates.and,
    or: derivedStates.or,
  }[observed.form]
  if (form) states.add(form)
  return states
}

const ownedStates = {
  w_leaf: `owned through a call chain`,
  'W0.step': `method owned through this`,
  wg0: `owned across files`,
  wg1: `owned through an aliased import`,
  w_valued: `owned through a value`,
  'W3.run': `owned through a field`,
  'W5.step': `owned through bind`,
  'W7.constructor': `constructor owned through new`,
  'W6.step': `a class passed as a value brings its methods`,
  w_overloaded: `overloaded function owned`,
}
// Functions that share a name, accessors, and a class-field arrow, by the
// model's own id, which the driver finds from the mutant's line. Each says
// whether its mutants must be owned to reach the state.
const namedStates = {
  'W8.run': [true, `a class method beside a same-named literal method owned`],
  'W8.other>run': [
    false,
    `a literal method named like a class method kept apart`,
  ],
  'w_nest0>next': [true, `a nested helper owned through its caller`],
  'w_nest1>next': [false, `a same-named nested helper kept apart`],
  'W9.status#get': [true, `a getter owned through a property read`],
  'W9.status#set': [true, `a setter owned through a property read`],
  'W9.handle': [true, `a class-field arrow owned through this`],
  'W10.#helper': [true, `a private method owned through this`],
  'w_dead>unused': [
    true,
    `an uncalled function inside an owned function owned`,
  ],
  'w_closure>later': [
    true,
    `a returned function inside an owned function owned`,
  ],
  'W10.#named': [true, `a private method named in an owns entry`],
}

async function driver(plan, observe) {
  const dir = realpathSync(mkdtempSync(join(here, `.scratch-`)))
  try {
    // A symbolic link to the package, for sources spelled through it.
    symlinkSync(dir, `${dir}.link`, `dir`)
    const files = fixtureFiles(plan)
    const before = analyzeFixture(dir, files, plan)
    observe(`static`, before)
    const derived = before.derived
      ? observeDerived(
          ts,
          plan.derived.source,
          before.derived.code,
          before.derived.numbers,
        )
      : undefined
    if (derived) observe(`derived`, derived)
    const states = new Set(derived ? derivedReach(derived) : [])
    const bad = plan.history.badArguments
    const argumentsRun = argumentsRunOf(dir, plan)
    observe(`arguments`, argumentsRun)
    if (argumentsRun.exit !== 0) {
      states.add(`refused arguments: ${bad.kind}`)
      if (bad.daemon) states.add(`refused arguments through --daemon`)
    }
    if (before.refusal && faults.includes(plan.fault))
      states.add(`refused ${plan.fault}`)
    if (before.refusal && plan.declaration === `neither`)
      states.add(`refused without an oracle file`)
    // A bad entry in a run that owns no selected source: two refusals apply,
    // and the declaration's own fault is the one to name, since fixing it is
    // what the author must do first.
    if (
      before.refusal &&
      plan.fault === `badEntry` &&
      plan.wholeFile === `none` &&
      plan.functions.every((fn) => fn.owners.length === 0)
    )
      states.add(`refused badEntry with no owner`)
    // A runtime fault does not refuse here, so a refusal in its run is the
    // run's lack of an owner.
    if (
      before.refusal &&
      !faults.includes(plan.fault) &&
      plan.declaration !== `neither`
    )
      states.add(`refused without an owner`)
    if (!before.refusal && plan.declaration === `oracleProperty`)
      states.add(`owns read from oracleProperty`)
    if (!before.refusal && plan.declaration === `both`)
      states.add(`owns read from both declarations`)
    // The statement whose lines hold a mutant, by the model's layout.
    const statementAt = (m) =>
      plan.functions
        .flatMap((fn) => fn.body.map((stmt) => ({ fn, stmt })))
        .find(
          ({ fn, stmt }) =>
            fn.file === m.source &&
            stmt.line <= m.line &&
            m.line < stmt.line + stmt.lines.length,
        )
    const nearStates = {
      former: `a former-form probe judged`,
      name: `a guard under another name judged`,
      let: `a let guard judged`,
      init: `a guard of another initializer judged`,
      outer: `a probe under an outer function's guard judged`,
    }
    for (const m of before.mutants ?? []) {
      const at = statementAt(m)
      if (at?.stmt.kind === `nearProbe` && !m.probe)
        states.add(nearStates[at.stmt.variant])
      if (
        m.probe &&
        plan.functions.some(
          (fn) => fn.file === m.source && fn.guardLine === m.line,
        )
      )
        states.add(`a probe guard declaration left out`)
      if (m.probe) {
        if (m.function === `w_probeonly`) states.add(`derived probe helper`)
        if (m.function === `w_callschain`)
          states.add(`derived probe helper chain`)
        continue
      }
      if (m.owned && ownedStates[m.function])
        states.add(ownedStates[m.function])
      if (!m.owned) states.add(`unowned`)
      if (m.function === `W4.step` && !m.owned)
        states.add(`a constructed class brings only what is referenced`)
      if (m.source === LIB && !m.owned) states.add(`unowned in another file`)
      if (m.function === `reportAndPush`) states.add(`mixed helper judged`)
      const generated = plan.functions.find(
        (fn) => fn.generated && fn.id === m.function,
      )
      if (
        generated?.owners.length === 0 &&
        plan.wholeFile !== `none` &&
        m.owned
      )
        states.add(`owned by a whole-file entry`)
      const [fnId, kind] =
        plan.functions
          .flatMap((fn) =>
            fn.body.map((s) => [`${fn.file}:${s.line}`, fn.id, s.kind]),
          )
          .find(([at]) => at === `${m.source}:${m.line}`)
          ?.slice(1) ?? []
      const named = namedStates[fnId]
      if (named && named[0] === m.owned) states.add(named[1])
      if (kind === `dollar`) states.add(`a $-named call outside Svelte judged`)
      if (m.function === `get` && m.line === statementAt(m)?.stmt.line)
        states.add(`the first of two functions on one line named`)
      if (m.function === `set` && m.line === statementAt(m)?.stmt.line)
        states.add(`the second of two functions on one line named`)
      if (m.function === `w_shadow` && !m.probe && m.operator === `delete-call`)
        states.add(
          `a call to a nested function named like a probe helper judged`,
        )
      if (kind === `oldProbe`) states.add(`old probe form judged`)
      if (kind === `mixed` && m.operator === `if-true`)
        states.add(`production beside a probe`)
      if (kind === `elseIf` && m.operator === `if-true`)
        states.add(`production else judged`)
    }
    if (!before.refusal) {
      if (plan.sourceSpelling === `dot`) states.add(`a source spelled with ./`)
      if (plan.sourceSpelling === `redundant`)
        states.add(`a source spelled through a redundant segment`)
      if (plan.runesSource) states.add(`a Svelte module instrumented`)
      if (plan.sourceSpelling === `linked`)
        states.add(`a source spelled through a link to the package`)
      if (plan.ownsSpelling !== `plain`)
        states.add(`an owns entry spelled another way`)
      if (plan.dotGenSource) states.add(`a source under a ..-named directory`)
      if (plan.sourceSpelling === `cased`)
        states.add(`a source spelled in another letter case`)
    }
    if (plan.stability !== `none` && !before.refusal) {
      observe(
        `stability`,
        analyzeFixture(dir, { ...files, [SOURCE]: edited(plan) }, plan),
      )
      states.add(`stability rerun`)
    }
    for (const state of states) observe(`reach`, state)
  } finally {
    written.delete(dir)
    removePath(`${dir}.link`)
    rmSync(dir, { recursive: true, force: true })
  }
}

// ## Comparison
//
// Mutants are matched to the model's by source, function, line, operator,
// and order on the line, then each law is checked in turn.
const siteOf = (m) =>
  `${m.source}:${m.function}:${m.line}:${m.operator}#${m.ordinal}`
const withOrdinals = (mutants) => {
  const seen = new Map()
  return mutants.map((m) => {
    const at = `${m.source} ${m.line} ${m.operator}`
    const ordinal = seen.get(at) ?? 0
    seen.set(at, ordinal + 1)
    return { ...m, ordinal }
  })
}

// Svelte's placement rule for runes, the judge of the instrumented Svelte
// module: `$state` and `$derived` (and `.raw`, `.by`) only as a variable's
// initializer, `$effect` (and `.pre`) only as a statement. The compiler
// refuses any other place (`state_invalid_placement`,
// `effect_invalid_placement`), so a module whose instrumented text breaks
// the rule no longer compiles. Returns the rune calls and the misplaced
// ones, by their text.
function runePlacement(code) {
  const file = ts.createSourceFile(
    `state.svelte.ts`,
    code,
    ts.ScriptTarget.Latest,
    true,
  )
  const calls = []
  const misplaced = []
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(file)
      const initializer = /^\$(state|derived)(\.(raw|by))?$/.test(callee)
      const statement = /^\$effect(\.pre)?$/.test(callee)
      if (initializer || statement) {
        calls.push(callee)
        const placed = initializer
          ? ts.isVariableDeclaration(node.parent) &&
            node.parent.initializer === node
          : ts.isExpressionStatement(node.parent)
        if (!placed) misplaced.push(node.getText(file).slice(0, 80))
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return { calls, misplaced }
}

// The derived class's laws, in order. Its source runs as the model says; its
// instrumented copy with no mutant active runs as its source does; and under
// every mutant the constructor still completes, with its base class's tag,
// so no mutant has made `super(...)` conditional, removed it, or moved it.
function checkDerived(plan, observed) {
  if (!observed)
    return violation(`derived`, `the derived class was not run`, `completion`)
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const owed = DERIVED_INPUTS.map((x) => derivedExpected(plan.derived.spec, x))
  for (const [i, x] of DERIVED_INPUTS.entries())
    if (!same(observed.source[i], owed[i]))
      return violation(
        `derived`,
        `the source run for ${x} is ${JSON.stringify(observed.source[i])}, owed ${JSON.stringify(owed[i])}`,
        `source behavior`,
      )
  for (const [i, x] of DERIVED_INPUTS.entries())
    if (!same(observed.instrumented[i], observed.source[i]))
      return violation(
        `derived`,
        `with no mutant active, the instrumented class for ${x} is ${JSON.stringify(observed.instrumented[i])}, the source's ${JSON.stringify(observed.source[i])}`,
        `no-mutant behavior`,
        { actual: observed.instrumented[i], expected: observed.source[i] },
      )
  for (const mutant of observed.mutants)
    for (const [i, x] of DERIVED_INPUTS.entries()) {
      const run = mutant.runs[i]
      if (run.error !== undefined || run.tag !== owed[i].tag)
        return violation(
          `derived`,
          `under mutant ${mutant.number} the class for ${x} ${run.error ?? `has tag ${JSON.stringify(run.tag)}`}`,
          `super unconditional`,
        )
    }
  return undefined
}

function check(plan, observations, expected) {
  const got = observations.find((o) => o.checkpoint === `static`)?.value
  if (!got) return violation(`static`, `no analysis was observed`, `completion`)
  if (got.outputs) {
    const namespace = outputNamespace(got.outputs)
    if (namespace) return namespace
  }
  if (got.help?.status !== 0 || got.help?.printed !== usage.trimEnd())
    return violation(
      `static`,
      `--help exited ${got.help?.status} and printed ${JSON.stringify(got.help?.printed)}, not the usage text`,
      `help`,
    )
  // Law 11: the history's bad arguments refuse the run, naming their cause.
  const bad = plan.history.badArguments
  const argumentsRun = observations.find(
    (o) => o.checkpoint === `arguments`,
  )?.value
  if (!argumentsRun)
    return violation(
      `arguments`,
      `no run with bad arguments was observed`,
      `completion`,
    )
  const breach = refusalBreach(argumentsRun, {
    cause: argumentFault(bad, `<package>`, SOURCE).cause,
    outKnown: false,
  })
  if (breach)
    return violation(
      `arguments`,
      `with ${bad.kind} arguments${bad.daemon ? ` and --daemon` : ``}, ${breach}`,
      `report-shaped ending`,
    )
  // An owner that fails, and a config the runner cannot honor, are found
  // only when the runner starts, so the analysis must not refuse for them.
  const refused = expected.refused?.runtime ? undefined : expected.refused
  if (refused) {
    if (!got.refusal)
      return violation(
        `static`,
        `the analysis did not refuse ${refused.cause}`,
        `refusal`,
      )
    if (!got.refusal.includes(refused.cause))
      return violation(
        `static`,
        `the refusal does not name ${refused.cause}: ${got.refusal}`,
        `refusal`,
      )
    return pass
  }
  if (got.refusal)
    return violation(
      `static`,
      `the analysis refused: ${got.refusal}`,
      `refusal`,
    )
  if (plan.runesSource) {
    // Every rune statement of the module holds exactly one rune call.
    const owed = plan.functions
      .filter((fn) => fn.file === RUNES)
      .flatMap((fn) => fn.body).length
    const { calls, misplaced } = runePlacement(got.runes ?? ``)
    if (calls.length !== owed || misplaced.length > 0)
      return violation(
        `static`,
        `the instrumented Svelte module ${misplaced.length > 0 ? `moves a rune from its place: ${misplaced[0]}` : `has ${calls.length} rune calls, owed ${owed}`}`,
        `rune placement`,
      )
  }
  if (plan.derived) {
    const observed = observations.find((o) => o.checkpoint === `derived`)?.value
    const broken = checkDerived(plan, observed)
    if (broken) return broken
  }
  const owedMutants = expected.refused?.runtime
    ? model({ ...plan, fault: `none` }).mutants
    : expected.mutants
  const actual = withOrdinals(got.mutants)
  if (
    actual.map(siteOf).sort().join() !== owedMutants.map(siteOf).sort().join()
  )
    return violation(`static`, `the mutant set differs`, `enumeration`, {
      actual: actual.map(siteOf).sort(),
      expected: owedMutants.map(siteOf).sort(),
    })
  const pairs = owedMutants.map((m) => [
    m,
    actual.find((a) => siteOf(a) === siteOf(m)),
  ])
  for (const [owed, m] of pairs)
    if (owed.probe !== m.probe)
      return violation(
        `static`,
        `${siteOf(m)}: probe code is ${m.probe}, owed ${owed.probe}`,
        `probe-only code`,
      )
  for (const [owed, m] of pairs)
    if (!owed.probe && m.owned !== (owed.kind !== `unowned`))
      return violation(
        `static`,
        `${siteOf(m)}: ${m.owned ? `owned` : `unowned`}, owed ${owed.kind === `unowned` ? `unowned` : `owned`}`,
        `ownership`,
      )
  for (const [owed, m] of pairs)
    if (m.key !== owed.key)
      return violation(
        `static`,
        `${siteOf(m)}: key ${JSON.stringify(m.key)}, owed ${JSON.stringify(owed.key)}`,
        `keys`,
      )
  // A selected run's keys are the full run's, for each mutant it selects.
  for (const run of Object.values(got.selection ?? {}))
    for (const selected of run) {
      const full = got.mutants.find((m) => m.id === selected.id)
      if (full?.key !== selected.key)
        return violation(
          `static`,
          `${selected.id}: key ${JSON.stringify(selected.key)} in a selected run, ${JSON.stringify(full?.key)} in the full run`,
          `selection keys`,
        )
    }
  const moved = observations.find((o) => o.checkpoint === `stability`)?.value
  if (moved) {
    if (moved.refusal)
      return violation(
        `stability`,
        `the edited source was refused: ${moved.refusal}`,
        `key stability`,
      )
    const describe = (m) => `${m.key} ${m.probe} ${m.owned}`
    const keys = new Set(got.mutants.map((m) => m.key))
    const before = got.mutants.map(describe).sort()
    const after = moved.mutants
      .filter((m) => keys.has(m.key))
      .map(describe)
      .sort()
    if (before.join(`\n`) !== after.join(`\n`))
      return violation(
        `stability`,
        `the ${plan.stability} edit changed existing keys, probe marks, or ownership`,
        `key stability`,
        { actual: after, expected: before },
      )
  }
  return pass
}

declareOracle({
  check: [check, refusalBreach],
  model: [model, interpret, ownersOf, probeHelpers, argumentFault],
  grammar: [histories, argumentHistories],
})

// ## Calibrations
//
// Each hands the check a wrong analysis.
const corrupt = (checkpoint, change) => (trace) => {
  const index = trace.findIndex((o) => o.checkpoint === checkpoint)
  if (index < 0 || !trace[index].value.mutants?.length) return undefined
  const value = structuredClone(trace[index].value)
  if (change(value) === false) return undefined
  return trace.map((o, i) => (i === index ? { ...o, value } : o))
}
// A wrong ending of the run with bad arguments: the ways a CLI that crashes,
// or half-reports a refusal, would end.
const corruptArguments = (change) => (trace) => {
  const index = trace.findIndex((o) => o.checkpoint === `arguments`)
  if (index < 0) return undefined
  const value = { ...trace[index].value, ...change(trace[index].value) }
  return trace.map((o, i) => (i === index ? { ...o, value } : o))
}
const calibrations = [
  {
    name: `a refusal prints a stack trace, as a crash does`,
    law: `report-shaped ending`,
    corrupt: corruptArguments(() => ({ stackFrames: true })),
  },
  {
    name: `a refusal exits 1, as a crash does`,
    law: `report-shaped ending`,
    corrupt: corruptArguments(() => ({ exit: 1 })),
  },
  {
    name: `a refusal gives no fix`,
    law: `report-shaped ending`,
    corrupt: corruptArguments(() => ({ fix: undefined, cause: undefined })),
  },
  {
    name: `a refusal's fix offers a way around it`,
    law: `report-shaped ending`,
    corrupt: corruptArguments((v) => ({
      fix: `${v.fix} Or mark the mutant equivalent.`,
    })),
  },
  {
    name: `a refusal names another cause`,
    law: `report-shaped ending`,
    corrupt: corruptArguments(() => ({ cause: `something went wrong` })),
  },
  {
    name: `a rune is moved from its place`,
    law: `rune placement`,
    corrupt: corrupt(`static`, (v) => {
      if (!v.runes?.includes(`= $`)) return false
      v.runes = v.runes.replace(`= $`, `= void 0 || $`)
    }),
  },
  {
    name: `a mutant is dropped`,
    law: `enumeration`,
    corrupt: corrupt(`static`, (v) => void v.mutants.shift()),
  },
  {
    name: `production code is marked as probe code`,
    law: `probe-only code`,
    corrupt: corrupt(`static`, (v) => {
      const m = v.mutants.find((x) => !x.probe)
      if (!m) return false
      m.probe = true
    }),
  },
  {
    name: `an owned mutant is reported unowned`,
    law: `ownership`,
    corrupt: corrupt(`static`, (v) => {
      const m = v.mutants.find((x) => !x.probe && x.owned)
      if (!m) return false
      m.owned = false
    }),
  },
  {
    name: `a derived class's super call is made conditional`,
    law: `super unconditional`,
    corrupt: corrupt(`derived`, (v) => {
      const run = v.mutants[0]?.runs[0]
      if (!run) return false
      v.mutants[0].runs[0] = {
        error: `Must call super constructor in derived class before accessing 'this'`,
      }
    }),
  },
  {
    name: `the instrumented derived class differs with no mutant active`,
    law: `no-mutant behavior`,
    corrupt: corrupt(`derived`, (v) => {
      v.instrumented[0] = { error: `Must call super constructor` }
    }),
  },
  {
    name: `a key drops its statement`,
    law: `keys`,
    corrupt: corrupt(`static`, (v) => {
      v.mutants[0].key = v.mutants[0].key.slice(
        0,
        v.mutants[0].key.lastIndexOf(`:`),
      )
    }),
  },
  {
    name: `an edit moves a key`,
    law: `key stability`,
    corrupt: (trace) => {
      const before = trace.find((o) => o.checkpoint === `static`)?.value
      const keys = new Set(before?.mutants?.map((m) => m.key) ?? [])
      return corrupt(`stability`, (v) => {
        const m = v.mutants.find((x) => keys.has(x.key))
        if (!m) return false
        m.key = `${m.key}~moved`
      })(trace)
    },
  },
]

const faults = [`badEntry`, `missingSource`, `nonLiteral`, `outsideSource`]
// Each constructed history builds from a generated history whose declaration
// is `declareOracle` and whose first function is owned, the form the other
// histories use, unless it names its own: a refusing declaration or an
// ownerless run then reaches only the states that name it, and a run that
// owns nothing is not refused for a state it does not name.
const withDeclaration = (constructed) =>
  constructed.map((item) => ({
    ...item,
    build: (generated) =>
      item.build({
        ...generated,
        declaration: `declareOracle`,
        ownerless: false,
        owners: [`a`, ...generated.owners.slice(1)],
      }),
  }))
const required = [
  ...Object.values(ownedStates),
  ...Object.values(derivedStates),
  ...Object.values(namedStates).map(([, state]) => state),
  `a $-named call outside Svelte judged`,
  `a Svelte module instrumented`,
  `a probe guard declaration left out`,
  `a former-form probe judged`,
  `a guard under another name judged`,
  `a let guard judged`,
  `a guard of another initializer judged`,
  `a probe under an outer function's guard judged`,
  `a source spelled with ./`,
  `a source spelled through a redundant segment`,
  `a source spelled through a link to the package`,
  `an owns entry spelled another way`,
  `a source under a ..-named directory`,
  // Only where the filesystem ignores letter case.
  ...(caseless ? [`a source spelled in another letter case`] : []),
  `the first of two functions on one line named`,
  `the second of two functions on one line named`,
  `a call to a nested function named like a probe helper judged`,
  `derived probe helper`,
  `derived probe helper chain`,
  `mixed helper judged`,
  `unowned`,
  `a constructed class brings only what is referenced`,
  `unowned in another file`,
  `owned by a whole-file entry`,
  `old probe form judged`,
  `production beside a probe`,
  `production else judged`,
  `stability rerun`,
  ...faults.map((fault) => `refused ${fault}`),
  `owns read from oracleProperty`,
  `owns read from both declarations`,
  `refused without an oracle file`,
  `refused without an owner`,
  `refused badEntry with no owner`,
  ...argumentStates,
]

oracleProperty({
  id: `oracle-gaps.report-static`,
  law: {
    statement: `The gap report's static half keeps every Svelte rune where Svelte allows it, gives each run's default output a directory of its own under its package's state, so runs of one package and of two packages never collide, enumerates the promised operator mutants, marks exactly the probe-only code, refuses broken owns declarations, gives each function the owners whose call trees contain it, anchors each mutant's key, keeps keys, probe marks, and ownership stable under unrelated edits, and keeps each derived class's \`super(...)\` call unconditional. In a derived constructor, no mutant site lies before the first statement that calls super or inside that statement (an arrow inherits super, so an arrow's call counts), and statements after it keep their sites. So no mutant, when active, prevents or delays the super call. With no mutant active the instrumented class behaves as its source does, and under every mutant the constructor completes with its base class's tag unless an early return ends it first. Bad arguments (a missing --package or --source, a --package that does not exist, a source outside the package, a bad --env-prefix, --seed, count, or limit, an unknown --pool, a --mutants directory that does not exist, an option with no value, an unknown option) refuse the real CLI, cold or with --daemon, with exit 2 and a refused: block that names the cause, then one fix: directive that offers no way around the fix, and no stack trace.`,
    authority: `The maintainer's gap-check decisions in design runs v11, v14, and v19 (2026-11-04 and 2026-11-05), as for oracle-gaps.report; the frozen design's plan for an oracle over the checker's pure core (v19 P10, F4); the maintainer's few-seconds budget for an incremental test run (2026-11-05); for rune placement, Svelte 5's placement rule for runes (state_invalid_placement, effect_invalid_placement) and the maintainer's report of svelte-db's useLiveQuery.svelte.ts failing to compile under instrumentation (2026-11-08); for derived classes, the gap report's contract that instrumentation with no mutant active does not change behavior and that a mutant is a legal program variant (the operator contract in schemata.mjs), ECMAScript's rule that a derived constructor calls \`super\` before it reads \`this\` and before it returns, the maintainer's report of TanStack DB's subscription.ts failing with no mutant active (G11, 2026-11-09), and the maintainer's decision of 2026-11-09 on the derived constructor's site region (every shape of super, including an early return before it, is covered by the one rule); for the report-shaped ending, the maintainer's decision of 2026-11-10 ("we should never just crash -- the cli should also return something sensible") and the usage text in args.mjs, the CLI's documented interface.`,
    limits: `The grammar and model of oracle-gaps.report, with its limits. Outcomes that need test runs, and the failing-owner refusal, belong to oracle-gaps.report. Same-named functions, accessors, and field arrows are judged for ownership only; runes only as $state, $state.raw, $derived, $derived.by, $effect, and $effect.pre in a .svelte.ts module, judged by a restatement of Svelte's placement rule rather than the compiler. A derived class is judged in this oracle's in-process run and in the end-to-end oracle's static half: the end-to-end oracle instruments its file and judges its sites as unowned, but no test imports or constructs the class, so no test runs it. The in-process run transpiles the file to CommonJS at ES2022; other downlevel targets and Vitest's own transform are not exercised. The mutant switch (switchFor) is a hand copy of the switch's contract in schemata.mjs, not the capture setup's runtime: the capture setup imports Vitest and installs timers and globals when it loads, so it cannot run in-process. The derived grammar has one derived class per history, with parameter properties, a field, statements before and after super, an early return before it, and the four forms of the super call (a statement, an arrow argument, and the right operand of \`&&\` or \`||\`). It has no super call in a method, a nested class, or a \`super.method()\` call, and no default parameter. The ending law is judged here only for argument refusals, one fault per history, whose arguments name no output directory; refusals from the analysis and the runner, their results.json and summary.md, and the daemon's own path are the end-to-end oracle's. No legal history reaches an internal error, so its shape (exit 3, the stack in error.log) is not judged; a calibration shows that the check rejects a stack trace on stderr.`,
  },
  histories: {
    arbitrary: argumentHistories,
    states: required,
    runs: 40,
    fixedSeeds: [20261105],
    constructed: withDeclaration([
      {
        name: `every static state`,
        enters: required.filter(
          (s) =>
            ![
              `owned by a whole-file entry`,
              `a source spelled through a redundant segment`,
              `a source spelled through a link to the package`,
              `a source spelled in another letter case`,
              // Each other form of the derived class is its own history's.
              derivedStates.plain,
              derivedStates.arrow,
              derivedStates.and,
              derivedStates.or,
              ...faults.map((f) => `refused ${f}`),
              `owns read from oracleProperty`,
              `owns read from both declarations`,
              `refused without an oracle file`,
              `refused without an owner`,
              `refused badEntry with no owner`,
              ...argumentStates,
            ].includes(s),
        ),
        build: (generated) => ({
          ...generated,
          witness: true,
          wholeFile: `none`,
          fault: `none`,
          stability: `insertGuard`,
          steps: null,
          sourceSpelling: `dot`,
          ownsSpelling: `dot`,
          dotGen: true,
          // A parameter property, a field, statements before `super(...)`
          // (a conditional push, and an early return), the plain form of
          // `super`, and statements after it: a push, `this` read, and a
          // conditional push.
          derived: {
            params: `property`,
            field: true,
            before: [
              { kind: `push` },
              { kind: `if`, op: `>`, k: 4 },
              { kind: `early`, op: `>`, k: 4 },
            ],
            form: `plain`,
            after: [
              { kind: `push` },
              { kind: `tag` },
              { kind: `if`, op: `<`, k: 5 },
            ],
          },
          // A library function that calls the library's `$derived`.
          library: [[{ kind: `dollar` }], ...generated.library].slice(0, 2),
          // Every rune form, in a Svelte module.
          runes: [
            [
              { kind: `runeState`, op: `>`, k: 4 },
              { kind: `runeStateRaw` },
              { kind: `runeDerived` },
              { kind: `runeDerivedBy` },
            ],
            [
              { kind: `runeEffect`, rune: `$effect` },
              { kind: `runeEffect`, rune: `$effect.pre` },
            ],
          ],
        }),
      },
      {
        name: `a whole-file owner`,
        enters: [
          `owned by a whole-file entry`,
          `a source spelled through a redundant segment`,
        ],
        build: (generated) => ({
          ...generated,
          functions: [
            [
              { kind: `push`, quote: `'` },
              ...generated.functions[0].slice(0, 4),
            ],
            ...generated.functions.slice(1),
          ],
          owners: [],
          wholeFile: `a`,
          witness: false,
          fault: `none`,
          stability: `none`,
          steps: null,
          sourceSpelling: `redundant`,
        }),
      },
      {
        name: `a plain-parameter derived class`,
        enters: [derivedStates.plain],
        build: (generated) => ({
          ...generated,
          witness: false,
          wholeFile: `none`,
          fault: `none`,
          stability: `none`,
          steps: null,
          derived: {
            params: `plain`,
            field: false,
            before: [],
            form: `plain`,
            after: [{ kind: `push` }],
          },
        }),
      },
      // Each form of `super(...)` that is not a statement, with the
      // statements around it: the arrow argument, and each logical operand.
      ...[`arrow`, `and`, `or`].map((form) => ({
        name: `a derived class calling super ${form === `arrow` ? `in an arrow` : form === `and` ? `after &&` : `after ||`}`,
        enters: [derivedStates[form]],
        build: (generated) => ({
          ...generated,
          witness: false,
          wholeFile: `none`,
          fault: `none`,
          stability: `none`,
          steps: null,
          derived: {
            params: `plain`,
            field: false,
            before: [],
            form,
            after: [{ kind: `push` }],
          },
        }),
      })),
      ...(caseless
        ? [
            {
              name: `a source in another letter case`,
              enters: [`a source spelled in another letter case`],
              build: (generated) => ({
                ...generated,
                sourceSpelling: `cased`,
                witness: false,
                fault: `none`,
                steps: null,
              }),
            },
          ]
        : []),
      {
        name: `a source through a link to the package`,
        enters: [`a source spelled through a link to the package`],
        build: (generated) => ({
          ...generated,
          sourceSpelling: `linked`,
          witness: false,
          fault: `none`,
          steps: null,
        }),
      },
      ...faults.map((fault) => ({
        name: `a declaration fault: ${fault}`,
        enters: [`refused ${fault}`],
        build: (generated) => ({ ...generated, fault, steps: null }),
      })),
      {
        name: `owns read from oracleProperty`,
        enters: [`owns read from oracleProperty`],
        build: (generated) => ({
          ...generated,
          declaration: `oracleProperty`,
          fault: `none`,
          steps: null,
        }),
      },
      {
        name: `owns read from both declarations`,
        enters: [`owns read from both declarations`],
        build: (generated) => ({
          ...generated,
          declaration: `both`,
          fault: `none`,
          steps: null,
        }),
      },
      {
        name: `no oracle file refuses the run`,
        enters: [`refused without an oracle file`],
        build: (generated) => ({
          ...generated,
          declaration: `neither`,
          fault: `none`,
          steps: null,
        }),
      },
      {
        name: `no owns entry refuses the run`,
        enters: [`refused without an owner`],
        build: (generated) => ({
          ...generated,
          declaration: `declareOracle`,
          fault: `none`,
          ownerless: true,
          wholeFile: `none`,
          steps: null,
        }),
      },
      // Each argument fault, every other one through --daemon.
      ...argumentKinds.map((kind, i) => ({
        name: `bad arguments: ${kind}`,
        enters: [
          `refused arguments: ${kind}`,
          ...(i % 2 === 1 ? [`refused arguments through --daemon`] : []),
        ],
        build: (generated) => ({
          ...generated,
          badArguments: {
            ...generated.badArguments,
            kind,
            daemon: i % 2 === 1,
          },
          steps: null,
        }),
      })),
      {
        name: `a bad entry in a run with no owner names the bad entry`,
        enters: [`refused badEntry with no owner`],
        build: (generated) => ({
          ...generated,
          declaration: `declareOracle`,
          fault: `badEntry`,
          ownerless: true,
          wholeFile: `none`,
          steps: null,
        }),
      },
    ]),
  },
  resolve: resolveHistory,
  model,
  driver,
  check,
  calibrations,
  timeout: 120_000,
})
