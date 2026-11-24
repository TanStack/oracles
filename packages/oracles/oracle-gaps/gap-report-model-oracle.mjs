/**
 * The gap report oracles' shared history grammar, fixture rendering, and
 * model (see gap-report-oracle.property.test.mjs for the laws). The static
 * oracle runs the CLI's static half in-process on these fixtures; the
 * end-to-end oracle runs the real CLI on them.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'

// TypeScript is the authority on what a token is (law 6), not the CLI.
const ts = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), `../package.json`),
)(`typescript-for-tanstack-oracles`)

// The prefix of the framework's environment variables that the fixtures read
// and the end-to-end oracle passes to the CLI (`--env-prefix`).
export const ENV_PREFIX = `ORACLE`
const SOURCE = `src/sut.ts`
// A second source in the same package, which the first imports from.
const LIB = `src/lib.ts`
// A Svelte module, which only the static half reads: no test loads it.
const RUNES = `src/state.svelte.ts`
// A module with a base class and a derived class, which only the static half
// reads: no test loads it. See `derivedFile`.
const DERIVED = `src/derived.ts`
// The derived class's constructor, as the model names it: no oracle owns it.
const DERIVED_FN = `Derived.constructor`
// Its helper `nothing`, which no oracle owns either.
const DERIVED_HELPER = `nothing`
// The inputs a derived class is run with, each judged against the model.
export const DERIVED_INPUTS = [0, 4, 9]
// Where this package's own dependencies are installed.
const OWN_MODULES = join(
  dirname(fileURLToPath(import.meta.url)),
  `../node_modules`,
)
// The Vite this repository installs, which the CLI reads from a package's own
// resolution (`vite` from its package.json), so a fixture outside it links it.
const ROOT_VITE = dirname(
  createRequire(import.meta.url).resolve(`vite/package.json`),
)
// A source in a directory of the package whose name starts with `..`, which
// is in the package all the same. No test loads it.
const DOTGEN = `..gen/extra.ts`
// Unnamed exports, each the one function of its own file, which no test
// loads: an ES default function and default arrow (bare and in
// parentheses), CommonJS's `module.exports` (alone and chained through
// `exports`) and `exports.default`, and a CommonJS named export. An unnamed
// export is named `default`, as an import names it, and a CommonJS named
// export by its export's name (F24). Each calls its file's helper `help`,
// which pushes: the export's own site is that call, on line 5, and the
// helper's is its push, on line 2. The importer (`src/importer.ts`) imports
// every form but `exports.default` (a default import of a CommonJS module is
// the module, not its `default`) and calls each, so its tree holds each
// export and, through it, its helper.
const EXPORT_FORMS = [
  {
    exportForm: `esFunction`,
    file: `src/es-function.ts`,
    name: `default`,
    open: `export default function (x: number, out: Array<string>): void {`,
    close: `}`,
    imported: `import esFunction from './es-function'`,
  },
  {
    exportForm: `esArrow`,
    file: `src/es-arrow.ts`,
    name: `default`,
    open: `export default (x: number, out: Array<string>): void => {`,
    close: `};`,
    imported: `import esArrow from './es-arrow'`,
  },
  {
    exportForm: `esParen`,
    file: `src/es-paren.ts`,
    name: `default`,
    open: `export default ((x: number, out: Array<string>): void => {`,
    close: `});`,
    imported: `import esParen from './es-paren'`,
  },
  {
    exportForm: `cjs`,
    file: `src/cjs.js`,
    name: `default`,
    open: `module.exports = function (x, out) {`,
    close: `};`,
    imported: `import cjs from './cjs'`,
  },
  {
    exportForm: `cjsChained`,
    file: `src/cjs-chained.js`,
    name: `default`,
    open: `module.exports = exports = function (x, out) {`,
    close: `};`,
    imported: `import cjsChained from './cjs-chained'`,
  },
  {
    exportForm: `cjsDefault`,
    file: `src/cjs-default.js`,
    name: `default`,
    open: `exports.default = (x, out) => {`,
    close: `};`,
  },
  {
    exportForm: `cjsNamed`,
    file: `src/cjs-named.js`,
    name: `run`,
    open: `exports.run = function (x, out) {`,
    close: `};`,
    imported: `import { run as cjsNamed } from './cjs-named'`,
  },
]
const IMPORTER = `src/importer.ts`
// The model's own name for the code in no function of that file.
const TOP_LOOP = `<module>@..gen`
// Whether this filesystem ignores letter case, so that `src/Sut.ts` names
// `src/sut.ts`; the `cased` spelling applies only where it does.
const caseless = existsSync(fileURLToPath(import.meta.url).toUpperCase())
// The full limit of a cut-off copy's confirmation that the driver passes
// (`--hang-limit`), and, under one budget, the first budget too.
const FULL_LIMIT_MS = 20000
// How long a slow test waits, in real milliseconds: past the 1 s first
// budget that the driver passes (`--first-limit`), within the full limit.
const SLOW_MS = 3000
// How long each slow test of `w_slowpair` waits: past its file's first
// budget (the 1 s `--first-limit` plus three times its one-test file's
// unmutated time t), so its copy is always cut and confirmed; past half the
// mutant's budget, so two such confirmations never fit it; and under the
// full limit, so each would fit alone. The window holds while t < 3 s and
// ten times the two files' time stays under 2 × 10 s (their sum under 2 s).
const PAIR_SLOW_MS = 10000
// A mutant's budget for the runs that confirm its cut-off copies, which the
// driver passes (`--mutant-limit`): one slow owner's confirmation fits it
// (SLOW_MS), and two of `w_slowpair`'s do not. Ten times the fixture's
// one-test files' time stays under it, so the floor is the budget.
const MUTANT_LIMIT_MS = 15000
// How often the CLI says which mutant a busy copy runs (its heartbeat): the
// driver shortens it from 30 s (`ORACLE_GAPS_HEARTBEAT_MS`), so that a slow
// test's wait of SLOW_MS passes it. A copy beats once its own run has lasted
// an interval, so the interval is twice the 1 s first budget: a copy cut at
// its first budget never lasts it, and whether a run beats is a function of
// the history, not of the machine's load, as the determinism tests require.
const HEARTBEAT_MS = 2000
// The slow kill's hold (#84; v21.2 R57, the register's C entry "Determinism
// under load covers witnesses too"). A wait of SLOW_MS spans the heartbeat
// interval only while the copy stays the batch's running copy for two
// seconds of it, which load decides, so whether a heartbeat named the busy
// mutant was a matter of timing (#84). Where the driver names the run's
// stream log (`GAP_BEAT_LOG`), the test instead holds until the log has one
// more heartbeat that names a mutant in its own file than it had when the
// hold began: the CLI's own line releases it, never the clock. The copy
// stays busy while it holds, so the CLI beats for it at its next interval
// (in its batch, or in its confirming run alone if its first budget cut it
// first), and a beat for another busy copy of the file releases it too.
// Either way the run has a heartbeat that names a mutant, so the state "a
// heartbeat named a busy mutant" follows from the history. If no beat ever
// came, the CLI's budget would cut the held copy, and the mutant would read
// `timeout, owed killed`: that is the loud failure. The bound of 2,400 polls
// (about 120 s) is only a backstop, which the CLI's limits reach first. A run with no
// such log (through the daemon, whose workers keep the environment of the
// call that started it, or a stop run) waits SLOW_MS as before: its beats
// are progress, checked for shape only (maintainer decision, 2026-11-14).
const beatHold = (file) => [
  `import { readFileSync as readBeatLog } from 'node:fs'`,
  `const beatLine = /^oracle-gaps: busy \\S+:M\\d+ in tests\\/${file}\\.test\\.ts for \\d+s$/`,
  `const beatsLogged = (log: string) => { try { return readBeatLog(log, 'utf8').split('\\n').filter((line) => beatLine.test(line)).length } catch { return 0 } }`,
  `async function beatHeld(): Promise<void> {`,
  `  const log = process.env.GAP_BEAT_LOG`,
  `  if (!log) return new Promise((r) => setTimeout(r, ${SLOW_MS}))`,
  `  const before = beatsLogged(log)`,
  `  for (let polls = 0; beatsLogged(log) <= before; polls += 1) {`,
  `    if (polls >= 2400) throw new Error('no heartbeat named a mutant of this file within 2400 polls')`,
  `    await new Promise((r) => setTimeout(r, 50))`,
  `  }`,
  `}`,
]
const ORACLE_FILES = [`a`, `b`]
// The owners of the budget witness (`w_slowpair`): two oracle files of one
// test each, so that their unmutated time stays short on a loaded machine,
// and ten times it stays under the mutant's budget floor.
const PAIR_FILES = [`p`, `q`]
/** The oracle files a plan's fixture has. */
const oracleFilesOf = (plan) => [
  ...ORACLE_FILES,
  ...(plan.functions.some((fn) => fn.id === `w_slowpair`) ? PAIR_FILES : []),
]
const METHOD_NAMES = [`run`, `step`, `tick`]

// ## History grammar
//
// A history is a source file, the test files of its package, and how the
// CLI is run. The source holds one to three generated functions over `x`,
// each a free function or a method of class `C0` or `C1`; methods take
// names in order from `run`, `step`, `tick`, so the two classes share names.
// A statement pushes a label (quoted with `'` or a backtick), pushes a
// record of an arithmetic field and a label field as JSON, branches on
// one comparison against a constant, throws on a value no input reaches,
// fires a probe through a guard, a helper, a probe-only `if` or block, or
// calls a later function (by name, or through `this` within a class).
//
// Oracle files `a` and `b` declare owns entries: per function, or for the
// whole source, as strings or template literals. File `c` is an ordinary
// test file. A test calls one function with one input and observes the
// output, either through `__oracleObserve` or through `expect`; it may judge,
// reporting a verdict when the output differs from the unmutated one; it may
// register a route, chosen independently of its name; and it may also
// observe a clock, which makes it nondeterministic.
//
// A declaration fault breaks one owns declaration or one owner, and the run
// must then fail. The stability edit says how the source is changed for law
// 8. The steps are law 9's edits, applied one at a time between checks
// through the daemon (see `applyEdit`). The witness module adds functions whose outcomes the generated part
// reaches rarely, each with its own tests, so constructed histories reach
// every class.
const comparison = fc.constantFrom(`<`, `<=`, `>`, `>=`, `===`, `!==`)
const quote = fc.constantFrom(`'`, `\``)
const constant = fc.integer({ min: 0, max: 9 })
const statement = fc.oneof(
  // A push, or now and then a record: a record has five mutants, each a run
  // of the real CLI, so it shares the push's share of histories.
  fc.oneof(
    { arbitrary: fc.record({ kind: fc.constant(`push`), quote }), weight: 3 },
    { arbitrary: fc.record({ kind: fc.constant(`record`) }), weight: 1 },
  ),
  // A boolean literal in production code, written out as text.
  fc.record({ kind: fc.constant(`flag`), value: fc.boolean() }),
  // A loop that pushes twice, or now and then one that pushes until the
  // output has three entries: without its push that one spins forever on
  // instrumented code, and each spin costs a cut, so it shares the loop's
  // share of histories.
  fc.oneof(
    { arbitrary: fc.record({ kind: fc.constant(`loop`), quote }), weight: 3 },
    { arbitrary: fc.record({ kind: fc.constant(`until`), quote }), weight: 1 },
  ),
  fc.record({
    kind: fc.constant(`if`),
    op: comparison,
    k: constant,
    not: fc.boolean(),
    quote,
  }),
  fc.record({
    kind: fc.constant(`throwIf`),
    message: fc.constantFrom(`plain`, `assertion`),
  }),
  fc.record({ kind: fc.constant(`guard`), op: comparison, k: constant, quote }),
  // A probe statement in a shape the decided form does not accept, which is
  // production code: the former form (the `NODE_ENV` comparison itself on
  // the left of `&&`), a guard under another name, a `let` guard, a guard
  // of another initializer, and a probe in a nested function that only an
  // outer function's guard covers.
  fc.record({
    kind: fc.constant(`nearProbe`),
    variant: fc.constantFrom(`former`, `name`, `let`, `init`, `outer`),
    op: comparison,
    k: constant,
  }),
  // The probe form before the maintainer's decision: production code now.
  fc.record({ kind: fc.constant(`oldProbe`) }),
  fc.record({ kind: fc.constant(`mixed`), op: comparison, k: constant, quote }),
  fc.record({
    kind: fc.constant(`helperCall`),
    helper: fc.constantFrom(`report`, `reportTwice`),
  }),
  fc.record({ kind: fc.constant(`mixedHelperCall`) }),
  fc.record({ kind: fc.constant(`probeIf`), op: comparison, k: constant }),
  fc.record({ kind: fc.constant(`probeBlock`), op: comparison, k: constant }),
  fc.record({
    kind: fc.constant(`elseIf`),
    op: comparison,
    k: constant,
    quote,
  }),
  fc.record({ kind: fc.constant(`call`), target: fc.nat({ max: 3 }) }),
  // A function passed as a value, a class constructed with `new`, a method
  // called through a field, and a method called through `.bind`.
  fc.record({ kind: fc.constant(`valueCall`), target: fc.nat({ max: 3 }) }),
  fc.record({ kind: fc.constant(`newCall`), target: fc.nat({ max: 3 }) }),
  fc.record({ kind: fc.constant(`fieldCall`), target: fc.nat({ max: 3 }) }),
  fc.record({ kind: fc.constant(`bindCall`), target: fc.nat({ max: 3 }) }),
  // A class passed as a value to a factory.
  fc.record({ kind: fc.constant(`factoryCall`), target: fc.nat({ max: 3 }) }),
  // A call to a function of the library file, by its name or an import alias.
  fc.record({
    kind: fc.constant(`libCall`),
    target: fc.nat({ max: 3 }),
    alias: fc.boolean(),
  }),
  // A read of module-level data (see `MODULE_DATA`): an object literal's
  // fields, an array's first element, or a primitive constant.
  fc.record({
    kind: fc.constant(`readData`),
    shape: fc.constantFrom(`object`, `array`, `primitive`, `methods`),
  }),
  // An object that only a truthy `x` makes, read through `?.` (the history's
  // `absentObjects` says what a falsy `x` leaves in its place).
  fc.record({ kind: fc.constant(`optional`) }),
)
const libStatement = fc.oneof(
  fc.record({ kind: fc.constant(`push`), quote }),
  fc.record({
    kind: fc.constant(`if`),
    op: comparison,
    k: constant,
    not: fc.boolean(),
    quote,
  }),
  // A call to the library's own function `$derived`. Outside a Svelte
  // module (`.svelte.ts`) a name that starts with `$` is an ordinary name,
  // so its call is a mutation site like any other.
  fc.record({ kind: fc.constant(`dollar`) }),
)
// A statement of a Svelte module (`src/state.svelte.ts`): a rune call in
// the place Svelte requires for it. `$state` and `$derived` (and `.raw`,
// `.by`) must be a variable's initializer and `$effect` (and `.pre`) a
// statement, or the Svelte compiler refuses the module
// (`state_invalid_placement`, `effect_invalid_placement`). Each rune's
// argument holds ordinary code that may be mutated.
const runeStatement = fc.oneof(
  fc.record({ kind: fc.constant(`runeState`), op: comparison, k: constant }),
  fc.record({ kind: fc.constant(`runeStateRaw`) }),
  fc.record({ kind: fc.constant(`runeDerived`) }),
  fc.record({ kind: fc.constant(`runeDerivedBy`) }),
  fc.record({
    kind: fc.constant(`runeEffect`),
    rune: fc.constantFrom(`$effect`, `$effect.pre`),
  }),
)
// A derived class (DERIVED's `Derived`, which extends `DerivedBase`). Its
// constructor runs `before` statements, then one `super('a')` call in one of
// four forms, then `after` statements. A before statement may return early
// (an object, with no `super` call). The class's parameters may be parameter
// properties, and it may have a field initializer.
const derivedBefore = fc.oneof(
  fc.record({ kind: fc.constant(`push`) }),
  fc.record({ kind: fc.constant(`if`), op: comparison, k: constant }),
  fc.record({ kind: fc.constant(`early`), op: comparison, k: constant }),
)
const derivedAfter = fc.oneof(
  fc.record({ kind: fc.constant(`push`) }),
  fc.record({ kind: fc.constant(`tag`) }),
  fc.record({ kind: fc.constant(`if`), op: comparison, k: constant }),
)
const derivedClass = fc
  .record({
    params: fc.constantFrom(`plain`, `property`),
    field: fc.boolean(),
    before: fc.array(derivedBefore, { maxLength: 3 }),
    // `plain`: a statement `super('a')`; `arrow`: called in an arrow passed to
    // a call; `and` and `or`: its right operand of `&&` or `||`.
    form: fc.constantFrom(`plain`, `arrow`, `and`, `or`),
    after: fc.array(derivedAfter, { maxLength: 3 }),
  })
  // Only a statement `super` is legal TypeScript beside parameter properties
  // or a field initializer: TypeScript emits the former before the body, and
  // requires a root-level `super` for the latter.
  .filter(
    (spec) => spec.form === `plain` || (spec.params === `plain` && !spec.field),
  )
// The framework's route vocabulary (oracle-route.ts), and three names it
// retired, which a registration may still carry and which are unknown
// routes now.
const routes = [
  `fixed seed`,
  `fixed history`,
  `case`,
  `random seed`,
  `calibration`,
  `enumerated`,
  `probe calibration`,
  `determinism`,
]
const testCase = fc.record({
  file: fc.constantFrom(`a`, `b`, `c`),
  route: fc.constantFrom(...routes),
  registered: fc.constantFrom(true, true, true, false),
  name: fc.constantFrom(`route`, `plain`),
  fn: fc.nat({ max: 7 }),
  input: constant,
  judges: fc.boolean(),
  law: fc.constantFrom(`L`, `reach agreement`),
  channel: fc.constantFrom(`observe`, `observe`, `expect`),
  flaky: fc.constantFrom(false, false, false, true),
  // A test may judge by an `expect` assertion instead of a verdict, as older
  // oracles do; that is a kill under an unnamed law. A soft assertion
  // (`expect.soft`) records its failure and lets the test go on to its next
  // campaign.
  judgeBy: fc.constantFrom(`verdict`, `verdict`, `assertion`, `soft`),
  // A test may hang where it would judge: when the output differs, it waits
  // on a promise that never settles. Rare, since each hang costs a run its
  // whole time limit.
  hangs: fc.constantFrom(false, false, false, false, false, false, false, true),
  // Slow tests cost seconds of real time each, so only a witness has one.
  slow: fc.constant(false),
  // Only a witness checks that fast-check shrinks an injected failure.
  shrinks: fc.constant(false),
  // Only a witness draws from Math.random and observes the draw.
  draws: fc.constant(false),
  // Only a witness waits on a child process: seconds of real time.
  ioWait: fc.constant(false),
  // Only a witness spins when the driver stops a run.
  stops: fc.constant(false),
  // A test may import its owned module through a query (`?raw`, as a Vite
  // worker's `?worker&url` import is), and must read the module's own text:
  // the import is Vite's, not the instrumented copy's. The test judges nothing
  // about the import; it fails only when the text differs.
  rawImport: fc.constantFrom(
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    true,
  ),
  // A test's own cleanup hook may throw once the test has failed, as a
  // controlled clock's release does. The test's failure still judges.
  cleanupThrows: fc.constantFrom(false, false, false, true),
  // A test may be a property of @fast-check/vitest (`test.prop`), which
  // runs the suite's `afterEach` and `beforeEach` hooks between its runs.
  // It judges only in runs whose generated `n` is positive, so its last
  // run, a shrink to 0, passes: the test fails by an earlier run.
  asProp: fc.constantFrom(false, false, false, true),
  // A test may run a second campaign, on its own route and input, as an
  // oracle's second property does.
  then: fc.option(
    fc.record({ route: fc.constantFrom(...routes), input: constant }),
    { nil: null },
  ),
  // A test's work bound is derived from its plan (see the tests below), so
  // the grammar draws nothing for it and its generated histories stay those
  // of the grammar without the work law.
  work: fc.constant(null),
  // Only a witness waits on a timer, sleeps, reads the clock, or waits a
  // turn: its work could follow the clock.
  timed: fc.constant(false),
})
// Law 9's edits. Each content edit changes what some evidence depends on:
// a test file, a source statement, the source's line numbers, an owns list,
// the authored mutant, a helper module that only file b imports, the seed
// (file a judges only under seed 1), the set of oracle files, or the CLI's
// own code (`cli` changes the summary's wording in the copy of the CLI that
// the history runs). `restart` stops the daemon, and `revert` returns to the
// state before the last step.
const edits = [
  `test`,
  `source`,
  `prepend`,
  `owns`,
  `authored`,
  `helper`,
  `seed`,
  // The check's `--config` switches to a second config of the package,
  // which includes only file a's tests, and back: the config is part of a
  // session's settings, so the daemon warms its contexts again (F12).
  `config`,
  `newOracle`,
  `cli`,
  // The module that only file b's mutated runs import (`lazyGate`).
  `lazy`,
  // The data file that file b's verdict reads through fs (`fsRead`): no
  // test or source changes, only a file a test reads at run time.
  `fsData`,
  // File b's helper edited while a check through the daemon runs (law 9's
  // mid-run edit): a test of file a, which has loaded the helper, rewrites
  // it the first time it runs, before file b's runs read it.
  `midrun`,
  `restart`,
  `revert`,
  // Events that end a daemon, not edits: a crash (killed, its socket and
  // lock left behind), a reboot (killed, and its socket gone with the temp
  // directory), a reboot that gives the dead daemon's process id to a live
  // process, a crash followed by two checks at once, and a check started
  // while the daemon is being stopped.
  `crash`,
  `reboot`,
  `reusedPid`,
  `crashAtOnce`,
  `stopAtOnce`,
  // A change to the CLI's code followed by two checks at once, and a native
  // addon installed into the dependency tree (or removed) between checks.
  `cliAtOnce`,
  // A check from a second install of the CLI, at another path and with
  // other code, while the first install's daemon serves the package.
  `otherInstall`,
  `addAddon`,
  // A daemon killed while it runs a check (under a seed no other step uses,
  // so that the check has work to do), a daemon killed before it reads
  // a request (the connection is reset), the session's dependency made
  // resolvable (for a package that resolved no TypeScript), and a prebuilt
  // addon added into an existing build/Release.
  `dieMidCheck`,
  `resetBeforeRead`,
  `fixSession`,
  `addRelease`,
  // A scoped package with a prebuilt addon installed into a scope directory
  // that already exists, so only the scope directory changes.
  `addScopedAddon`,
  // The OS cleans the temp directory that holds the daemon's state (its
  // lock, log, and evidence) between checks: the next check is a cold
  // start, never a failure.
  `cleanState`,
  // A second check through the daemon of a state that nothing changed.
  `recheck`,
]
// The edits that came after the steps grammar was first drawn: a fixed
// seed's steps draw from the earlier ones, and these come from
// `laterSteps` (the generator rule: new draws go last).
const laterEdits = [`fsData`, `midrun`]
const earlierEdits = edits.filter((edit) => !laterEdits.includes(edit))
// A history's no later edits, one value, so `histories` can take it back
// (fc.constant takes back only its own reference).
const NO_LATER_STEPS = Object.freeze([])
// A history's no stop runs, one value for the same reason: a constructed
// history whose stops are all constructed-only is taken back to it.
const NO_STOPS = Object.freeze([])
// The later edits a history takes after its steps: only one without the
// witness module that has steps.
const laterStepsOf = (history) =>
  history.witness === false && history.steps != null
    ? (history.laterSteps ?? [])
    : []
