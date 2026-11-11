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
// How long a slow test waits, in real milliseconds: past the 1 s first
// budget that the driver passes (`--first-limit`), within the 6 s full limit
// (`--hang-limit`).
const SLOW_MS = 3000
const ORACLE_FILES = [`a`, `b`]
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
  // Only a witness waits on a child process: seconds of real time.
  ioWait: fc.constant(false),
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
]
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
])
const histories = fc.record({
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
  witness: fc.constantFrom(false, true, `capture`),
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
  // Most histories have no steps, which keeps the campaign's cost down.
  // Whether the run asks for the ordinary tests' outcome (`--ordinary`).
  ordinary: fc.boolean(),
  // A second authored mutant, on the next statement, so that two patched
  // sources are judged in the same run and neither may see the other's.
  secondAuthored: fc.boolean(),
  // The package's Vitest config: its file, and whether it exports an object
  // or a function (sync or async) that returns one. Vitest accepts each, so
  // the runner must too.
  config: fc.constantFrom(`object`, `object`, `function`, `async`),
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
  // names; or nowhere, so Vitest's defaults apply. The run names the config
  // it used, or says that it found none.
  configPlace: fc.constantFrom(
    `discovered`,
    `discovered`,
    `discovered`,
    `named`,
    `none`,
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
  // runner does not account for warns.
  contexts: fc.oneof(
    { weight: 29, arbitrary: fc.constant(4) },
    { weight: 1, arbitrary: fc.constant(11) },
  ),
  steps: fc.oneof(
    { weight: 5, arbitrary: fc.constant(null) },
    {
      weight: 1,
      arbitrary: fc.array(fc.constantFrom(...edits), {
        minLength: 1,
        maxLength: edits.length * 2,
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
})

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
  then: null,
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
  `w_spin`,
])

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
    `export function derivedMake(x: number, out: Array<string>): Derived {`,
    `  return new Derived(x, out);`,
    `}`,
  )
  return { source: `${lines.join(`\n`)}\n`, statements }
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
    [`configThrows`, `configNoDefault`, `projects`, `setupThrows`].includes(
      history.fault,
    ) ||
    history.configEnv === true ||
    history.setupGlobal === true
  const place =
    history.configPlace === `none` && needsConfig
      ? `discovered`
      : (history.configPlace ?? `discovered`)
  const packageType = history.packageType ?? `module`
  const named = history.configFile ?? `vite.config.ts`
  const format = formatOf(named, packageType)
  const discovered =
    history.fault === `configNoDefault` && format === `cjs`
      ? named.replace(/\.c?js$/, (ext) => (ext === `.cjs` ? `.cts` : `.ts`))
      : named
  const configPath =
    place === `none`
      ? undefined
      : place === `named`
        ? `config/gap-vitest.${discovered.split(`.`).at(-1)}`
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
    ...(history.witness
      ? witness
          .filter((w) => history.witness === true || captureWitness.has(w.id))
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
  return {
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
    steps: history.steps ?? [],
    ordinary: history.ordinary === true,
    config: history.config ?? `object`,
    ...configOf(history),
    configEnv: history.configEnv === true,
    native: history.native ?? `none`,
    // A prebuilt addon in the workspace dependency's build/Release
    // (`addRelease`).
    release: history.release === true,
    // A scoped package with a prebuilt addon (`addScopedAddon`).
    scopedAddon: history.scopedAddon === true,
    depSubpath: history.depSubpath === true,
    unbuiltDep: history.unbuiltDep === true,
    budget: history.budget ?? `two`,
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
    },
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
const partsOf = (t) => [
  { route: t.route, input: t.input },
  ...(t.then ? [t.then] : []),
]
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
  // Its `return false` runs only when reading the environment throws.
  add(`devBuild`, 6, `bool-flip`, `return false`, { role: `devBuildFalse` })
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
      if (stmt.kind === `getterReturn`) {
        at(`value-undefined`, `string`, stmt.line, whole)
        at(`bool-flip`, `flag`, stmt.line, whole)
      }
      // `$derived` is an ordinary name outside a Svelte module.
      if (stmt.kind === `dollar`) {
        at(`delete-call`, `push`, stmt.line, whole)
        at(`value-undefined`, `value`, stmt.line, whole)
      }
      if (stmt.kind === `dollarReturn`)
        at(`value-undefined`, `string`, stmt.line, whole)
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
        add(name, d.line, `arithmetic-swap`, text, { role: `${name}Arith` })
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
      id === DERIVED_FN
        ? []
        : [plan.wholeFile]),
    ])
}