// The steps that act on the daemon and change no file.
const daemonEvents = new Set([
  `restart`,
  `crash`,
  `reboot`,
  `reusedPid`,
  `crashAtOnce`,
  `stopAtOnce`,
  `resetBeforeRead`,
  `otherInstall`,
  `cleanState`,
  `recheck`,
])
const drawn = fc.record({
  functions: fc.array(fc.array(statement, { minLength: 1, maxLength: 5 }), {
    minLength: 1,
    maxLength: 3,
  }),
  containers: fc.array(fc.constantFrom(`free`, `free`, `C0`, `C1`), {
    maxLength: 3,
  }),
  // A free function may carry an overload signature before its body.
  overloads: fc.array(fc.boolean(), { maxLength: 3 }),
  owners: fc.array(fc.constantFrom(`a`, `b`, `both`, `none`), { maxLength: 3 }),
  // The library file's functions and who owns each directly.
  library: fc.array(fc.array(libStatement, { minLength: 1, maxLength: 3 }), {
    maxLength: 2,
  }),
  libraryOwners: fc.array(fc.constantFrom(`a`, `b`, `none`, `none`), {
    maxLength: 2,
  }),
  // The Svelte module's functions, which no oracle owns and no test loads:
  // only their mutants and their instrumented text are judged.
  runes: fc.array(fc.array(runeStatement, { minLength: 1, maxLength: 4 }), {
    maxLength: 2,
  }),
  // The derived class of DERIVED's file, when there is one.
  derived: fc.option(derivedClass, { nil: null, freq: 4 }),
  // How `--source` spells each path: as the package names it, with a
  // leading `./`, or through a redundant segment. Each names the same file,
  // and the report names it by its path in the package.
  // `linked` names each source by an absolute path through a symbolic link
  // to the package (as macOS's /tmp is a link to /private/tmp).
  sourceSpelling: fc.constantFrom(
    `plain`,
    `plain`,
    `dot`,
    `redundant`,
    `linked`,
    // The file names' first letters in capitals, on a caseless filesystem.
    `cased`,
  ),
  // A source file under `..gen/`, owned by file a.
  dotGen: fc.constantFrom(false, false, false, true),
  // How owns entries spell their file, which names the same file in every
  // spelling, as `--source` does.
  ownsSpelling: fc.constantFrom(`plain`, `plain`, `dot`, `redundant`),
  wholeFile: fc.constantFrom(`none`, `none`, `none`, `a`, `b`),
  template: fc.boolean(),
  tests: fc.array(testCase, { minLength: 1, maxLength: 5 }),
  // The witness module: all of it, or only the functions whose outcomes
  // need real test runs (see `captureWitness`).
  // The budget witness alone (`budget`) costs two 10 s confirmations per
  // mutant in every CLI run of a history, so generated histories rarely
  // draw it; its constructed history (the daemon recheck) always does.
  witness: fc.oneof(
    { weight: 30, arbitrary: fc.constantFrom(false, true, `capture`) },
    { weight: 1, arbitrary: fc.constant(`budget`) },
  ),
  authored: fc.option(
    fc.record({
      stmt: fc.nat({ max: 20 }),
      kind: fc.constantFrom(`apply`, `apply`, `stale`, `ambiguous`),
    }),
    { nil: null },
  ),
  // Where the oracle files name their `owns`: on `oracleProperty`
  // (maintainer decision, 2026-11-10: `oracleProperty` takes `owns`), on a
  // wrapper's call, which forwards it to `oracleProperty` (maintainer
  // decision, 2026-11-11: the CLI reads `owns` from an object-literal
  // argument of any call), on both (the entries split between the two calls,
  // so the union is read), or nowhere, which leaves no oracle file.
  declaration: fc.constantFrom(
    `wrapper`,
    `wrapper`,
    `wrapper`,
    `oracleProperty`,
    `oracleProperty`,
    `both`,
    `neither`,
  ),
  // No function and no whole file is owned: every function's owners and
  // the library's are emptied (the run refuses with no owns entry).
  ownerless: fc.boolean(),
  fault: fc.constantFrom(
    `none`,
    `none`,
    `none`,
    `none`,
    `none`,
    `none`,
    `badEntry`,
    `missingSource`,
    `nonLiteral`,
    `brokenOwner`,
    // `--source` also names a file outside the package, which the run
    // refuses rather than report as unowned.
    `outsideSource`,
    // The package's Vitest config defines `test.projects`, which the runner
    // cannot honor: each project has its own environment and setup files.
    `projects`,
    // The package resolves no TypeScript. The CLI analyzes with its own
    // compiler, so the package's TypeScript is no input to the analysis
    // (the peer range is optional; the 2026-11-09 adopter report).
    `noTypescript`,
    // The package's TypeScript has TypeScript 7's shape: its version and no
    // compiler API. The CLI analyzes with its own compiler, as it does for
    // noTypescript, and must not read the package's TypeScript at all.
    `apiLessTypescript`,
    // The package's Vitest fails the same way, after waiting on I/O, so a
    // daemon has read its requests when its session fails.
    `brokenVitest`,
    // The package's own files fail under Vitest: its config throws when it
    // loads, its config has no default export, or a setup file throws when
    // it loads. Each is the author's to fix, so each refuses the run.
    `configThrows`,
    `configNoDefault`,
    // A config whose default export is null, and one with a syntax error,
    // which Vitest refuses too (review of #46, F5 and F7).
    `configNull`,
    `configSyntax`,
    `setupThrows`,
  ),
  stability: fc.constantFrom(
    `none`,
    `none`,
    `none`,
    `prepend`,
    `insertGuard`,
    `reformat`,
  ),
  // Whether the run asks for the ordinary tests' outcome (`--ordinary`).
  ordinary: fc.boolean(),
  // File b's verdicts also wait on a module that the test imports only
  // where the output differs, so only a mutated run loads it
  // (`tests/lazy.ts`, which law 9's `lazy` edit changes).
  lazyGate: fc.constantFrom(false, false, false, true),
  // A second authored mutant, on the next statement, so that two patched
  // sources are judged in the same run and neither may see the other's.
  secondAuthored: fc.boolean(),
  // The package's Vitest config: its file, and whether it exports an object
  // or a function (sync or async) that returns one. Vitest accepts each, so
  // the runner must too.
  // Whether file a has a test that writes to the process's own streams
  // (review of #46, F2; re-review N2: a run whose tests wrote nothing names
  // no log).
  consoleOutput: fc.boolean(),
  // A promise of a config, which Vite awaits (review of #46, F5).
  config: fc.constantFrom(`object`, `object`, `function`, `async`, `promise`),
  // A config may read the environment Vitest's CLI sets before it loads
  // one (VITEST, TEST, and NODE_ENV), as svelte-db's picks its resolve
  // conditions by VITEST. This one finds its tests only under it.
  configEnv: fc.boolean(),
  // The config may name a setup file that defines a new global without
  // `configurable`, as offline-transactions' defines `indexedDB`. Vitest runs
  // it once per file in a fresh worker; every copy must see the same.
  setupGlobal: fc.constantFrom(false, false, false, true),
  // A native addon in the package's dependency tree: the workspace
  // dependency itself, built from a `binding.gyp` beside its manifest, as
  // better-sqlite3 is; or a dependency of the workspace dependency that ships
  // only a prebuilt `.node` file, as prebuilt-binary packages do.
  native: fc.constantFrom(`none`, `none`, `none`, `none`, `gyp`, `deep`),
  // The source imports a subpath of the workspace dependency
  // (`state-dep/extra`), which loads the dependency's main module too.
  depSubpath: fc.constantFrom(false, false, false, true),
  // The package and its workspace dependency each name a devDependency that
  // no test loads and that has no ESM entry (only `require`), as an unbuilt
  // workspace package has.
  unbuiltDep: fc.constantFrom(false, false, false, true),
  // The first generated function, when it is a free function that calls no
  // other generated function and has no `while` loop, also runs when the
  // module loads, with 0. A mutant under which it throws then fails every
  // file that imports the module, before any test runs.
  boot: fc.constantFrom(false, false, false, true),
  // The run's time budgets: a short first budget confirmed by a run alone
  // with the full limit, or one budget (`--first-limit` equal to
  // `--hang-limit`), where a run past it is a timeout at once.
  budget: fc.constantFrom(`two`, `two`, `two`, `one`),
  // Runs that the driver stops by a signal while the stop witness's test
  // spins (`w_stop`), each in a pool: Vitest's workers as child processes or
  // as threads. Each costs a run of its own, so few histories have one.
  stopRuns: fc.oneof(
    { weight: 9, arbitrary: fc.constant(NO_STOPS) },
    {
      weight: 1,
      arbitrary: fc.array(
        fc.record({
          signal: fc.constantFrom(`SIGTERM`, `SIGINT`),
          pool: fc.constantFrom(`forks`, `threads`),
          // When the signal comes: while the stop witness spins (`run`),
          // once the run has printed its completed line, while its process
          // holds its exit (`after`, review of #46, F3), or while the run
          // warms its config (`warm`, re-review N1). Or no signal: the check's
          // A drawn history never aborts a run's process. The abort is the
          // CLI's own test hook (ORACLE_GAPS_TEST_ABORT_AT), and a drawn field
          // switches no test-only hook on ("Randomness wins for new fields",
          // M 2026-11-12; I16). Only a constructed history with hookStops
          // draws that stop: `every outcome class, the abort stop`, and the
          // setup-file history of issues #117 and #137.
          // `after` switches the test-only hold ORACLE_GAPS_TEST_HOLD_UNTIL,
          // so only a constructed history sets it (the maintainer's decision
          // "Randomness wins for new fields": a drawn field never switches a
          // test-only hook); the take-back reads it as `run` (plainStops).
          when: fc.constantFrom(`run`, `run`, `warm`),
        }),
        { minLength: 1, maxLength: 5 },
      ),
    },
  ),
  // A second run with `--only`, of one owned function's mutants: its
  // baseline runs only their owners (law 14). It costs a run of its own.
  onlyRun: fc.constantFrom(false, false, false, false, false, true),
  // Oracle file a names its own Vitest environment in a pragma
  // (`// @vitest-environment`), another than the config's, and fails to load
  // outside it: every copy of it must run in that environment too.
  pragma: fc.constantFrom(false, false, false, true),
  // Where the CLI is installed: a plain path, or one with a space and `#`,
  // which a file URL spells with escapes.
  cliPath: fc.constantFrom(`plain`, `plain`, `plain`, `spaced`),
  // Whether law 9's first check is two checks through the daemon at once,
  // as an editor hook and a terminal can start them.
  concurrentStart: fc.boolean(),
  // The config's file name. Its extension and the package's module type
  // decide the format Vite loads it in (`formatOf`).
  configFile: fc.constantFrom(
    `vite.config.ts`,
    `vite.config.ts`,
    `vitest.config.ts`,
    `vite.config.mjs`,
    `vitest.config.mts`,
    `vite.config.js`,
    `vitest.config.cjs`,
    `vite.config.cts`,
  ),
  // Where the config is (maintainer finding F12, 2026-11-10): where Vitest
  // discovers it; under a name it does not discover, which `--config`
  // names; nowhere, so Vitest's defaults apply; or in the package's parent
  // directory only, where Vitest finds it too (its cli-api's find-up over
  // `configFiles`; maintainer decision, 2026-11-11). The run names the
  // config it used, or says that it found none.
  configPlace: fc.constantFrom(
    `discovered`,
    `discovered`,
    `discovered`,
    `named`,
    `none`,
    `parent`,
  ),
  // The package's module type: `module`, or none, in which Node and Vite
  // read a `.js` or `.ts` file as CommonJS (F13).
  packageType: fc.constantFrom(`module`, `module`, `module`, `commonjs`),
  // The config awaits at its top level, which only an ES module config can.
  configAwait: fc.constantFrom(false, false, true),
  // The config calls `require` and `require.resolve`, which only a CommonJS
  // config can (review of 2026-11-11).
  configRequire: fc.constantFrom(false, false, true),
  // The runner's warm contexts (`--contexts`): each is a Vitest instance,
  // which listens on the process (F15). Past ten, a listener that the
  // runner does not account for warns. With one, every run of a check takes
  // the same context in a fixed order, so a hang replaces the context that
  // read every file (law 9 must still invalidate what it read).
  contexts: fc.oneof(
    { weight: 28, arbitrary: fc.constant(4) },
    { weight: 1, arbitrary: fc.constant(11) },
    { weight: 1, arbitrary: fc.constant(1) },
  ),
  // Most histories have no steps, which keeps the campaign's cost down. A
  // history with the witness module has none (see `histories`).
  // The steps draw from the edits that came before the later ones, so a
  // fixed seed's steps stay as they were; the later edits are drawn last
  // (`laterSteps`) and follow these steps.
  steps: fc.oneof(
    { weight: 5, arbitrary: fc.constant(null) },
    {
      weight: 1,
      arbitrary: fc.array(fc.constantFrom(...earlierEdits), {
        minLength: 1,
        maxLength: earlierEdits.length * 2,
      }),
    },
  ),
  // Who owns each module-level data declaration directly (`src/sut.ts#D_OBJ`),
  // in `MODULE_DATA`'s order. A declaration is written when a function reads
  // it or an entry names it.
  dataOwners: fc.array(fc.constantFrom(`a`, `b`, `none`, `none`), {
    maxLength: 4,
  }),
  // The unnamed exports (see `EXPORT_FORMS`), in its order: one file each
  // for the first ones, with who names it in an owns entry.
  exportOwners: fc.array(fc.constantFrom(`a`, `b`, `none`), {
    maxLength: EXPORT_FORMS.length,
  }),
  // Who names the importer's function in an owns entry, if any.
  importer: fc.constantFrom(`none`, `a`, `b`),
  // Last, so the fields above draw as before.
  // Which file's test lands a mid-run edit (`midrun`), and what it edits:
  // file b's helper, or the data file when file b reads one (`midrunTarget`
  // is the helper otherwise). Only a check through the daemon takes the
  // `midrun` step.
  midrunBy: fc.constantFrom(`a`, `b`),
  midrunTarget: fc.constantFrom(`helper`, `data`),
  // The package's config also has a plugin of its own, `enforce: 'pre'`,
  // whose transform appends a comment to every module in the package, as a
  // code-rewriting plugin does: the runner must store a run under what it
  // served, not under the text after another pre plugin (third review of
  // #55, F-A).
  prePlugin: fc.constantFrom(false, false, false, true),
  // File b's verdicts also wait on `tests/data.json`, which the test reads
  // through fs at run time, by a sync, a promise, or a callback read (law
  // 9: a file a test reads is an input of its run, as a module it imports
  // is). The `fsData` edit changes only that file.
  // A `statDir` read stats the test's own directory first, as a test that
  // looks for a fixtures folder does (review of #55: a directory that a
  // test stats is no file to hash).
  fsRead: fc.constantFrom(
    `none`,
    `none`,
    `none`,
    `sync`,
    `promise`,
    `callback`,
    `statDir`,
  ),
  // The edits added after the first steps were drawn, which follow a
  // history's steps (`histories`): the data file's edit and the mid-run
  // edit. Most histories take none.
  laterSteps: fc.oneof(
    { weight: 9, arbitrary: fc.constant(NO_LATER_STEPS) },
    {
      weight: 1,
      arbitrary: fc.array(fc.constantFrom(...laterEdits), {
        minLength: 1,
        maxLength: 2,
      }),
    },
  ),
  // Randomness wins for new fields (maintainer decision, 2026-11-16): a field
  // that changes what a history runs is drawn, and only a field that switches
  // a test-only hook on stays a constant that constructed histories set. Of
  // the fields below, `tornRows` (ORACLE_GAPS_TEST_TORN_ROWS), `pauseEngages`
  // (ORACLE_GAPS_TEST_PAUSE_AT, which the daemon steps arm unless it is false)
  // and `rejectBatch` (ORACLE_GAPS_TEST_REJECT_BATCH) switch hooks, so each is
  // a constant; `warmReplaced`, `testRoot` and `loadPlugin` choose a scenario
  // or a fixture's shape, so each is drawn. Their draws come after every
  // earlier field's, so the earlier fields keep their values; the histories
  // that draw them run other code, so a fixed seed's histories shift.
  //
  // A batch's closing row written in two halves (issue #83) is constructed
  // only: the constant draws nothing, so generated histories hold no row, and
  // `histories` takes a constructed one back as this constant (as
  // `logLost` does). Its neutral value is recorded by the canary.
  tornRows: fc.constant(false),
  // Whether the daemon's pause engages in the daemon steps (dieMidCheck and
  // resetBeforeRead): false leaves the pause hook unset. Always true in drawn
  // histories; only the constructed history "a daemon pause that cannot engage"
  // sets it false.
  pauseEngages: fc.constant(true),
  // Whether the warm daemon is stopped after the warm check of a
  // `resetBeforeRead` step, so another daemon takes the reset (review of #73,
  // B2). It acts only in that step, which arms a daemon pause and so only
  // constructed histories take (`plainSteps`): a drawn value changes nothing
  // a generated history runs.
  warmReplaced: fc.boolean(),
  // Where the config's `test.root` sits (issue #101, `testRoots`): `none`, the
  // package, or one of four shapes. Only an ES module config that Vitest
  // discovers sets one (`testRootOf`).
  testRoot: fc.constantFrom(
    `none`,
    `none`,
    `none`,
    `none`,
    `tests`,
    `parent`,
    `outside`,
    `link`,
  ),
  // Whether the config has a plugin whose own \`load\` reads each test file
  // with a sync read (\`LOAD_PLUGIN\`, review of #103). Only a config in ES
  // module syntax has it (\`loadPluginOf\`).
  loadPlugin: fc.constantFrom(false, false, false, true),
  // The batch whose run rejects: a constructed-only field (0 is no fault). Only the constructed history at
  // the end of the campaign sets it; the take-back below returns it to 0 (the generator rule, extended).
  rejectBatch: fc.constant(0),
  // #57's fields (maintainer decision "Randomness wins for new fields",
  // 2026-11-16): a field that changes what a history runs is drawn, and only a
  // field that switches a test-only hook stays a constant that constructed
  // histories set (overlap, spawnStop, spawnOnStart, logLost, supervisorDeath,
  // unsupervised). The take-back maps those back to their neutral values
  // (constructedNeutral).
  // Where the run writes: `--out` names (`explicit`), or the directory the
  // CLI picks when `--out` is left out (`default`, args.mjs), whose stream
  // log, results, and done line must still agree (law 15).
  outMode: fc.constantFrom(`explicit`, `explicit`, `explicit`, `default`),
  // The run's `<out>/stream.log` is a directory, so the log cannot be written
  // (a problem the author can fix: the run refuses before it checks).
  logBlocked: fc.constantFrom(
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    true,
  ),
  // A second run on the first run's output directory while the first is live
  // (ORACLE_GAPS_TEST_HOLD_UNTIL holds the first): constructed only.
  overlap: fc.constant(false),
  // The stop witness alone (`w_stop`), which a run the driver stops needs. A
  // field of its own, so the witness options above keep their weights.
  stopWitness: fc.constantFrom(
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    true,
  ),
  // A stop sent as the CLI starts (ORACLE_GAPS_TEST_STARTED): constructed only.
  spawnStop: fc.constant(false),
  // The signal of a spawn stop, and how long the driver waits, once the CLI is
  // held at its start, before it sends it (0 to 300 ms). A held start makes the
  // outcome independent of the wait; a hold released by time would end before
  // a long wait.
  spawnSignal: fc.constantFrom(`SIGINT`, `SIGINT`, `SIGTERM`),
  spawnDelay: fc.integer({ min: 0, max: 300 }),
  // Where a spawn stop is held: after the CLI's started marker
  // (ORACLE_GAPS_TEST_PAUSE_AFTER_STARTED), or, when false, before the CLI's
  // first statement (the driver's own preload). Constructed only.
  spawnOnStart: fc.constant(false),
  // A claim that every start must refuse (the maintainer's decision "Stale
  // claims refuse; no takeover"): two racing starts on a dead pid's claim
  // (`race`), one start on it (`stale`), or one on an empty (`empty`),
  // unreadable (`unreadable`), or dangling-link (`dangling`) claim.
  claimScenario: fc.constantFrom(
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    `race`,
    `stale`,
    `empty`,
    `unreadable`,
    `dangling`,
  ),
  // A stream log that becomes a directory right after the note
  // (ORACLE_GAPS_TEST_PAUSE_AT=note): constructed only.
  logLost: fc.constant(false),
  // A supervised check whose supervisor is killed (ORACLE_GAPS_TEST_PAUSE_AT=child,
  // POSIX): constructed only.
  supervisorDeath: fc.constant(false),
  // A POSIX check run unsupervised, the path win32 takes (the test-only hook
  // ORACLE_GAPS_TEST_UNSUPERVISED). Constructed only: a drawn record holds false.
  unsupervised: fc.constant(false),
  // The runs' PATH holds no `ps` (a slim container, or BusyBox's `ps`, which
  // has no `-p`): the supervised run needs no external command (POSIX; review
  // of #57, A7).
  psMissing: fc.constantFrom(false, false, false, false, false, false, true),
  // Whether two checks at once are held to overlap in the daemon (the
  // test-only hold ORACLE_GAPS_TEST_HOLD_OVERLAP, issue #82): the first check
  // a daemon serves waits until it has accepted a second request. A hook is
  // never switched on by a drawn field, so the constant draws nothing and
  // only the constructed edit sequence through the daemon sets it; the
  // take-back below returns it to false.
  holdOverlap: fc.constant(false),
  // Whether the daemon of a `dieMidCheck` step holds its reply and lives on
  // until the CLI has ended (the cold-fallback witness, R39). It switches the
  // test-only `daemon-reply` pause on with no kill, so it is a constant that
  // only the constructed history "a check whose daemon stops answering" sets;
  // the take-back returns it to false.
  replyHeld: fc.constant(false),
  // Whether file b's verdict tests that read `tests/data.json` (`fsRead`)
  // spin on the function they test, where its output differs and the data
  // is open, in place of judging: a mutated copy then reads a file that its
  // file's unmutated run never reads, and its call budget cuts it (a spin).
  // An edit that closes the data makes those copies end unjudged, so a run
  // stored under fewer inputs than it read would be reused stale (F-D of
  // #55's third review: a spun run is stored under the inputs it read).
  // Drawn: it shapes the fixture's tests and switches no hook.
  spinData: fc.constantFrom(false, false, false, true),
  // Where a package that lies in this repository is placed: beside the CLI's
  // own files (`.scratch-*` in its directory), or in a directory beside the
  // CLI's directory whose name extends that directory's name
  // (`oracle-gaps-sibling-*`), so a plain prefix test of its path reads it
  // as inside the CLI's directory when it is not (#73, fix class 2). Drawn:
  // it places the fixture and switches no hook.
  siblingDir: fc.constantFrom(false, false, false, true),
  // Whether the driver runs this history's stops on win32, where every stop
  // goes through the test stop file (ORACLE_GAPS_TEST_STOP): a constant that
  // only the halves of `every outcome class` set, so no drawn history
  // switches that hook on, and the history is the same on every platform.
  hookStops: fc.constant(false),
  // Whether a copy that spins on open data (`spinData`) first schedules an
  // error that fires after its test has ended: an error outside any test,
  // which Vitest cannot give to one copy, so the CLI runs each copy of that
  // batch alone (runAlone), and the spun copy's unit comes from a run alone
  // (merge gate F4). The outcomes stay the batch's. Drawn: it shapes the
  // fixture's tests and switches no hook.
  spinThrows: fc.constantFrom(false, false, false, true),
  // Whether a daemon is held past its CLI's bound, and where: `open`, a fresh
  // daemon holds its first check before it runs
  // (ORACLE_GAPS_TEST_HOLD_OVERLAP) while its CLI carries the warm-up pause, a
  // session slower to open than the bound (merge gate delta 4, F-h); after a
  // warm check, `warm`, the next check holds before it warms its contexts
  // (ORACLE_GAPS_TEST_PAUSE_AT=daemon-warm), a slow but healthy warm-up (merge
  // gate D1), and `replace`, before a context warms in place of one a cut
  // stopped (daemon-replace), a slow config load mid-phase (delta 4, P11). It
  // switches a test-only hook on, so only constructed histories set it.
  slowStart: fc.constant(false),
  // Whether a warm daemon's checks run under a 3 s bound
  // (ORACLE_GAPS_TEST_WAIT_MS): the witness that a daemon that works tells its
  // CLI so (its beats). It switches a test-only knob, so only the constructed
  // history "a check through the daemon that works past the bound" sets it.
  shortWait: fc.constant(false),
  // What each `optional` statement of the generated functions, in order,
  // holds in place of its object when its `x` is falsy: `undefined`, or
  // `null`; a statement past the list's end holds `undefined`. A plain read
  // in place of `?.` throws on either, where `?.` gives `undefined`. Drawn
  // last, so the earlier fields keep their draws (the generator rule).
  absentObjects: fc.array(fc.constantFrom(`undefined`, `null`), {
    maxLength: 8,
  }),
  // How each `optional` statement, in order, reads its object: through
  // `links` `?.` links (`o?.v`, `o?.a?.v`, `o?.a?.b?.v`), where the object at
  // depth `level % links` (0 is `o` itself) is the one a falsy `x` leaves
  // absent. A statement past the list's end reads one link. A plain read in
  // place of one link throws only where that link's own object is absent: a
  // link past an absent object is short-circuited, as JavaScript skips the
  // rest of the chain. Drawn last (the generator rule).
  // A chain may end in a method `f` called through `?.()`, then read `v`
  // through `?.` (`o?.f?.()?.v`) or a plain read (`o?.f?.().v`). The method
  // is a builtin, so its field holds no function of the source: `Object`
  // returns an object, and `Function.prototype` returns nothing (the plain
  // read is drawn only after a method that returns an object). The absent
  // value may be the method itself (the level after the last object). An
  // optional call is no mutation site: where its method is absent,
  // JavaScript skips the rest of the chain, so a later `?.` link's plain read
  // changes nothing.
  optionalChains: fc.array(
    fc.record({
      links: fc.constantFrom(1, 1, 2, 3),
      level: fc.nat({ max: 3 }),
      call: fc.constantFrom(`none`, `none`, `optional`, `plain`),
      returns: fc.constantFrom(`object`, `nothing`),
    }),
    { maxLength: 8 },
  ),
  // The oracle files that hold a law that fails with no mutant active
  // (`FAILING_LAW`), beside the plan's tests: file a, file b, both, or
  // neither. A failing law judges nothing, and its file's passing tests
  // still judge the mutants the file owns (the maintainer's decision "Block
  // per law", 2026-11-18). It is no test-only hook, so it is drawn
  // (randomness wins, 2026-11-16; v21.2 R54), last (the generator rule).
  failingLaw: fc.oneof(
    { weight: 4, arbitrary: fc.constant(`none`) },
    { weight: 3, arbitrary: fc.constantFrom(`a`, `b`, `both`) },
  ),
  // Where the failing law sits in its file: after every other test, or
  // before them, so the plan's tests run after it (review of #176, F3).
  // Drawn last (the generator rule).
  failingLawAt: fc.constantFrom(`end`, `start`),
  // Whether the failing law calls production before it fails: not at all,
  // once (so it reaches the sites of the first generated function, which
  // only it may reach), or `HEAVY_CALLS` times, past the call floor, as a
  // failing property that shrinks does (review of #176, F1 and F2).
  // A heavy law runs in every copy of its file, about a second each (it
  // still runs, "An excluded test still runs"), so it is drawn rarely: the
  // determinism unit of a generated history with it took 419 s in CI.
  failingLawCalls: fc.oneof(
    { weight: 4, arbitrary: fc.constantFrom(`none`, `once`) },
    { weight: 1, arbitrary: fc.constant(`heavy`) },
  ),
  // Whether the failing law fails by itself, or a hook of a `describe`
  // around it does: a `beforeAll` that throws, which skips it, or an
  // `afterAll` that throws after it passed. Either is a failure that only
  // that describe's laws own (the maintainer's decision "A broken owner file
  // judges nothing", 2026-11-19, scoped to the describe; review of #176, F4).
  failingLawHook: fc.constantFrom(`none`, `none`, `beforeAll`, `afterAll`),
  // Whether a failing law that calls production once then repeats the call
  // until its output is the unmutated one (up to `SPIN_BOUND` times): with
  // no mutant active it stops at once, and under a mutant that changes that
  // output it spins on instrumented code until its copy's call budget cuts
  // it. A test left out of judging still runs, and a count cut it causes is
  // a gap (the maintainer's decision "An excluded test still runs",
  // 2026-11-23).
  failingLawSpins: fc.boolean(),
  // How oracle file a reads a data file of the package (`READ_DATA`) that it
  // owns and asserts on, and that an authored mutant edits: not at all, by a
  // sync read with an encoding or to a buffer (as TypeScript's compiler host
  // reads a declaration file), a promise, or a callback. The runner serves
  // the mutant's patch to these reads in the copy's own process
  // (feat/authored-mutant-any-file). Drawn last (the generator rule).
  authoredRead: fc.constantFrom(
    `none`,
    `none`,
    `none`,
    `none`,
    `sync`,
    `buffer`,
    `promise`,
    `callback`,
  ),
})

// The edit sequence over the witness module, the one list of steps that a
// history with the witness module takes. A test edit makes the daemon
// recompute file a's runs, the hangs among them; the helper edit changes
// only file b, so the daemon reuses file a's timed-out runs; the revert
// returns to a state that the daemon has seen. The budget witness alone
// (`budget`) takes its own one step instead: a second daemon check with
// nothing changed, which reuses the confirmations that the first check ran.
const witnessSteps = [`test`, `helper`, `revert`]
const budgetSteps = [`recheck`]
// The stop witness alone takes no steps, so it counts only where the history
// has none; a history with steps and the field is a legal history without it.
const stopsOnly = (history) =>
  history.stopWitness === true && history.steps === null
const keepsSteps = (history) => {
  if (history.witness === false || history.steps === null) return true
  const kept = history.witness === `budget` ? budgetSteps : witnessSteps
  return (
    history.steps.length === kept.length &&
    history.steps.every((step, i) => step === kept[i])
  )
}

// The histories. The witness module makes each cold run about 20 s (its
// hangs, slow kills, and stability rerun), and each step adds a cold run and
// a daemon check, so a generated history with both could run past the
// test's time limit: about one campaign in six drew a witness history with
// eight or more steps. A generated history with the witness module
// therefore has no steps. The constructed history "an edit sequence over the
// witness module" takes `witnessSteps`, so every campaign still judges law
// 9 over the witness module's outcome classes, along one short sequence
// (maintainer decision, 2026-11-11, option M of the CI plan; a stated
// limit of the property). The budget witness's confirmations cost about
// 15 s a mutant, so its histories follow the same rule, and its constructed
// history "a second daemon check of the budget witness" takes
// `budgetSteps` (the review of the gap CLI's runtime fixes, 2026-11-12,
// P1-a: the budget witness only in its own histories). The map is its own
// inverse on the histories it keeps, so fast-check takes every one of them
// back and shrinks it. A constructed value of a field that switches a
// test-only hook (a stream log loss, `logLost`, for one) is not a value `drawn`
// can produce, so its take-back reads it as the drawn constant (a shrink of
// such a counterexample is log-intact: the constructed history stays the
// counterexample for its law), and a constructed stop after the completed
// line or while the config warms is read as a plain stop (`plainStops`). A constructed history may also set `tornRows`
// (issue #83), which `drawn` cannot produce, so its take-back reads it as the
// drawn constant `false`: a shrink is torn-row-free.
// A history is drawn as on main; the plan takes its later edits after its
// steps (`laterStepsOf`). Taking a history back returns it unchanged,
// except a constructed one whose `steps` hold a later edit, which the
// steps grammar cannot draw: its later edits move to `laterSteps`. A
// constructed history may also set a hook's field, which `drawn` cannot
// produce, so its take-back reads each as its neutral value
// (`constructedNeutral`, as `logLost` does): a shrink switches no hook on.
// The drawn fields (`warmReplaced`, `testRoot`, `loadPlugin`, `spinData`,
// `siblingDir`, `spinThrows`) come back as they are.
// The neutral value of each constructed-only field: a drawn record holds it,
// and the take-back maps a constructed history back to it.
const constructedNeutral = {
  overlap: false,
  spawnStop: false,
  spawnOnStart: false,
  logLost: false,
  supervisorDeath: false,
  unsupervised: false,
  tornRows: false,
  pauseEngages: true,
  rejectBatch: 0,
  replyHeld: false,
  hookStops: false,
  slowStart: false,
  holdOverlap: false,
  shortWait: false,
}
// A drawn history never switches a test-only hook either (randomness wins,
// 2026-11-16; v21.2 I16). Two steps arm a daemon pause: `dieMidCheck` holds
// the daemon's reply (ORACLE_GAPS_TEST_PAUSE_AT=daemon-reply, with the wait
// and served marks) and `resetBeforeRead` holds its connection unread
// (daemon-read), so a drawn history takes neither; the constructed histories
// that gate their states take them. A stop after the completed line holds the
// run's exit (ORACLE_GAPS_TEST_HOLD_UNTIL) and a stop while the config warms
// waits at the warm probe (ORACLE_GAPS_TEST_WARM_PROBE), so a drawn history's
// stops are stops while the witness spins (`warm` becomes `run`;
// the grammar draws no `after`, and a constructed one is taken back as `run`).
// On win32 every stop goes through the test stop file; the driver runs a
// stop there only for a history that sets `hookStops`, so the histories are
// the same on every platform (v21.2 R4). The maps read the same draws, so no
// field's draws move. Taking a constructed history back reads its hook steps
// and stops the same way, so a shrink keeps none.
const hookSteps = new Set([`dieMidCheck`, `resetBeforeRead`])
const plainSteps = (steps) => {
  if (steps == null || !steps.some((step) => hookSteps.has(step))) return steps
  const kept = steps.filter((step) => !hookSteps.has(step))
  return kept.length > 0 ? kept : null
}
// The plain stops: a stop while the witness spins (`run`); every other stop
// (`warm`, a constructed `abort`, `after` or `note`) is read as `run`. An abort
// needs the CLI's test hook, so a taken-back history is not one that aborts.
const plainWhens = new Set([`run`])
const plainStops = (stopRuns) =>
  stopRuns.some((stop) => !plainWhens.has(stop.when))
    ? stopRuns.map((stop) =>
        plainWhens.has(stop.when) ? stop : { ...stop, when: `run` },
      )
    : stopRuns.length === 0
      ? NO_STOPS
      : stopRuns
const histories = drawn.map(
  (history) => {
    const kept = keepsSteps(history) ? history : { ...history, steps: null }
    const steps = plainSteps(kept.steps)
    const stopRuns = plainStops(kept.stopRuns)
    return steps === kept.steps && stopRuns === kept.stopRuns
      ? kept
      : { ...kept, steps, stopRuns }
  },
  (value) => {
    const history =
      /** @type {{ witness: unknown, steps: unknown[] | null, stopRuns: Array<{ when: string }>, tests: Array<{ slow: unknown, slowMs?: unknown }> } & Record<string, unknown>} */ (
        value
      )
    if (!keepsSteps(history))
      throw new Error(`a history with the witness module takes no steps`)
    const reset = Object.entries(constructedNeutral).every(
      ([field, neutral]) => history[field] === neutral,
    )
      ? value
      : { ...history, ...constructedNeutral }
    const stopRuns = plainStops(history.stopRuns ?? NO_STOPS)
    const steps = plainSteps(history.steps)
    // A constructed slow test (a wait where the output differs, seconds of
    // real time) is read as the drawn one, which never waits.
    const tests = history.tests.some((test) => test.slow)
      ? history.tests.map(({ slowMs, ...test }) => ({ ...test, slow: false }))
      : history.tests
    // A half of the witness module (captureHalves, constructed only) comes
    // back as the whole module, which the arbitrary draws.
    const whole = Object.hasOwn(captureHalves, history.witness)
      ? { ...reset, witness: `capture` }
      : reset
    const taken =
      stopRuns === history.stopRuns &&
      steps === history.steps &&
      tests === history.tests
        ? whole
        : { ...whole, stopRuns, steps, tests }
    const later = (steps ?? []).filter((step) => laterEdits.includes(step))
    if (later.length === 0) return taken
    const earlier = steps.filter((step) => !laterEdits.includes(step))
    return {
      ...taken,
      steps: earlier.length > 0 ? earlier : null,
      laterSteps: later,
    }
  },
)

// The witness module: functions whose outcome classes generated histories
// reach rarely, each with its own owners and tests.
const kill = { kind: `if`, op: `>`, k: 4, not: false, quote: `'` }
const push = { kind: `push`, quote: `'` }
const judging = (file, route, input, extra = {}) => ({
  file,
  route,
  registered: true,
  name: `route`,
  input,
  judges: true,
  law: `L`,
  channel: `observe`,
  flaky: false,
  judgeBy: `verdict`,
  hangs: false,
  slow: false,
  shrinks: false,
  ioWait: false,
  rawImport: false,
  cleanupThrows: false,
  asProp: false,
  stops: false,
  then: null,
  draws: false,
  work: null,
  timed: false,
  ...extra,
})
const witness = [
  {
    id: `w_kill`,
    owners: [`a`],
    body: [kill],
    tests: [judging(`a`, `fixed seed`, 7)],
  },
  {
    id: `w_both`,
    owners: [`a`],
    body: [push],
    tests: [judging(`a`, `fixed seed`, 1), judging(`a`, `random seed`, 1)],
  },
  {
    id: `w_overloaded`,
    owners: [`a`],
    overload: true,
    body: [push],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `w_random`,
    owners: [`a`],
    body: [kill],
    tests: [judging(`a`, `random seed`, 7)],
  },
  {
    id: `w_agree`,
    owners: [`a`],
    body: [push],
    tests: [judging(`a`, `fixed seed`, 1, { law: `reach agreement` })],
  },
  {
    id: `w_agreeboth`,
    owners: [`a`],
    body: [push],
    tests: [
      judging(`a`, `fixed seed`, 1, { law: `reach agreement` }),
      judging(`a`, `case`, 1),
    ],
  },
  {
    id: `w_crash`,
    owners: [`a`],
    body: [{ kind: `throwIf`, message: `assertion` }, push],
    tests: [judging(`a`, `case`, 3)],
  },
  {
    id: `w_frame`,
    owners: [`a`],
    body: [push],
    tests: [judging(`a`, `calibration`, 1)],
  },
  {
    id: `w_unregistered`,
    owners: [`a`],
    body: [push],
    tests: [judging(`a`, `fixed seed`, 1, { registered: false })],
  },
  {
    id: `w_flaky`,
    owners: [`b`],
    body: [push],
    tests: [judging(`b`, `fixed seed`, 1, { flaky: true })],
  },
  {
    id: `w_observe`,
    owners: [`a`],
    body: [push],
    tests: [judging(`a`, `fixed history`, 1, { judges: false })],
  },
  {
    id: `w_expect`,
    owners: [`a`],
    body: [push],
    tests: [
      judging(`a`, `fixed history`, 1, { judges: false, channel: `expect` }),
    ],
  },
  // A cache write that no observation reads: its `if-false` and `drop-not`
  // mutants change what the module caches for 4 and leave `out` as it was,
  // so they survive infected and unobserved (`not-observed`); its call
  // mutants are `not-distinguished`. It caches under 4, and `w_memo` under 1,
  // so the two never read each other's entries.
  {
    id: `w_unseen`,
    owners: [`a`],
    body: [{ kind: `memoSet`, label: 21 }],
    tests: [judging(`a`, `fixed seed`, 4)],
  },
  // A cache write that nothing observes, in a test that also observes a
  // draw from Math.random. The capture seeds the ambient random source by
  // the test, so the draw is the same with no mutant active and under every
  // mutant, in the original file and in the copies that mutant runs use,
  // whatever their names and the batch around them. The write's `if-false`
  // and `drop-not` mutants change only the cache, so they are not-observed,
  // not not-judged. It caches under 6, apart from `w_unseen` and `w_memo`.
  {
    id: `w_draws`,
    owners: [`a`],
    body: [{ kind: `memoSet` }],
    tests: [judging(`a`, `fixed seed`, 6, { draws: true })],
  },
  // Shortcuts for speed (klona's early return for a primitive, and its
  // assignment in place of `Object.defineProperty`): the general path gives
  // the same output for every input, with more work, so forcing the
  // shortcut's `if` false changes no observation and costs work
  // (`extra-work`). Each has a twin whose tests declare a work bound, which
  // kills that mutant under law `work bound`: 2 for the early return, whose
  // loop costs several times the shortcut, and 1 for the call, which costs
  // one site evaluation more. Their inputs are 7, which takes the shortcut,
  // and 1, which takes the general path.
  {
    id: `w_fast`,
    owners: [`a`],
    body: [{ kind: `shortcut`, op: `>`, k: 2, not: false }],
    tests: [judging(`a`, `fixed seed`, 7), judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `w_fastbound`,
    owners: [`a`],
    body: [{ kind: `shortcut`, op: `>`, k: 2, not: false }],
    tests: [
      judging(`a`, `fixed seed`, 7, { work: 2 }),
      judging(`a`, `fixed seed`, 1, { work: 2 }),
    ],
  },
  {
    id: `w_fastcall`,
    owners: [`a`],
    body: [{ kind: `callShortcut`, op: `>`, k: 2, not: false }],
    tests: [judging(`a`, `fixed seed`, 7), judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `w_fastcallbound`,
    owners: [`a`],
    body: [{ kind: `callShortcut`, op: `>`, k: 2, not: false }],
    tests: [
      judging(`a`, `fixed seed`, 7, { work: 1 }),
      judging(`a`, `fixed seed`, 1, { work: 1 }),
    ],
  },
  // The early return again, in tests that the work law does not judge,
  // with a bound of 1: tests whose count could follow the clock, as a
  // polling or a deadline loop's does (a kill must replay on an idle
  // machine, the maintainer's decision of 2026-11-12 under P3). Each reaches
  // the clock by one path before it runs production: a timer through
  // `util.promisify(setTimeout)`, the global and `node:timers`'s (which
  // also checks that the capture keeps `util.promisify.custom`, law 3: a
  // test that passes alone passes under the CLI), a sleep through
  // `node:timers/promises`, `Date.now()` (and through a `vi.spyOn`
  // passthrough, whose spy frame comes first), `process.uptime()`,
  // `os.uptime()`, `AbortSignal.timeout`, `Atomics.wait` and
  // `Atomics.waitAsync` with a timeout, and `monitorEventLoopDelay`. One untimed test runs the
  // general path. A mutant is killed if any test still judges work, so its
  // `if-false` mutant stays `not-observed` only while every path is seen.
  // Tests that wait one turn (`setImmediate`, as `withinTurns` does) and
  // read no clock still judge work, so there it is killed; and tests that
  // register no route (below) can carry no bound.
  {
    id: `w_fastclocked`,
    owners: [`a`],
    body: [{ kind: `shortcut`, op: `>`, k: 2, not: false }],
    tests: [
      ...[
        `timer`,
        `nodetimer`,
        `sleep`,
        `clock`,
        `spiedclock`,
        `uptime`,
        `osuptime`,
        `abort`,
        `waitasync`,
        `wait`,
        `loopdelay`,
      ].map((timed) => judging(`a`, `fixed seed`, 7, { timed, work: 1 })),
      judging(`a`, `fixed seed`, 1, { work: 1 }),
    ],
  },
  {
    id: `w_fastturn`,
    owners: [`a`],
    body: [{ kind: `shortcut`, op: `>`, k: 2, not: false }],
    tests: [
      judging(`a`, `fixed seed`, 7, { timed: `turn`, work: 1 }),
      judging(`a`, `fixed seed`, 1, { timed: `turn`, work: 1 }),
    ],
  },
  {
    id: `w_fastplain`,
    owners: [`a`],
    body: [{ kind: `shortcut`, op: `>`, k: 2, not: false }],
    tests: [
      judging(`a`, `fixed seed`, 7, { registered: false }),
      judging(`a`, `fixed seed`, 1, { registered: false }),
    ],
  },
  {
    id: `w_noobs`,
    owners: [`a`],
    body: [kill],
    tests: [judging(`a`, `fixed seed`, 7), judging(`a`, `fixed seed`, 1)],
  },
  { id: `w_unreached`, owners: [`a`], body: [push], tests: [] },
  {
    id: `w_ordinary`,
    owners: [`a`],
    body: [push],
    tests: [judging(`c`, `case`, 1)],
  },
  {
    id: `w_mixed`,
    owners: [`a`],
    body: [
      { kind: `mixed`, op: `>`, k: 4, quote: `'` },
      { kind: `mixedHelperCall` },
    ],
    tests: [judging(`a`, `fixed seed`, 7)],
  },
  {
    id: `w_else`,
    owners: [`a`],
    body: [{ kind: `elseIf`, op: `>`, k: 4, quote: `'` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `w_callsprobe`,
    owners: [`a`],
    body: [{ kind: `call`, to: `w_probeonly` }, push],
    tests: [judging(`a`, `fixed seed`, 7)],
  },
  {
    id: `w_probeonly`,
    owners: [],
    body: [
      { kind: `guard`, op: `>`, k: 4, quote: `'` },
      { kind: `probeIf`, op: `>`, k: 4 },
    ],
    tests: [],
  },
  // A chain of probe helpers, each declared after its caller.
  {
    id: `w_callschain`,
    owners: [`a`],
    body: [{ kind: `call`, to: `w_probe1` }, push],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `w_probe1`,
    owners: [],
    body: [{ kind: `call`, to: `w_probe2` }],
    tests: [],
  },
  {
    id: `w_probe2`,
    owners: [],
    body: [{ kind: `guard`, op: `>`, k: 4, quote: `\`` }],
    tests: [],
  },
  {
    id: `w_oldprobe`,
    owners: [`a`],
    body: [{ kind: `oldProbe` }, push],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `w_foreign`,
    owners: [`b`],
    body: [push],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `w_union`,
    owners: [`a`, `b`],
    body: [push],
    tests: [judging(`b`, `fixed seed`, 1)],
  },
  {
    id: `w_unowned`,
    owners: [],
    body: [push],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `w_entry`,
    owners: [`a`],
    body: [{ kind: `call`, to: `w_mid` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `w_mid`,
    owners: [],
    body: [{ kind: `call`, to: `w_leaf` }],
    tests: [],
  },
  { id: `w_leaf`, owners: [], body: [push], tests: [] },
  {
    id: `W0.run`,
    owners: [`a`],
    body: [{ kind: `call`, to: `W0.step` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  { id: `W0.step`, owners: [], body: [push], tests: [] },
  {
    id: `W1.run`,
    owners: [`b`],
    body: [push],
    tests: [judging(`b`, `fixed seed`, 1)],
  },
  // Owned across files: through an import, and through an import alias.
  {
    id: `w_libentry`,
    owners: [`a`],
    body: [{ kind: `libCall`, to: `wg0`, alias: false }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `w_libalias`,
    owners: [`a`],
    body: [{ kind: `libCall`, to: `wg1`, alias: true }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  // Owned through references the type checker resolves: a value, a field,
  // a class constructed with `new` (which owns all its methods), and `.bind`.
  {
    id: `w_value`,
    owners: [`a`],
    body: [{ kind: `valueCall`, to: `w_valued` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  { id: `w_valued`, owners: [], body: [push], tests: [] },
  {
    id: `W2.run`,
    owners: [`a`],
    body: [{ kind: `fieldCall`, to: `W3.run` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  { id: `W3.run`, owners: [], body: [push], tests: [] },
  { id: `W3.step`, owners: [], body: [push], tests: [] },
  {
    id: `w_new`,
    owners: [`a`],
    body: [{ kind: `newCall`, to: `W4.run` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  { id: `W4.run`, owners: [], body: [push], tests: [] },
  { id: `W4.step`, owners: [], body: [push], tests: [] },
  {
    id: `W5.run`,
    owners: [`a`],
    body: [{ kind: `bindCall`, to: `W5.step` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  { id: `W5.step`, owners: [], body: [push], tests: [] },
  // A class passed to a factory as a value brings all its methods.
  {
    id: `w_factory`,
    owners: [`a`],
    body: [{ kind: `factoryCall`, to: `W6.run` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  // A constructor is a function: `new W7()` brings it, and it brings what it
  // refers to.
  {
    id: `w_ctor`,
    owners: [`a`],
    body: [{ kind: `newCall`, to: `W7.run` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `W7.constructor`,
    owners: [],
    signature: `constructor()`,
    field: `tag = 'a'`,
    body: [{ kind: `primeCall` }],
    tests: [],
  },
  {
    id: `W7.prime`,
    owners: [],
    signature: `prime(): void`,
    body: [{ kind: `setTag` }],
    tests: [],
  },
  { id: `W7.run`, owners: [], body: [{ kind: `pushTag` }], tests: [] },
  { id: `W6.run`, owners: [], body: [push], tests: [] },
  { id: `W6.step`, owners: [], body: [push], tests: [] },
  // A probe in each shape that the decided form does not accept, beside a
  // decided one: all of it but the decided probe and its guard is judged.
  {
    id: `w_near`,
    owners: [`a`],
    body: [
      { kind: `guard`, op: `>`, k: 4, quote: `\`` },
      { kind: `nearProbe`, variant: `former`, op: `>`, k: 4 },
      { kind: `nearProbe`, variant: `name`, op: `>`, k: 4 },
      { kind: `nearProbe`, variant: `let`, op: `>`, k: 4 },
      { kind: `nearProbe`, variant: `init`, op: `>`, k: 4 },
      { kind: `nearProbe`, variant: `outer`, op: `>`, k: 4 },
    ],
    tests: [],
  },
  // Private members: `W10.run` calls `this.#helper`, which its tree holds,
  // and file b names `W10.#named` in an owns entry (the file is split from
  // the function at the first `#`).
  {
    id: `W10.run`,
    owners: [`a`],
    body: [{ kind: `call`, to: `W10.#helper` }],
    tests: [],
  },
  { id: `W10.#helper`, owners: [], body: [push], tests: [] },
  { id: `W10.#named`, owners: [`b`], body: [push], tests: [] },
  // Everything defined inside an owned function's text is owned with it,
  // whether or not anything refers to it (maintainer decision, 2026-11-08:
  // a gap in an unreferenced nested function often marks dead production
  // code, which the report should flag). `w_dead` defines a helper nothing
  // calls; `w_closure` returns one, reached only through what it returns.
  {
    id: `w_dead`,
    owners: [`a`],
    body: [{ kind: `innerUnused`, to: `w_dead>unused` }, push],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  {
    id: `w_dead>unused`,
    name: `unused`,
    container: `nested`,
    form: `arrow`,
    owners: [],
    body: [push],
    tests: [],
  },
  {
    id: `w_closure`,
    owners: [`a`],
    signature: `w_closure(x: number, out: Array<string>): () => void`,
    body: [{ kind: `innerReturned`, to: `w_closure>later` }],
    tests: [],
  },
  {
    id: `w_closure>later`,
    name: `later`,
    container: `nested`,
    form: `arrow`,
    owners: [],
    body: [push],
    tests: [],
  },
  // Two functions that start on one line: an object literal's `get` and
  // `set` arrows. Each mutant belongs to the one whose text holds it. No
  // oracle owns `w_pair`, so its names alone are judged.
  { id: `w_pair`, owners: [], body: [{ kind: `pair` }], tests: [] },
  {
    id: `w_pair>get`,
    name: `get`,
    container: `nested`,
    owners: [],
    body: [],
    tests: [],
  },
  {
    id: `w_pair>set`,
    name: `set`,
    container: `nested`,
    owners: [],
    body: [],
    tests: [],
  },
  // A nested function that has the name of the probe helper `report`: a
  // call to it is a call to production code, which is judged.
  {
    id: `w_shadow`,
    owners: [`a`],
    body: [{ kind: `inner`, to: `w_shadow>report` }],
    tests: [],
  },
  {
    id: `w_shadow>report`,
    name: `report`,
    container: `nested`,
    form: `function`,
    owners: [],
    body: [push],
    tests: [],
  },
  // Functions that share a name in one file are still distinct functions.
  // `W8.other` returns an object literal whose method is named like the
  // class method `W8.run`; it is `run`, a function of its own, owned only
  // through what refers to it. `w_nest0` and `w_nest1` each define a nested
  // helper named `next`. The model knows each by its own id and reports it
  // by its name (`name`).
  { id: `W8.run`, owners: [`a`], body: [push], tests: [] },
  {
    id: `W8.other`,
    owners: [],
    body: [{ kind: `inner`, to: `W8.other>run` }],
    tests: [],
  },
  {
    id: `W8.other>run`,
    name: `run`,
    container: `nested`,
    form: `method`,
    owners: [],
    body: [push],
    tests: [],
  },
  {
    id: `w_nest0`,
    owners: [`a`],
    body: [{ kind: `inner`, to: `w_nest0>next` }],
    tests: [],
  },
  {
    id: `w_nest0>next`,
    name: `next`,
    container: `nested`,
    form: `arrow`,
    owners: [],
    body: [push],
    tests: [],
  },
  {
    id: `w_nest1`,
    owners: [],
    body: [{ kind: `inner`, to: `w_nest1>next` }],
    tests: [],
  },
  {
    id: `w_nest1>next`,
    name: `next`,
    container: `nested`,
    form: `arrow`,
    owners: [],
    body: [push],
    tests: [],
  },
  // Accessors and a class-field arrow are functions too. `W9.run` reads the
  // property `status`, which refers to its getter and its setter (one name,
  // two functions), and calls the field arrow `handle` through `this`.
  {
    id: `W9.run`,
    owners: [`a`],
    body: [{ kind: `pushStatus` }, { kind: `call`, to: `W9.handle` }],
    tests: [],
  },
  {
    id: `W9.status#get`,
    name: `W9.status`,
    signature: `get status(): string`,
    field: `tags: Array<string> = []`,
    owners: [],
    body: [{ kind: `getterReturn` }],
    tests: [],
  },
  {
    id: `W9.status#set`,
    name: `W9.status`,
    signature: `set status(value: string)`,
    owners: [],
    body: [{ kind: `setterPush` }],
    tests: [],
  },
  {
    id: `W9.handle`,
    signature: `handle = (x: number, out: Array<string>): void =>`,
    owners: [],
    body: [push],
    tests: [],
  },
  // An assertion judges, and a second campaign catches what the first misses.
  {
    id: `w_assert`,
    owners: [`a`],
    body: [push],
    tests: [judging(`a`, `fixed seed`, 1, { judgeBy: `assertion` })],
  },
  {
    id: `w_campaigns`,
    owners: [`a`],
    body: [kill],
    tests: [
      judging(`a`, `fixed seed`, 1, {
        then: { route: `random seed`, input: 7 },
      }),
    ],
  },
  // A soft assertion fails in the random campaign, and the test goes on to
  // register a fixed seed: the verdict keeps the random route.
  {
    id: `w_soft`,
    owners: [`a`],
    body: [kill],
    tests: [
      judging(`a`, `random seed`, 7, {
        judgeBy: `soft`,
        then: { route: `fixed seed`, input: 1 },
      }),
    ],
  },
  // A test that asserts on a value with a getter and checks that nothing
  // read it, as an oracle that counts reads does. The CLI's capture must
  // not read it either: the harness may not change what a test observes.
  {
    id: `w_getter`,
    owners: [`a`],
    body: [push],
    tests: [judging(`a`, `fixed seed`, 1, { getter: true })],
  },
  // A test that spies on the builtins a value is scanned with
  // (`Object.keys`, `Object.getPrototypeOf`,
  // `Object.getOwnPropertyDescriptor`), asserts on a value, and checks that
  // nothing scanned it, as TanStack DB's includes work counter does. The
  // capture must keep its own references to the builtins it calls.
  {
    id: `w_spy`,
    owners: [`a`],
    body: [push],
    tests: [judging(`a`, `fixed seed`, 1, { spies: true })],
  },
  // Two tests that share state: the first, which calls another function,
  // sets it; the second calls this function only when it is set. A runner
  // that runs only the tests that reached a site must not change what the
  // second sees.
  {
    id: `w_shared`,
    owners: [`a`],
    body: [kill],
    tests: [
      {
        ...judging(`a`, `fixed seed`, 1, { judges: false, setsShared: true }),
        fn: `w_kill`,
      },
      judging(`a`, `fixed seed`, 5, { judges: false, readsShared: true }),
    ],
  },
  // Module state. `w_memo` caches its label in a module-level map, so a
  // runner that keeps modules loaded between mutants would answer a later
  // mutant from an earlier run's cache. `w_load` runs when the module loads,
  // and `w_loaded` reads what it wrote, so its mutants take effect only in a
  // freshly loaded module.
  {
    id: `w_memo`,
    owners: [`a`],
    body: [{ kind: `memoSet` }, { kind: `memoGet` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  // `w_load`'s `if` runs only at load, with 0: its `if-true` mutant
  // changes a value only there, so a runner that skips mutants which change
  // no value must count what runs at load.
  { id: `w_load`, owners: [`a`], body: [kill, push], tests: [] },
  {
    id: `w_loaded`,
    owners: [`a`],
    body: [{ kind: `pushLoaded` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  // A test that fires a verdict and catches its failure passes, so it kills
  // nothing, and the tests after it must still run. It sits between a test
  // that reaches `w_late` and the one that judges it, so a runner that
  // leaves out the tests before the first reaching one still runs it.
  { id: `w_caught`, owners: [`a`], body: [push], tests: [] },
  {
    id: `w_late`,
    owners: [`a`],
    body: [push],
    tests: [
      judging(`a`, `fixed seed`, 1, { judges: false }),
      {
        ...judging(`a`, `fixed seed`, 1, {
          judges: false,
          caughtVerdict: true,
        }),
        fn: `w_caught`,
      },
      judging(`a`, `fixed seed`, 1),
    ],
  },
  // A test that never calls this function judges what an earlier test
  // stored from it, so it sees the mutant through shared state.
  {
    id: `w_prop`,
    owners: [`a`],
    body: [push],
    tests: [
      judging(`a`, `fixed seed`, 7, { judges: false, storesShared: true }),
      judging(`a`, `fixed seed`, 7, { judgesShared: true }),
    ],
  },
  // Hangs. A test that hangs where it would judge cuts its file's run off
  // at the time limit. Alone, the mutant is a timeout; a kill in another
  // owner still decides, and a survivor in another owner does not.
  // A module imported through a query is loaded by Vite as written: the
  // owner's test reads it with `?raw` and must see the module's own text,
  // which the instrumented copy does not change. The judging test kills the
  // mutant as usual, so a run that refused for the import shows as a change.
  {
    id: `w_rawimport`,
    owners: [`a`],
    body: [kill],
    tests: [
      judging(`a`, `fixed seed`, 1, { judges: false, rawImport: true }),
      judging(`a`, `fixed seed`, 7),
    ],
  },
  {
    id: `w_hang`,
    owners: [`a`],
    body: [kill],
    tests: [judging(`a`, `fixed seed`, 7, { judges: false, hangs: true })],
  },
  {
    id: `w_hangkill`,
    owners: [`a`, `b`],
    body: [kill],
    tests: [
      judging(`a`, `fixed seed`, 7, { judges: false, hangs: true }),
      judging(`b`, `fixed seed`, 7),
    ],
  },
  {
    id: `w_hangsurvive`,
    owners: [`a`, `b`],
    body: [kill],
    tests: [
      judging(`a`, `fixed seed`, 7, { judges: false, hangs: true }),
      judging(`b`, `fixed seed`, 7, { judges: false }),
    ],
  },
  // A nondeterministic test judges nothing, even when its verdict fires, so
  // it must not stop its file: the deterministic test after it decides.
  {
    id: `w_flakykill`,
    owners: [`a`],
    body: [kill],
    tests: [
      judging(`a`, `fixed seed`, 7, { flaky: true }),
      judging(`a`, `fixed seed`, 7),
    ],
  },
  // A gap in one owner does not stop the mutant: a later owner's kill
  // still decides.
  {
    id: `w_crosskill`,
    owners: [`a`, `b`],
    body: [kill],
    tests: [judging(`a`, `random seed`, 7), judging(`b`, `fixed seed`, 7)],
  },
  // A slow kill: the run ends after the first budget, within the full
  // limit, so the confirming rerun kills it (a run is a timeout only when
  // it passes the full limit alone).
  {
    id: `w_slowkill`,
    owners: [`a`],
    body: [kill],
    tests: [judging(`a`, `fixed seed`, 7, { slow: true })],
  },
  // Slow in both owners, and judged by neither: each owner's copy is cut at
  // its first budget, and the two confirmations together need more than the
  // mutant's budget, so the mutant is a timeout, not a survivor.
  {
    id: `w_slowpair`,
    owners: PAIR_FILES,
    body: [kill],
    tests: [
      judging(`p`, `fixed seed`, 7, {
        judges: false,
        slow: true,
        slowMs: PAIR_SLOW_MS,
      }),
      judging(`q`, `fixed seed`, 7, {
        judges: false,
        slow: true,
        slowMs: PAIR_SLOW_MS,
      }),
    ],
  },
  // A kill as usual. In a run that the driver stops (`GAP_STOP_DIR` set),
  // the test instead starts a child process, records its own process id and
  // the child's, and spins synchronously where it would judge, so the
  // driver can stop the run while a worker is busy.
  {
    id: `w_stop`,
    owners: [`a`],
    body: [kill],
    tests: [judging(`a`, `fixed seed`, 7, { stops: true })],
  },
  // Each owner makes only one of this `if`'s two mutants change a value:
  // owner a calls it with 1, owner b with 7.
  {
    id: `w_otherinfect`,
    owners: [`a`, `b`],
    body: [kill],
    tests: [judging(`a`, `fixed seed`, 1), judging(`b`, `fixed seed`, 7)],
  },
  // A calibration that injects a property failure and checks that it
  // shrinks, as framework calibrations do. The runner must not change how
  // fast-check runs a property, or this test fails under every mutant that
  // reaches it.
  {
    id: `w_shrink`,
    owners: [`a`],
    body: [kill],
    tests: [judging(`a`, `calibration`, 1, { judges: false, shrinks: true })],
  },
  // A boolean literal that a judging test sees: its flip changes the output.
  {
    id: `w_flag`,
    owners: [`a`],
    body: [{ kind: `flag`, value: true }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  // A workspace dependency (`state-dep`, linked through node_modules) keeps
  // a log in module state. `w_dep` reads the log, then notes an entry, so
  // a fresh module shows an empty log. Every copy must load it afresh, or a
  // copy after one that noted sees that note.
  {
    id: `w_dep`,
    owners: [`a`],
    body: [{ kind: `depSeen` }, { kind: `depNote` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  // A loop that a judging test sees: forcing its condition false empties
  // the output.
  {
    id: `w_loop`,
    owners: [`a`],
    body: [{ kind: `loop`, quote: `'` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  // A loop that a judging test reaches: with its push deleted it spins
  // forever on instrumented code, which its call budget cuts off.
  {
    id: `w_spin`,
    owners: [`a`],
    body: [{ kind: `until`, quote: `'` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  // A record that a judging test sees: each field drop and the arithmetic
  // swap change its JSON.
  {
    id: `w_record`,
    owners: [`a`],
    body: [{ kind: `record` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  // A function that reads each shape of module-level data, so each
  // declaration's mutants are owned through it and killed by its test.
  {
    id: `w_data`,
    owners: [`a`],
    body: [
      { kind: `readData`, shape: `object` },
      { kind: `readData`, shape: `array` },
      { kind: `readData`, shape: `primitive` },
    ],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  // An object read through `?.`, made for the test's input: the plain read
  // in its place is not distinguished, since the object is there.
  {
    id: `w_optional`,
    owners: [`a`],
    body: [{ kind: `optional` }],
    tests: [judging(`a`, `fixed seed`, 1)],
  },
  // A test that waits on a child process where the output differs: an I/O
  // handle is open, so its copy is busy, never cut for idleness, and the
  // confirming run kills it.
  {
    id: `w_iowait`,
    owners: [`a`],
    body: [kill],
    tests: [judging(`a`, `fixed seed`, 7, { ioWait: true })],
  },
  // A kill whose test's cleanup hook then throws: the kill stands.
  {
    id: `w_cleanup`,
    owners: [`a`],
    body: [kill],
    tests: [judging(`a`, `fixed seed`, 7, { cleanupThrows: true })],
  },
  // A kill by a `test.prop` property whose last run passes.
  {
    id: `w_fcprop`,
    owners: [`a`],
    body: [kill],
    tests: [judging(`a`, `fixed seed`, 7, { asProp: true })],
  },
  // A cache that an earlier test of the file warmed: `w_unseen`'s test
  // caches under 4 first, so in the whole file `w_cold`'s write is
  // skipped. A run of the tests from `w_cold`'s on, without the one that
  // warmed the cache, observes the same and does one call more, so the
  // runner owes a selection only where it reproduces the whole file's work
  // as well as its observations. Its `drop-not` mutant writes again in the
  // whole file (`extra-work`), and writes nothing in such a selection.
  // It is the last test of its file, so its selection holds no
  // nondeterministic test, which would fail any selection to reproduce.
  {
    id: `w_cold`,
    owners: [`a`],
    warm: true,
    body: [{ kind: `memoSet` }],
    tests: [judging(`a`, `fixed seed`, 4)],
  },
  { id: `wg0`, file: LIB, owners: [], body: [push], tests: [] },
  { id: `wg1`, file: LIB, owners: [], body: [push], tests: [] },
  { id: `wg2`, file: LIB, owners: [], body: [push], tests: [] },
]

// The witnesses whose outcomes depend on what real test runs record: law
// verdicts, assertions, soft assertions, routes, crashes, framework checks,
// nondeterminism, observations, ordinary tests, and several owners. The
// rest test the static half, which gap-report-static-oracle checks
// in-process.
const captureWitness = new Set([
  `w_kill`,
  `w_dead`,
  `w_dead>unused`,
  `w_both`,
  `w_random`,
  `w_agree`,
  `w_agreeboth`,
  `w_crash`,
  `w_frame`,
  `w_unregistered`,
  `w_flaky`,
  `w_observe`,
  `w_expect`,
  `w_unseen`,
  `w_draws`,
  `w_cold`,
  `w_fast`,
  `w_fastbound`,
  `w_fastcall`,
  `w_fastcallbound`,
  `w_fastclocked`,
  `w_fastturn`,
  `w_fastplain`,
  `w_noobs`,
  `w_unreached`,
  `w_ordinary`,
  `w_foreign`,
  `w_union`,
  `w_unowned`,
  `w_assert`,
  `w_campaigns`,
  `w_soft`,
  `w_getter`,
  `w_spy`,
  `w_shared`,
  `w_caught`,
  `w_late`,
  `w_prop`,
  `w_memo`,
  `w_load`,
  `w_loaded`,
  `w_rawimport`,
  `w_hang`,
  `w_hangkill`,
  `w_hangsurvive`,
  `w_flakykill`,
  `w_crosskill`,
  `w_slowkill`,
  `w_stop`,
  `w_otherinfect`,
  `w_shrink`,
  `w_flag`,
  `w_dep`,
  `w_loop`,
  `w_iowait`,
  `w_cleanup`,
  `w_fcprop`,
  `w_record`,
  `w_data`,
  `w_optional`,
  `w_oldprobe`,
  `w_spin`,
])
// The witness module's edit sequence in two halves (`captureA` and
// `captureB`), whose union is `captureWitness` and which share no function.
// One sequence over the whole module took one CI job alone, over P12's
// 10 minutes for its determinism unit (#106, #145). The maintainer's
// decision "A one-history job over budget is cut by cost" (2026-11-16)
// replaces such a history by cheaper ones of equal reach and equal kills,
// which is not a weakening (v21.2 R7, R55 (b)). A function and the functions
// its tests or statements read stay in one half: `w_shared` with `w_kill`,
// `w_late` with `w_caught`, `w_loaded` with `w_load`, `w_dead` with its
// inner function, the memo's writers and reader, and the shortcut family.
// Only constructed histories take a half: a generated history with the
// witness module takes no steps (maintainer decision, 2026-11-11), so a
// half without steps judges nothing that `capture` does not.
const captureA = new Set([
  `w_kill`,
  `w_shared`,
  `w_dead`,
  `w_dead>unused`,
  `w_fast`,
  `w_fastbound`,
  `w_fastcall`,
  `w_fastcallbound`,
  `w_fastclocked`,
  `w_fastturn`,
  `w_fastplain`,
  `w_flaky`,
  `w_flakykill`,
  `w_both`,
  `w_random`,
  `w_agree`,
  `w_agreeboth`,
  `w_crash`,
  `w_frame`,
  `w_unregistered`,
  `w_observe`,
  `w_expect`,
  `w_noobs`,
  `w_hang`,
  `w_hangkill`,
  `w_spin`,
  `w_iowait`,
  `w_shrink`,
  `w_flag`,
  `w_loop`,
  `w_record`,
])
const captureHalves = {
  captureA,
  captureB: new Set([...captureWitness].filter((id) => !captureA.has(id))),
}
if ([...captureA].some((id) => !captureWitness.has(id)))
  throw new Error(`captureA names a function outside captureWitness`)

// ## Rendering and layout
//
// `resolve` renders the source, one statement per line (a mixed or probe
// block takes four, an `else` statement two), and records each statement's
// first line and text. Free functions come first in index order, then each
// class's methods. A preamble defines `devBuild()`, now an ordinary function
// that only the older probe form calls; the probe helpers `report` and
// `reportTwice`; and the mixed helper `reportAndPush`, which probes and also
// writes output. The witness
// function `w_probeonly` is a probe helper declared after its caller. The
// model reads the layout; the driver writes the text.
// The decided probe form (maintainer decision, 2026-11-08): at the top of
// each function that probes, the guard
// `const probing = typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production'`,
// and each probe one statement, `probing && hook(name, condition)`. The
// guard's strings may be quoted with `'` or a backtick, as the lint rule
// accepts; a function's guard takes the quote of its first `guard`
// statement.
const hookText = (probe, condition) =>
  `(globalThis as { __oracleProbe?: (name: string, condition: unknown) => void }).__oracleProbe?.(${probe}, ${condition})`
const probeText = (probe, condition) =>
  `probing && ${hookText(probe, condition)};`
const guardInit = (quote = `'`) =>
  `typeof process === ${quote}undefined${quote} ? false : process.env.NODE_ENV !== ${quote}production${quote}`
const guardText = (quote = `'`) => `const probing = ${guardInit(quote)};`
// The statements that read a function's `probing`, so the function declares
// the guard.
const usesGuard = (stmt) =>
  [`guard`, `mixed`, `probeBlock`].includes(stmt.kind) ||
  (stmt.kind === `nearProbe` && stmt.variant === `outer`)
// The form before the decision, which is production code now.
const oldProbeCallText = (probe) =>
  `(globalThis as { __oracleProbe?: (probe: string) => void }).__oracleProbe?.(${probe});`
const oldProbeText = (probe) =>
  `if (devBuild() && process.env.NODE_ENV !== 'production') ${oldProbeCallText(probe)}`
const preamble = [
  `function devBuild(): boolean {`,
  `  try {`,
  `    return process.env.NODE_ENV !== 'production'`,
  `  } catch {`,
  `    return false`,
  `  }`,
  `}`,
  `function report(): void {`,
  `  ${guardText()}`,
  `  ${probeText(`'gap#report'`, `true`)}`,
  `}`,
  `function reportTwice(): void {`,
  `  report();`,
  `  report();`,
  `}`,
  `export function reportAndPush(out: Array<string>): void {`,
  `  ${guardText()}`,
  `  ${probeText(`'gap#mixed'`, `true`)}`,
  `  out.push('h');`,
  `}`,
  `export function apply(fn: (x: number, out: Array<string>) => void, x: number, out: Array<string>): void {`,
  `  fn(x, out);`,
  `}`,
  `export function make(cls: new () => { run(x: number, out: Array<string>): void }, x: number, out: Array<string>): void {`,
  `  new cls().run(x, out);`,
  `}`,
  // Module state: a cache that `w_memo` fills, and labels that the module
  // writes when it loads (`w_load`, called at the end of the source).
  `const memo = new Map<number, string>()`,
  `export const loaded: Array<string> = []`,
]
// Module-level data: a declaration at the top of a module whose initializer
// is not a function is a unit of its own, named by its variable, as a
// function is by its name. It is in the static reference tree of every
// function that reads it, so its sites take the readers' owners; an owns
// entry may name it directly, and a whole-file entry owns it (F10, the
// ownership law of owners.mjs applied to data). Its initializer runs when the
// module loads, so its sites are reached at load. Each shape is written after
// the preamble, once, with its sites: the object literal's two field drops,
// the array element's `+`, and the primitive's boolean literal. A `readData`
// statement pushes what it reads as one template string, so its only own
// site is the push. What an initializer refers to is in the declaration's
// tree, as what a function's body refers to is in the function's.
const MODULE_DATA = [
  {
    shape: `object`,
    id: `D_OBJ`,
    text: `const D_OBJ = { n: 3, s: 'o' };`,
    read: `\`\${D_OBJ.n}\${D_OBJ.s}\``,
  },
  {
    shape: `array`,
    id: `D_ARR`,
    text: `const D_ARR = [2 + 1, devBuild];`,
    read: `\`\${D_ARR[0]}\``,
    // The array holds `devBuild` as a value, so its tree holds `devBuild`.
    refers: [`devBuild`],
  },
  {
    shape: `primitive`,
    id: `D_PRIM`,
    text: `const D_PRIM = true;`,
    read: `\`\${D_PRIM}\``,
  },
  // An object of two methods, each a unit of its own: a read calls `used`,
  // which its call brings into the reader's tree, and nothing calls
  // `spare`. Neither belongs to the declaration because its text holds it.
  {
    shape: `methods`,
    id: `D_FNS`,
    text: `const D_FNS = { used() { return 1 + 2; }, spare() { return 3 + 4; } };`,
    read: `\`\${D_FNS.used()}\``,
    refers: [],
    calls: [`used`],
  },
]
const dataOf = (shape) => MODULE_DATA.find((d) => d.shape === shape)
const preambleStatements = {
  devBuild: `return process.env.NODE_ENV !== 'production'`,
  reportTwice: `report();`,
  reportAndPushPush: `out.push('h');`,
  applyCall: `fn(x, out);`,
  makeCall: `new cls().run(x, out);`,
}

const pushText = (stmt) =>
  stmt.quote === `'`
    ? `out.push('s${stmt.label}');`
    : `out.push(\`s${stmt.label}\`);`
// Statements that reach another function, each rendered by `callText`.
const referenceKinds = new Set([
  `call`,
  `libCall`,
  `valueCall`,
  `newCall`,
  `fieldCall`,
  `bindCall`,
  `factoryCall`,
])
const condText = (stmt) =>
  stmt.not ? `!(x ${stmt.op} ${stmt.k})` : `x ${stmt.op} ${stmt.k}`

// The value an `optional` statement's object takes when `x` is falsy.
const absentOf = (stmt) => stmt.absent ?? `undefined`
// An `optional` statement's chain fields where it names none.
const OPTIONAL_DEFAULTS = {
  links: 1,
  level: 0,
  call: `none`,
  returns: `object`,
}
// The site roles of an `optional` statement's field drops and links.
const dropRole = (prop) => `drop${prop.toUpperCase()}`
const chainRole = (link) => (link === 0 ? `chain` : `chain${link}`)
// The property that each object link of an `optional` statement reads,
// outermost object first: `a`, then `b`, and `v` last, or the method `f`
// where the chain calls one.
const linkProps = (stmt) => [
  ...[`a`, `b`].slice(0, (stmt.links ?? 1) - 1),
  (stmt.call ?? `none`) === `none` ? `v` : `f`,
]
// Every `?.` link of the read that is a mutation site, first link first:
// the object links, then the `?.v` after an optional call.
const siteLinks = (stmt) =>
  linkProps(stmt).length + (stmt.call === `optional` ? 1 : 0)
// The read's text after the object's name.
const readText = (stmt) =>
  linkProps(stmt)
    .map((prop) => `?.${prop}`)
    .join(``) +
  { none: ``, optional: `?.()?.v`, plain: `?.().v` }[stmt.call ?? `none`]
// The method's source: one that returns an object, or one that returns
// nothing; absent for a falsy `x` where the method is the statement's level.
const methodText = (stmt) => {
  const method = stmt.returns === `nothing` ? `Function.prototype` : `Object`
  return (stmt.level ?? 0) === stmt.links
    ? `x ? ${method} : ${absentOf(stmt)}`
    : method
}
// The source of the object at depth `depth` of an `optional` statement: the
// object a falsy `x` leaves absent at the statement's level.
function optionalObject(stmt, depth = 0) {
  const props = linkProps(stmt)
  const value =
    depth < props.length - 1
      ? optionalObject(stmt, depth + 1)
      : (stmt.call ?? `none`) === `none`
        ? `'p${stmt.label}'`
        : methodText(stmt)
  const made = `{ ${props[depth]}: ${value} }`
  return depth === (stmt.level ?? 0) ? `x ? ${made} : ${absentOf(stmt)}` : made
}

/** The source lines of one statement. */
function renderStatement(stmt, callText) {
  const probe = `'gap#p${stmt.label}'`
  switch (stmt.kind) {
    case `push`:
      return [pushText(stmt)]
    case `flag`:
      return [`out.push(String(${stmt.value}));`]
    case `loop`:
      return [`for (let i = 0; i < 2; i += 1) ${pushText(stmt)}`]
    case `until`:
      return [`while (out.length < 3) ${pushText(stmt)}`]
    case `record`:
      return [`out.push(JSON.stringify({ n: x + 1, s: 's${stmt.label}' }));`]
    case `depNote`:
      return [`note('d');`]
    case `depSeen`:
      return [`out.push(...seen());`]
    case `if`:
      return [`if (${condText(stmt)}) ${pushText(stmt)}`]
    case `throwIf`:
      return [
        `if (x > 100) throw new Error('${stmt.message === `assertion` ? `expected x to be at most 100` : `boom`}');`,
      ]
    case `guard`:
      return [probeText(probe, `x ${stmt.op} ${stmt.k}`)]
    case `nearProbe`: {
      const hook = hookText(probe, `x ${stmt.op} ${stmt.k}`)
      return {
        former: [`process.env.NODE_ENV !== 'production' && ${hook};`],
        name: [
          `const enabled${stmt.label} = ${guardInit()};`,
          `enabled${stmt.label} && ${hook};`,
        ],
        let: [
          `{`,
          `  let probing = ${guardInit()};`,
          `  probing && ${hook};`,
          `}`,
        ],
        init: [
          `{`,
          `  const probing = process.env.NODE_ENV !== 'production';`,
          `  probing && ${hook};`,
          `}`,
        ],
        outer: [`(() => {`, `  probing && ${hook};`, `})();`],
      }[stmt.variant]
    }
    case `oldProbe`:
      return [oldProbeText(probe)]
    case `mixed`:
      return [
        `if (${condText(stmt)}) {`,
        `  ${probeText(probe, `true`)}`,
        `  ${pushText(stmt)}`,
        `}`,
      ]
    case `helperCall`:
      return [`${stmt.helper}();`]
    case `mixedHelperCall`:
      return [`reportAndPush(out);`]
    case `probeIf`:
      return [`if (${condText(stmt)}) report();`]
    case `probeBlock`:
      return [
        `if (${condText(stmt)}) {`,
        `  report();`,
        `  ${probeText(probe, `true`)}`,
        `}`,
      ]
    case `elseIf`:
      return [`if (${condText(stmt)}) report();`, `else ${pushText(stmt)}`]
    case `shortcut`:
      return [
        `if (${condText(stmt)}) {`,
        `  out.push('s' + x);`,
        `  return;`,
        `}`,
        `let n${stmt.label} = 0;`,
        `while (n${stmt.label} < x) n${stmt.label} += 1;`,
        `out.push('s' + n${stmt.label});`,
      ]
    case `callShortcut`:
      return [
        `if (${condText(stmt)}) out.push('s' + x);`,
        `else out.push(String('s' + x));`,
      ]
    case `pair`:
      return [
        `const pair = { get: (k: number): string => String(k), set: (k: number): string => String(k + 1) };`,
        `out.push(pair.get(x));`,
      ]
    case `pushStatus`:
      return [`out.push(this.status);`]
    case `getterReturn`:
      return [`return String(true);`]
    case `setterPush`:
      return [`this.tags.push(value);`]
    case `dollar`:
      return [`out.push($derived(x));`]
    case `dollarReturn`:
      return [`return String(x);`]
    case `runeState`:
      return [`let v${stmt.label} = $state(x ${stmt.op} ${stmt.k});`]
    case `runeStateRaw`:
      return [`let v${stmt.label} = $state.raw(String(x));`]
    case `runeDerived`:
      return [`const v${stmt.label} = $derived(x + 1);`]
    case `runeDerivedBy`:
      return [`const v${stmt.label} = $derived.by(() => String(x));`]
    case `runeEffect`:
      return [`${stmt.rune}(() => {`, `  ${pushText(stmt)}`, `});`]
    case `primeCall`:
      return [`this.prime();`]
    case `setTag`:
      return [`this.tag = 'b';`]
    case `pushTag`:
      return [`out.push(this.tag);`]
    case `memoSet`:
      return [`if (!memo.has(x)) memo.set(x, 's${stmt.label}');`]
    case `memoGet`:
      return [`out.push(String(memo.get(x)));`]
    case `pushLoaded`:
      return [`out.push(...loaded);`]
    case `optional`:
      return [
        `const o${stmt.label} = ${optionalObject(stmt)};`,
        `out.push(\`\${o${stmt.label}${readText(stmt)}}\`);`,
      ]
    case `readData`:
      return [`out.push(${dataOf(stmt.shape).read});`]
    case `call`:
    case `libCall`:
    case `valueCall`:
    case `newCall`:
    case `fieldCall`:
    case `bindCall`:
    case `factoryCall`:
      return [callText]
  }
  throw new Error(`unknown statement kind ${stmt.kind}`)
}

// ## The derived class's file
//
// `Derived` extends `DerivedBase`. Its constructor runs the spec's `before`
// statements, the `super('a')` call in the spec's form, then its `after`
// statements. Each statement is one line, so a site's line is its statement's
// line. Before `super`, a push labels `b<i>`, an `if` labels `c<i>` when its
// condition holds, and an `early` returns an object when it holds. After
// `super`, a push labels `a<i>`, `tag` pushes `this.tag` (`a`), and an `if`
// labels `d<i>` when its condition holds. `nothing` returns 0, so the `or`
// form calls `super` as its right operand. `derivedMake` returns a new
// `Derived`. `statements` records each statement with its phase, its line,
// its text, and its call, which is what a site of the statement is.
const superCall = {
  plain: `super('a');`,
  arrow: `[0].forEach(() => super('a'));`,
  and: `out && super('a');`,
  or: `nothing(n) || super('a');`,
}
function derivedFile(spec) {
  const lines = [
    `export class DerivedBase {`,
    `  tag: string`,
    `  constructor(tag: string) {`,
    `    this.tag = tag`,
    `  }`,
    `}`,
    `export class Derived extends DerivedBase {`,
  ]
  if (spec.field) lines.push(`  count = 0`)
  lines.push(
    `  constructor(${spec.params === `property` ? `public ` : ``}n: number, out: Array<string>) {`,
  )
  const statements = []
  const statement = (phase, kind, text, call) => {
    lines.push(`    ${text}`)
    statements.push({ phase, kind, text, call, line: lines.length })
  }
  for (const [i, s] of spec.before.entries()) {
    if (s.kind === `push`)
      statement(`before`, `push`, `out.push('b${i}');`, `out.push('b${i}');`)
    else if (s.kind === `if`)
      statement(
        `before`,
        `if`,
        `if (n ${s.op} ${s.k}) out.push('c${i}');`,
        `out.push('c${i}');`,
      )
    else statement(`before`, `early`, `if (n ${s.op} ${s.k}) return {};`)
  }
  statement(`super`, `super`, superCall[spec.form], undefined)
  for (const [i, s] of spec.after.entries()) {
    if (s.kind === `push`)
      statement(`after`, `push`, `out.push('a${i}');`, `out.push('a${i}');`)
    else if (s.kind === `tag`)
      statement(`after`, `tag`, `out.push(this.tag);`, `out.push(this.tag);`)
    else
      statement(
        `after`,
        `if`,
        `if (n ${s.op} ${s.k}) out.push('d${i}');`,
        `out.push('d${i}');`,
      )
  }
  lines.push(`  }`, `}`)
  lines.push(
    `function nothing(x: number): number {`,
    `  return x - x;`,
    `}`,
    // A concise arrow, which has no `return` statement to mutate: what
    // `derivedMake` returns is what the derived runs read.
    `export const derivedMake = (x: number, out: Array<string>): Derived =>`,
    `  new Derived(x, out);`,
  )
  // `nothing`'s `return`, a site of its own outside the constructor.
  const returnLine = lines.indexOf(`  return x - x;`) + 1
  return { source: `${lines.join(`\n`)}\n`, statements, returnLine }
}

// What a derived class's constructor pushes for `x`, and the fields it sets:
// the labels in order (each `if` pushes its label when its comparison holds
// for `x`), and, unless an early `return` left the constructor first, the tag
// the base class sets, `n` for a parameter property, and `count` for a field
// initializer. An early return yields the object it returns, with no fields.
// The source's and the instrumented copy's runs must both agree with it.
export function derivedExpected(spec, x) {
  const labels = []
  for (const [i, s] of spec.before.entries()) {
    if (s.kind === `push`) labels.push(`b${i}`)
    else if (s.kind === `if`) {
      if (holds(x, s.op, s.k)) labels.push(`c${i}`)
    } else if (holds(x, s.op, s.k)) return { labels }
  }
  spec.after.forEach((s, i) => {
    if (s.kind === `push`) labels.push(`a${i}`)
    else if (s.kind === `tag`) labels.push(`a`)
    else if (holds(x, s.op, s.k)) labels.push(`d${i}`)
  })
  return {
    labels,
    tag: `a`,
    ...(spec.params === `property` ? { n: x } : {}),
    ...(spec.field ? { count: 0 } : {}),
  }
}

/**
 * The format Vite loads a config file in, so the format Vitest loads it in
 * (Vite's config docs and `isFilePathESM`): `.mjs` and `.mts` are ES
 * modules, `.cjs` and `.cts` are CommonJS, and any other extension follows
 * the package's module type. The fixture keeps every config under the
 * package's own package.json.
 */
const formatOf = (file, packageType) =>
  /\.m[jt]s$/.test(file)
    ? `esm`
    : /\.c[jt]s$/.test(file)
      ? `cjs`
      : packageType === `module`
        ? `esm`
        : `cjs`

/**
 * The package's config and module type, and the runner's contexts. A plan
 * whose config a fault, the environment, or a setup file needs has a config
 * file. A config holds only what Vitest itself loads in its format: a
 * top-level await only in an ES module, `require` only in CommonJS. A
 * JavaScript config in CommonJS is written in CommonJS syntax
 * (`module.exports`); every other config uses `import` and `export`. A
 * config with no default export (`configNoDefault`) is an `export` without
 * `default`, so its CommonJS JavaScript name becomes TypeScript (`.cjs` to
 * `.cts`, `.js` to `.ts`), which keeps its format.
 */
function configOf(history) {
  const needsConfig =
    [
      `configThrows`,
      `configNoDefault`,
      `configNull`,
      `configSyntax`,
      `projects`,
      `setupThrows`,
    ].includes(history.fault) ||
    history.configEnv === true ||
    history.setupGlobal === true
  const place =
    history.configPlace === `none` && needsConfig
      ? `discovered`
      : (history.configPlace ?? `discovered`)
  const packageType = history.packageType ?? `module`
  const named = history.configFile ?? `vite.config.ts`
  // A config in the parent directory has no package.json beside or above
  // it, so Node and Vite read its `.js` or `.ts` name as CommonJS.
  const format = formatOf(named, place === `parent` ? `commonjs` : packageType)
  const discovered =
    history.fault === `configNoDefault` && format === `cjs`
      ? named.replace(/\.c?js$/, (ext) => (ext === `.cjs` ? `.cts` : `.ts`))
      : named
  const configPath =
    place === `none`
      ? undefined
      : place === `named`
        ? `config/gap-vitest.${discovered.split(`.`).at(-1)}`
        : place === `parent`
          ? `../${discovered}`
          : discovered
  return {
    configFile: discovered,
    configPath,
    configPlace: place,
    packageType,
    configFormat: format,
    // CommonJS syntax: a JavaScript config in CommonJS.
    configSyntax:
      format === `cjs` && /\.c?js$/.test(discovered) ? `cjs` : `esm`,
    configAwait: history.configAwait === true && format === `esm`,
    configRequire: history.configRequire === true && format === `cjs`,
    contexts: history.contexts ?? 4,
  }
}

/**
 * Where a history's config sets `test.root` (`testRoots`): its drawn shape
 * where a shape applies, and the package (`none`) elsewhere. A shape's root
 * is written from the config's own URL, so only an ES module config sets
 * one, and only the config that Vitest discovers in the package: a config
 * that `--config` names (and the `config` edit's second config, which it
 * names) sits in `config/`, and a parent's config above the package, so the
 * shape's paths would name other directories; a `projects` config nests its
 * test options in a project.
 */
function testRootOf(history) {
  const config = configOf(history)
  const steps = [...(history.steps ?? []), ...laterStepsOf(history)]
  return config.configFormat === `esm` &&
    config.configPlace === `discovered` &&
    history.fault !== `projects` &&
    !steps.includes(`config`)
    ? (history.testRoot ?? `none`)
    : `none`
}

/**
 * Whether a history's config has the load plugin (`LOAD_PLUGIN`): where it
 * draws one and has a config whose syntax can import `readFileSync`.
 */
function loadPluginOf(history) {
  const config = configOf(history)
  return (
    history.loadPlugin === true &&
    config.configPlace !== `none` &&
    config.configSyntax === `esm`
  )
}

function resolveHistory(history) {
  let label = 0
  const containerOf = (index) => history.containers[index] ?? `free`
  // Generated functions: methods take names in order within their class.
  const used = { C0: 0, C1: 0 }
  const generated = history.functions.map((body, index) => {
    const container = containerOf(index)
    const id =
      container === `free`
        ? `f${index}`
        : `${container}.${METHOD_NAMES[used[container]++]}`
    return {
      id,
      container,
      overload: container === `free` && history.overloads[index] === true,
      generated: true,
      owners: { a: [`a`], b: [`b`], both: [`a`, `b`], none: [] }[
        history.owners[index] ?? `none`
      ],
      body,
    }
  })
  // A call goes to a later function, by name to a free function, or through
  // `this` to a method of the same class; any other target is a push.
  const classOf = (id) => (id.includes(`.`) ? id.split(`.`)[0] : `free`)
  for (const [index, fn] of generated.entries())
    fn.body = fn.body.map((stmt) => {
      const later = generated.slice(index + 1)
      const pick = (candidates) =>
        candidates.length > 0
          ? candidates[stmt.target % candidates.length].id
          : undefined
      const reference = {
        valueCall: () => pick(later.filter((t) => t.container === `free`)),
        newCall: () => pick(later.filter((t) => t.container !== `free`)),
        fieldCall: () =>
          fn.container === `free`
            ? undefined
            : pick(
                later.filter(
                  (t) => t.container !== `free` && t.container !== fn.container,
                ),
              ),
        bindCall: () =>
          fn.container === `free`
            ? undefined
            : pick(later.filter((t) => t.container === fn.container)),
        factoryCall: () =>
          pick(
            later.filter(
              (t) => t.container !== `free` && t.id.endsWith(`.run`),
            ),
          ),
      }[stmt.kind]
      if (reference) {
        const to = reference()
        return to ? { kind: stmt.kind, to } : { kind: `push`, quote: `'` }
      }
      if (stmt.kind !== `call`) return stmt
      const target = later[stmt.target % Math.max(1, later.length)]
      if (
        target &&
        (target.container === `free` || target.container === fn.container)
      )
        return { kind: `call`, to: target.id }
      return { kind: `push`, quote: `'` }
    })
  // Each `optional` statement takes its absent object and its chain, in
  // order. A history filed before either field existed reads `undefined` and
  // one link (register M, "Replay by history").
  let optionals = 0
  for (const fn of generated)
    fn.body = fn.body.map((stmt) => {
      if (stmt.kind !== `optional`) return stmt
      const chain = history.optionalChains?.[optionals]
      const links = chain?.links ?? 1
      const call = chain?.call ?? `none`
      const absent = history.absentObjects?.[optionals] ?? `undefined`
      optionals += 1
      return {
        ...stmt,
        absent,
        links,
        // The method itself is one more level that may be absent.
        level: (chain?.level ?? 0) % (links + (call === `none` ? 0 : 1)),
        call,
        returns: call === `plain` ? `object` : (chain?.returns ?? `object`),
      }
    })
  const library = history.library.map((body, index) => ({
    id: `g${index}`,
    file: LIB,
    container: `free`,
    generated: true,
    library: true,
    owners: { a: [`a`], b: [`b`], none: [] }[
      history.libraryOwners[index] ?? `none`
    ],
    body,
  }))
  // A library call names a library function; with none, it is a push.
  for (const fn of generated)
    fn.body = fn.body.map((stmt) =>
      stmt.kind !== `libCall`
        ? stmt
        : library.length > 0
          ? {
              kind: `libCall`,
              to: library[stmt.target % library.length].id,
              alias: stmt.alias,
            }
          : { kind: `push`, quote: `'` },
    )
  // The library's `$derived`, which a `dollar` statement calls.
  const dollar = library.some((fn) =>
    fn.body.some((stmt) => stmt.kind === `dollar`),
  )
    ? [
        {
          id: `$derived`,
          file: LIB,
          container: `free`,
          signature: `$derived(x: number): string`,
          library: true,
          owners: [],
          body: [{ kind: `dollarReturn` }],
          tests: [],
        },
      ]
    : []
  // The `..gen/` source's one function.
  const dotGen = history.dotGen
    ? [
        {
          id: `e0`,
          file: DOTGEN,
          container: `free`,
          owners: [`a`],
          body: [{ kind: `push`, quote: `'` }],
          tests: [],
        },
      ]
    : []
  // The Svelte module's functions.
  const runes = (history.runes ?? []).map((body, index) => ({
    id: `r${index}`,
    file: RUNES,
    container: `free`,
    owners: [],
    body,
    tests: [],
  }))
  // The unnamed exports' functions, each calling its file's helper, and the
  // importer that calls each.
  const exported = (history.exportOwners ?? []).flatMap((owner, index) => {
    const form = EXPORT_FORMS[index]
    const helper = {
      id: `h_${form.exportForm}`,
      name: `help`,
      file: form.file,
      container: `free`,
      owners: [],
      body: [{ kind: `push`, quote: `'` }],
      tests: [],
    }
    return [
      {
        ...form,
        id: `x_${form.exportForm}`,
        container: `free`,
        owners: owner === `none` ? [] : [owner],
        body: [{ kind: `call`, to: helper.id }],
        tests: [],
      },
      helper,
    ]
  })
  const importable = exported.filter((fn) => fn.imported !== undefined)
  const importer =
    (history.importer ?? `none`) !== `none` && importable.length > 0
      ? [
          {
            id: `importer`,
            file: IMPORTER,
            container: `free`,
            owners: [history.importer],
            body: importable.map((fn) => ({ kind: `call`, to: fn.id })),
            tests: [],
          },
        ]
      : []
  // The derived class's file, which is no function of the model's (see
  // `derivedFile`).
  const file = history.derived ? derivedFile(history.derived) : undefined
  const functions = [
    ...generated,
    ...library,
    ...dollar,
    ...runes,
    ...exported,
    ...importer,
    ...dotGen,
    ...(history.witness || stopsOnly(history)
      ? witness
          .filter(
            (w) =>
              // The budget witness costs two 10 s confirmations per mutant,
              // so only histories of the `budget` mode carry it.
              (history.witness === true && w.id !== `w_slowpair`) ||
              (history.witness === `capture` && captureWitness.has(w.id)) ||
              captureHalves[history.witness]?.has(w.id) ||
              (stopsOnly(history) && w.id === `w_stop`) ||
              (history.witness === `budget` && w.id === `w_slowpair`),
          )
          .map((w) => ({
            ...w,
            container:
              w.container ?? (w.id.includes(`.`) ? w.id.split(`.`)[0] : `free`),
            generated: false,
          }))
      : []),
  ].map((fn) => ({
    file: SOURCE,
    ...fn,
    body: fn.body.map((stmt) => ({ ...stmt, label: ++label })),
  }))
  const byId = new Map(functions.map((fn) => [fn.id, fn]))
  const callText = (stmt) =>
    stmt.kind === `valueCall`
      ? `apply(${stmt.to}, x, out);`
      : stmt.kind === `factoryCall`
        ? `make(${classOf(stmt.to)}, x, out);`
        : stmt.kind === `newCall`
          ? `new ${classOf(stmt.to)}().${stmt.to.split(`.`)[1]}(x, out);`
          : stmt.kind === `fieldCall`
            ? `this.peer${classOf(stmt.to)}.${stmt.to.split(`.`)[1]}(x, out);`
            : stmt.kind === `bindCall`
              ? `this.${stmt.to.split(`.`)[1]}.bind(this)(x, out);`
              : stmt.kind === `libCall`
                ? `${stmt.alias ? `h_${stmt.to}` : stmt.to}(x, out);`
                : byId.get(stmt.to).container === `free`
                  ? `${stmt.to}(x, out);`
                  : `this.${stmt.to.split(`.`)[1]}(x, out);`

  // The main file starts with its import from the library, then the
  // preamble, then free functions, then each class. The library holds its
  // functions alone.
  const imported = [
    ...new Set(
      functions.flatMap((fn) =>
        fn.body
          .filter((stmt) => stmt.kind === `libCall`)
          .map((stmt) => (stmt.alias ? `${stmt.to} as h_${stmt.to}` : stmt.to)),
      ),
    ),
  ]
  const libLines = []
  // The workspace dependency's import shares the first line, so the
  // preamble's lines do not move.
  const lines = [
    `import { ${imported.join(`, `)} } from './lib'; import { note, seen } from 'state-dep'${history.depSubpath ? `; import 'state-dep/extra'` : ``}`,
    ...preamble,
  ]
  // Module-level data, after the preamble: each shape that a function reads
  // or an owns entry names, with its direct owners.
  const data = MODULE_DATA.flatMap((d, index) => {
    const owners = { a: [`a`], b: [`b`], none: [] }[
      history.dataOwners?.[index] ?? `none`
    ]
    const read = functions.some((fn) =>
      fn.body.some(
        (stmt) => stmt.kind === `readData` && stmt.shape === d.shape,
      ),
    )
    if (!read && owners.length === 0) return []
    lines.push(d.text)
    return [{ ...d, owners, line: lines.length }]
  })
  // A body's statements, each on its own lines. A nested function (an
  // `inner` statement) is defined where it is called: an arrow assigned to
  // its name, or a method of an object literal.
  const emitBody = (body, indent) => {
    for (const stmt of body) {
      if (stmt.kind === `innerUnused` || stmt.kind === `innerReturned`) {
        // Defined, and called by nothing here: left unused, or returned.
        const inner = byId.get(stmt.to)
        lines.push(`${indent}const ${inner.name} = (): void => {`)
        emitBody(inner.body, `${indent}  `)
        lines.push(`${indent}};`)
        stmt.lines =
          stmt.kind === `innerReturned` ? [`return ${inner.name};`] : []
      } else if (stmt.kind === `inner`) {
        const inner = byId.get(stmt.to)
        if (inner.form === `arrow`) {
          lines.push(`${indent}const ${inner.name} = (): void => {`)
          emitBody(inner.body, `${indent}  `)
          lines.push(`${indent}};`)
        } else if (inner.form === `function`) {
          lines.push(`${indent}function ${inner.name}(): void {`)
          emitBody(inner.body, `${indent}  `)
          lines.push(`${indent}}`)
        } else {
          lines.push(
            `${indent}const peer = {`,
            `${indent}  ${inner.name}(): void {`,
          )
          emitBody(inner.body, `${indent}    `)
          lines.push(`${indent}  },`, `${indent}};`)
        }
        stmt.lines = [
          inner.form === `method`
            ? `peer.${inner.name}();`
            : `${inner.name}();`,
        ]
      } else
        stmt.lines = renderStatement(
          stmt,
          referenceKinds.has(stmt.kind) ? callText(stmt) : undefined,
        )
      stmt.line = lines.length + 1
      for (const line of stmt.lines) lines.push(`${indent}${line}`)
    }
  }
  const emit = (fn, indent) => {
    const name = fn.container === `free` ? fn.id : fn.id.split(`.`)[1]
    if (fn.overload)
      lines.push(
        `${indent}export function ${name}(x: number, out: Array<string>): void`,
      )
    const signature =
      fn.signature ?? `${name}(x: number, out: Array<string>): void`
    lines.push(
      fn.container === `free`
        ? `${indent}export function ${signature} {`
        : `${indent}${signature} {`,
    )
    if (fn.body.some(usesGuard)) {
      fn.guardLine = lines.length + 1
      fn.guardQuote =
        fn.body.find((stmt) => stmt.kind === `guard`)?.quote ?? `'`
      lines.push(`${indent}  ${guardText(fn.guardQuote)}`)
    }
    emitBody(fn.body, `${indent}  `)
    lines.push(`${indent}}`)
  }
  for (const fn of functions)
    if (fn.container === `free` && fn.file === SOURCE) emit(fn, ``)
  for (const cls of [...new Set(functions.map((f) => f.container))].filter(
    (c) => c !== `free` && c !== `nested`,
  )) {
    lines.push(`export class ${cls} {`)
    // A field holds each class that a method here calls through a field.
    for (const peer of new Set(
      functions
        .filter((fn) => fn.container === cls)
        .flatMap((fn) => fn.body)
        .filter((stmt) => stmt.kind === `fieldCall`)
        .map((stmt) => classOf(stmt.to)),
    ))
      lines.push(`  peer${peer} = new ${peer}()`)
    for (const fn of functions)
      if (fn.container === cls && fn.field) lines.push(`  ${fn.field}`)
    for (const fn of functions) if (fn.container === cls) emit(fn, `  `)
    lines.push(`}`)
  }
  // Code that runs when the module loads: `w_load` writes its labels into
  // `loaded`, which `w_loaded` reads, and a booted first function writes
  // into an array no one reads.
  const loadCalls = []
  if (functions.some((fn) => fn.id === `w_load`)) {
    loadCalls.push({
      fn: `w_load`,
      line: lines.length + 1,
      text: `w_load(0, loaded);`,
    })
    lines.push(`w_load(0, loaded);`)
  }
  const [first] = generated
  if (
    history.boot === true &&
    first?.container === `free` &&
    first.body.every(
      (stmt) =>
        stmt.kind !== `until` &&
        !referenceKinds.has(stmt.kind) &&
        stmt.kind !== `libCall`,
    )
  ) {
    loadCalls.push({
      fn: first.id,
      line: lines.length + 1,
      text: `${first.id}(0, []);`,
    })
    lines.push(`${first.id}(0, []);`)
  }
  const source = `${lines.join(`\n`)}\n`
  // The library and the Svelte module are laid out the same way, each in
  // its own file.
  const mainLines = lines.splice(0)
  for (const fn of functions) if (fn.file === LIB) emit(fn, ``)
  libLines.push(...lines.splice(0))
  for (const fn of functions) if (fn.file === RUNES) emit(fn, ``)
  const runesLines = lines.splice(0)
  for (const fn of functions) if (fn.file === DOTGEN) emit(fn, ``)
  // A top-level loop, whose variable is no unit: its code is `<module>`'s.
  const topLoop =
    dotGen.length > 0
      ? { line: lines.length + 1, text: `for (let i = 1 - 1; i < 1; i += 1);` }
      : undefined
  if (topLoop) lines.push(topLoop.text)
  const dotGenSource =
    dotGen.length > 0 ? `${lines.splice(0).join(`\n`)}\nexport {}\n` : undefined
  // Each unnamed export's file: its helper, then its opening line, its call
  // of the helper, and its close. The importer's file imports each and calls
  // each, one per line after its opening line.
  const exportSources = Object.fromEntries(
    functions
      .filter((fn) => fn.exportForm !== undefined)
      .map((fn) => {
        const helper = byId.get(fn.body[0].to)
        const [push] = helper.body
        push.lines = [pushText(push)]
        push.line = 2
        const [call] = fn.body
        call.lines = [`help(out);`]
        call.line = 5
        const typed = fn.file.endsWith(`.ts`)
        return [
          fn.file,
          [
            typed
              ? `function help(out: Array<string>): void {`
              : `function help(out) {`,
            `  ${push.lines[0]}`,
            `}`,
            fn.open,
            `  ${call.lines[0]}`,
            fn.close,
            ``,
          ].join(`\n`),
        ]
      }),
  )
  for (const fn of functions)
    if (fn.file === IMPORTER) {
      const imports = fn.body.map((stmt) => byId.get(stmt.to).imported)
      fn.body.forEach((stmt, index) => {
        stmt.lines = [`${byId.get(stmt.to).exportForm}(x, out);`]
        stmt.line = imports.length + 2 + index
      })
      exportSources[IMPORTER] = [
        ...imports,
        `export function importer(x: number, out: Array<string>): void {`,
        ...fn.body.map((stmt) => `  ${stmt.lines[0]}`),
        `}`,
        ``,
      ].join(`\n`)
    }
  lines.push(...mainLines)
  const librarySource = `${libLines.join(`\n`)}\nexport {}\n`
  const runesSource =
    runes.length > 0 ? `${runesLines.join(`\n`)}\nexport {}\n` : undefined

  const generatedIds = generated.map((fn) => fn.id)
  const tests = [
    ...history.tests.map((t) => ({
      ...t,
      fn: generatedIds[t.fn % generatedIds.length],
      // A generated test declares a work bound of 1 (an oracle property's
      // `work`, which rejects a mutant that does any more work there) when
      // its input is a multiple of 3: derived from the plan, not drawn, so
      // the grammar's generated histories, and their cost, stay those of
      // the grammar without the work law.
      work: t.work ?? (t.input % 3 === 0 ? 1 : null),
    })),
    ...functions.flatMap((fn) =>
      fn.generated ? [] : fn.tests.map((t) => ({ ...t, fn: t.fn ?? fn.id })),
    ),
  ]
  const pushes = functions
    .filter((fn) => fn.file === SOURCE)
    .flatMap((fn) =>
      fn.body
        .filter((stmt) => [`push`, `if`, `mixed`, `elseIf`].includes(stmt.kind))
        .map((stmt) => ({ fn: fn.id, stmt })),
    )
  const authoredFrom = (spec, id) => {
    const target = pushes[spec.stmt % pushes.length]
    const find =
      spec.kind === `stale`
        ? `out.push('nope');`
        : spec.kind === `ambiguous`
          ? `out.push(`
          : pushText(target.stmt)
    return {
      id,
      fn: target.fn,
      label: target.stmt.label,
      find,
      replace:
        spec.kind === `apply`
          ? pushText(target.stmt).replace(
              `s${target.stmt.label}`,
              `s${target.stmt.label}!`,
            )
          : `out.push('x');`,
      applies: source.split(find).length - 1 === 1,
      line: source.slice(0, source.indexOf(find)).split(`\n`).length,
      kind: spec.kind,
    }
  }
  const authored =
    history.authored && pushes.length > 0
      ? authoredFrom(history.authored, `a1`)
      : undefined
  const authoredList = authored
    ? [
        authored,
        ...(history.secondAuthored
          ? [
              authoredFrom(
                { stmt: history.authored.stmt + 1, kind: `apply` },
                `a2`,
              ),
            ]
          : []),
      ]
    : []
  // A run that reaches its own check keeps an owner (see `reachesRun`).
  const ownerless = history.ownerless === true && !reachesRun(history)
  const plan = {
    functions: ownerless
      ? functions.map((fn) => ({ ...fn, owners: [] }))
      : functions,
    data: ownerless ? data.map((d) => ({ ...d, owners: [] })) : data,
    tests,
    authored,
    authoredList,
    loadCalls,
    wholeFile: history.wholeFile,
    // A fault injects an entry into an oracle file, so it needs one: only a
    // history with no fault can have no oracle file.
    declaration:
      history.declaration === `neither` && (history.fault ?? `none`) !== `none`
        ? `wrapper`
        : (history.declaration ?? `wrapper`),
    ownerless,
    template: history.template,
    fault: history.fault,
    stability: history.stability,
    steps: [...(history.steps ?? []), ...laterStepsOf(history)],
    pauseEngages: history.pauseEngages !== false,
    warmReplaced: history.warmReplaced === true,
    replyHeld: history.replyHeld === true,
    lazyGate: history.lazyGate === true,
    fsRead: history.fsRead ?? `none`,
    spinData: history.spinData === true,
    siblingDir: history.siblingDir === true,
    hookStops: history.hookStops === true,
    spinThrows: history.spinThrows === true,
    slowStart: history.slowStart ?? false,
    shortWait: history.shortWait === true,
    // Whether a step edits file b's helper during a check (`midrun`): then
    // file a loads the helper and holds the test that edits it.
    midrun: [...(history.steps ?? []), ...laterStepsOf(history)].includes(
      `midrun`,
    ),
    // Which file's test lands the mid-run edit (`midrunBy`), and what it
    // edits (`midrunTarget`): file a edits file b's helper after its
    // context loaded it, or file b edits its own helper or the data file
    // that its verdict reads through fs, after its judged tests read them.
    // Then the run that lands the edit read the old text, and its verdict
    // follows it (review of #55, F1).
    midrunBy: history.midrunBy ?? `a`,
    midrunTarget: midrunTargetOf(history),
    consoleOutput: history.consoleOutput === true,
    // The oracle files that hold a failing law (`failingLaw` above). A
    // history filed before the field existed holds none.
    failingLaw: history.failingLaw ?? `none`,
    failingLawAt: history.failingLawAt ?? `end`,
    failingLawCalls: history.failingLawCalls ?? `none`,
    failingLawHook: history.failingLawHook ?? `none`,
    failingLawSpins: history.failingLawSpins === true,
    ordinary: history.ordinary === true,
    // The batch whose run rejects (a test-only fault; 0 is none).
    rejectBatch: history.rejectBatch ?? 0,
    // Whether two checks at once are held to overlap in the daemon.
    holdOverlap: history.holdOverlap === true,
    // An `owns` key in an assertion's arguments, in the ordinary file: its
    // assertion form and whether its list is a literal, or none.
    matcherOwns: history.matcherOwns ?? `none`,
    config: history.config ?? `object`,
    prePlugin: history.prePlugin === true,
    tornRows: history.tornRows === true,
    ...configOf(history),
    configEnv: history.configEnv === true,
    // Where the config's `test.root` sits (`testRoots`, issue #101), and
    // whether it has the load plugin, where each applies.
    testRoot: testRootOf(history),
    loadPlugin: loadPluginOf(history),
    native: history.native ?? `none`,
    // A prebuilt addon in the workspace dependency's build/Release
    // (`addRelease`).
    release: history.release === true,
    // A scoped package with a prebuilt addon (`addScopedAddon`).
    scopedAddon: history.scopedAddon === true,
    depSubpath: history.depSubpath === true,
    unbuiltDep: history.unbuiltDep === true,
    budget: history.budget ?? `two`,
    outMode: history.outMode ?? `explicit`,
    // Both name the run's `--out` directory before it starts, so they need
    // an explicit one (a default directory is chosen by the CLI).
    logBlocked:
      history.logBlocked === true && outModeOf(history) === `explicit`,
    // A second run needs a live first run, which has its note and stream log.
    // A blocked log refuses the first run before it is live, and a refusing
    // fault (an argument, declaration, or config fault) ends it before its note
    // too, so the overlap is generated only for a run that reaches its check
    // (decision of 2026-11-13, review of #57: O1 and O2).
    overlap:
      history.overlap === true &&
      outModeOf(history) === `explicit` &&
      history.logBlocked !== true &&
      (history.fault ?? `none`) === `none`,
    stopRuns: history.stopRuns ?? [],
    spawnStop: history.spawnStop === true,
    spawnSignal: history.spawnSignal ?? `SIGINT`,
    spawnDelay: history.spawnDelay ?? 0,
    // A claim that every start must refuse (`claimScenario` above). The claim
    // is read after the arguments, so a run whose arguments refuse
    // (`outsideSource`) refuses for them first, and draws no claim.
    claimScenario:
      (history.fault ?? `none`) === `outsideSource`
        ? false
        : (history.claimScenario ?? false),
    logLost: history.logLost ?? false,
    supervisorDeath: history.supervisorDeath ?? false,
    unsupervised: history.unsupervised === true,
    spawnOnStart: history.spawnOnStart === true,
    psMissing: history.psMissing === true,
    onlyRun: history.onlyRun === true,
    pragma: history.pragma === true,
    cliPath: history.cliPath ?? `plain`,
    concurrentStart: history.concurrentStart === true,
    setupGlobal: history.setupGlobal === true,
    // `cased` names another file where letter case matters.
    sourceSpelling:
      history.sourceSpelling === `cased` && !caseless
        ? `plain`
        : (history.sourceSpelling ?? `plain`),
    ownsSpelling: history.ownsSpelling ?? `plain`,
    // The source files the CLI is asked to check.
    sources: [
      SOURCE,
      LIB,
      ...(runesSource ? [RUNES] : []),
      ...(dotGenSource ? [DOTGEN] : []),
      ...Object.keys(exportSources),
      ...(file ? [DERIVED] : []),
    ],
    dotGenSource,
    exportSources,
    topLoop,
    history,
    source,
    librarySource,
    runesSource,
    derived: file && {
      spec: history.derived,
      source: file.source,
      statements: file.statements,
      returnLine: file.returnLine,
    },
  }
  // How file a reads the data file that an authored mutant edits
  // (`authoredRead`). A run with no owns entry or no oracle file refuses for
  // that, and its data entry would change what it refuses for; under the
  // `link` test root the test files live outside the package, so their
  // relative path to it differs.
  const read = history.authoredRead ?? `none`
  return {
    ...plan,
    authoredRead:
      read === `none` ||
      ownsNothing(plan) ||
      plan.declaration === `neither` ||
      plan.testRoot === `link`
        ? `none`
        : read,
  }
}

/** The `--source` argument: each source path in the plan's spelling. */
// A path in the package, spelled as `spelling` says; `link` is the absolute
// path of a symbolic link to the package, for `linked`.
const spell = (path, spelling, link) =>
  spelling === `dot`
    ? `./${path}`
    : spelling === `redundant`
      ? path.replace(`src/`, `src/../src/`)
      : spelling === `linked`
        ? `${link}/${path}`
        : spelling === `cased`
          ? path.replace(
              /[^/]+$/,
              (name) => name[0].toUpperCase() + name.slice(1),
            )
          : path
// A file beside the fixture package, outside it (the fixture's directory
// holds this CLI's own files).
const OUTSIDE = `../vitest.config.mjs`
const sourceArgument = (plan, link) =>
  [
    ...plan.sources.map((path) => spell(path, plan.sourceSpelling, link)),
    ...(plan.fault === `outsideSource` ? [OUTSIDE] : []),
  ].join(`,`)

// ## Model
//
// The model is an interpreter of the grammar, not of TypeScript. Each
// statement owns the sites that law 1 promises for its form, in document
// order, at the line `resolve` laid out, with the statement text that law 6
// anchors them to. Law 2 marks probe-only sites, deriving probe helpers
// among the generated free functions by the fixpoint the law states.
// Ownership (law 3) comes from the declared entries and the call
// statements, so it is a property of the source, not of what any test ran.
// A mutant is one active site: the interpreter forces or swaps its
// condition, drops its negation, or skips its call. Running each owner test
// with and without it gives the test's output, whether it threw, which sites
// it reached, and which outcomes each `if` took. Law 4's ladder turns those
// facts into the mutant's outcome. Nothing here reads the instrumenter or the
// CLI.
const swapped = {
  '<': `<=`,
  '<=': `<`,
  '>': `>=`,
  '>=': `>`,
  '===': `!==`,
  '!==': `===`,
}
const holds = (a, op, b) =>
  op === `<`
    ? a < b
    : op === `<=`
      ? a <= b
      : op === `>`
        ? a > b
        : op === `>=`
          ? a >= b
          : op === `===`
            ? a === b
            : a !== b
// A test's campaigns: its own route and input, then an optional second one.
const partsOf = (t) =>
  t.framework
    ? []
    : [{ route: t.route, input: t.input }, ...(t.then ? [t.then] : [])]
// A campaign's route kind; a test that registered nothing has none.
const routeOf = (t, part = t) =>
  !t.registered
    ? `unknown`
    : [`fixed seed`, `fixed history`, `case`].includes(part.route)
      ? `reproducible`
      : part.route === `random seed`
        ? `random`
        : part.route === `calibration`
          ? `framework`
          : `unknown`

/**
 * Law 6's normalization: the statement's tokens, as TypeScript's scanner
 * reads them, joined by single spaces. The scanner reads `>` alone unless
 * asked to rescan it, which joins `>=`.
 */
function tokens(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true)
  scanner.setText(text)
  const found = []
  for (
    let kind = scanner.scan();
    kind !== ts.SyntaxKind.EndOfFileToken;
    kind = scanner.scan()
  ) {
    if (kind === ts.SyntaxKind.GreaterThanToken) scanner.reScanGreaterToken()
    found.push(scanner.getTokenText())
  }
  return found.join(` `)
}

/** The functions whose every statement is probe-only (law 2), by fixpoint. */
function probeHelpers(plan) {
  // The preamble's helpers satisfy the same rule; they are not in the plan.
  const helpers = new Set([`report`, `reportTwice`])
  const probeOnly = (stmt) =>
    [`guard`, `helperCall`, `probeIf`, `probeBlock`].includes(stmt.kind) ||
    (stmt.kind === `call` && helpers.has(stmt.to))
  for (let grew = true; grew;) {
    grew = false
    for (const fn of plan.functions)
      if (
        fn.container === `free` &&
        !helpers.has(fn.id) &&
        fn.body.every(probeOnly)
      ) {
        helpers.add(fn.id)
        grew = true
      }
  }
  return { helpers, probeOnly }
}

function sitesOf(plan) {
  const { helpers, probeOnly } = probeHelpers(plan)
  const sites = []
  const fileOf = new Map(plan.functions.map((fn) => [fn.id, fn.file]))
  // A site names its function as law 1 does; `fnId` is the model's own,
  // which tells apart two functions of one name.
  const nameOf = new Map(plan.functions.map((fn) => [fn.id, fn.name ?? fn.id]))
  const add = (fn, line, operator, text, extra = {}) =>
    sites.push({
      id: sites.length,
      file: fileOf.get(fn) ?? SOURCE,
      function: nameOf.get(fn) ?? fn,
      fnId: fn,
      line,
      operator,
      text: tokens(text),
      probe: false,
      ...extra,
    })
  // A decided probe statement: `&&`, then the hook call, the `&&`'s right
  // operand and so a value-position call, then a comparison in its
  // condition, or a `bool-flip` for the literal `true`. It has no call
  // statement to delete.
  const guard = (fn, line, probe, condition) => {
    const text = probeText(probe, condition)
    add(fn, line, `binary-swap`, text, { probe: true })
    add(fn, line, `value-undefined`, text, { probe: true })
    add(fn, line, condition === `true` ? `bool-flip` : `binary-swap`, text, {
      probe: true,
    })
  }
  // The guard's declaration: its `===`, its `false`, and its `!==`, all
  // probe-only code.
  const declaration = (fn, line, quote, extra = { probe: true }) => {
    const text = guardText(quote)
    add(fn, line, `binary-swap`, text, extra)
    add(fn, line, `bool-flip`, text, extra)
    add(fn, line, `binary-swap`, text, extra)
  }
  // `devBuild()` is an ordinary function now; only the older probe form calls it.
  add(`devBuild`, 4, `binary-swap`, preambleStatements.devBuild, {
    role: `devBuild`,
  })
  add(`devBuild`, 4, `return-undefined`, preambleStatements.devBuild, {
    role: `devBuildReturn`,
  })
  // Its `return false` runs only when reading the environment throws.
  add(`devBuild`, 6, `bool-flip`, `return false`, { role: `devBuildFalse` })
  add(`devBuild`, 6, `return-undefined`, `return false`, {
    role: `devBuildFalseReturn`,
  })
  declaration(`report`, 10, `'`)
  guard(`report`, 11, `'gap#report'`, `true`)
  add(`reportTwice`, 14, `delete-call`, preambleStatements.reportTwice, {
    probe: true,
  })
  add(`reportTwice`, 15, `delete-call`, preambleStatements.reportTwice, {
    probe: true,
  })
  declaration(`reportAndPush`, 18, `'`)
  guard(`reportAndPush`, 19, `'gap#mixed'`, `true`)
  add(
    `reportAndPush`,
    20,
    `delete-call`,
    preambleStatements.reportAndPushPush,
    {
      role: `helperPush`,
    },
  )
  add(`apply`, 23, `delete-call`, preambleStatements.applyCall, {
    role: `applyCall`,
  })
  add(`make`, 26, `delete-call`, preambleStatements.makeCall, {
    role: `makeCall`,
  })
  for (const fn of plan.functions) {
    const inHelper = helpers.has(fn.id)
    if (fn.guardLine !== undefined)
      declaration(fn.id, fn.guardLine, fn.guardQuote)
    for (const stmt of fn.body) {
      const whole = stmt.lines.join(` `)
      const probe = inHelper || probeOnly(stmt)
      const at = (operator, role, line, text, extra) =>
        add(fn.id, line, operator, text, {
          stmt: stmt.label,
          role,
          probe,
          ...extra,
        })
      const condition = () => {
        at(`if-true`, `true`, stmt.line, whole)
        at(`if-false`, `false`, stmt.line, whole)
        if (stmt.not) at(`drop-not`, `not`, stmt.line, whole)
        at(`binary-swap`, `swap`, stmt.line, whole)
      }
      if ([`push`, `pushTag`, `pushStatus`, `setterPush`].includes(stmt.kind))
        at(`delete-call`, `push`, stmt.line, whole)
      // A call of a nested function where it is defined.
      if (stmt.kind === `inner`) at(`delete-call`, `call`, stmt.line, whole)
      // A returned nested function, which is not `undefined`.
      if (stmt.kind === `innerReturned`)
        at(`return-undefined`, `returned`, stmt.line, whole)
      // The object literal's field, then the push and its optional read.
      // Each object's field, outermost first, then the push and its links,
      // the last link first (the instrumenter numbers a node before its
      // children, and a chain's last link holds the earlier ones).
      if (stmt.kind === `optional`) {
        for (const prop of linkProps(stmt))
          at(`field-drop`, dropRole(prop), stmt.line, stmt.lines[0])
        at(`delete-call`, `push`, stmt.line + 1, stmt.lines[1])
        for (let link = siteLinks(stmt) - 1; link >= 0; link -= 1)
          at(`optional-chain`, chainRole(link), stmt.line + 1, stmt.lines[1])
      }
      // Two arrows on one line: each property's field drop, its call, and
      // the `+ 1` belong to the arrow whose text holds them; the push and
      // its argument to `w_pair`.
      if (stmt.kind === `pair`) {
        const [declaration, call] = stmt.lines
        const inPair = (fn, operator) =>
          add(fn, stmt.line, operator, declaration, { stmt: stmt.label })
        inPair(`w_pair>get`, `field-drop`)
        inPair(`w_pair>get`, `value-undefined`)
        inPair(`w_pair>set`, `field-drop`)
        inPair(`w_pair>set`, `value-undefined`)
        inPair(`w_pair>set`, `arithmetic-swap`)
        at(`delete-call`, `push`, stmt.line + 1, call)
        at(`value-undefined`, `string`, stmt.line + 1, call)
      }
      // A returned call is a `return-undefined` site too (the sixth review).
      if (stmt.kind === `getterReturn`) {
        at(`value-undefined`, `string`, stmt.line, whole)
        at(`return-undefined`, `returned`, stmt.line, whole)
        at(`bool-flip`, `flag`, stmt.line, whole)
      }
      // `$derived` is an ordinary name outside a Svelte module.
      if (stmt.kind === `dollar`) {
        at(`delete-call`, `push`, stmt.line, whole)
        at(`value-undefined`, `value`, stmt.line, whole)
      }
      if (stmt.kind === `dollarReturn`) {
        at(`value-undefined`, `string`, stmt.line, whole)
        at(`return-undefined`, `returned`, stmt.line, whole)
      }
      // A rune call stays where Svelte requires it, so it is no site of its
      // own (its value is not replaced, nor its statement skipped); the code
      // in its argument is.
      if (stmt.kind === `runeState`) at(`binary-swap`, `swap`, stmt.line, whole)
      if (stmt.kind === `runeStateRaw` || stmt.kind === `runeDerivedBy`)
        at(`value-undefined`, `string`, stmt.line, whole)
      if (stmt.kind === `runeDerived`)
        at(`arithmetic-swap`, `arith`, stmt.line, whole)
      if (stmt.kind === `runeEffect`)
        at(`delete-call`, `push`, stmt.line + 1, pushText(stmt))
      if (stmt.kind === `flag`) {
        at(`delete-call`, `push`, stmt.line, whole)
        at(`value-undefined`, `string`, stmt.line, whole)
        at(`bool-flip`, `flag`, stmt.line, whole)
      }
      // The push, its JSON, the `n` field, the `+ 1` in it, and the `s` field.
      if (stmt.kind === `record`) {
        at(`delete-call`, `push`, stmt.line, whole)
        at(`value-undefined`, `string`, stmt.line, whole)
        at(`field-drop`, `dropN`, stmt.line, whole)
        at(`arithmetic-swap`, `arith`, stmt.line, whole)
        at(`field-drop`, `dropS`, stmt.line, whole)
      }
      if (stmt.kind === `loop` || stmt.kind === `until`) {
        at(`loop-false`, `loop`, stmt.line, whole)
        at(`binary-swap`, `swap`, stmt.line, whole)
        at(`delete-call`, `push`, stmt.line, pushText(stmt))
      }
      if (stmt.kind === `depNote`) at(`delete-call`, `note`, stmt.line, whole)
      if (stmt.kind === `depSeen`) {
        at(`delete-call`, `push`, stmt.line, whole)
        at(`value-undefined`, `seen`, stmt.line, whole)
      }
      if (stmt.kind === `memoSet`) {
        at(`if-true`, `true`, stmt.line, whole)
        at(`if-false`, `false`, stmt.line, whole)
        at(`drop-not`, `not`, stmt.line, whole)
        at(`value-undefined`, `has`, stmt.line, whole)
        at(
          `delete-call`,
          `memoSet`,
          stmt.line,
          `memo.set(x, 's${stmt.label}');`,
        )
      }
      if (stmt.kind === `memoGet` || stmt.kind === `pushLoaded`)
        at(`delete-call`, stmt.kind, stmt.line, whole)
      if (stmt.kind === `memoGet`) {
        at(`value-undefined`, `string`, stmt.line, whole)
        at(`value-undefined`, `get`, stmt.line, whole)
      }
      if (stmt.kind === `primeCall`) at(`delete-call`, `call`, stmt.line, whole)
      if (stmt.kind === `readData`) at(`delete-call`, `push`, stmt.line, whole)
      if (stmt.kind === `readData` && stmt.shape === `methods`)
        at(`value-undefined`, `value`, stmt.line, whole)
      if (stmt.kind === `if`) {
        condition()
        at(`delete-call`, `push`, stmt.line, pushText(stmt))
      }
      if (stmt.kind === `throwIf`) condition()
      if (stmt.kind === `guard`)
        guard(
          fn.id,
          stmt.line,
          `'gap#p${stmt.label}'`,
          `x ${stmt.op} ${stmt.k}`,
        )
      // A probe in a shape the decided form does not accept is production
      // code, its guard's declaration included.
      if (stmt.kind === `nearProbe`) {
        const near = { stmt: stmt.label, role: `near`, probe: inHelper }
        const at = (line, operator, text, extra) =>
          add(fn.id, line, operator, text, { ...near, ...extra })
        // The `&&` that guards the hook is a logical operator. No hook is
        // installed, so `?.()` never evaluates the condition it is passed,
        // and `process` is defined, so a guard's `false` is never read:
        // neither is reached.
        const and = { logical: true }
        const idle = { idle: true }
        const call = (line) => {
          const text = stmt.lines[line - stmt.line].trim()
          at(line, `binary-swap`, text, and)
          at(line, `value-undefined`, text)
          at(line, `binary-swap`, text, idle)
        }
        if (stmt.variant === `former`) {
          at(stmt.line, `binary-swap`, whole, and)
          at(stmt.line, `binary-swap`, whole)
          at(stmt.line, `value-undefined`, whole)
          at(stmt.line, `binary-swap`, whole, idle)
        }
        // A guard's declaration: its `===`, its `false`, and its `!==`.
        const declared = (line, text) => {
          at(line, `binary-swap`, text)
          at(line, `bool-flip`, text, idle)
          at(line, `binary-swap`, text)
        }
        if (stmt.variant === `name`) {
          declared(stmt.line, stmt.lines[0])
          call(stmt.line + 1)
        }
        if (stmt.variant === `let`) {
          declared(stmt.line + 1, stmt.lines[1].trim())
          call(stmt.line + 2)
        }
        if (stmt.variant === `init`) {
          at(stmt.line + 1, `binary-swap`, stmt.lines[1].trim())
          call(stmt.line + 2)
        }
        if (stmt.variant === `outer`) {
          at(stmt.line, `delete-call`, whole)
          call(stmt.line + 1)
        }
      }
      if (stmt.kind === `oldProbe`) {
        at(`if-true`, `oldTrue`, stmt.line, whole)
        at(`if-false`, `oldFalse`, stmt.line, whole)
        at(`binary-swap`, `oldAnd`, stmt.line, whole, { logical: true })
        at(`value-undefined`, `oldDevBuild`, stmt.line, whole)
        at(`binary-swap`, `oldNe`, stmt.line, whole)
        at(
          `delete-call`,
          `oldCall`,
          stmt.line,
          oldProbeCallText(`'gap#p${stmt.label}'`),
        )
      }
      if (stmt.kind === `mixed`) {
        condition()
        guard(fn.id, stmt.line + 1, `'gap#p${stmt.label}'`, `true`)
        at(`delete-call`, `push`, stmt.line + 2, pushText(stmt))
      }
      if (stmt.kind === `helperCall`)
        add(fn.id, stmt.line, `delete-call`, whole, { probe: true })
      if (stmt.kind === `mixedHelperCall` || referenceKinds.has(stmt.kind))
        at(`delete-call`, `call`, stmt.line, whole)
      if (stmt.kind === `probeIf`) {
        condition()
        add(fn.id, stmt.line, `delete-call`, `report();`, {
          probe: true,
        })
      }
      if (stmt.kind === `probeBlock`) {
        condition()
        add(fn.id, stmt.line + 1, `delete-call`, `report();`, {
          probe: true,
        })
        guard(fn.id, stmt.line + 2, `'gap#p${stmt.label}'`, `true`)
      }
      // The shortcut's `if` (its whole block is the statement that holds
      // its sites), its push, then the loop's condition and comparison, and
      // the push after the loop, each in the statement that holds it.
      if (stmt.kind === `shortcut`) {
        const block = stmt.lines.slice(0, 4).join(` `)
        at(`if-true`, `true`, stmt.line, block)
        at(`if-false`, `false`, stmt.line, block)
        at(`binary-swap`, `swap`, stmt.line, block)
        at(`delete-call`, `fast`, stmt.line + 1, stmt.lines[1])
        at(`loop-false`, `loop`, stmt.line + 5, stmt.lines[5])
        at(`binary-swap`, `loopSwap`, stmt.line + 5, stmt.lines[5])
        at(`delete-call`, `push`, stmt.line + 6, stmt.lines[6])
      }
      if (stmt.kind === `callShortcut`) {
        condition()
        at(`delete-call`, `fast`, stmt.line, `out.push('s' + x);`)
        at(`delete-call`, `push`, stmt.line + 1, `out.push(String('s' + x));`)
        at(
          `value-undefined`,
          `string`,
          stmt.line + 1,
          `out.push(String('s' + x));`,
        )
      }
      if (stmt.kind === `elseIf`) {
        // An `if` with a production `else` is production; its probe branch
        // alone is probe-only.
        condition()
        add(fn.id, stmt.line, `delete-call`, `report();`, {
          probe: true,
        })
        at(`delete-call`, `push`, stmt.line + 1, pushText(stmt))
      }
    }
  }
  // `nothing`'s returned `x - x`, a number.
  if (plan.derived)
    add(
      `nothing`,
      plan.derived.returnLine,
      `return-undefined`,
      `return x - x;`,
      {
        file: DERIVED,
      },
    )
  // The derived class's file (`derivedFile`), which no oracle owns. A
  // statement before `super(...)`, and the `super` statement itself, have no
  // site: no mutant, when active, may prevent or delay the constructor's
  // `super` call (maintainer decision, 2026-11-09). After `super`, a push or
  // tag has its call's site, and an `if` the sites of its condition and call.
  for (const s of plan.derived?.statements ?? []) {
    if (s.phase !== `after`) continue
    const at = (operator, text) =>
      add(DERIVED_FN, s.line, operator, text, { file: DERIVED })
    if (s.kind === `if`) {
      at(`if-true`, s.text)
      at(`if-false`, s.text)
      at(`binary-swap`, s.text)
    }
    at(`delete-call`, s.call)
  }
  // Module-level data: each declaration's sites belong to it, by its name.
  for (const d of plan.data ?? []) {
    const put = (operator, role) =>
      add(d.id, d.line, operator, d.text, { data: d.shape, role })
    if (d.shape === `object`) {
      put(`field-drop`, `dropN`)
      put(`field-drop`, `dropS`)
    }
    if (d.shape === `array`) put(`arithmetic-swap`, `arith`)
    if (d.shape === `primitive`) put(`bool-flip`, `flag`)
    // A method's `+` belongs to the method, and runs only when it is called.
    if (d.shape === `methods`)
      for (const [name, text] of [
        [`used`, `return 1 + 2;`],
        [`spare`, `return 3 + 4;`],
      ])
        for (const operator of [`arithmetic-swap`, `return-undefined`])
          add(name, d.line, operator, text, {
            role: `${name}${operator === `arithmetic-swap` ? `Arith` : `Return`}`,
          })
  }
  // The `..gen/` file's top-level loop: its variable's `-`, its condition,
  // and its `<`, in no function, and owned by no entry (a whole-file entry
  // names the main source).
  if (plan.topLoop)
    for (const operator of [`arithmetic-swap`, `loop-false`, `binary-swap`])
      add(TOP_LOOP, plan.topLoop.line, operator, plan.topLoop.text, {
        file: DOTGEN,
        function: `<module>`,
      })
  // A call statement to a probe helper is probe-only code (law 2), at
  // module level too.
  for (const call of plan.loadCalls)
    add(`<module>`, call.line, `delete-call`, call.text, {
      role: call.fn === `w_load` ? `moduleLoad` : `bootLoad`,
      probe: helpers.has(call.fn),
    })
  // Order on a line, and the anchor's occurrence index within a function.
  const onLine = new Map()
  const anchors = new Map()
  for (const site of sites) {
    const lineKey = `${site.file} ${site.line} ${site.operator}`
    site.ordinal = onLine.get(lineKey) ?? 0
    onLine.set(lineKey, site.ordinal + 1)
    const base = `${site.file}#${site.function}:${site.operator}:${site.text}`
    const count = (anchors.get(base) ?? 0) + 1
    anchors.set(base, count)
    site.key = count === 1 ? base : `${base}~${count}`
  }
  return sites
}

/** Each function's owners: the files whose entries' call trees contain it. */
function ownersOf(plan) {
  // A reference is an edge: to the function or method it names; to `apply`
  // and the value passed to it; and, for a class passed as a value, to every
  // method of that class. `new C().m()` reaches only `m` (and C's
  // constructor, which the grammar does not write).
  const methodsOf = (cls) =>
    plan.functions.filter((fn) => fn.container === cls).map((fn) => fn.id)
  const calls = new Map(
    plan.functions.map((fn) => [
      fn.id,
      fn.body.flatMap((stmt) =>
        stmt.kind === `valueCall`
          ? [`apply`, stmt.to]
          : stmt.kind === `factoryCall`
            ? [`make`, ...methodsOf(stmt.to.split(`.`)[0])]
            : stmt.kind === `newCall`
              ? [stmt.to, `${stmt.to.split(`.`)[0]}.constructor`]
              : stmt.kind === `primeCall`
                ? [`W7.prime`]
                : referenceKinds.has(stmt.kind)
                  ? [stmt.to]
                  : stmt.kind === `mixedHelperCall`
                    ? [`reportAndPush`]
                    : stmt.kind === `oldProbe`
                      ? [`devBuild`]
                      : stmt.kind === `inner`
                        ? [stmt.to]
                        : stmt.kind === `dollar`
                          ? [`$derived`]
                          : stmt.kind === `pair`
                            ? [`w_pair>get`]
                            : // A property read refers to both its accessors.
                              stmt.kind === `pushStatus`
                              ? [`W9.status#get`, `W9.status#set`]
                              : // A read of module data refers to its declaration.
                                stmt.kind === `readData`
                                ? [
                                    dataOf(stmt.shape).id,
                                    ...(dataOf(stmt.shape).calls ?? []),
                                  ]
                                : [],
      ),
    ]),
  )
  const owners = new Map()
  const visit = (id, file) => {
    const set = owners.get(id) ?? new Set()
    if (set.has(file)) return
    set.add(file)
    owners.set(id, set)
    for (const callee of calls.get(id) ?? []) visit(callee, file)
  }
  // A nested function (`parent>name`) is contained in its parent's text, so
  // its parent's tree holds it, called or not.
  for (const d of plan.data ?? []) calls.set(d.id, d.refers ?? [])
  for (const fn of plan.functions)
    if (fn.id.includes(`>`)) {
      const parent = fn.id.slice(0, fn.id.lastIndexOf(`>`))
      calls.set(parent, [...(calls.get(parent) ?? []), fn.id])
    }
  for (const fn of plan.functions)
    for (const file of fn.owners) visit(fn.id, file)
  for (const d of plan.data ?? [])
    for (const file of d.owners) visit(d.id, file)
  // A whole-file entry names the main source, so it owns only its functions.
  const inLibrary = new Set(
    plan.functions.filter((fn) => fn.file !== SOURCE).map((fn) => fn.id),
  )
  return (id) =>
    new Set([
      ...(owners.get(id) ?? []),
      ...(plan.wholeFile === `none` ||
      inLibrary.has(id) ||
      id === TOP_LOOP ||
      id === DERIVED_FN ||
      id === DERIVED_HELPER
        ? []
        : [plan.wholeFile]),
    ])
}

/** One call of a function with at most one active mutation. */
function interpret(plan, fnId, x, sites, active) {
  const trace = []
  const reached = new Set()
  // The run's work: one for each site evaluation, as the capture counts a
  // test's `calls` (capture-setup.mjs), which a work bound judges. Probe code
  // is never work (maintainer decision, 2026-11-16): a probe-only site's
  // evaluation counts nothing.
  let work = 0
  const reach = (id) => {
    if (!sites[id].probe) work += 1
    reached.add(id)
  }
  const outcomes = []
  // The comparison sites whose two operators disagree on the operands this
  // run reached: the sites an unmutated run infects (capture-setup.mjs `cmp`).
  const infected = new Set()
  const siteOf = (stmt, role) =>
    sites.find((s) => s.stmt === stmt.label && s.role === role)
  const helperPush = sites.find((s) => s.role === `helperPush`)
  const isActive = (site) =>
    site !== undefined && active?.site !== undefined && active.site === site.id
  const condition = (stmt) => {
    for (const role of [`true`, `false`, `not`, `swap`])
      if (siteOf(stmt, role)) reach(siteOf(stmt, role).id)
    const op = stmt.kind === `throwIf` ? `>` : stmt.op
    const k = stmt.kind === `throwIf` ? 100 : stmt.k
    const swap = siteOf(stmt, `swap`)
    if (swap && holds(x, op, k) !== holds(x, swapped[op], k))
      infected.add(swap.id)
    let value = holds(x, isActive(swap) ? swapped[op] : op, k)
    if (stmt.not && !isActive(siteOf(stmt, `not`))) value = !value
    outcomes.push([stmt.line, value])
    // A forced `if` changes its condition only where the condition took the
    // other outcome: the if-false site where it was true, the if-true where
    // it was false (the capture's `cond`, classify.mjs).
    const forced = siteOf(stmt, value ? `false` : `true`)
    if (forced) infected.add(forced.id)
    if (isActive(siteOf(stmt, `true`))) return true
    if (isActive(siteOf(stmt, `false`))) return false
    return value
  }
  const write = (stmt) => {
    const site = siteOf(stmt, `push`)
    reach(site.id)
    if (isActive(site)) return
    trace.push(
      active?.authored === stmt.label ? `s${stmt.label}!` : `s${stmt.label}`,
    )
  }
  const depLog = []
  // Module state as a freshly loaded module has it: an empty cache, and
  // the labels `w_load` wrote at load, under the same mutant.
  // A function that runs after an earlier test of its file cached its
  // input (`w_cold`) finds the entry there.
  const memo = new Map(
    plan.functions.find((f) => f.id === fnId)?.warm ? [[x, `warm`]] : [],
  )
  const loaded = () => {
    // The module loaded outside any test, so its load counts no work.
    const call = sites.find((s) => s.role === `moduleLoad`)
    if (call) reached.add(call.id)
    if (isActive(call)) return []
    const load = interpret(plan, `w_load`, 0, sites, active)
    for (const id of load.reached) reached.add(id)
    return load.trace
  }
  const run = (id, object = { tag: `a` }) => {
    const fn = plan.functions.find((f) => f.id === id)
    for (const stmt of fn.body) {
      if (stmt.kind === `push`) write(stmt)
      // The condition runs before each pass; a forced-false condition runs
      // none, and `<=` runs one more.
      if (stmt.kind === `loop`)
        for (let i = 0; ; i += 1) {
          const loopSite = siteOf(stmt, `loop`)
          reach(loopSite.id)
          if (isActive(loopSite)) break
          const swapSite = siteOf(stmt, `swap`)
          reach(swapSite.id)
          if (i === 2) infected.add(swapSite.id)
          if (!(isActive(swapSite) ? i <= 2 : i < 2)) break
          write(stmt)
        }
      // Pushes while the output is short of three entries; `<=` pushes to
      // four. With its push deleted, a short output never grows: the loop
      // never ends.
      if (stmt.kind === `until`) {
        const loopSite = siteOf(stmt, `loop`)
        for (;;) {
          reach(loopSite.id)
          if (isActive(loopSite)) break
          const swapSite = siteOf(stmt, `swap`)
          reach(swapSite.id)
          if (trace.length === 3) infected.add(swapSite.id)
          if (!(isActive(swapSite) ? trace.length <= 3 : trace.length < 3))
            break
          if (isActive(siteOf(stmt, `push`))) {
            reach(siteOf(stmt, `push`).id)
            throw new Spin()
          }
          write(stmt)
        }
      }
      // The workspace dependency's log, as a freshly loaded module has it.
      if (stmt.kind === `depNote`) {
        const call = siteOf(stmt, `note`)
        reach(call.id)
        if (!isActive(call)) depLog.push(`d`)
      }
      if (stmt.kind === `depSeen`) {
        const call = siteOf(stmt, `push`)
        reach(call.id)
        if (!isActive(call)) {
          const seenSite = siteOf(stmt, `seen`)
          reach(seenSite.id)
          // Spreading undefined throws.
          if (isActive(seenSite)) throw new TypeError(`seen() is undefined`)
          trace.push(...depLog)
        }
      }
      if (stmt.kind === `record`) {
        // A deleted push builds nothing; a dropped field never evaluates.
        const call = siteOf(stmt, `push`)
        reach(call.id)
        if (!isActive(call)) {
          const string = siteOf(stmt, `string`)
          reach(string.id)
          if (isActive(string)) trace.push(undefined)
          else {
            const record = {}
            const dropN = siteOf(stmt, `dropN`)
            reach(dropN.id)
            if (!isActive(dropN)) {
              const arith = siteOf(stmt, `arith`)
              reach(arith.id)
              record.n = isActive(arith) ? x - 1 : x + 1
            }
            const dropS = siteOf(stmt, `dropS`)
            reach(dropS.id)
            if (!isActive(dropS)) record.s = `s${stmt.label}`
            trace.push(JSON.stringify(record))
          }
        }
      }
      if (stmt.kind === `flag`) {
        // A deleted push never evaluates its literal.
        const call = siteOf(stmt, `push`)
        reach(call.id)
        if (!isActive(call)) {
          // `String(...)` replaced by undefined never evaluates its literal.
          const string = siteOf(stmt, `string`)
          reach(string.id)
          if (isActive(string)) trace.push(undefined)
          else {
            const flip = siteOf(stmt, `flag`)
            reach(flip.id)
            trace.push(String(isActive(flip) ? !stmt.value : stmt.value))
          }
        }
      }
      if (stmt.kind === `memoSet`) {
        for (const role of [`true`, `false`, `not`, `has`])
          reach(siteOf(stmt, role).id)
        let value = !(isActive(siteOf(stmt, `has`)) ? undefined : memo.has(x))
        if (isActive(siteOf(stmt, `not`))) value = !value
        outcomes.push([stmt.line, value])
        // A forced `if` changes its condition only where the condition took the
        // other outcome: the if-false site where it was true, the if-true where
        // it was false (the capture's `cond`, classify.mjs).
        const forced = siteOf(stmt, value ? `false` : `true`)
        if (forced) infected.add(forced.id)
        if (isActive(siteOf(stmt, `true`))) value = true
        if (isActive(siteOf(stmt, `false`))) value = false
        if (value) {
          const set = siteOf(stmt, `memoSet`)
          reach(set.id)
          if (!isActive(set)) memo.set(x, `s${stmt.label}`)
        }
      }
      if (stmt.kind === `memoGet` || stmt.kind === `pushLoaded`) {
        const site = siteOf(stmt, stmt.kind)
        reach(site.id)
        if (!isActive(site) && stmt.kind === `pushLoaded`)
          trace.push(...loaded())
        if (!isActive(site) && stmt.kind === `memoGet`) {
          const string = siteOf(stmt, `string`)
          reach(string.id)
          if (isActive(string)) trace.push(undefined)
          else {
            const get = siteOf(stmt, `get`)
            reach(get.id)
            trace.push(String(isActive(get) ? undefined : memo.get(x)))
          }
        }
      }
      // The object at the statement's level exists only for a truthy `x`,
      // so its fields, and those of the objects inside it, are reached only
      // then; a dropped field leaves its property out. The read follows
      // JavaScript's optional chain: at the first link whose object is
      // absent (`undefined` or `null`), `?.` gives `undefined` for the whole
      // chain and no later link runs, while a plain read in its place
      // throws. A link past that one changes nothing.
      if (stmt.kind === `optional`) {
        // A witness's statement holds no chain fields: one link, no call.
        const chain = { ...OPTIONAL_DEFAULTS, ...stmt }
        const props = linkProps(chain)
        const objectAt = (depth) => {
          if (depth === chain.level && !x)
            return stmt.absent === `null` ? null : undefined
          const drop = siteOf(stmt, dropRole(props[depth]))
          reach(drop.id)
          if (isActive(drop)) return {}
          if (depth < props.length - 1)
            return { [props[depth]]: objectAt(depth + 1) }
          if (chain.call === `none`) return { v: `p${stmt.label}` }
          // The method, absent at its own level for a falsy `x`.
          return {
            f:
              chain.level === chain.links && !x
                ? stmt.absent === `null`
                  ? null
                  : undefined
                : () => (chain.returns === `nothing` ? undefined : {}),
          }
        }
        const made = objectAt(0)
        const site = siteOf(stmt, `push`)
        reach(site.id)
        if (!isActive(site)) {
          // Every link's switch runs before the chain does.
          for (let link = 0; link < siteLinks(chain); link += 1)
            reach(siteOf(stmt, chainRole(link)).id)
          // The read's steps in order: each object link, then the optional
          // call and the read of `v` after it.
          const steps = [
            ...props.map((prop, link) => ({ link, prop })),
            ...(chain.call === `none` ? [] : [{ call: true }]),
            ...(chain.call === `optional`
              ? [{ link: props.length, prop: `v` }]
              : []),
            ...(chain.call === `plain` ? [{ prop: `v` }] : []),
          ]
          let value = made
          for (const step of steps) {
            const absent = value === undefined || value === null
            if (absent && (step.call || step.link !== undefined)) {
              if (
                step.link !== undefined &&
                isActive(siteOf(stmt, chainRole(step.link)))
              )
                throw new TypeError(`Cannot read properties of ${value}`)
              value = undefined
              break
            }
            value = step.call ? value() : value[step.prop]
          }
          trace.push(String(value))
        }
      }
      if (stmt.kind === `innerReturned`) reach(siteOf(stmt, `returned`).id)
      // A read of module data, as the module evaluated it at load under the
      // same mutant: a dropped field reads undefined, the swapped `+` gives
      // 1, and the flipped literal false.
      if (stmt.kind === `readData`) {
        const site = siteOf(stmt, `push`)
        reach(site.id)
        if (!isActive(site)) {
          const at = (role) =>
            isActive(
              sites.find((s) => s.data === stmt.shape && s.role === role),
            )
          // A method's call: undefined in its place, or its `1 + 2`.
          const called = () => {
            const value = siteOf(stmt, `value`)
            reach(value.id)
            if (isActive(value)) return `undefined`
            // Its `return`: undefined in place of what it returns.
            const returned = sites.find((s) => s.role === `usedReturn`)
            reach(returned.id)
            if (isActive(returned)) return `undefined`
            const arith = sites.find((s) => s.role === `usedArith`)
            reach(arith.id)
            return String(isActive(arith) ? -1 : 3)
          }
          trace.push(
            stmt.shape === `methods`
              ? called()
              : stmt.shape === `object`
                ? `${at(`dropN`) ? undefined : 3}${at(`dropS`) ? undefined : `o`}`
                : stmt.shape === `array`
                  ? String(at(`arith`) ? 1 : 3)
                  : String(!at(`flag`)),
          )
        }
      }
      if (stmt.kind === `pushTag`) {
        const site = siteOf(stmt, `push`)
        reach(site.id)
        if (!isActive(site)) trace.push(object.tag)
      }
      // `out.push($derived(x))`, where `$derived` returns `String(x)`.
      if (stmt.kind === `dollar`) {
        const call = siteOf(stmt, `push`)
        reach(call.id)
        if (!isActive(call)) {
          const value = siteOf(stmt, `value`)
          reach(value.id)
          if (isActive(value)) trace.push(undefined)
          else {
            const [inner] = plan.functions.find((f) => f.id === `$derived`).body
            // Its `return String(x)` is a `value-undefined` site (the call)
            // and a `return-undefined` site (the returned value), both
            // reached when `$derived` runs, and either gives `undefined`.
            const string = siteOf(inner, `string`)
            const returned = siteOf(inner, `returned`)
            reach(string.id)
            reach(returned.id)
            trace.push(
              isActive(string) || isActive(returned) ? undefined : String(x),
            )
          }
        }
      }
      if (stmt.kind === `setTag`) object.tag = `b`
      // A probe in another shape reaches its sites but the idle ones; no hook
      // is installed, so none of it writes output.
      if (stmt.kind === `nearProbe`)
        for (const site of sites)
          if (site.stmt === stmt.label && !site.idle) reach(site.id)
      if (stmt.kind === `primeCall`) {
        const site = siteOf(stmt, `call`)
        reach(site.id)
        if (!isActive(site)) run(`W7.prime`, object)
      }
      if ((stmt.kind === `if` || stmt.kind === `mixed`) && condition(stmt))
        write(stmt)
      // A shortcut for speed: an early return that pushes what the loop
      // below it would count up to, for every input it takes.
      if (stmt.kind === `shortcut`) {
        if (condition(stmt)) {
          const fast = siteOf(stmt, `fast`)
          reach(fast.id)
          if (!isActive(fast)) trace.push(`s${x}`)
          return
        }
        let n = 0
        const loopSite = siteOf(stmt, `loop`)
        const swapSite = siteOf(stmt, `loopSwap`)
        for (;;) {
          reach(loopSite.id)
          if (isActive(loopSite)) break
          reach(swapSite.id)
          if (n === x) infected.add(swapSite.id)
          if (!(isActive(swapSite) ? n <= x : n < x)) break
          n += 1
        }
        const push = siteOf(stmt, `push`)
        reach(push.id)
        if (!isActive(push)) trace.push(`s${n}`)
      }
      // A shortcut that skips a call: the `else` pushes the same text
      // through `String`, one call more.
      if (stmt.kind === `callShortcut`) {
        if (condition(stmt)) {
          const fast = siteOf(stmt, `fast`)
          reach(fast.id)
          if (!isActive(fast)) trace.push(`s${x}`)
        } else {
          const push = siteOf(stmt, `push`)
          reach(push.id)
          if (!isActive(push)) {
            const string = siteOf(stmt, `string`)
            reach(string.id)
            trace.push(isActive(string) ? undefined : `s${x}`)
          }
        }
      }
      if (stmt.kind === `elseIf` && !condition(stmt)) write(stmt)
      if (stmt.kind === `probeIf` || stmt.kind === `probeBlock`) condition(stmt)
      if (stmt.kind === `throwIf` && condition(stmt)) throw new Error(`boom`)
      if (stmt.kind === `oldProbe`) {
        // `devBuild()` is true under test, so the guard holds and the probe
        // is called; none of it writes output.
        for (const role of [
          `oldTrue`,
          `oldFalse`,
          `oldAnd`,
          `oldDevBuild`,
          `oldNe`,
          `oldCall`,
        ])
          reach(siteOf(stmt, role).id)
        reach(sites.find((s) => s.role === `devBuild`).id)
        // Its `return`, whose undefined value leaves the probe uncalled, and
        // no output changes.
        reach(sites.find((s) => s.role === `devBuildReturn`).id)
        outcomes.push([stmt.line, true])
        // The guard is true, so its if-false site changes it; and its `!==`
        // compares 'test' with 'production', on which `!==` and `===`
        // disagree.
        infected.add(siteOf(stmt, `oldFalse`).id)
        infected.add(siteOf(stmt, `oldNe`).id)
      }
      if (referenceKinds.has(stmt.kind) || stmt.kind === `mixedHelperCall`) {
        const site = siteOf(stmt, `call`)
        reach(site.id)
        if (isActive(site)) continue
        if (stmt.kind === `valueCall` || stmt.kind === `factoryCall`) {
          // `apply` calls the function it was given; `make` constructs the
          // class and calls its `run`.
          const inner = sites.find(
            (s) =>
              s.role === (stmt.kind === `valueCall` ? `applyCall` : `makeCall`),
          )
          reach(inner.id)
          if (isActive(inner)) continue
        }
        if (stmt.kind === `newCall`) {
          // `new` runs the class's constructor, then the method, on one object.
          const object = { tag: `a` }
          const ctor = `${stmt.to.split(`.`)[0]}.constructor`
          if (plan.functions.some((f) => f.id === ctor)) run(ctor, object)
          run(stmt.to, object)
        } else if (stmt.kind !== `mixedHelperCall`) run(stmt.to)
        else {
          reach(helperPush.id)
          if (!isActive(helperPush)) trace.push(`h`)
        }
      }
    }
  }
  let threw = false
  let spun = false
  try {
    run(fnId)
  } catch (error) {
    if (error instanceof Spin) spun = true
    else threw = true
  }
  return { trace, threw, spun, reached, outcomes, infected, work }
}

/** A loop that never ends, as the interpreter sees one. */
class Spin extends Error {}

/**
 * Each owner test's run under a mutant: whether it hung, crashed, or waited
 * slowly, its verdicts, and whether its output changed.
 */
function runsOf(plan, tests, sites, active) {
  // A test runs its campaigns in order. Each failing judgment is a verdict
  // that carries its campaign's route; an assertion is a verdict under an
  // unnamed law. A verdict or a crash stops the test, except a soft
  // assertion, which lets it go on. A failed test's own route is the route
  // active when it ended. A slow test, or one that waits on a child
  // process, waits where its output changed, before it would hang or judge.
  return tests
    .filter((t) => !t.flaky)
    .map((t) => {
      let changedAny = false
      let slowed = false
      const found = []
      // The test's work, summed over its campaigns, with no mutant active and
      // under the mutant. A test that only reads what an earlier test stored
      // calls no production code, so it does none.
      let before = 0
      let after = 0
      for (const part of partsOf(t)) {
        const base = interpret(plan, t.fn, part.input, sites)
        const mutated = interpret(plan, t.fn, part.input, sites, active)
        if (!t.judgesShared) {
          before += base.work
          after += mutated.work
        }
        const route = routeOf(t, part)
        // A loop that never ends cuts the file's run off, as a hang does.
        if (mutated.spun)
          return { t, route, hang: true, verdicts: found, changed: true }
        const changed =
          !mutated.threw && mutated.trace.join() !== base.trace.join()
        changedAny ||= changed
        slowed ||= changed && (t.slow || t.ioWait)
        if (mutated.threw)
          return {
            t,
            route,
            crash: true,
            verdicts: found,
            changed: changedAny,
            slowed,
          }
        // A test that hangs where another would judge never ends.
        if (changed && t.hangs)
          return { t, route, hang: true, verdicts: found, changed: true }
        // A verdict test of file b that reads the data spins there instead,
        // while the data is open, which it is before any edit (`spinData`):
        // a loop that never ends, as above.
        if (changed && plan.spinData && fsGated(plan, t.file, t))
          return { t, route, hang: true, verdicts: found, changed: true }
        if (changed && t.judges) {
          found.push({
            route,
            law: t.judgeBy === `verdict` ? t.law : `(unnamed)`,
          })
          if (t.judgeBy !== `soft`)
            return { t, route, verdicts: found, changed: true, slowed }
        }
      }
      // A test that passed: its route is the last one it registered, and
      // its work is judged against the bound it declared. An authored
      // mutant's copy is not instrumented, so it counts no work, and the
      // work law judges only operator mutants.
      const route = routeOf(t, partsOf(t).at(-1))
      // Only a route that oracleProperty registers for production can carry
      // a bound, and a test that made a timer can do work that follows the
      // clock, so neither judges work.
      const judgesWork =
        found.length === 0 &&
        active?.site !== undefined &&
        [`reproducible`, `random`].includes(route) &&
        (!t.timed || t.timed === `turn`)
      return {
        t,
        route,
        verdicts:
          judgesWork &&
          t.work !== null &&
          t.registered &&
          after > t.work * before
            ? [{ route, law: `work bound` }]
            : found,
        changed: changedAny,
        slowed,
        rose: judgesWork && after > before,
      }
    })
}

// A kill: a behavioral verdict on a reproducible route.
const killsIn = (r) =>
  r.verdicts.some(
    (v) => v.route === `reproducible` && v.law !== `reach agreement`,
  )

/**
 * The runs that each owner file runs under a mutant, file by file in path
 * order, each file's up to its first hang or kill (a kill stops the file),
 * and the files the mutant's run reaches: those up to the first file that
 * kills it.
 */
function filesRun(runs) {
  const files = [...new Set(runs.map((r) => r.t.file))].sort()
  const ran = new Map()
  for (const file of files) {
    const own = []
    for (const r of runs.filter((x) => x.t.file === file)) {
      own.push(r)
      if (r.hang || killsIn(r)) break
    }
    ran.set(file, own)
    if (own.some(killsIn)) break
  }
  return ran
}

/**
 * A mutant's kind from its owner tests' runs. An operator mutant's
 * confirming runs share its budget (`budgeted`); an authored mutant's runs
 * are each final at the full limit, so it has no confirmations to budget.
 */
function judge(
  plan,
  tests,
  sites,
  active,
  { budgeted = true, lawSpins = new Map() } = {},
) {
  const runs = runsOf(plan, tests, sites, active)
  // A file's tests run in order, and a kill (a behavioral verdict on a
  // reproducible route) stops the file. A hang before that cuts the file's
  // run off, and a run that was cut off records nothing, not even its
  // earlier verdicts. A kill in another file still decides (a kill outranks
  // a timeout); failing that, the mutant is a timeout.
  // A failing law runs too, though it judges nothing (`lawSpins`, the files
  // whose failing law spins under the mutant, and where it sits): at the
  // start of its file its count cut ends the file's run before any test
  // judges; at the end it does unless a test before it killed or hung. A
  // count cut a failing law causes blocks the mutant by that law (register
  // C 2026-11-23, "A count cut caused by a failing law is blocked by it"):
  // a gap, never `timeout`, which is only the backstop's (M-24), and never a
  // kill, though a kill in another file still decides.
  const hung = new Set()
  const cut = new Set()
  const slowed = new Map()
  for (const file of new Set([
    ...runs.map((r) => r.t.file),
    ...lawSpins.keys(),
  ])) {
    if (lawSpins.get(file) === `start`) {
      cut.add(file)
      continue
    }
    let ended = false
    for (const r of runs.filter((x) => x.t.file === file)) {
      if (r.slowed) slowed.set(file, r.t.slowMs ?? SLOW_MS)
      if (r.hang) hung.add(file)
      if (r.hang || killsIn(r)) {
        ended = true
        break
      }
    }
    if (!ended && lawSpins.get(file) === `end`) cut.add(file)
  }
  const live = runs.filter((r) => !hung.has(r.t.file) && !cut.has(r.t.file))
  const verdicts = (route) =>
    live.flatMap((r) =>
      r.verdicts.filter((v) => v.route === route).map((v) => v.law),
    )
  const reproducible = verdicts(`reproducible`)
  if (reproducible.some((law) => law !== `reach agreement`)) return `killed`
  if (cut.size > 0) return `blocked`
  if (hung.size > 0) return `timeout`
  // The runs that confirm a mutant's cut-off copies share its budget
  // (`--mutant-limit`, MUTANT_LIMIT_MS here; maintainer disposition G1,
  // 2026-11-11). Under two budgets, a slow owner file is cut at its first
  // budget and confirmed alone, and its confirmation takes longer than the
  // time its slow test waits. When the confirmations of every slow owner
  // file do not fit the budget together, one is cut, and the mutant is a
  // timeout; a kill still decides first. Under one budget no copy is
  // confirmed, so the budget never binds.
  if (
    budgeted &&
    plan.budget === `two` &&
    [...slowed.values()].reduce((sum, ms) => sum + ms, 0) >= MUTANT_LIMIT_MS
  )
    return `timeout`
  if (reproducible.length > 0) return `agreement-only-kill`
  if (verdicts(`random`).length > 0) return `random-only-kill`
  if (verdicts(`unknown`).length > 0) return `unregistered-kill`
  const failing = live.filter((r) => r.crash || r.verdicts.length > 0)
  if (failing.some((r) => r.route !== `framework`)) return `crashed`
  if (failing.length > 0) return `framework-error`
  return live.some((r) => r.changed) ? `not-judged` : `survived`
}

/**
 * Which fault, if any, must make the run fail, and its cause, in the order the
 * run finds them. The analysis reads the test files that the loaded Vitest
 * config includes (check.mjs warms the contexts, then calls `analyze` with
 * their specs), so a Vitest or config that cannot load or be honored is named
 * first. The analysis's refusals come next: a broken declaration, then a run
 * with no oracle file or no owner. A fault that the baseline run finds (a
 * failing setup or owner) comes last. A fault found only at run time is
 * tagged `runtime`, so the static oracle, which runs only the analysis, does
 * not expect it.
 */
/** Whether no owns entry names anything: no whole file, function, or data. */
const ownsNothing = (plan) =>
  plan.wholeFile === `none` &&
  plan.functions.every((fn) => fn.owners.length === 0) &&
  (plan.data ?? []).every((d) => d.owners.length === 0)

// The suite of the failing owner test (`brokenOwner`): regular-expression
// syntax, a dollar sign, and a quote.
const BROKEN_SUITE = `broken (b.*) $x it's`

function refusal(plan) {
  // The stages of a run decide which refusal comes first (P10 as amended in
  // v21.2, R10): the arguments, before any check starts; then the stream log,
  // which the run opens before its first line (the maintainer's decision of
  // 2026-11-12); then the check itself, whatever it would find.
  // A `--source` outside the package is an argument the CLI refuses before
  // it starts a check (the argument rules that the static oracle judges),
  // so its stdout has no line that names a stream log.
  if (plan.fault === `outsideSource`)
    return { cause: `outside the package`, arguments: true }
  // A stream log that cannot be written is refused before the check starts
  // (the CLI opens the log before its first line, index.mjs), so its stdout
  // owes its done line alone.
  if (plan.logBlocked === true)
    return { cause: `the stream log`, arguments: true }
  // A Vitest that does not load, and a config the runner cannot honor, refuse
  // the run rather than leave every mutant unreached (maintainer decision,
  // 2026-11-08).
  if (plan.fault === `brokenVitest`) return { cause: `vitest`, runtime: true }
  if (plan.fault === `projects`)
    return { cause: `test.projects`, runtime: true }
  if (plan.fault === `badEntry`) return { cause: `${SOURCE}#nope` }
  // An owns entry that names a missing file (a test file's declaration) is
  // found by the analysis, after the check has started, so this refusal
  // owes the stream log's note. The argument-stage case, a `--source` that
  // is not a file of the package, is the static oracle's `absentSource`.
  if (plan.fault === `missingSource`) return { cause: `src/missing.ts` }
  if (plan.fault === `nonLiteral`) return { cause: `b.test.ts` }
  // The analysis reads the test files that the package's Vitest config
  // includes (index.mjs, step 2), so a config that does not load is named
  // before anything the analysis would find. The cause names the config
  // file and its error.
  if (plan.fault === `configThrows`)
    return {
      cause: plan.configPath,
      detail: `the fixture config broke`,
      runtime: true,
    }
  if (
    plan.fault === `configNoDefault` ||
    plan.fault === `configNull` ||
    plan.fault === `configSyntax`
  )
    return { cause: plan.configPath, runtime: true }
  // A run with no oracle file, or with no owns entry, owns no selected
  // source, so every mutant would read as unowned. The analysis refuses it
  // (maintainer decision, 2026-11-10).
  if (plan.declaration === `neither`) return { cause: `no oracle file` }
  if (ownsNothing(plan)) return { cause: `owns any selected source` }
  // A failing owner, a failing law, and a setup file that throws (which
  // fails every test file before any test runs) refuse nothing: they judge
  // nothing, and they block only the mutants that no passing owner test
  // judges (`blockingOf`).
  return undefined
}

// The law that fails with no mutant active (`failingLaw`), a test of its
// own at the start or the end of its file (`failingLawAt`), and the error it
// throws. Under a failing describe hook (`failingLawHook`) it sits in the
// describe `HOOKED_SUITE`, passes itself, and the hook throws `HOOK_ERROR`.
const FAILING_LAW = `a law that fails with no mutant active`
const FAILING_ERROR = `Error: this law fails with no mutant active`
const HOOKED_SUITE = `hooked`
const HOOK_ERROR = `this hook fails with no mutant active`
// How often a heavy failing law calls production: past the call floor
// (check.mjs CALL_FLOOR, 100,000 site evaluations) in its own test.
const HEAVY_CALLS = 110_000
// How often a spinning failing law repeats its call at most: past any call
// budget the grammar's files reach, so on instrumented code its copy is cut
// first, while an authored mutant's copy, which counts nothing, ends it.
const SPIN_BOUND = 1_000_000
/** Whether oracle file `file` holds the failing law. */
const holdsFailingLaw = (plan, file) =>
  plan.failingLaw === file ||
  (plan.failingLaw === `both` && (file === `a` || file === `b`))
/** The failing law's name, as its file's tests name it. */
const failingLawName = (plan) =>
  plan.failingLawHook === `none`
    ? FAILING_LAW
    : `${HOOKED_SUITE} > ${FAILING_LAW}`
/** The function the failing law calls, if it calls one: the first generated. */
const failingLawTarget = (plan) =>
  plan.failingLawCalls === `none` || plan.failingLawHook === `beforeAll`
    ? undefined
    : plan.functions.find((fn) => fn.generated)?.id

/**
 * The test files that fail with no mutant active, each with its first
 * failing test and that test's error (none for a file that does not load, or
 * whose only failure is a hook), and its failing laws, in file order: each
 * test of it that fails, and each test of a describe whose hook fails. A
 * failing law judges nothing, as a nondeterministic test judges nothing, so
 * it is left out per test, and the passing tests of its file still judge the
 * mutants the file owns (the maintainer's decision "Block per law",
 * 2026-11-18, which replaces the file-level block of disposition G5 and the
 * v20 freeze's decision 2, v21.2 R11, at the granularity of a test; a
 * describe's failing hook is a failure of its laws, under "A broken owner
 * file judges nothing", 2026-11-19, scoped to the describe). A file that
 * does not load has no law that passes, and names no failing law: it fails
 * as a whole, and judges nothing. The report is provisional while any oracle
 * file fails. The baseline's replay runs a file's first failing test alone,
 * under the config the run loaded: a config that only `--config` names, too
 * (F12 with law 3).
 */
function blockingOf(plan) {
  if (plan.fault === `setupThrows`)
    return [
      ...oracleFilesOf(plan).map((file) => ({ file })),
      { file: `c`, ordinary: true },
    ]
  const brokenOwner = plan.fault === `brokenOwner`
  return [`a`, `b`].flatMap((file) => {
    const owner = brokenOwner && file === `b`
    const law = holdsFailingLaw(plan, file)
    if (!owner && !law) return []
    const broken = owner ? [`${BROKEN_SUITE} > fixed seed 999`] : []
    const failing = law ? [failingLawName(plan)] : []
    // File b's failing owner follows the plan's tests; the failing law is
    // the first test of its file or the last.
    const laws =
      plan.failingLawAt === `start`
        ? [...failing, ...broken]
        : [...broken, ...failing]
    // The first failing test: the failing law throws itself only with no
    // hook around it.
    const lawFails = law && plan.failingLawHook === `none`
    const first = laws.find((name) =>
      name === failingLawName(plan) ? lawFails : true,
    )
    return [
      {
        file,
        laws,
        // How many of its tests fail, which the baseline counts.
        failed: broken.length + (lawFails ? 1 : 0),
        hook: law && plan.failingLawHook !== `none` ? HOOK_ERROR : undefined,
        ...(first === undefined
          ? {}
          : first === failingLawName(plan)
            ? {
                test: first,
                error: FAILING_ERROR,
                replayed: owner ? [FAILING_LAW] : undefined,
              }
            : {
                test: first,
                error: `Error: this owner fails with no mutant active`,
                replayed: [`${BROKEN_SUITE} fixed seed 999`],
              }),
      },
    ]
  })
}

/**
 * The tests the fixture writes into a file beyond the plan's (`oracleTestFile`),
 * each deterministic and passing: the console-stream test of file a, the
 * mid-run edit test of the file that lands the edit, and the
 * failing owner's two passing tests. None calls the source under test. The
 * mid-run test is the baseline's passing test (law 14): its file reads the
 * edited text only after the edit lands, so a later check may see it fail;
 * the model follows the baseline here, as it does for the other baseline counts.
 *
 * Load reach goes to every test of an owner file that imports the module
 * (M 2026-11-06). A file imports it only when a plan test calls a function of
 * the module: the fixture's `import * as sut` is elided when no test uses it
 * (a file with only framework tests, or only a placeholder, does not import the
 * module, and production reports its mutants unreached). So a file's framework
 * tests count only where the file has a plan test.
 *
 * The failing owner's pair judges: under per-law blocking ("Block per law",
 * M 2026-11-18, #176) its file's failing law judges nothing and its passing
 * tests still judge, so `ownerTests` keeps the pair (#186).
 */
function frameworkTestsOf(plan) {
  const tests = []
  const importers = new Set(plan.tests.map((t) => t.file))
  const add = (file, name) =>
    importers.has(file) &&
    tests.push({
      file,
      name,
      framework: true,
      flaky: false,
      registered: true,
      route: `framework`,
    })
  if (plan.consoleOutput) add(`a`, `writes to the console streams`)
  if (plan.authoredRead !== `none`) add(`a`, LIMIT_TEST)
  if (plan.midrun) add(plan.midrunBy, MIDRUN_EDITORS[plan.midrunTarget].test)
  if (plan.fault === `brokenOwner`) {
    add(`b`, `fixed seed 999 again`)
    add(`b`, `fixed seed 999`)
  }
  return tests
}

/**
 * Each test file's baseline (law 14): its tests that ran and those skipped
 * (a file with no tests of the plan holds one skipped placeholder), how
 * many failed, and its failing test, or that it did not load, or that it
 * failed outside its tests (a describe's hook).
 */
function baselineOf(plan) {
  const failing = blockingOf(plan)
  return [...oracleFilesOf(plan), `c`].map((file) => {
    // File a's tests beyond the plan's run in every baseline too: the mid-run
    // edit test, and the one that writes to the console streams.
    const own =
      plan.tests.filter((t) => t.file === file).length +
      (plan.midrun && file === plan.midrunBy ? 1 : 0) +
      (file === `a` && plan.consoleOutput ? 1 : 0) +
      (file === `a` && plan.authoredRead !== `none` ? 1 : 0)
    const entry = failing.find((f) => f.file === file)
    const loads = entry === undefined || entry.laws !== undefined
    // The failing owner's suite holds two tests and a third of its name, and
    // the failing law is one test more; a `beforeAll` that throws skips it.
    const owner = plan.fault === `brokenOwner` && file === `b`
    const law = loads && holdsFailingLaw(plan, file)
    const skippedLaw = law && plan.failingLawHook === `beforeAll`
    const ran = own + (owner ? 3 : 0) + (law && !skippedLaw ? 1 : 0)
    return {
      file: `tests/${file}.test.ts`,
      ordinary: file === `c`,
      ran,
      skipped: ran === 0 && !skippedLaw ? 1 : 0,
      failed: entry?.failed ?? 0,
      loads,
      fails: entry !== undefined,
      test: entry?.test,
      error: entry?.error,
      hook: entry?.hook,
    }
  })
}

// The faults the analysis refuses before it reads ownership: their plans may
// be made ownerless. Every other fault is a runtime one, or a fault of the
// instrumented copy, and its plan is not made ownerless, so most such runs
// reach their own check. Its generated owners can still own nothing; the
// analysis then refuses the run for that first (see `refusal`).
const declarationFaults = [
  `none`,
  `badEntry`,
  `missingSource`,
  `nonLiteral`,
  `outsideSource`,
]
const outModeOf = (history) => history.outMode ?? `explicit`
const reachesRun = (history) =>
  !declarationFaults.includes(history.fault ?? `none`)

// Law 15, the stream's lines (the maintainer's request of 2026-11-12,
// relayed by the coordinator: an agent acts on a check's results as they
// stream, so one `grep '^oracle-gaps: '` finds every line the CLI writes
// for it, and the kind's word right after the prefix filters one kind; the
// same prefixes on stdout and stderr, in a cold run and through the
// daemon). The kinds:
// The stdout summary's lines have kinds of their own: its totals
// (`summary`), one directive per gap class (`legend`), and each function's
// heading over its gap lines (`function`) (the coordinator's decision of
// 2026-11-12 on review F1: every line of either stream is a line of the
// stream). An internal error says so on a line of its own kind (`error`,
// law 12) before its done line: P10 prefixes every line the CLI writes,
// and its declared exempt lines (v21.2 P10 and I3) do not name an internal
// error's lines. The kind is the done line's status word for exit 3 (v21.2
// I7), and the line's form is the register's C entry "The internal-error
// line" (2026-11-16).
const streamKinds = [
  `config`,
  `note`,
  `baseline`,
  `blocked`,
  `progress`,
  `gap`,
  `busy`,
  `summary`,
  `legend`,
  `function`,
  `error`,
  `done`,
]
// The one decisive baseline line, before any mutant runs: every oracle
// file passed, or how many of them failed, which makes the report
// provisional.
const baselineVerdict =
  /^oracle-gaps: baseline (?:all \d+ oracle files? pass|\d+ of \d+ oracle files? failed \(provisional\))$/
const countedFiles = (n) => `${n} oracle file${n === 1 ? `` : `s`}`
/** The decisive baseline line of a run with `files` oracle files, `failing` of them failing. */
const verdictLine = (files, failing) =>
  failing === 0
    ? `oracle-gaps: baseline all ${countedFiles(files)} pass`
    : `oracle-gaps: baseline ${failing} of ${countedFiles(files)} failed (provisional)`
/**
 * The last line of a completed run's stdout: its status, its gap count, and
 * the path of its full report in output directory `out`.
 */
const doneLine = (gaps, provisional, out) =>
  `oracle-gaps: done completed, ${gaps} gap${gaps === 1 ? `` : `s`}${provisional ? ` (provisional)` : ``}, report ${out.replaceAll(`\\`, `/`)}/summary.md`

function model(plan) {
  const refused = refusal(plan)
  // The config the run names (F12) once its contexts have loaded it: the
  // file, or none. A run refused before then names none: an argument
  // fault, a Vitest that does not load, a config that does not load, and a
  // config that defines test.projects, which a loaded context shows. Every
  // other run names it once, refused or not.
  const configLines =
    [
      `outsideSource`,
      `brokenVitest`,
      `configThrows`,
      `configNoDefault`,
      `configNull`,
      `configSyntax`,
      `projects`,
    ].includes(plan.fault) || plan.logBlocked === true
      ? []
      : [
          plan.configPath === undefined
            ? `oracle-gaps: config none, Vitest's default discovery`
            : `oracle-gaps: config ${plan.configPath}`,
        ]
  if (refused) return { refused, configLines }
  const sites = sitesOf(plan)
  const owners = ownersOf(plan)
  // The oracle files that fail with no mutant active. A failing law judges
  // nothing, and the plan's tests are no failing law, so they judge in
  // every file that loads; a file that does not load runs no test.
  const failing = blockingOf(plan).filter((f) => !f.ordinary)
  const failingFiles = new Set(failing.map((f) => f.file))
  const baseline = baselineOf(plan)
  const entryOf = (file) =>
    baseline.find((b) => b.file === `tests/${file}.test.ts`)
  // An owner file that loads and runs a test, failing or passing.
  const runsTests = (file) =>
    entryOf(file)?.loads === true && entryOf(file).ran > 0
  // How many of a file's tests pass: the plan's, and the tests of no plan
  // (the failing owner's two passing tests, the mid-run edit's, the
  // console's, and the abort's), which judge no mutant, though each keeps
  // its file's mutants from blocking. A failing law is no test of the plan,
  // so the plan's tests judge as they would beside none.
  const passingIn = (file) =>
    runsTests(file) ? entryOf(file).ran - entryOf(file).failed : 0
  // Every test of an owner file, the plan's and the fixture's own
  // deterministic passing tests (`frameworkTestsOf`, #204).
  const census = [...plan.tests, ...frameworkTestsOf(plan)]
  const ownerTests = (id) =>
    census.filter(
      (t) =>
        oracleFilesOf(plan).includes(t.file) &&
        owners(id).has(t.file) &&
        runsTests(t.file),
    )
  // An authored mutant (its copy records no reach) with no passing owner
  // test, that a failing law or a failing file of its owners holds, and no
  // passing owner kills, is blocked: it waits for them.
  const blockedOr = (id, kind) =>
    kind !== `killed` &&
    [...owners(id)].some((file) => failingFiles.has(file)) &&
    [...owners(id)].every((file) => passingIn(file) === 0)
      ? `blocked`
      : kind
  // Code that ran when the module loaded: the calls at the end of the
  // source, and the sites that each call reached (with 0).
  const loadRuns = plan.loadCalls.map((call) =>
    interpret(plan, call.fn, 0, sites),
  )
  const ranAtLoad = (site) =>
    site.fnId === `<module>` ||
    site.data !== undefined ||
    loadRuns.some((run) => run.reached.has(site.id))
  // The sites the failing law reaches, when it calls production (input 7);
  // a `beforeAll` that throws skips it, so it reaches nothing then.
  const lawTarget = failingLawTarget(plan)
  const lawReached =
    lawTarget === undefined
      ? new Set()
      : interpret(plan, lawTarget, 7, sites).reached
  // The owner files whose failing law spins under an operator mutant, and
  // where it sits: its call spins, or, repeating its call (`failingLawSpins`,
  // with one call), the mutant changed that call's output without a throw.
  // It still runs ("An excluded test still runs", 2026-11-23).
  const lawSpinsAt = (site) => {
    if (lawTarget === undefined || !lawReached.has(site.id)) return new Map()
    const base = interpret(plan, lawTarget, 7, sites)
    const mutated = interpret(plan, lawTarget, 7, sites, { site: site.id })
    const spins =
      mutated.spun ||
      (plan.failingLawSpins &&
        plan.failingLawCalls === `once` &&
        !mutated.threw &&
        mutated.trace.join() !== base.trace.join())
    return new Map(
      spins
        ? [...owners(site.fnId)]
            .filter((file) => holdsFailingLaw(plan, file) && runsTests(file))
            .map((file) => [file, plan.failingLawAt])
        : [],
    )
  }
  // Whether a deterministic passing owner test judges an operator mutant:
  // one of the plan's that reached it, or, for code that ran at load, one
  // of an owner file that loads (main's rule for code run at load). A
  // failing law judges nothing.
  const judgedAt = (site) => {
    // Every test of an owner file counts (#204's census): under per-law
    // blocking the failing owner's passing pair judges too, as each of
    // the fixture's deterministic tests of a file that loads the module.
    const tests = ownerTests(site.fnId).filter((t) => !t.flaky)
    return ranAtLoad(site)
      ? tests.length > 0
      : tests.some((t) =>
          partsOf(t).some((part) =>
            interpret(plan, t.fn, part.input, sites).reached.has(site.id),
          ),
        )
  }
  // An operator mutant that no deterministic passing owner test judges is
  // blocked by its owners' failing laws that reached it, and by its owner
  // files that judge nothing at all (one that does not load, or whose every
  // test fails, which may reach anything it owns), unless it is killed
  // (Block per law, 2026-11-18; "A broken owner file judges nothing",
  // 2026-11-19, and its C reading: a mutant reached only by failing laws or
  // broken files is blocked by them, as one reached only by nondeterministic
  // tests is indeterminate). A mutant that nothing reached stays unreached.
  const blockedAt = (site, kind) => {
    if (kind === `killed` || judgedAt(site)) return kind
    const atLoad = ranAtLoad(site)
    const holds = [...owners(site.fnId)].some(
      (file) =>
        failingFiles.has(file) &&
        (passingIn(file) === 0 ||
          // Code that ran at load reaches a file's failing laws where it
          // reaches its tests: in a file with a test of the plan (main's
          // rule for code run at load).
          (atLoad && plan.tests.some((t) => t.file === file)) ||
          (holdsFailingLaw(plan, file) && lawReached.has(site.id))),
    )
    return holds ? `blocked` : kind
  }
  const kindOf = (site) => {
    if (owners(site.fnId).size === 0) return `unowned`
    const tests = ownerTests(site.fnId)
    const reached = new Set()
    for (const t of tests)
      for (const part of partsOf(t)) {
        const run = interpret(plan, t.fn, part.input, sites)
        for (const id of run.reached) reached.add(id)
      }
    // Code that ran when the module loaded runs in every owner file that has
    // a test, and reaches every test of that file (maintainer decision,
    // 2026-11-06); a site that the load did not run is reached only by tests.
    const atLoad = ranAtLoad(site)
    if (!reached.has(site.id) && !(atLoad && tests.length > 0))
      return `unreached`
    // A mutant under which the module throws while it loads fails every
    // file that imports it before any test runs: an error outside any test
    // (law 4; the classification oracle's `setup-error`, ORC-006's setup
    // failure).
    if (
      atLoad &&
      plan.loadCalls.some(
        (call) => interpret(plan, call.fn, 0, sites, { site: site.id }).threw,
      )
    )
      return `setup-error`
    const reaching = atLoad
      ? tests
      : tests.filter((t) =>
          partsOf(t).some((part) =>
            interpret(plan, t.fn, part.input, sites).reached.has(site.id),
          ),
        )
    if (reaching.every((t) => t.flaky)) return `indeterminate`
    const kind = judge(
      plan,
      tests,
      sites,
      { site: site.id },
      {
        lawSpins: lawSpinsAt(site),
      },
    )
    if (kind !== `survived`) return kind
    // A test that reached it did more work, though nothing it observed
    // changed: the mutant deleted a shortcut for speed (maintainer decision,
    // 2026-11-12), which only a work bound sees.
    if (runsOf(plan, reaching, sites, { site: site.id }).some((r) => r.rose))
      return `extra-work`
    // The survivor classes (classify.mjs): an `if` whose line one outcome
    // never took, a comparison no owner test infected, and otherwise an
    // infected site that no observation shows.
    const isIf = site.operator === `if-true` || site.operator === `if-false`
    const comparison = site.operator === `binary-swap` && site.role === `swap`
    // A mutant that changes a value only on some inputs, with no capture to
    // show which: a loop's condition, an undefined call value, a dropped
    // field, a skipped call, and a logical operator (the `&&` of the old
    // probe form and of a probe in another shape). Its directive names the
    // input that distinguishes it.
    if (
      [
        `loop-false`,
        `value-undefined`,
        `field-drop`,
        `delete-call`,
        `return-undefined`,
        `optional-chain`,
      ].includes(site.operator) ||
      site.logical === true
    )
      return `not-distinguished`
    // Code that runs at load infects every test of its file, and a
    // nondeterministic test's infection judges nothing.
    const infectedIn =
      tests.some(
        (t) =>
          !t.flaky &&
          partsOf(t).some((part) =>
            interpret(plan, t.fn, part.input, sites).infected.has(site.id),
          ),
      ) ||
      (tests.length > 0 && loadRuns.some((run) => run.infected.has(site.id)))
    if (isIf) return infectedIn ? `not-observed` : `branch-never-taken`
    if (comparison && !infectedIn) return `not-infected`
    return `not-observed`
  }
  // The ordinary tests' outcome is reported, for information, only when the
  // run asks for it, and only for a survivor or an unreached mutant that an
  // ordinary test reached.
  // Code that runs at module load reaches every test of a file that loads
  // the module, ordinary files included (maintainer decision, 2026-11-06).
  const ordinaryReaches = (site) => {
    const ordinary = plan.tests.filter((t) => t.file === `c`)
    if (ranAtLoad(site)) return ordinary.length > 0
    return ordinary.some((t) =>
      interpret(plan, t.fn, t.input, sites).reached.has(site.id),
    )
  }
  const survivorKinds = new Set([
    `not-judged`,
    `extra-work`,
    `branch-never-taken`,
    `not-infected`,
    `not-observed`,
    `not-distinguished`,
    `indeterminate`,
    `unreached`,
  ])
  const mutants = sites.map((site) => {
    const kind = site.probe
      ? undefined
      : owners(site.fnId).size === 0
        ? `unowned`
        : blockedAt(site, kindOf(site))
    return {
      key: site.key,
      source: site.file,
      function: site.function,
      fnId: site.fnId,
      line: site.line,
      operator: site.operator,
      ordinal: site.ordinal,
      probe: site.probe,
      kind,
      ordinaryOutcome:
        plan.ordinary && survivorKinds.has(kind) && ordinaryReaches(site),
    }
  })
  // An owner file whose copy loads the source as a module, where the runner
  // serves an authored mutant's patch: a file that loads, with a plan test
  // (each calls the source through its import) or a failing law that calls
  // production. Any other file's import of the source is unused, so it is
  // elided, and its copy never loads the source.
  const loadsSource = (file) =>
    entryOf(file)?.loads === true &&
    (plan.tests.some((t) => t.file === file) ||
      (holdsFailingLaw(plan, file) && failingLawTarget(plan) !== undefined))
  // Each authored mutant is judged alone, against the original source with
  // only its own edit.
  const authoredAll = plan.authoredList.map((a) => ({
    id: a.id,
    key: `${SOURCE}#authored:${a.id}`,
    // An authored mutant is not instrumented, so a survivor is not-judged
    // (a changed observation) or not-observed (the patch changed the code),
    // unless no owner's copy loaded the source: the patch never ran there,
    // so it is unreached.
    kind: !a.applies
      ? `does-not-apply`
      : owners(a.fn).size === 0
        ? `unowned`
        : ((kind) =>
            blockedOr(
              a.fn,
              kind !== `survived`
                ? kind
                : [...owners(a.fn)].some(loadsSource)
                  ? `not-observed`
                  : `unreached`,
            ))(
            judge(
              plan,
              ownerTests(a.fn),
              sites,
              { authored: a.label },
              { budgeted: false },
            ),
          ),
    line: a.applies ? a.line : undefined,
  }))
  // The authored mutant of the data file that file a reads through fs and
  // judges: the runner serves its patch to the read, and file a's law
  // rejects the changed limit on a fixed seed.
  if (plan.authoredRead !== `none`)
    authoredAll.push({
      id: `read`,
      key: `${READ_DATA}#authored:read`,
      kind: entryOf(`a`)?.loads === true ? `killed` : `blocked`,
      line: 1,
    })
  const authored = authoredAll[0]?.kind
  const isGap = (kind) =>
    kind !== undefined && ![`killed`, `unowned`].includes(kind)
  const count = (kind) => mutants.filter((m) => m.kind === kind).length
  // Each gap as the summary lists it: its key, its kind, and its line.
  const entries = [
    ...mutants
      .filter((m) => isGap(m.kind))
      .map((m) => ({ key: m.key, kind: m.kind, line: String(m.line) })),
    ...authoredAll
      .filter((a) => isGap(a.kind))
      .map((a) => ({ key: a.key, kind: a.kind, line: String(a.line) })),
  ].sort((a, b) => (a.key < b.key ? -1 : 1))
  const gaps = entries.map((e) => e.key)
  return {
    configLines,
    // The batch whose run the model predicts rejects (a constructed fault): the run ends as an internal error.
    rejectedBatch: plan.rejectBatch > 0 ? plan.rejectBatch : undefined,
    baseline: baselineOf(plan),
    blocking: blockingOf(plan).filter((f) => !f.ordinary),
    replayed: blockingOf(plan).find((f) => f.replayed)?.replayed,
    // A native addon can crash the whole process from a worker thread, so a
    // package that depends on one runs its tests in child processes.
    pool:
      plan.native === `none` && !plan.release && !plan.scopedAddon
        ? `threads`
        : `forks`,
    mutants,
    authored,
    authoredAll,
    authoredLine: authoredAll[0]?.line,
    gaps,
    entries,
    unowned: [
      ...mutants.filter((m) => m.kind === `unowned`).map((m) => m.key),
      ...authoredAll.filter((a) => a.kind === `unowned`).map((a) => a.key),
    ].sort(),
    counts: {
      mutants: mutants.length + authoredAll.length,
      authored: authoredAll.length,
      killed:
        count(`killed`) + authoredAll.filter((a) => a.kind === `killed`).length,
      gaps: gaps.length,
      probe: mutants.filter((m) => m.probe).length,
    },
  }
}

const testName = (t, index) =>
  t.name === `plain`
    ? `check ${index}`
    : t.route === `fixed seed`
      ? `fixed seed ${index + 1}`
      : t.route === `fixed history`
        ? `fixed history: h${index}`
        : t.route === `case`
          ? `case ${index}`
          : t.route === `calibration`
            ? `calibration: c${index}`
            : t.route === `probe calibration`
              ? `probe p${index} always fires`
              : t.route
const callFor = (fn) =>
  fn.includes(`.`)
    ? `new sut.${fn.split(`.`)[0]}().${fn.split(`.`)[1]}`
    : `sut.${fn}`
const quoteEntry = (plan, entry) =>
  plan.template ? `\`${entry}\`` : `'${entry}'`

// Whether a test's verdict waits on file b's lazy gate (`lazyGate`).
const lazyGated = (plan, file, t) =>
  plan.lazyGate && file === `b` && t.judges && t.judgeBy === `verdict`
// Whether a test's verdict waits on the data file it reads through fs.
const fsGated = (plan, file, t) =>
  plan.fsRead !== `none` && file === `b` && t.judges && t.judgeBy === `verdict`
// How file b reads `tests/data.json`, by each kind of fs read.
// Each read first checks that the fs function it uses keeps its own name
// and length, as code that dispatches on a function's arity does: a test
// that passes alone passes under the CLI (law 3), whatever the CLI does to
// see the read (review of #55).
const keptFs = (local, name, length) =>
  `if (${local}.name !== '${name}' || ${local}.length !== ${length}) throw new Error('fs.${name} lost its own properties')`
const dataReads = {
  sync: [
    `import { readFileSync as readDataSync } from 'node:fs'`,
    keptFs(`readDataSync`, `readFileSync`, 2),
    `const readData = async () => JSON.parse(readDataSync(new URL('./data.json', import.meta.url), 'utf8'))`,
  ],
  promise: [
    `import { readFile as readDataFile } from 'node:fs/promises'`,
    keptFs(`readDataFile`, `readFile`, 2),
    `const readData = async () => JSON.parse(await readDataFile(new URL('./data.json', import.meta.url), 'utf8'))`,
  ],
  statDir: [
    `import { existsSync as dataDirExists, readFileSync as readDataSync, statSync as statDataDir } from 'node:fs'`,
    keptFs(`statDataDir`, `statSync`, 1),
    keptFs(`dataDirExists`, `existsSync`, 1),
    `const readData = async () => (statDataDir(new URL('./', import.meta.url)).isDirectory() && dataDirExists(new URL('./', import.meta.url)) ? JSON.parse(readDataSync(new URL('./data.json', import.meta.url), 'utf8')) : { open: false })`,
  ],
  callback: [
    `import { readFile as readDataCallback } from 'node:fs'`,
    keptFs(`readDataCallback`, `readFile`, 3),
    `const readData = () => new Promise((resolve, reject) => readDataCallback(new URL('./data.json', import.meta.url), 'utf8', (error, text) => (error ? reject(error) : resolve(JSON.parse(text)))))`,
  ],
}

function oracleTestFile(plan, file) {
  const sites = sitesOf(plan)
  const entries = [
    ...(plan.wholeFile === file ? [spell(SOURCE, plan.ownsSpelling)] : []),
    ...plan.functions
      .filter((fn) => fn.owners.includes(file))
      .map((fn) => `${spell(fn.file, plan.ownsSpelling)}#${fn.name ?? fn.id}`),
    ...(plan.data ?? [])
      .filter((d) => d.owners.includes(file))
      .map((d) => `${spell(SOURCE, plan.ownsSpelling)}#${d.id}`),
    ...(file === `a` && plan.authoredRead !== `none` ? [READ_DATA] : []),
    ...(file === `b` && plan.fault === `badEntry` ? [`${SOURCE}#nope`] : []),
    ...(file === `b` && plan.fault === `missingSource`
      ? [`src/missing.ts#f0`]
      : []),
  ].map((entry) => quoteEntry(plan, entry))
  // The calls that declare the entries, one per declaration the file makes.
  // With `both`, the entries split between the two calls. A wrapper takes
  // its options, `owns` among them, after a leading id, as a project's
  // registration helpers do, so the list is read from any argument.
  const declares = {
    wrapper: [`registerOwned`],
    oracleProperty: [`oracleProperty`],
    both: [`registerOwned`, `oracleProperty`],
    neither: [],
  }[plan.declaration ?? `wrapper`]
  const call = (name, owns) =>
    name === `registerOwned`
      ? `${name}('p', { runs: 1, owns: ${owns} })`
      : `${name}({ owns: ${owns} })`
  const owns = declares.flatMap((name, part) => {
    const list =
      plan.declaration === `both`
        ? entries.filter((_, i) => i % 2 === part)
        : entries
    return file === `b` && plan.fault === `nonLiteral`
      ? [
          `const OWNS_${part} = [${list.join(`, `)}]`,
          call(name, `OWNS_${part}`),
        ]
      : [call(name, `[${list.join(`, `)}]`)]
  })
  const stubs = declares.map((name) =>
    name === `registerOwned`
      ? `function ${name}(_id: string, _options: { runs: number; owns: Array<string> }): void {}`
      : `function ${name}(_parts: { owns: Array<string> }): void {}`,
  )
  const out = [
    // A per-file environment, which Vitest reads from the file's text.
    ...(plan.pragma && file === `a` ? [`// @vitest-environment marked`] : []),
    `import { ${holdsFailingLaw(plan, file) && plan.failingLawHook !== `none` ? `${plan.failingLawHook}, ` : ``}${plan.tests.some((t) => t.file === file && t.cleanupThrows) ? `afterEach, ` : ``}describe, expect, test${plan.tests.some((t) => t.file === file && (t.spies || t.timed === `spiedclock`)) ? `, vi` : ``} } from 'vitest'`,
    ...(plan.tests.some((t) => t.file === file && t.shrinks)
      ? [`import fc from 'fast-check'`]
      : []),
    ...(plan.tests.some((t) => t.file === file && (t.ioWait || t.stops))
      ? [`import { spawn } from 'node:child_process'`]
      : []),
    ...(plan.tests.some((t) => t.file === file && t.timed === `sleep`)
      ? [`import { setTimeout as sleep } from 'node:timers/promises'`]
      : []),
    ...(plan.tests.some((t) => t.file === file && t.timed && t.timed !== `turn`)
      ? [
          `import { promisify } from 'node:util'`,
          `import { setTimeout as nodeSetTimeout } from 'node:timers'`,
          `import { uptime as osUptime } from 'node:os'`,
          `import { monitorEventLoopDelay } from 'node:perf_hooks'`,
        ]
      : []),
    ...(plan.tests.some((t) => t.file === file && t.stops)
      ? [
          `import { writeFileSync as recordPid } from 'node:fs'`,
          `import { join as pidPath } from 'node:path'`,
        ]
      : []),
    ...(plan.tests.some(
      (t) => t.file === file && t.slow && t.slowMs === undefined,
    )
      ? beatHold(file)
      : []),
    // The mid-run edit (`midrun`): file a loads file b's helper, so its
    // context holds the helper's old text when the edit lands.
    ...(plan.midrun && file === plan.midrunBy
      ? [
          `import { readFileSync as readMarker, writeFileSync as writeEdit } from 'node:fs'`,
          `import { dirname as markerDir, join as markerPath } from 'node:path'`,
          ...(file === `a`
            ? [`import { strict as strictAtLoad } from './strict'`]
            : []),
        ]
      : []),
    // A module's text through a query import, which Vite loads (see rawImport).
    ...(plan.tests.some((t) => t.file === file && t.rawImport)
      ? [
          `import rawSource from '../src/sut.ts?raw'`,
          `import { readFileSync } from 'node:fs'`,
        ]
      : []),
    ...(plan.tests.some((t) => t.file === file && t.asProp)
      ? [`import { fc as fcv, test as fcTest } from '@fast-check/vitest'`]
      : []),
    `import * as sut from '../src/sut'`,
    ...(file === `b` ? [`import { strict } from './strict'`] : []),
    ...(file === `b` && plan.fsRead !== `none` ? dataReads[plan.fsRead] : []),
    ...(file === `a` && plan.authoredRead !== `none`
      ? limitReads[plan.authoredRead]
      : []),
    ...stubs,
    // State that tests of this file share (the `w_shared` witness).
    `const shared = { value: 0 }`,
    `const stored: { value: Array<string> } = { value: [] }`,
    ...owns,
    `const g = globalThis as { __oracleRoute?: (route: string) => void; __oracleObserve?: (c: string, v: unknown) => void; __oracleVerdict?: (v: { property: string; law: string; checkpoint: string }) => void; __oracleWorkBound?: (ratio: number) => void }`,
    ...(plan.pragma && file === `a`
      ? [
          `if ((globalThis as { __gapEnvironment?: string }).__gapEnvironment !== 'marked') throw new Error('the file ran outside the environment its pragma names')`,
        ]
      : []),
  ]
  // Whether the file's tests judge, which law 9's edits change: file b's
  // follow its helper module, and file a's hold only under seed 1. The
  // driver's cold runs before any edit use seed 1 and a strict helper, so
  // the gate is open there and the model need not read it.
  const gate =
    file === `a`
      ? `process.env.${ENV_PREFIX}_SEED === '1'`
      : file === `b`
        ? `strict`
        : `true`
  if (plan.failingLawAt === `start`) out.push(...failingLawLines(plan, file))
  plan.tests.forEach((t, index) => {
    if (t.file !== file) return
    // A property judges, slows, and hangs only in runs with a positive `n`.
    const when = t.asProp ? `${gate} && n > 0` : gate
    // Each campaign registers its route, calls the function, observes, and
    // judges the unmutated output, which the model computes.
    const campaign = (part, i) => {
      const expected = JSON.stringify(
        interpret(plan, t.fn, part.input, sites).trace,
      )
      const out = `out${i}`
      return [
        ...(t.registered ? [`    g.__oracleRoute?.('${part.route}')`] : []),
        // The framework registers a work bound beside the route.
        ...(t.registered && t.work !== null
          ? [`    g.__oracleWorkBound?.(${t.work})`]
          : []),
        // A test that waits on a timer before it runs production.
        ...(t.timed
          ? [
              {
                timer: `    if ((await promisify(setTimeout)(0, 'v')) !== 'v') throw new Error('promisify(setTimeout) lost its value')`,
                nodetimer: `    if ((await promisify(nodeSetTimeout)(0, 'v')) !== 'v') throw new Error('promisify of node:timers lost its value')`,
                sleep: `    await sleep(0)`,
                clock: `    if (Date.now() < 0) throw new Error('the clock reads before 1970')`,
                spiedclock: `    { const spy = vi.spyOn(Date, 'now'); if (Date.now() < 0) throw new Error('the clock reads before 1970'); spy.mockRestore() }`,
                uptime: `    if (process.uptime() < 0) throw new Error('negative uptime')`,
                osuptime: `    if (osUptime() < 0) throw new Error('negative uptime')`,
                abort: `    if (AbortSignal.timeout(60000).aborted) throw new Error('aborted at once')`,
                waitasync: `    if (Atomics.waitAsync(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 0).value !== 'timed-out') throw new Error('waitAsync did not time out')`,
                wait: `    if (Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 0) !== 'timed-out') throw new Error('wait did not time out')`,
                loopdelay: `    { const delay = monitorEventLoopDelay(); delay.enable(); delay.disable() }`,
                turn: `    await new Promise((r) => setImmediate(r))`,
              }[t.timed],
            ]
          : []),
        `    const ${out}: Array<string> = []`,
        ...(t.setsShared ? [`    shared.value = 5`] : []),
        t.readsShared
          ? `    if (shared.value === 5) ${callFor(t.fn)}(${part.input}, ${out})`
          : t.judgesShared
            ? `    ${out}.push(...stored.value)`
            : `    ${callFor(t.fn)}(${part.input}, ${out})`,
        ...(t.storesShared ? [`    stored.value = [...${out}]`] : []),
        ...(t.rawImport
          ? [
              `    if (rawSource !== readFileSync(new URL('../src/sut.ts', import.meta.url), 'utf8')) throw new Error('the raw import is not the module text')`,
            ]
          : []),
        ...(t.caughtVerdict
          ? [
              `    try {`,
              `      g.__oracleVerdict?.({ property: 'fixture-${file}', law: 'L', checkpoint: 'caught' })`,
              `      throw new Error('caught')`,
              `    } catch {}`,
            ]
          : []),
        // A draw from the ambient random source, which the capture seeds by
        // the test: the same in every run of the test, its copies included.
        ...(t.draws
          ? [`    g.__oracleObserve?.('draw', Math.floor(Math.random() * 1e6))`]
          : []),
        t.channel === `expect`
          ? `    expect(${out}).toBeDefined()`
          : `    g.__oracleObserve?.('trace', ${out})`,
        ...(t.flaky
          ? [`    g.__oracleObserve?.('clock', performance.now())`]
          : []),
        ...(t.spies
          ? [
              `    const payload${i} = { trace: ${out} }`,
              `    const spies${i} = [vi.spyOn(Object, 'keys'), vi.spyOn(Object, 'getPrototypeOf'), vi.spyOn(Object, 'getOwnPropertyDescriptor')]`,
              `    expect(payload${i}).toBeDefined()`,
              `    const scans${i} = spies${i}.flatMap((spy) => spy.mock.calls).filter(([target]) => target === payload${i}).length`,
              `    for (const spy of spies${i}) spy.mockRestore()`,
              `    if (scans${i} !== 0) throw new Error('the payload was scanned')`,
            ]
          : []),
        ...(t.getter
          ? [
              `    let reads${i} = 0`,
              `    expect({ get payload() { reads${i} += 1; return ${out} } }).toBeDefined()`,
              `    if (reads${i} !== 0) throw new Error('the payload was read')`,
            ]
          : []),
        // A slow test waits past the first budget, within the full limit,
        // where the output differs; it then judges as usual. The slow kill
        // (`w_slowkill`, no `slowMs`) waits on the CLI instead of the clock
        // where the driver names the run's stream log (`beatHeld`).
        ...(t.slow
          ? [
              `    if (${when} && JSON.stringify(${out}) !== ${JSON.stringify(expected)}) await ${t.slowMs === undefined ? `beatHeld()` : `new Promise((r) => setTimeout(r, ${t.slowMs}))`}`,
            ]
          : []),
        // A test that waits on I/O (a child process, about 3 s) where the
        // output differs, then judges as usual.
        ...(t.ioWait
          ? [
              `    if (${when} && JSON.stringify(${out}) !== ${JSON.stringify(expected)}) await new Promise((r) => spawn(process.execPath, ['-e', 'setTimeout(() => {}, ${SLOW_MS})']).on('exit', r))`,
            ]
          : []),
        // An injected failure shrinks to its smallest counterexample.
        ...(t.shrinks
          ? [
              `    const shrunk${i} = fc.check(fc.property(fc.integer({ min: 0, max: 1000 }), (n) => n < 5), { seed: 1 })`,
              `    if (shrunk${i}.counterexample?.[0] !== 5) throw new Error('the injected failure did not shrink')`,
            ]
          : []),
        // In a run the driver stops, a test that stops starts a child
        // process, records its own process id and the child's in the
        // directory the driver names, and spins where its output differs.
        // In any other run it judges as usual.
        ...(t.stops
          ? [
              `    if (${when} && process.env.GAP_STOP_DIR && JSON.stringify(${out}) !== ${JSON.stringify(expected)}) {`,
              `      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })`,
              `      recordPid(pidPath(process.env.GAP_STOP_DIR, String(child.pid)), '')`,
              `      recordPid(pidPath(process.env.GAP_STOP_DIR, String(process.pid)), '')`,
              `      for (;;) {}`,
              `    }`,
            ]
          : []),
        // A flaky test never hangs: the model leaves flaky tests out.
        ...(t.hangs && !t.flaky
          ? [
              `    if (${when} && JSON.stringify(${out}) !== ${JSON.stringify(expected)}) await new Promise(() => {})`,
            ]
          : []),
        // Where the output differs and the data is open, a verdict test of
        // file b that reads the data spins on the function it tests
        // (`spinData`), so the capture's call budget cuts its copy. A flaky
        // test does not: the model leaves flaky tests out.
        ...(plan.spinData && fsGated(plan, file, t) && !t.flaky
          ? [
              `    if (${when} && JSON.stringify(${out}) !== ${JSON.stringify(expected)} && (await readData()).open) {`,
              ...(plan.spinThrows
                ? [
                    `      setTimeout(() => { throw new Error('a spinning copy threw outside its test') })`,
                  ]
                : []),
              `      for (;;) ${callFor(t.fn)}(${part.input}, [])`,
              `    }`,
            ]
          : []),
        ...(!t.judges
          ? []
          : t.judgeBy !== `verdict`
            ? [
                `    if (${when}) expect${t.judgeBy === `soft` ? `.soft` : ``}(${out}).toEqual(${expected})`,
              ]
            : [
                // A lazy gate is imported only where the output differs, so
                // the unmutated run never loads it. It is open before any
                // edit, so the model need not read it.
                `    if (${when} && JSON.stringify(${out}) !== ${JSON.stringify(expected)}${lazyGated(plan, file, t) ? ` && (await import('./lazy')).open` : ``}${fsGated(plan, file, t) ? ` && (await readData()).open` : ``}) {`,
                `      g.__oracleVerdict?.({ property: 'fixture-${file}', law: '${t.law}', checkpoint: 'trace' })`,
                `      throw new Error('violation')`,
                `    }`,
              ]),
      ]
    }
    out.push(
      `describe('t${index}', () => {`,
      ...(t.cleanupThrows
        ? [
            `  afterEach((context) => {`,
            `    if (context.task.result?.state === 'fail') throw new Error('cleanup failed after the failure')`,
            `  })`,
          ]
        : []),
      t.asProp
        ? `  fcTest.prop([fcv.integer({ min: 0, max: 10 })], { numRuns: 20, seed: 1 })('${testName(t, index)}', async (n) => {`
        : `  test('${testName(t, index)}', ${(t.hangs && !t.flaky) || t.slow || t.ioWait || t.timed || lazyGated(plan, file, t) || fsGated(plan, file, t) ? `async ` : ``}() => {`,
      ...partsOf(t).flatMap(campaign),
      `  })`,
      `})`,
    )
  })
  // The failing owner test sits in a suite whose name holds regular
  // expression and shell syntax, beside a test whose name extends it and a
  // top-level test of its own name, so the baseline's replay command must
  // escape, anchor, and quote its pattern to run it alone (law 3).
  if (file === `b` && plan.fault === `brokenOwner`)
    out.push(
      `describe(${JSON.stringify(BROKEN_SUITE)}, () => {`,
      `  test('fixed seed 999', () => {`,
      `    g.__oracleRoute?.('fixed seed')`,
      `    throw new Error('this owner fails with no mutant active')`,
      `  })`,
      `  test('fixed seed 999 again', () => {})`,
      `})`,
      `test('fixed seed 999', () => {})`,
    )
  // The mid-run edit: the first run of this test after the driver marks an
  // edit pending (`midrun.txt`, `pending:<value>`) rewrites file b's
  // helper, or the data file, with that value and marks the edit done, so
  // every later run of it, in this check or another, changes nothing. It
  // calls nothing of the source under test, so no mutant reaches it. In
  // file b it first reads what it edits and fails unless the helper is
  // strict or the data open, as in the history's first state: the run that
  // lands the edit passes, and every run that reads the edited text fails,
  // so a run stored under the edited text with the old verdict shows in
  // the baseline (review of #55, F1).
  if (plan.midrun && file === plan.midrunBy)
    out.push(
      `test('${MIDRUN_EDITORS[plan.midrunTarget].test}', async () => {`,
      ...(file === `a`
        ? [`  void strictAtLoad`]
        : [
            `  if (!(${plan.midrunTarget === `data` ? `(await readData()).open` : `strict`})) throw new Error('${MIDRUN_EDITORS[plan.midrunTarget].message}')`,
          ]),
      // The marker sits in the run's own session directory, beside the
      // runner's harness (the worker's first setup file), which is no input
      // of a run by design (check.mjs, ownHarness). So the marker's own edit
      // does not decide whether the run is stored: only the helper's or the
      // data's text does. A run with no harness, or no marker, edits nothing.
      `  const harness = (globalThis as { __vitest_worker__?: { config?: { setupFiles?: Array<string> } } }).__vitest_worker__?.config?.setupFiles?.[0]`,
      `  if (!harness) return`,
      `  const marker = markerPath(markerDir(harness), 'midrun.txt')`,
      `  let text = ''`,
      `  try { text = readMarker(marker, 'utf8') } catch { return }`,
      `  if (!text.startsWith('pending:')) return`,
      `  const value = text.slice('pending:'.length).trim()`,
      plan.midrunTarget === `data`
        ? `  writeEdit(new URL('./data.json', import.meta.url), \`{"open":\${value}}\\n\`)`
        : `  writeEdit(new URL('./strict.ts', import.meta.url), \`export const strict = \${value}\\n\`)`,
      `  writeEdit(marker, 'done\\n')`,
      `})`,
    )
  // A file with no tests still loads, so the CLI can read what it owns.
  if (
    !plan.tests.some((t) => t.file === file) &&
    !(plan.midrun && file === plan.midrunBy) &&
    !(file === `a` && plan.consoleOutput) &&
    !(file === `a` && plan.authoredRead !== `none`)
  )
    out.push(`test.skip('no tests', () => {})`)
  // File a reads the data file through fs and judges its limit on a fixed
  // seed: a law that the authored mutant `read`, which changes the limit,
  // violates once its patch reaches the read. It calls nothing of the
  // source under test.
  if (file === `a` && plan.authoredRead !== `none`)
    out.push(
      `test('${LIMIT_TEST}', async () => {`,
      `  g.__oracleRoute?.('fixed seed')`,
      `  if ((await readLimit()) !== 3) {`,
      `    g.__oracleVerdict?.({ property: 'fixture-a', law: 'data limit', checkpoint: 'trace' })`,
      `    throw new Error('violation')`,
      `  }`,
      `})`,
    )
  // A test that writes to the process's own streams, as a test's debugging
  // output does: none of it may reach the CLI's streams (law 15; review of
  // #46, F2). It calls nothing of the source under test.
  if (file === `a` && plan.consoleOutput)
    out.push(
      `test('writes to the console streams', () => {`,
      `  process.stdout.write('raw stdout from a test\\n')`,
      `  process.stderr.write('raw stderr from a test\\n')`,
      `})`,
    )
  if (plan.failingLawAt !== `start`) out.push(...failingLawLines(plan, file))
  return `${out.join(`\n`)}\n`
}

/**
 * The failing law of oracle file `file` (`failingLaw`), if it holds one. On
 * a reproducible route it calls production as `failingLawCalls` says (the
 * first generated function, with 7), then, with no hook around it, reports a
 * violation and throws, as a failing law does, so it fails in every run of
 * its file, mutated or not: a runner that counted its verdict would see a
 * kill under every mutant its file runs. Under a hook it passes itself, and
 * the hook of its describe throws: a `beforeAll` before it runs, which skips
 * it, or an `afterAll` after it passed.
 */
function failingLawLines(plan, file) {
  if (!holdsFailingLaw(plan, file)) return []
  const target = failingLawTarget(plan)
  const calls =
    target === undefined
      ? []
      : plan.failingLawCalls === `heavy`
        ? [
            `  for (let i = 0; i < ${HEAVY_CALLS}; i += 1) ${callFor(target)}(7, [])`,
          ]
        : plan.failingLawSpins
          ? [
              `  for (let i = 0; i < ${SPIN_BOUND}; i += 1) {`,
              `    const out: Array<string> = []`,
              `    ${callFor(target)}(7, out)`,
              `    if (JSON.stringify(out) === ${JSON.stringify(JSON.stringify(interpret(plan, target, 7, sitesOf(plan)).trace))}) break`,
              `  }`,
            ]
          : [`  ${callFor(target)}(7, [])`]
  const law = [
    `test('${FAILING_LAW}', () => {`,
    `  g.__oracleRoute?.('fixed seed')`,
    ...calls,
    ...(plan.failingLawHook === `none`
      ? [
          `  g.__oracleVerdict?.({ property: 'fixture-${file}', law: 'F', checkpoint: 'trace' })`,
          `  throw new ${FAILING_ERROR.replace(`: `, `('`)}')`,
        ]
      : []),
    `})`,
  ]
  return plan.failingLawHook === `none`
    ? law
    : [
        `describe('${HOOKED_SUITE}', () => {`,
        `  ${plan.failingLawHook}(() => {`,
        `    throw new Error('${HOOK_ERROR}')`,
        `  })`,
        ...law.map((line) => `  ${line}`),
        `})`,
      ]
}

/**
 * The assertions that may hold an `owns` key in their arguments, each as the
 * statement it writes for an object: every form of `expect` that Vitest
 * offers (a matcher, a negated or soft one, one read by a computed member,
 * and an aliased `expect`), Vitest's `assert` and `chai`, `expectTypeOf`,
 * and Node's `assert` by a named, a default, and a namespace import.
 */
export const ASSERTION_FORMS = {
  expect: (object) => `expect(compared).toEqual(${object})`,
  'expect-not': (object) => `expect(compared).not.toEqual(${object})`,
  'expect-soft': (object) => `expect.soft(compared).toEqual(${object})`,
  'expect-computed': (object) => `expect(compared)['toEqual'](${object})`,
  'expect-aliased': (object) => `check(compared).toEqual(${object})`,
  'expect-argument': (object) => `expect(${object}).toBeDefined()`,
  assert: (object) => `assert.deepEqual(compared, ${object})`,
  chai: (object) => `chai.expect(compared).to.deep.equal(${object})`,
  'expect-type-of': (object) =>
    `expectTypeOf(compared).toEqualTypeOf(${object})`,
  // Node's `assert`, by a named, a default, and a namespace import.
  'node-assert-named': (object) => `deepStrictEqual(compared, ${object})`,
  'node-assert-default': (object) =>
    `nodeAssert.deepStrictEqual(compared, ${object})`,
  'node-assert-namespace': (object) =>
    `strictAssert.deepEqual(compared, ${object})`,
}

function ordinaryTestFile(plan) {
  const sites = sitesOf(plan)
  const out = [
    `import { expect, test } from 'vitest'`,
    `import * as sut from '../src/sut'`,
  ]
  plan.tests.forEach((t, index) => {
    if (t.file !== `c`) return
    const expected = JSON.stringify(interpret(plan, t.fn, t.input, sites).trace)
    out.push(
      `test('ordinary ${index}', () => {`,
      `  const out: Array<string> = []`,
      `  ${callFor(t.fn)}(${t.input}, out)`,
      `  expect(out).toEqual(${expected})`,
      `})`,
    )
  })
  if (!plan.tests.some((t) => t.file === `c`))
    out.push(`test.skip('no tests', () => {})`)
  // An `owns` key in an assertion's arguments is data that the test
  // compares, so it declares no ownership: the file stays an ordinary test
  // file, and a list that is not a literal refuses nothing (review of
  // remove/declare-oracle, 2026-11-11). The model's ownership and refusals
  // never read it.
  const assertion = ASSERTION_FORMS[plan.matcherOwns?.form]
  if (assertion !== undefined) {
    const list =
      plan.matcherOwns.list === `literal`
        ? `['${SOURCE}']`
        : `compared.owns.slice(1)`
    out[0] = `import { assert, chai, expect, expect as check, expectTypeOf, test } from 'vitest'`
    out.splice(
      1,
      0,
      `import nodeAssert, { deepStrictEqual } from 'node:assert'`,
      `import * as strictAssert from 'node:assert/strict'`,
    )
    out.push(
      `const compared = { owns: ['${SOURCE}'] }`,
      `test('owns in an assertion', () => {`,
      `  ${assertion(`{ owns: ${list} }`)}`,
      `})`,
    )
  }
  return `${out.join(`\n`)}\n`
}

/** The source after the stability edit, which keeps every output the same. */
function edited(plan) {
  if (plan.stability === `prepend`) {
    const [imports, ...rest] = plan.source.split(`\n`)
    return [
      imports,
      `export function zz(x: number, out: Array<string>): void {`,
      `  if (x > 1) out.push('u');`,
      `}`,
      ...rest,
    ].join(`\n`)
  }
  if (plan.stability === `insertGuard`) {
    // A probe, and the function's guard if it has none yet.
    const lines = plan.source.split(`\n`)
    const [fn] = plan.functions
    const at = fn.body[0].line - 1
    const indent = lines[at].match(/^\s*/)[0]
    lines.splice(
      at,
      0,
      ...(fn.guardLine === undefined ? [`${indent}${guardText()}`] : []),
      `${indent}${probeText(`'gap#zz'`, `true`)}`,
    )
    return lines.join(`\n`)
  }
  // Whitespace only: drop spaces around comparisons, add them in calls.
  return plan.source
    .replaceAll(/ (<=|>=|===|!==|<|>) /g, `$1`)
    .replaceAll(`(x, out)`, `( x,out )`)
}

const AUTHORED = `mutants/authored-mutant.json`
// The data file that oracle file a reads through fs, owns, and asserts on,
// and that the authored mutant `read` edits (`authoredRead`).
const READ_DATA = `data/limit.json`
// How file a reads the data file's limit, by each kind of fs read.
const limitReads = {
  sync: [
    `import { readFileSync as readLimitSync } from 'node:fs'`,
    `const readLimit = async () => JSON.parse(readLimitSync(new URL('../${READ_DATA}', import.meta.url), 'utf8')).limit`,
  ],
  // A read to a buffer, decoded after, as TypeScript's compiler host reads
  // a declaration file.
  buffer: [
    `import { readFileSync as readLimitSync } from 'node:fs'`,
    `const readLimit = async () => JSON.parse(readLimitSync(new URL('../${READ_DATA}', import.meta.url)).toString()).limit`,
  ],
  promise: [
    `import { readFile as readLimitFile } from 'node:fs/promises'`,
    `const readLimit = async () => JSON.parse(await readLimitFile(new URL('../${READ_DATA}', import.meta.url), 'utf8')).limit`,
  ],
  callback: [
    `import { readFile as readLimitCallback } from 'node:fs'`,
    `const readLimit = () => new Promise((resolve, reject) => readLimitCallback(new URL('../${READ_DATA}', import.meta.url), 'utf8', (error, text) => (error ? reject(error) : resolve(JSON.parse(text).limit))))`,
  ],
}
// The test of file a that reads the data file and judges its limit.
const LIMIT_TEST = `reads the data limit`

/**
 * The test that lands a mid-run edit, by what it edits: its name, and the
 * error it throws in file b when it reads the edited text.
 */
const MIDRUN_EDITORS = {
  helper: {
    test: `edits the helper during the check`,
    message: `the helper this run read is not strict`,
  },
  data: {
    test: `edits the data during the check`,
    message: `the data this run read is closed`,
  },
}

/** What a mid-run edit changes: the data file only when file b reads one. */
const midrunTargetOf = (history) =>
  history.midrunTarget === `data` && (history.fsRead ?? `none`) !== `none`
    ? `data`
    : `helper`

// Law 9's fixture state: the history, and what the edits outside it set.
const initialState = (plan) => ({
  history: plan.history,
  prepend: false,
  strict: true,
  // What `tests/lazy.ts` exports: whether file b's lazy gate is open.
  lazyOpen: true,
  // What `tests/data.json` holds: whether file b's data gate is open.
  dataOpen: true,
  // How many mid-run edits have landed (`midrun`).
  midruns: 0,
  seed: 1,
  // Whether the check's `--config` names the second config (`altConfig`).
  altConfig: false,
  newOracle: false,
  cliEdited: false,
  // Whether the package's Vitest and runner dependencies are linked into its
  // own node_modules (`fixSession`).
  linked: false,
})

/**
 * The second config of law 9's `config` edit, which only `--config` names:
 * the package's config in its own format and syntax, with only file a's
 * tests included.
 */
const altConfigPath = (plan) =>
  `config/gap-vitest-alt.${plan.configFile.split(`.`).at(-1)}`

// The config's own pre plugin (`prePlugin`): it rewrites each module of the
// package that it transforms, keeping what the module does.
const PRE_PLUGIN = `{ name: 'gap-pre-rewrite', enforce: 'pre', transform(code, id) { const path = id.split('?')[0]; return /\\.(ts|js|mjs)$/.test(path) && !path.includes('/node_modules/') ? code + '\\n// rewritten by a pre plugin\\n' : undefined } }`

// The config's own plugin with a \`load\` hook (\`loadPlugin\`): it loads each
// test file itself, with a sync read of its path, as a plugin that reads a
// module's source does. The runner's copy of a test file exists only in
// memory, so only the runner's own \`load\` can answer for it (review of #103).
const LOAD_PLUGIN = `{ name: 'gap-own-load', load(id) { const path = id.split('?')[0]; return path.endsWith('.test.ts') ? readFileSync(path, 'utf8') : undefined } }`

/**
 * The text of the package's config, in its syntax (`configOf`), with the
 * fault, the top-level await, or the `require` calls the plan holds. `test`
 * is the config's `test` object.
 */
function configText(plan, test) {
  const commonjs = plan.configSyntax === `cjs`
  const plugins = [
    ...(plan.prePlugin ? [PRE_PLUGIN] : []),
    ...(plan.loadPlugin ? [LOAD_PLUGIN] : []),
  ]
  const config = `defineConfig(${
    { object: ``, function: `() => (`, async: `async () => (`, promise: `` }[
      plan.config
    ]
  }{ test: ${
    plan.fault === `projects`
      ? `{ projects: [{ test: { name: 'unit', ...${test} } }] }`
      : test
  }${plugins.length > 0 ? `, plugins: [${plugins.join(`, `)}]` : ``} }${plan.config === `object` || plan.config === `promise` ? `` : `)`})`
  // A promise of the config, a null default, or a config cut off mid-object.
  const body =
    plan.fault === `configNull`
      ? `null`
      : plan.fault === `configSyntax`
        ? `defineConfig({ test: {`
        : plan.config === `promise`
          ? `Promise.resolve(${config})`
          : config
  return [
    commonjs
      ? `const { defineConfig } = require('vitest/config')`
      : `import { defineConfig } from 'vitest/config'`,
    ...(plan.testRoot === `none`
      ? []
      : [`import { fileURLToPath } from 'node:url'`]),
    // Only a config in ES module syntax has the load plugin (`loadPluginOf`).
    ...(plan.loadPlugin ? [`import { readFileSync } from 'node:fs'`] : []),
    ...(plan.fault === `configThrows`
      ? [`throw new Error('the fixture config broke')`]
      : []),
    // A top-level await, which only an ES module config can hold.
    ...(plan.configAwait ? [`await Promise.resolve()`] : []),
    // `require` and `require.resolve`, which only a CommonJS config has.
    ...(plan.configRequire
      ? [
          `const { sep } = require('node:path')`,
          `if (require.resolve('node:path') !== 'node:path' || sep.length !== 1) throw new Error('the fixture config could not require')`,
        ]
      : []),
    commonjs
      ? `module.exports = ${body}`
      : `export ${plan.fault === `configNoDefault` ? `const config =` : `default`} ${body}`,
    ``,
  ].join(`\n`)
}

/** The fixture package's files in one state. */
/**
 * Whether the scratch package lies outside this repository: one that must
 * resolve no TypeScript, one with no Vitest config, and one whose config is
 * in its parent directory. Vitest looks for a config in the package's parent
 * directories too (its cli-api's find-up over `configFiles`), so a package
 * with no config inside the CLI's directory would run under the CLI's own
 * config; outside, "no config" is what Vitest sees, and a parent's config
 * is the only one above the package. A package whose config is in its
 * parent lies in a directory of a temporary directory, which holds the
 * config and the linked dependencies (`parentModules`).
 */
const outsideRepository = (plan) =>
  plan.fault === `noTypescript` ||
  plan.configPlace === `none` ||
  plan.configPlace === `parent`

/**
 * Where an outside package's linked dependencies live: in the package, or,
 * for a package whose config is in its parent directory, in the parent, so
 * that the config resolves them as the package does. The package's own
 * Vitest after `fixSession` is the package's.
 */
const parentModules = (plan, state) =>
  plan.configPlace === `parent` && !state.linked
    ? `../node_modules`
    : `node_modules`

/**
 * Where a config's `test.root` sits (issue #101), as a path from the config,
 * with the test files' glob and the setup file as Vitest reads them: relative
 * to that root. `none` sets no root, so the root is the package. `tests` is
 * the directory that holds the tests, as the repository's own oracle-gaps
 * config sets it. `parent` is the directory above the package, which the
 * driver places in a directory `pkg` of its scratch directory, so the glob
 * names it. `outside` is a directory of the package that holds no test file,
 * so the test files lie outside the root. `link` is `tests`, where the
 * package's `tests` is a symbolic link to the directory that holds them
 * (`linkedTests`), so the root's path is a link's. Vite names a module that
 * a plugin resolves inside its root by its path from the root, and one
 * outside it by its absolute path, so each shape names a copy of a test file
 * differently if the runner resolves it. Every shape names each test file by
 * its path in the package, so the model's keys are the same in all of them.
 * Vitest resolves the package of a pragma's environment from the root (its
 * init chunk's `vitest-environment-<name>` resolution), so under `parent` that
 * package lies in the root's node_modules (`environments`); every other shape
 * finds the package's own.
 * Only an ES module config that Vitest discovers sets a root (it reads its
 * own URL; `testRootOf`). Generated histories draw the shape, and each shape
 * also has a constructed history of its own.
 */
const inTests = {
  root: `./tests`,
  include: `**/*.test.ts`,
  setup: `./setup.ts`,
}
const testRoots = {
  none: { include: `tests/**/*.test.ts`, setup: `./tests/setup.ts` },
  tests: inTests,
  parent: {
    root: `..`,
    include: `pkg/tests/**/*.test.ts`,
    setup: `./pkg/tests/setup.ts`,
    environments: `../node_modules`,
  },
  outside: {
    root: `./src`,
    include: `../tests/**/*.test.ts`,
    setup: `../tests/setup.ts`,
  },
  link: inTests,
}

// The directory that the package's `tests` links to under the `link` test
// root.
const linkedTests = `tests-target`
/**
 * Where a package path lies in the fixture's files: under the `link` test
 * root, the files of `tests` live in `linkedTests`, and `tests` links there.
 */
const fixturePathOf = (plan, path) =>
  plan.testRoot === `link` && path.startsWith(`tests/`)
    ? `${linkedTests}/${path.slice(`tests/`.length)}`
    : path

function fixtureFiles(plan, state = initialState(plan)) {
  const manifest = (fields) =>
    `${JSON.stringify({ private: true, type: `module`, ...fields })}\n`
  // The package's own manifest has its module type, or none (F13).
  const ownManifest = (fields) =>
    plan.packageType === `module`
      ? manifest(fields)
      : `${JSON.stringify({ private: true, ...fields })}\n`
  // A symbolic link, as a package manager links a workspace package.
  const link = (target) => ({ link: target })
  // The config's test root, and the test files' glob and the setup file,
  // which Vitest reads relative to it (`testRoots`, issue #101).
  const testRoot = testRoots[plan.testRoot]
  const testRootOption =
    testRoot.root === undefined
      ? ``
      : `root: fileURLToPath(new URL('${testRoot.root}', import.meta.url)), `
  const test = `{ ${testRootOption}include: ${
    plan.configEnv
      ? `process.env.VITEST === 'true' && process.env.TEST === 'true' && process.env.NODE_ENV === 'test' ? ['${testRoot.include}'] : []`
      : `['${testRoot.include}']`
  }${plan.setupGlobal || plan.fault === `setupThrows` ? `, setupFiles: ['${testRoot.setup}']` : ``} }`
  // A history that installs a scoped addon later declares it from the
  // start, beside a scoped package already installed in its scope.
  const scoped = plan.steps.includes(`addScopedAddon`)
  const files = {
    'package.json': ownManifest({
      name: `gap-fixture`,
      dependencies: { 'state-dep': `*` },
      ...(plan.unbuiltDep || scoped
        ? {
            devDependencies: {
              ...(plan.unbuiltDep ? { 'unbuilt-dep': `*` } : {}),
              ...(scoped ? { '@gap/plain': `*`, '@gap/addon': `*` } : {}),
            },
          }
        : {}),
    }),
    ...(scoped
      ? {
          'node_modules/@gap/plain/package.json': manifest({
            name: `@gap/plain`,
          }),
        }
      : {}),
    ...(plan.scopedAddon
      ? {
          'node_modules/@gap/addon/package.json': manifest({
            name: `@gap/addon`,
          }),
          'node_modules/@gap/addon/addon.node': ``,
        }
      : {}),
    // A TypeScript that exposes its version and no compiler API, as
    // TypeScript 7's package does. The CLI must analyze without reading it.
    ...(plan.fault === `apiLessTypescript`
      ? {
          'node_modules/typescript/package.json': `${JSON.stringify({ name: `typescript`, version: `7.0.2`, main: `index.js` })}\n`,
          'node_modules/typescript/index.js': `module.exports = { version: '7.0.2', versionMajorMinor: '7.0' }\n`,
        }
      : {}),
    // A Vitest whose load throws a long error, linked as a package manager
    // links a package, until `fixSession` links a working one.
    ...(plan.fault === `brokenVitest` && !state.linked
      ? {
          'node_modules/vitest': link(`../deps/broken-vitest`),
          'deps/broken-vitest/package.json': `${JSON.stringify({ name: `vitest`, type: `module`, exports: { './node': `./node.mjs` } })}\n`,
          'deps/broken-vitest/node.mjs': [
            `await new Promise((resolve) => setTimeout(resolve, 1500))`,
            `const log = Array.from({ length: 8000 }, (_, i) => \`  step \${i} of the vitest build failed\`)`,
            `throw new Error(\`vitest failed to load: its build is incomplete\\n\${log.join('\\n')}\`)`,
            ``,
          ].join(`\n`),
        }
      : {}),
    // Beside a config that only `--config` names, a config that Vitest
    // discovers and that includes no test file, as a package's app build
    // config does. A run that loads it instead of the named one, or a
    // replay command that leaves out `--config`, runs no test (F12).
    ...(plan.configPlace === `named`
      ? {
          'vite.config.mjs': `export default { test: { include: ['decoy/**/*.test.ts'] } }\n`,
        }
      : {}),
    ...(state.altConfig
      ? {
          [altConfigPath(plan)]: configText(
            plan,
            test.replace(`'tests/**/*.test.ts'`, `'tests/a.test.ts'`),
          ),
        }
      : {}),
    ...(plan.configPath === undefined
      ? {}
      : {
          [plan.configPath]: configText(plan, test),
        }),
    [SOURCE]: state.prepend
      ? edited({ ...plan, stability: `prepend` })
      : plan.source,
    [LIB]: plan.librarySource,
    ...(plan.runesSource ? { [RUNES]: plan.runesSource } : {}),
    ...(plan.derived ? { [DERIVED]: plan.derived.source } : {}),
    ...(plan.dotGenSource ? { [DOTGEN]: plan.dotGenSource } : {}),
    ...plan.exportSources,
    'tests/strict.ts': `export const strict = ${state.strict}\n`,
    ...(plan.lazyGate
      ? { 'tests/lazy.ts': `export const open = ${state.lazyOpen}\n` }
      : {}),
    ...(plan.fsRead !== `none`
      ? { 'tests/data.json': `${JSON.stringify({ open: state.dataOpen })}\n` }
      : {}),
    // A workspace dependency with module state, linked through node_modules.
    'deps/state-dep/package.json': manifest({
      name: `state-dep`,
      exports: plan.depSubpath
        ? { '.': `./index.js`, './extra': `./extra.js` }
        : `./index.js`,
      ...(plan.native === `deep` ? { dependencies: { 'addon-dep': `*` } } : {}),
      ...(plan.unbuiltDep ? { devDependencies: { 'unbuilt-dep': `*` } } : {}),
    }),
    // It also refuses a second load into one realm through a global marker,
    // as a duplicate-instance check does in a browser window:
    // each copy must load it as a fresh worker would.
    'deps/state-dep/index.js': `const marker = Symbol.for('state-dep/loaded')\nif (globalThis[marker]) throw new Error('state-dep loaded twice in one realm')\nglobalThis[marker] = true\nconst log = []\nexport function note(entry) {\n  log.push(entry)\n}\nexport function seen() {\n  return [...log]\n}\n`,
    ...(plan.setupGlobal || plan.fault === `setupThrows`
      ? {
          'tests/setup.ts': `${
            plan.fault === `setupThrows`
              ? `throw new Error('the fixture setup broke')\n`
              : ``
          }${
            plan.setupGlobal
              ? `Object.defineProperty(globalThis, 'fixtureStore', { value: { ready: true } })\n`
              : ``
          }`,
        }
      : {}),
    // A subpath that reads the dependency's main module, so a runner that
    // loads the two apart loads the main module twice.
    ...(plan.depSubpath
      ? {
          'deps/state-dep/extra.js': `export { seen as seenAgain } from './index.js'\n`,
        }
      : {}),
    // A build directory, so that an addon built later lands in a directory
    // that already exists.
    'deps/state-dep/build/Release/.keep': ``,
    ...(plan.release ? { 'deps/state-dep/build/Release/state.node': `` } : {}),
    // The runner's own dependencies, linked into the package. A package with
    // no TypeScript, or with no config, sits outside this repository
    // (`outsideRepository`), so it links them, and Vite too: the CLI bundles
    // a workspace dependency with the package's Vite. A Vitest that does not
    // load stays the package's own until `fixSession` links this one.
    ...(state.linked ||
    (outsideRepository(plan) && plan.fault !== `brokenVitest`)
      ? Object.fromEntries(
          [`vitest`, `fast-check`, `@fast-check`].map((name) => [
            `${parentModules(plan, state)}/${name}`,
            link(join(OWN_MODULES, name)),
          ]),
        )
      : {}),
    ...(outsideRepository(plan)
      ? { [`${parentModules(plan, state)}/vite`]: link(ROOT_VITE) }
      : {}),
    // A parent's config imports `vitest/config` from the parent directory,
    // which a broken Vitest in the package does not change.
    ...(plan.configPlace === `parent` && plan.fault === `brokenVitest`
      ? { '../node_modules/vitest': link(join(OWN_MODULES, `vitest`)) }
      : {}),
    ...(plan.native === `gyp`
      ? { 'deps/state-dep/binding.gyp': `{ "targets": [] }\n` }
      : {}),
    // A dependency of the workspace dependency that ships a prebuilt addon
    // and no binding.gyp. No test loads the addon.
    ...(plan.native === `deep`
      ? {
          'deps/addon-dep/package.json': manifest({
            name: `addon-dep`,
            exports: `./index.js`,
          }),
          'deps/addon-dep/index.js': `export {}\n`,
          'deps/addon-dep/addon.node': ``,
          'deps/state-dep/node_modules/addon-dep': link(`../../addon-dep`),
        }
      : {}),
    // A devDependency that no test loads, with only a CommonJS entry that was
    // never built.
    ...(plan.unbuiltDep
      ? {
          'deps/unbuilt-dep/package.json': manifest({
            name: `unbuilt-dep`,
            exports: { '.': { require: `./dist/index.cjs` } },
          }),
          'node_modules/unbuilt-dep': link(`../deps/unbuilt-dep`),
          'deps/state-dep/node_modules/unbuilt-dep': link(`../../unbuilt-dep`),
        }
      : {}),
    'tests/c.test.ts': ordinaryTestFile(plan),
    // The environment oracle file a's pragma names (`pragma`), a package
    // as Vitest finds one (`vitest-environment-<name>`) from the test root.
    ...(plan.pragma
      ? {
          [`${testRoot.environments ?? `node_modules`}/vitest-environment-marked/package.json`]: `${JSON.stringify({ name: `vitest-environment-marked`, type: `module`, exports: `./index.js` })}\n`,
          [`${testRoot.environments ?? `node_modules`}/vitest-environment-marked/index.js`]:
            [
              `export default {`,
              `  name: 'marked',`,
              `  viteEnvironment: 'ssr',`,
              `  setup(global) {`,
              `    global.__gapEnvironment = 'marked'`,
              `    return { teardown() { delete global.__gapEnvironment } }`,
              `  },`,
              `}`,
              ``,
            ].join(`\n`),
        }
      : {}),
    // A copy that a check which died left behind (the runner names its
    // copies `.oracle-gaps-<pid>-<n>-<file>`). It is no test file: a check
    // that took it for one would refuse the run.
    'tests/.oracle-gaps-1-1-a.test.ts': [
      `import { test } from 'vitest'`,
      `function oracleProperty(_parts: { owns: Array<string> }): void {}`,
      `oracleProperty({ owns: ['${SOURCE}#w_kill'] })`,
      `test('fixed seed 1', () => {`,
      `  throw new Error('a copy that a check which died left behind')`,
      `})`,
      ``,
    ].join(`\n`),
  }
  for (const file of oracleFilesOf(plan))
    files[`tests/${file}.test.ts`] = oracleTestFile(plan, file)
  // Each mid-run edit changes file a's own text too (a count of them), so
  // the daemon runs file a's tests again in the check the edit lands in,
  // instead of reusing their evidence: the marker sits in the daemon's
  // session directory, which is no input of a run.
  if (plan.midrun)
    files[`tests/${plan.midrunBy}.test.ts`] +=
      `// mid-run edits: ${state.midruns}\n`
  // The new oracle file d owns the first generated function and judges it.
  if (state.newOracle) {
    const target = plan.functions.find((fn) => fn.generated && !fn.library)
    files[`tests/d.test.ts`] = oracleTestFile(
      {
        ...plan,
        functions: plan.functions.map((fn) =>
          fn === target ? { ...fn, owners: [...fn.owners, `d`] } : fn,
        ),
        tests: [
          ...plan.tests,
          { ...judging(`d`, `fixed seed`, 7), fn: target.id },
        ],
      },
      `d`,
    )
  }
  for (const a of plan.authoredList)
    files[a.id === `a1` ? AUTHORED : `mutants/authored-mutant-${a.id}.json`] =
      JSON.stringify({
        id: a.id,
        source: SOURCE,
        find: a.find,
        replace: a.replace,
        intent: `pushes a different label`,
        author: `gap-report oracle`,
      })
  // The data file that file a reads, and the authored mutant that edits it.
  if (plan.authoredRead !== `none`) {
    files[READ_DATA] = `{ "limit": 3 }\n`
    files[`mutants/authored-mutant-read.json`] = JSON.stringify({
      id: `read`,
      source: READ_DATA,
      find: `"limit": 3`,
      replace: `"limit": 4`,
      intent: `raises the data limit`,
      author: `gap-report oracle`,
    })
  }
  if (plan.testRoot !== `link`) return files
  // The `link` test root: the files of `tests` live in `linkedTests`, and
  // `tests` links to it.
  return Object.fromEntries([
    ...Object.entries(files).map(([path, text]) => [
      fixturePathOf(plan, path),
      text,
    ]),
    [`tests`, link(linkedTests)],
  ])
}

/**
 * Removes a file or a symbolic link, never what a link points to: on Linux,
 * `rmSync` follows a link to a directory and refuses it (ERR_FS_EISDIR).
 */
function linkTarget(path) {
  try {
    return readlinkSync(path)
  } catch {
    return undefined
  }
}

function removePath(path) {
  try {
    if (lstatSync(path).isSymbolicLink()) unlinkSync(path)
    else rmSync(path, { force: true })
  } catch {
    // Already gone.
  }
}

// The paths each fixture directory holds, so a state that lacks a file of
// the state before it removes that file.
const written = new Map()
function writeFixture(dir, files) {
  for (const sub of [
    `src`,
    `tests`,
    `mutants`,
    `deps/state-dep`,
    `node_modules`,
  ])
    // A directory that the state links elsewhere is the link's.
    if (!(sub in files)) mkdirSync(join(dir, sub), { recursive: true })
  if (!existsSync(join(dir, `node_modules/state-dep`)))
    symlinkSync(`../deps/state-dep`, join(dir, `node_modules/state-dep`), `dir`)
  for (const path of written.get(dir) ?? [])
    if (!(path in files)) removePath(join(dir, path))
  for (const [path, text] of Object.entries(files)) {
    const at = join(dir, path)
    mkdirSync(dirname(at), { recursive: true })
    // An unchanged file keeps its modification time, as in a real package.
    if (typeof text === `string`) {
      if (!existsSync(at) || readFileSync(at, `utf8`) !== text)
        writeFileSync(at, text)
    } else if (linkTarget(at) !== text.link) {
      // A link that a later state points elsewhere is replaced.
      removePath(at)
      symlinkSync(text.link, at, `dir`)
    }
  }
  written.set(dir, Object.keys(files))
}

/**
 * One of law 9's edits applied to a fixture state. Edits inside the history
 * are rendered again by `resolve`, so the fixture stays consistent: a test's
 * expected output follows its function's new source.
 */
function applyEdit(state, edit) {
  const h = state.history
  if (edit === `test`) {
    const first = Math.max(
      0,
      h.tests.findIndex((t) => t.file === `a`),
    )
    return {
      ...state,
      history: {
        ...h,
        tests: h.tests.map((t, i) =>
          i === first ? { ...t, judges: !t.judges } : t,
        ),
      },
    }
  }
  if (edit === `source`) {
    const fi = h.functions.findIndex((body) =>
      body.some((stmt) => stmt.kind === `if`),
    )
    const functions =
      fi < 0
        ? [
            [{ kind: `push`, quote: `'` }, ...h.functions[0]].slice(0, 5),
            ...h.functions.slice(1),
          ]
        : h.functions.map((body, i) => {
            if (i !== fi) return body
            const at = body.findIndex((stmt) => stmt.kind === `if`)
            return body.map((stmt, j) =>
              j === at ? { ...stmt, k: (stmt.k + 1) % 10 } : stmt,
            )
          })
    return { ...state, history: { ...h, functions } }
  }
  if (edit === `prepend`) return { ...state, prepend: !state.prepend }
  if (edit === `owns`) {
    const next = { a: `none`, b: `a`, both: `b`, none: `a` }
    const owners = [...h.owners]
    owners[0] = next[owners[0] ?? `none`]
    return { ...state, history: { ...h, owners } }
  }
  if (edit === `authored`)
    return {
      ...state,
      history: {
        ...h,
        authored:
          h.authored?.kind === `apply`
            ? { ...h.authored, kind: `stale` }
            : { stmt: (h.authored?.stmt ?? -1) + 1, kind: `apply` },
      },
    }
  // A mid-run edit leaves file b's helper as the helper edit does.
  if (edit === `helper`) return { ...state, strict: !state.strict }
  if (edit === `midrun`)
    return midrunTargetOf(state.history) === `data`
      ? { ...state, dataOpen: !state.dataOpen, midruns: state.midruns + 1 }
      : { ...state, strict: !state.strict, midruns: state.midruns + 1 }
  if (edit === `lazy`) return { ...state, lazyOpen: !state.lazyOpen }
  if (edit === `fsData`) return { ...state, dataOpen: !state.dataOpen }
  if (edit === `seed`) return { ...state, seed: state.seed === 1 ? 2 : 1 }
  if (edit === `config`) return { ...state, altConfig: !state.altConfig }
  // A seed no other step uses, so the check has fresh work to be killed in.
  if (edit === `dieMidCheck`)
    return { ...state, seed: state.seed === 3 ? 1 : 3 }
  if (edit === `newOracle`) return { ...state, newOracle: !state.newOracle }
  if (edit === `cli` || edit === `cliAtOnce`)
    return { ...state, cliEdited: !state.cliEdited }
  if (edit === `fixSession`) return { ...state, linked: true }
  if (edit === `addRelease`)
    return { ...state, history: { ...h, release: !h.release } }
  if (edit === `addScopedAddon`)
    return { ...state, history: { ...h, scopedAddon: !h.scopedAddon } }
  if (edit === `addAddon`)
    return {
      ...state,
      history: {
        ...h,
        native: (h.native ?? `none`) === `none` ? `gyp` : `none`,
      },
    }
  return state
}

// ## How a run that does not complete ends (law 12)
//
// Every invocation of the CLI ends with a result shaped like a report, never
// with a bare stack trace (maintainer decision, 2026-11-10: "we should never
// just crash -- the cli should also return something sensible"). A run that
// does not complete is either refused or an internal error.
//
// A refusal is a problem the author can fix: a bad argument, a broken owns
// declaration, no oracle file or no owner, a config the runner cannot honor,
// a Vitest that does not load, an owner that fails with no mutant active. It
// exits 2 and prints one block on stderr with no stack frames: `refused:
// <cause>`, then `fix: <directive>`. The directive is one next step, and it
// offers no way around the fix (no "ignore it", no "mark it equivalent").
// When the run knows its output directory, its done line names the
// directory's summary.md (`done refused, report <dir>/summary.md`), and the
// directory holds a results.json, `{ status: "refused", cause, directive
// }`, whose cause and directive are the block's, and a summary.md, and no
// error.log: every ending removes the other ending's
// files. Arguments the CLI cannot parse know their output directory only
// when they name it (`--out`).
//
// An internal error is a bug in the CLI. It exits 3, says so in one
// `oracle-gaps: error` line on stderr and none on stdout, with the line
// breaks of its message and of its log's path escaped, and keeps the stack
// in an error.log rather than on stderr (the register's C entry "The
// internal-error line", 2026-11-16). No legal history reaches one; the
// end-to-end oracle's constructed rejected-batch history (a test-only
// fault) reaches it, and that oracle judges its exit, its error line, its
// error.log, the absence of stack frames on stderr, and the stream law (law
// 15) on both streams. This check judges refusals only (see each oracle's
// limits).

/**
 * What a run that ended without completing printed and wrote, as the
 * author reads it: its exit code, its `refused:` block (the cause up to its
 * `fix:` line, cut to 2,000 characters), its `fix:` line, whether it named
 * its output directory `out`, whether stderr holds a stack frame, and the
 * status, cause, and directive of the results.json in `out`, if there is
 * one. `name` replaces the scratch paths in a text, so two runs of one
 * history in different directories record the same ending.
 */
function endingOf(exit, stderr, out, name = (text) => text, stdout = ``) {
  const text = `${stderr ?? ``}`
  const line = (label) => text.match(new RegExp(`^${label}: (.*)$`, `m`))?.[1]
  const cause = text.match(/^refused: ([\s\S]*?)\nfix: /m)?.[1]
  let written
  try {
    const parsed = JSON.parse(readFileSync(join(out, `results.json`), `utf8`))
    written = {
      status: parsed.status,
      cause: parsed.cause && name(parsed.cause).slice(0, 2000),
      directive: parsed.directive && name(parsed.directive),
      summary: existsSync(join(out, `summary.md`)),
    }
  } catch {
    // No output directory is known, or the run wrote no results.json.
  }
  // The run's last line: what follows `oracle-gaps: done ` there (law 15).
  const last = text.split(`\n`).filter(Boolean).at(-1) ?? ``
  const done = last.startsWith(`oracle-gaps: done `)
    ? name(last.slice(`oracle-gaps: done `.length))
    : undefined
  // The stdout's lines: a run that does not complete prints only its done
  // line there (law 15).
  const printed = `${stdout ?? ``}`.split(`\n`).filter(Boolean)
  return {
    exit,
    cause: cause && name(cause).slice(0, 2000),
    fix: line(`fix`) && name(line(`fix`)),
    done,
    stdout: printed.map(name),
    namesOutput:
      // The done line names the report in forward slashes on every platform
      // (the register's Windows paths rule).
      out !== undefined &&
      done === name(`refused, report ${out.replaceAll(`\\`, `/`)}/summary.md`),
    // An internal error's log beside a refusal would be another run's.
    errorLog: out !== undefined && existsSync(join(out, `error.log`)),
    stackFrames: /^\s+at /m.test(text),
    written,
  }
}

/**
 * The first way a run's ending breaks the refusal law, or undefined. The
 * cause must name `cause`; with `outKnown`, the run knew its output
 * directory, so the block names it and the directory holds the refusal.
 * `logNote` is the line that names the run's stream log, owed first on
 * stdout when the run refused after it started a check, and undefined for
 * a refusal of its arguments, before any check (the maintainer's decision
 * of 2026-11-12 that every run that starts a check names its stream log
 * first).
 */
function refusalBreach(ending, { cause, outKnown, defaultOut, logNote }) {
  if (ending.exit !== 2) return `the refusal exited ${ending.exit}, not 2`
  if (ending.stackFrames) return `the refusal printed a stack trace`
  if (ending.cause === undefined)
    return `the refusal printed no \`refused:\` line followed by a \`fix:\` line`
  if (cause !== undefined && !ending.cause.includes(cause))
    return `the refusal's cause does not name ${cause}: ${ending.cause}`
  if (!ending.fix?.trim()) return `the refusal's \`fix:\` line is empty`
  // A directive that offers a way around the fix lets the author leave the
  // problem in place.
  if (/\b(ignore|equivalent|skip)/i.test(ending.fix))
    return `the refusal's fix offers a way around it: ${ending.fix}`
  // Its last line says that it refused (law 15), with its report once the
  // run knows its output directory.
  if (
    ending.done === undefined ||
    !/^refused(?:, report .+)?$/.test(ending.done)
  )
    return `the refusal's last line is not \`oracle-gaps: done refused\``
  // The done line ends stdout too, as its only line after the line that
  // names the stream log, if the run started a check.
  const owedStdout = [
    ...(logNote === undefined ? [] : [logNote]),
    `oracle-gaps: done ${ending.done}`,
  ]
  if (JSON.stringify(ending.stdout) !== JSON.stringify(owedStdout))
    return `the refusal's stdout is ${JSON.stringify(ending.stdout)}, not ${JSON.stringify(owedStdout)}`
  if (!outKnown) return undefined
  if (defaultOut) {
    // The CLI chose the directory (args.mjs, the default rule): the report is
    // in `<state>/oracle-gaps-<key>/out/<run name>`, and a run that logged its
    // note names the same directory. The rule's shape is judged here, not the
    // directory's name.
    const report = /^refused, report (.+)\/summary\.md$/.exec(ending.done)?.[1]
    if (
      report === undefined ||
      !/(^<default out>|^<out>|oracle-gaps-[^/\s]+\/out\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8})$/.test(
        report,
      )
    )
      return `the refusal does not name its report in the default output directory: done ${ending.done}`
    if (
      logNote !== undefined &&
      logNote !== `oracle-gaps: note log ${report}/stream.log`
    )
      return `the refusal's report is not in the directory its stream log names: ${logNote}`
    return undefined
  }
  if (!ending.namesOutput)
    return `the refusal does not name its report in its output directory: done ${ending.done}`
  const { written } = ending
  if (written?.status !== `refused`)
    return `the output's results.json has status ${written?.status ?? `(none)`}, not refused`
  if (written.cause !== ending.cause || written.directive !== ending.fix)
    return `the output's results.json gives another cause or directive than stderr`
  if (!written.summary) return `the refusal wrote no summary.md`
  if (ending.errorLog)
    return `the refusal left an earlier run's error.log in its output directory`
  return undefined
}

/**
 * The code span that `text` opens with, read as Markdown reads one: it opens
 * with a run of backticks and ends at the next run of exactly that length,
 * and one space of padding on each side is dropped. A fence that a backtick
 * in the code can close is therefore read as shorter code. Gives the code
 * and the text after the span, or undefined when `text` opens no span.
 */
function readCodeSpan(text) {
  const fence = text.match(/^`+/)?.[0]
  if (!fence) return undefined
  const rest = text.slice(fence.length)
  const close = [...rest.matchAll(/`+/g)].find(
    (run) => run[0].length === fence.length,
  )
  if (!close) return undefined
  const content = rest.slice(0, close.index)
  return {
    code:
      content.startsWith(` `) && content.endsWith(` `)
        ? content.slice(1, -1)
        : content,
    after: rest.slice(close.index + fence.length),
  }
}

/**
 * The summary's counts, gap keys, unowned keys, and each listed gap's kind
 * and line, read from its text as the author reads it.
 */
function readSummary(summary) {
  const header = summary.match(
    /^(\d+) mutants \((\d+) authored\)\. (\d+) killed by a law on a reproducible route, .*?\*\*(\d+) gaps\*\*/m,
  )
  const probe = summary.match(/ (\d+) mutants of state-probe code/)
  // A key is read as a code span (readCodeSpan).
  const codeSpanAt = (text) => readCodeSpan(text)?.code
  const keysAfter = (label) =>
    summary.split(`\n`).flatMap((line) => {
      const at = line.match(new RegExp(`^ *- ${label}: `))
      const key = at && codeSpanAt(line.slice(at[0].length))
      return key === undefined || key === null ? [] : [key]
    })
  return {
    counts: header
      ? {
          mutants: Number(header[1]),
          authored: Number(header[2]),
          killed: Number(header[3]),
          gaps: Number(header[4]),
          probe: probe ? Number(probe[1]) : 0,
        }
      : undefined,
    gaps: keysAfter(`Key`).sort(),
    unowned: keysAfter(`Unowned`).sort(),
    // Each listed gap's kind and line, from the bullet above its key.
    entries: (() => {
      const lines = summary.split(`\n`)
      return lines
        .flatMap((line, index) => {
          const key = line.startsWith(`  - Key: `)
            ? codeSpanAt(line.slice(`  - Key: `.length))
            : undefined
          const head = lines[index - 1]?.match(
            /^- \*\*([\w-]+)\*\*, line (\S+?):/,
          )
          return key === undefined
            ? []
            : [{ key, kind: head?.[1], line: head?.[2] }]
        })
        .sort((a, b) => (a.key < b.key ? -1 : 1))
    })(),
  }
}

export {
  drawn,
  NO_STOPS,
  NO_LATER_STEPS,
  MIDRUN_EDITORS,
  captureWitness,
  outsideRepository,
  endingOf,
  refusalBreach,
  readSummary,
  readCodeSpan,
  SOURCE,
  LIB,
  RUNES,
  DERIVED,
  DOTGEN,
  caseless,
  removePath,
  sourceArgument,
  ORACLE_FILES,
  oracleFilesOf,
  METHOD_NAMES,
  comparison,
  quote,
  constant,
  statement,
  libStatement,
  routes,
  testCase,
  edits,
  daemonEvents,
  histories,
  witnessSteps,
  budgetSteps,
  streamKinds,
  baselineVerdict,
  verdictLine,
  doneLine,
  kill,
  push,
  judging,
  witness,
  probeText,
  guardText,
  oldProbeCallText,
  oldProbeText,
  preamble,
  preambleStatements,
  pushText,
  referenceKinds,
  condText,
  renderStatement,
  resolveHistory,
  swapped,
  holds,
  partsOf,
  routeOf,
  tokens,
  probeHelpers,
  sitesOf,
  ownersOf,
  interpret,
  judge,
  MUTANT_LIMIT_MS,
  HEARTBEAT_MS,
  FULL_LIMIT_MS,
  refusal,
  ownsNothing,
  blockingOf,
  MODULE_DATA,
  EXPORT_FORMS,
  model,
  testName,
  callFor,
  quoteEntry,
  oracleTestFile,
  ordinaryTestFile,
  edited,
  altConfigPath,
  AUTHORED,
  READ_DATA,
  initialState,
  fixtureFiles,
  fixturePathOf,
  written,
  writeFixture,
  applyEdit,
}