/** One call of a function with at most one active mutation. */
function interpret(plan, fnId, x, sites, active) {
  const trace = []
  const reached = new Set()
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
      if (siteOf(stmt, role)) reached.add(siteOf(stmt, role).id)
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
    reached.add(site.id)
    if (isActive(site)) return
    trace.push(
      active?.authored === stmt.label ? `s${stmt.label}!` : `s${stmt.label}`,
    )
  }
  const depLog = []
  // Module state as a freshly loaded module has it: an empty cache, and
  // the labels `w_load` wrote at load, under the same mutant.
  const memo = new Map()
  const loaded = () => {
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
          reached.add(loopSite.id)
          if (isActive(loopSite)) break
          const swapSite = siteOf(stmt, `swap`)
          reached.add(swapSite.id)
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
          reached.add(loopSite.id)
          if (isActive(loopSite)) break
          const swapSite = siteOf(stmt, `swap`)
          reached.add(swapSite.id)
          if (trace.length === 3) infected.add(swapSite.id)
          if (!(isActive(swapSite) ? trace.length <= 3 : trace.length < 3))
            break
          if (isActive(siteOf(stmt, `push`))) {
            reached.add(siteOf(stmt, `push`).id)
            throw new Spin()
          }
          write(stmt)
        }
      }
      // The workspace dependency's log, as a freshly loaded module has it.
      if (stmt.kind === `depNote`) {
        const call = siteOf(stmt, `note`)
        reached.add(call.id)
        if (!isActive(call)) depLog.push(`d`)
      }
      if (stmt.kind === `depSeen`) {
        const call = siteOf(stmt, `push`)
        reached.add(call.id)
        if (!isActive(call)) {
          const seenSite = siteOf(stmt, `seen`)
          reached.add(seenSite.id)
          // Spreading undefined throws.
          if (isActive(seenSite)) throw new TypeError(`seen() is undefined`)
          trace.push(...depLog)
        }
      }
      if (stmt.kind === `record`) {
        // A deleted push builds nothing; a dropped field never evaluates.
        const call = siteOf(stmt, `push`)
        reached.add(call.id)
        if (!isActive(call)) {
          const string = siteOf(stmt, `string`)
          reached.add(string.id)
          if (isActive(string)) trace.push(undefined)
          else {
            const record = {}
            const dropN = siteOf(stmt, `dropN`)
            reached.add(dropN.id)
            if (!isActive(dropN)) {
              const arith = siteOf(stmt, `arith`)
              reached.add(arith.id)
              record.n = isActive(arith) ? x - 1 : x + 1
            }
            const dropS = siteOf(stmt, `dropS`)
            reached.add(dropS.id)
            if (!isActive(dropS)) record.s = `s${stmt.label}`
            trace.push(JSON.stringify(record))
          }
        }
      }
      if (stmt.kind === `flag`) {
        // A deleted push never evaluates its literal.
        const call = siteOf(stmt, `push`)
        reached.add(call.id)
        if (!isActive(call)) {
          // `String(...)` replaced by undefined never evaluates its literal.
          const string = siteOf(stmt, `string`)
          reached.add(string.id)
          if (isActive(string)) trace.push(undefined)
          else {
            const flip = siteOf(stmt, `flag`)
            reached.add(flip.id)
            trace.push(String(isActive(flip) ? !stmt.value : stmt.value))
          }
        }
      }
      if (stmt.kind === `memoSet`) {
        for (const role of [`true`, `false`, `not`, `has`])
          reached.add(siteOf(stmt, role).id)
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
          reached.add(set.id)
          if (!isActive(set)) memo.set(x, `s${stmt.label}`)
        }
      }
      if (stmt.kind === `memoGet` || stmt.kind === `pushLoaded`) {
        const site = siteOf(stmt, stmt.kind)
        reached.add(site.id)
        if (!isActive(site) && stmt.kind === `pushLoaded`)
          trace.push(...loaded())
        if (!isActive(site) && stmt.kind === `memoGet`) {
          const string = siteOf(stmt, `string`)
          reached.add(string.id)
          if (isActive(string)) trace.push(undefined)
          else {
            const get = siteOf(stmt, `get`)
            reached.add(get.id)
            trace.push(String(isActive(get) ? undefined : memo.get(x)))
          }
        }
      }
      // A read of module data, as the module evaluated it at load under the
      // same mutant: a dropped field reads undefined, the swapped `+` gives
      // 1, and the flipped literal false.
      if (stmt.kind === `readData`) {
        const site = siteOf(stmt, `push`)
        reached.add(site.id)
        if (!isActive(site)) {
          const at = (role) =>
            isActive(
              sites.find((s) => s.data === stmt.shape && s.role === role),
            )
          // A method's call: undefined in its place, or its `1 + 2`.
          const called = () => {
            const value = siteOf(stmt, `value`)
            reached.add(value.id)
            if (isActive(value)) return `undefined`
            const arith = sites.find((s) => s.role === `usedArith`)
            reached.add(arith.id)
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
        reached.add(site.id)
        if (!isActive(site)) trace.push(object.tag)
      }
      // `out.push($derived(x))`, where `$derived` returns `String(x)`.
      if (stmt.kind === `dollar`) {
        const call = siteOf(stmt, `push`)
        reached.add(call.id)
        if (!isActive(call)) {
          const value = siteOf(stmt, `value`)
          reached.add(value.id)
          if (isActive(value)) trace.push(undefined)
          else {
            const [inner] = plan.functions.find((f) => f.id === `$derived`).body
            const string = siteOf(inner, `string`)
            reached.add(string.id)
            trace.push(isActive(string) ? undefined : String(x))
          }
        }
      }
      if (stmt.kind === `setTag`) object.tag = `b`
      // A probe in another shape reaches its sites but the idle ones; no hook
      // is installed, so none of it writes output.
      if (stmt.kind === `nearProbe`)
        for (const site of sites)
          if (site.stmt === stmt.label && !site.idle) reached.add(site.id)
      if (stmt.kind === `primeCall`) {
        const site = siteOf(stmt, `call`)
        reached.add(site.id)
        if (!isActive(site)) run(`W7.prime`, object)
      }
      if ((stmt.kind === `if` || stmt.kind === `mixed`) && condition(stmt))
        write(stmt)
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
          reached.add(siteOf(stmt, role).id)
        reached.add(sites.find((s) => s.role === `devBuild`).id)
        outcomes.push([stmt.line, true])
        // The guard is true, so its if-false site changes it; and its `!==`
        // compares 'test' with 'production', on which `!==` and `===`
        // disagree.
        infected.add(siteOf(stmt, `oldFalse`).id)
        infected.add(siteOf(stmt, `oldNe`).id)
      }
      if (referenceKinds.has(stmt.kind) || stmt.kind === `mixedHelperCall`) {
        const site = siteOf(stmt, `call`)
        reached.add(site.id)
        if (isActive(site)) continue
        if (stmt.kind === `valueCall` || stmt.kind === `factoryCall`) {
          // `apply` calls the function it was given; `make` constructs the
          // class and calls its `run`.
          const inner = sites.find(
            (s) =>
              s.role === (stmt.kind === `valueCall` ? `applyCall` : `makeCall`),
          )
          reached.add(inner.id)
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
          reached.add(helperPush.id)
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
  return { trace, threw, spun, reached, outcomes, infected }
}

/** A loop that never ends, as the interpreter sees one. */
class Spin extends Error {}

function judge(plan, tests, sites, active) {
  // A test runs its campaigns in order. Each failing judgment is a verdict
  // that carries its campaign's route; an assertion is a verdict under an
  // unnamed law. A verdict or a crash stops the test, except a soft
  // assertion, which lets it go on. A failed test's own route is the route
  // active when it ended.
  const runs = tests
    .filter((t) => !t.flaky)
    .map((t) => {
      let changedAny = false
      const found = []
      for (const part of partsOf(t)) {
        const base = interpret(plan, t.fn, part.input, sites)
        const mutated = interpret(plan, t.fn, part.input, sites, active)
        const route = routeOf(t, part)
        // A loop that never ends cuts the file's run off, as a hang does.
        if (mutated.spun)
          return { t, route, hang: true, verdicts: found, changed: true }
        const changed =
          !mutated.threw && mutated.trace.join() !== base.trace.join()
        changedAny ||= changed
        if (mutated.threw)
          return { t, route, crash: true, verdicts: found, changed: changedAny }
        // A test that hangs where another would judge never ends.
        if (changed && t.hangs)
          return { t, route, hang: true, verdicts: found, changed: true }
        if (changed && t.judges) {
          found.push({
            route,
            law: t.judgeBy === `verdict` ? t.law : `(unnamed)`,
          })
          if (t.judgeBy !== `soft`)
            return { t, route, verdicts: found, changed: true }
        }
      }
      return {
        t,
        route: routeOf(t, partsOf(t).at(-1)),
        verdicts: found,
        changed: changedAny,
      }
    })
  // A file's tests run in order, and a kill (a behavioral verdict on a
  // reproducible route) stops the file. A hang before that cuts the file's
  // run off, and a run that was cut off records nothing, not even its
  // earlier verdicts. A kill in another file still decides (a kill outranks
  // a timeout); failing that, the mutant is a timeout.
  const kills = (r) =>
    r.verdicts.some(
      (v) => v.route === `reproducible` && v.law !== `reach agreement`,
    )
  const hung = new Set()
  for (const file of new Set(runs.map((r) => r.t.file)))
    for (const r of runs.filter((x) => x.t.file === file)) {
      if (r.hang) hung.add(file)
      if (r.hang || kills(r)) break
    }
  const live = runs.filter((r) => !hung.has(r.t.file))
  const verdicts = (route) =>
    live.flatMap((r) =>
      r.verdicts.filter((v) => v.route === route).map((v) => v.law),
    )
  const reproducible = verdicts(`reproducible`)
  if (reproducible.some((law) => law !== `reach agreement`)) return `killed`
  if (hung.size > 0) return `timeout`
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
  // A Vitest that does not load, and a config the runner cannot honor, refuse
  // the run rather than leave every mutant unreached (maintainer decision,
  // 2026-11-08).
  if (plan.fault === `brokenVitest`) return { cause: `vitest`, runtime: true }
  if (plan.fault === `projects`)
    return { cause: `test.projects`, runtime: true }
  if (plan.fault === `badEntry`) return { cause: `${SOURCE}#nope` }
  if (plan.fault === `missingSource`) return { cause: `src/missing.ts` }
  if (plan.fault === `nonLiteral`) return { cause: `b.test.ts` }
  if (plan.fault === `outsideSource`) return { cause: `outside the package` }
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
  if (plan.fault === `configNoDefault`)
    return { cause: plan.configPath, runtime: true }
  // A run with no oracle file, or with no owns entry, owns no selected
  // source, so every mutant would read as unowned. The analysis refuses it
  // (maintainer decision, 2026-11-10).
  if (plan.declaration === `neither`) return { cause: `no oracle file` }
  if (ownsNothing(plan)) return { cause: `owns any selected source` }
  // A setup file that throws fails every oracle file before any test runs,
  // so the run refuses as for a failing owner, naming the setup's error.
  if (plan.fault === `setupThrows`)
    return { cause: `the fixture setup broke`, runtime: true }
  // A failing owner is named with its test's error, so the author can fix it,
  // and its baseline's replay runs that test alone, under the config the run
  // loaded: a config that only `--config` names, too (F12 with law 3).
  if (plan.fault === `brokenOwner`)
    return {
      cause: `b.test.ts`,
      detail: `this owner fails with no mutant active`,
      replayed: [`${BROKEN_SUITE} fixed seed 999`],
      runtime: true,
    }
  return undefined
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
const reachesRun = (history) =>
  !declarationFaults.includes(history.fault ?? `none`)

function model(plan) {
  const refused = refusal(plan)
  // The config the run names (F12) once its contexts have loaded it: the
  // file, or none. A run refused before then names none: an argument
  // fault, a Vitest that does not load, a config that does not load, and a
  // config that defines test.projects, which a loaded context shows. Every
  // other run names it once, refused or not.
  const configLines = [
    `outsideSource`,
    `brokenVitest`,
    `configThrows`,
    `configNoDefault`,
    `projects`,
  ].includes(plan.fault)
    ? []
    : [
        plan.configPath === undefined
          ? `no config file: Vitest's default discovery`
          : `config: ${plan.configPath}`,
      ]
  if (refused) return { refused, configLines }
  const sites = sitesOf(plan)
  const owners = ownersOf(plan)
  const ownerTests = (id) =>
    plan.tests.filter(
      (t) => ORACLE_FILES.includes(t.file) && owners(id).has(t.file),
    )
  // Code that ran when the module loaded: the calls at the end of the
  // source, and the sites that each call reached (with 0).
  const loadRuns = plan.loadCalls.map((call) =>
    interpret(plan, call.fn, 0, sites),
  )
  const ranAtLoad = (site) =>
    site.fnId === `<module>` ||
    site.data !== undefined ||
    loadRuns.some((run) => run.reached.has(site.id))
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
    const kind = judge(plan, tests, sites, { site: site.id })
    if (kind !== `survived`) return kind
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
      [`loop-false`, `value-undefined`, `field-drop`, `delete-call`].includes(
        site.operator,
      ) ||
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
    `branch-never-taken`,
    `not-infected`,
    `not-observed`,
    `not-distinguished`,
    `indeterminate`,
    `unreached`,
  ])
  const mutants = sites.map((site) => {
    const kind = site.probe ? undefined : kindOf(site)
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
  // Each authored mutant is judged alone, against the original source with
  // only its own edit.
  const authoredAll = plan.authoredList.map((a) => ({
    id: a.id,
    key: `${SOURCE}#authored:${a.id}`,
    // An authored mutant is not instrumented, so a survivor is not-judged
    // (a changed observation) or not-observed (the patch changed the code).
    kind: !a.applies
      ? `does-not-apply`
      : owners(a.fn).size === 0
        ? `unowned`
        : ((kind) => (kind === `survived` ? `not-observed` : kind))(
            judge(plan, ownerTests(a.fn), sites, { authored: a.label }),
          ),
    line: a.applies ? a.line : undefined,
  }))
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
    `import { ${plan.tests.some((t) => t.file === file && t.cleanupThrows) ? `afterEach, ` : ``}describe, expect, test${plan.tests.some((t) => t.file === file && t.spies) ? `, vi` : ``} } from 'vitest'`,
    ...(plan.tests.some((t) => t.file === file && t.shrinks)
      ? [`import fc from 'fast-check'`]
      : []),
    ...(plan.tests.some((t) => t.file === file && t.ioWait)
      ? [`import { spawn } from 'node:child_process'`]
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
    ...stubs,
    // State that tests of this file share (the `w_shared` witness).
    `const shared = { value: 0 }`,
    `const stored: { value: Array<string> } = { value: [] }`,
    ...owns,
    `const g = globalThis as { __oracleRoute?: (route: string) => void; __oracleObserve?: (c: string, v: unknown) => void; __oracleVerdict?: (v: { property: string; law: string; checkpoint: string }) => void }`,
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
        // where the output differs; it then judges as usual.
        ...(t.slow
          ? [
              `    if (${when} && JSON.stringify(${out}) !== ${JSON.stringify(expected)}) await new Promise((r) => setTimeout(r, ${SLOW_MS}))`,
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
        // A flaky test never hangs: the model leaves flaky tests out.
        ...(t.hangs && !t.flaky
          ? [
              `    if (${when} && JSON.stringify(${out}) !== ${JSON.stringify(expected)}) await new Promise(() => {})`,
            ]
          : []),
        ...(!t.judges
          ? []
          : t.judgeBy !== `verdict`
            ? [
                `    if (${when}) expect${t.judgeBy === `soft` ? `.soft` : ``}(${out}).toEqual(${expected})`,
              ]
            : [
                `    if (${when} && JSON.stringify(${out}) !== ${JSON.stringify(expected)}) {`,
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
        : `  test('${testName(t, index)}', ${(t.hangs && !t.flaky) || t.slow || t.ioWait ? `async ` : ``}() => {`,
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
  // A file with no tests still loads, so the CLI can read what it owns.
  if (!plan.tests.some((t) => t.file === file))
    out.push(`test.skip('no tests', () => {})`)
  return `${out.join(`\n`)}\n`
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

// Law 9's fixture state: the history, and what the edits outside it set.
const initialState = (plan) => ({
  history: plan.history,
  prepend: false,
  strict: true,
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

/**
 * The text of the package's config, in its syntax (`configOf`), with the
 * fault, the top-level await, or the `require` calls the plan holds. `test`
 * is the config's `test` object.
 */
function configText(plan, test) {
  const commonjs = plan.configSyntax === `cjs`
  const body = `defineConfig(${
    { object: ``, function: `() => (`, async: `async () => (` }[plan.config]
  }{ test: ${
    plan.fault === `projects`
      ? `{ projects: [{ test: { name: 'unit', ...${test} } }] }`
      : test
  } }${plan.config === `object` ? `` : `)`})`
  return [
    commonjs
      ? `const { defineConfig } = require('vitest/config')`
      : `import { defineConfig } from 'vitest/config'`,
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
  const test = `{ include: ${
    plan.configEnv
      ? `process.env.VITEST === 'true' && process.env.TEST === 'true' && process.env.NODE_ENV === 'test' ? ['tests/**/*.test.ts'] : []`
      : `['tests/**/*.test.ts']`
  }${plan.setupGlobal || plan.fault === `setupThrows` ? `, setupFiles: ['./tests/setup.ts']` : ``} }`
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
    // no TypeScript sits outside this repository, so it links them, and Vite
    // too: the CLI bundles a workspace dependency with the package's Vite.
    ...(state.linked || plan.fault === `noTypescript`
      ? Object.fromEntries(
          [`vitest`, `fast-check`, `@fast-check`].map((name) => [
            `node_modules/${name}`,
            link(join(OWN_MODULES, name)),
          ]),
        )
      : {}),
    ...(plan.fault === `noTypescript`
      ? { 'node_modules/vite': link(ROOT_VITE) }
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
  for (const file of ORACLE_FILES)
    files[`tests/${file}.test.ts`] = oracleTestFile(plan, file)
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
  return files
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
    mkdirSync(join(dir, sub), { recursive: true })
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
  if (edit === `helper`) return { ...state, strict: !state.strict }
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
// When the run knows its output directory, the block ends with `output:
// <dir>`, and the directory holds a results.json, `{ status: "refused",
// cause, directive }`, whose cause and directive are the block's, and a
// summary.md, and no error.log: every ending removes the other ending's
// files. Arguments the CLI cannot parse know their output directory only
// when they name it (`--out`).
//
// An internal error is a bug in the CLI. It exits 3, says so, and keeps the
// stack in an error.log rather than on stderr. No legal history reaches one,
// so this law's check judges refusals only (see each oracle's limits).

/**
 * What a run that ended without completing printed and wrote, as the
 * author reads it: its exit code, its `refused:` block (the cause up to its
 * `fix:` line, cut to 2,000 characters), its `fix:` line, whether it named
 * its output directory `out`, whether stderr holds a stack frame, and the
 * status, cause, and directive of the results.json in `out`, if there is
 * one. `name` replaces the scratch paths in a text, so two runs of one
 * history in different directories record the same ending.
 */
function endingOf(exit, stderr, out, name = (text) => text) {
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
  return {
    exit,
    cause: cause && name(cause).slice(0, 2000),
    fix: line(`fix`) && name(line(`fix`)),
    namesOutput: out !== undefined && line(`output`) === out,
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
 */
function refusalBreach(ending, { cause, outKnown }) {
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
  if (!outKnown) return undefined
  if (!ending.namesOutput)
    return `the refusal does not name its output directory`
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
 * The summary's counts, gap keys, unowned keys, and each listed gap's kind
 * and line, read from its text as the author reads it.
 */
function readSummary(summary) {
  const header = summary.match(
    /^(\d+) mutants \((\d+) authored\)\. (\d+) killed by a law on a reproducible route, .*?\*\*(\d+) gaps\*\*/m,
  )
  const probe = summary.match(/ (\d+) mutants of state-probe code/)
  // A key is read as Markdown reads a code span: it opens with a run of
  // backticks and ends at the next run of exactly that length, and one
  // space of padding on each side is dropped. A fence that a backtick in
  // the key can close is therefore read as a shorter key.
  const codeSpanAt = (text) => {
    const fence = text.match(/^`+/)?.[0]
    if (!fence) return undefined
    const rest = text.slice(fence.length)
    const close = [...rest.matchAll(/`+/g)].find(
      (run) => run[0].length === fence.length,
    )
    if (!close) return undefined
    const content = rest.slice(0, close.index)
    return content.startsWith(` `) && content.endsWith(` `)
      ? content.slice(1, -1)
      : content
  }
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
  captureWitness,
  endingOf,
  refusalBreach,
  readSummary,
  SOURCE,
  LIB,
  RUNES,
  DERIVED,
  DOTGEN,
  caseless,
  removePath,
  sourceArgument,
  ORACLE_FILES,
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
  refusal,
  ownsNothing,
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
  initialState,
  fixtureFiles,
  written,
  writeFixture,
  applyEdit,
}
