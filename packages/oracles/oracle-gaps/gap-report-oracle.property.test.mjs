/**
 * # What does the gap report owe the oracle author?
 *
 * The gap report (`index.mjs`) is the input to the author's loop: the author
 * reads each gap, states the law it reveals, and re-plans the oracle. A gap
 * the report hides, a kill it credits wrongly, or a key that moves sends that
 * loop the wrong way. This oracle states what the report owes for one source
 * file and the test files of its package, and checks the real CLI against a
 * small model.
 *
 * Laws, checked in this order:
 *
 * 1. **Enumeration.** The report runs exactly the operator mutants that the
 *    CLI's documented interface (the header of `schemata.mjs`) promises for
 *    each source form: `if-true` and `if-false` for an `if` condition,
 *    `binary-swap` for a comparison or a logical operator, `drop-not` for
 *    `!`, `bool-flip` for a boolean literal outside a type,
 *    `value-undefined` for a call whose value is used (not a callee or the
 *    object of a property or element access), `loop-false` for the
 *    condition of a `for`, `while`, or `do` loop, and `delete-call` for a
 *    call statement. Each names its function and its line: a class's
 *    method, accessor, or field function by `Class.member`, any other
 *    function by its own name (an object literal's method by its property),
 *    module-level data (a top-level variable whose initializer is not a
 *    function) by its variable, and other code in no function by
 *    `<module>`. Two functions may share a name
 *    and are still two functions. In a Svelte module (`.svelte.ts`) a rune
 *    call that Svelte allows in one place only is no site of its own, so
 *    instrumentation does not move it.
 * 2. **Probe-only code.** A mutant is left out as probe code exactly when its
 *    site is probe-only code: the probe guard, a declaration
 *    `const probing = typeof process === 'undefined' ? false :
 *    process.env.NODE_ENV !== 'production'` in a function; a probe statement
 *    in the decided form, `probing && globalThis.__oracleProbe?.(name,
 *    condition)`, whose `probing` resolves to that guard in the nearest
 *    enclosing function (the receiver may be cast), including its condition
 *    (maintainer decision of 2026-11-08); a call
 *    statement to a probe helper, which is a function declaration whose every
 *    statement is probe-only; an `if` with no `else` whose branch is
 *    probe-only; or a block of probe-only statements. Code beside a probe is
 *    production code and is judged: a mixed block's condition and other
 *    statements, an `if` whose `else` does work, a function that probes and
 *    also writes output, and any other probe shape: the former form with the
 *    `NODE_ENV` comparison itself on the left of `&&`, a guard of another
 *    name, a `let` guard, a guard of another initializer, a probe that only
 *    an outer function's guard covers, and the older
 *    `if (devBuild() && …) probe(name)` form and its `devBuild()` helper.
 * 3. **Ownership.** The CLI discovers every oracle file in the package: a
 *    test file that calls `declareOracle({ owns })`. Each entry names a source
 *    file (`src/x.ts`, owning all of it) or a function in it
 *    (`src/x.ts#run`, `src/x.ts#Class.method`, `src/x.ts#Class.#private`,
 *    the file ending at the first `#`), in any spelling that names the
 *    package's file (as `--source` is read), as a string or a plain
 *    template literal. Owning a function owns its whole text, every
 *    function defined in it whether or not anything refers to it (a gap
 *    there often marks dead production code; maintainer decision of
 *    2026-11-08), and its static reference tree within
 *    the package, as the type checker resolves it: every function, method,
 *    or class that its body refers to, whether it calls it by name, through
 *    an import or its alias, through `this` or a typed field, through
 *    `.bind`, or passes it as a value. A class passed as a value brings all
 *    its methods, because which one is called is unknown statically; `new
 *    C()` brings only C's constructor (named `C.constructor`), which brings
 *    what its body refers to, and C's methods are owned when something in
 *    the tree refers to them. Module-level data is a unit as a
 *    function is (F10, the reference tree applied to data): a function that
 *    reads it brings it into its tree, with what its initializer refers to,
 *    an owns entry may name it (`src/x.ts#TABLE`), and a whole-file entry
 *    owns it. Its initializer runs when the module loads, so its mutants are
 *    reached as load-time code is. A
 *    function's owners are the oracle files whose trees contain it; a mutant
 *    in a function with no owner is `unowned` and is listed as a warning, not
 *    a gap. An owns entry that names nothing, an owns list that is not a
 *    literal, and an owner whose tests fail with no mutant active each make
 *    the run fail and name the cause, because each would otherwise hide gaps;
 *    a failing owner is named with a failing test and its error. The CLI's
 *    capture must not change what a test observes: an owner that passes
 *    alone passes under the CLI, even when it counts the reads of a getter
 *    on a value it asserts on, or spies on the builtins a value is scanned
 *    with (`Object.keys`, `Object.getPrototypeOf`,
 *    `Object.getOwnPropertyDescriptor`) and counts their calls. A Vitest
 *    config that defines `test.projects`, which the runner cannot honor,
 *    refuses the run and names `test.projects` (maintainer decision of
 *    2026-11-08), rather than leave every mutant unreached.
 * 4. **Classification across owners.** Each mutant is judged only by the
 *    tests of its function's owners. Each test's route is the one the
 *    framework registered for it (`__oracleRoute`), never its name; a test
 *    that runs several campaigns registers each one, and a verdict takes the
 *    route active when it fired, even when a soft assertion lets the test go
 *    on to another campaign; a test that registered none has an unknown
 *    route. A law verdict names its law; an `expect` assertion failure, as
 *    older oracles judge, is a verdict under an unnamed law (transitional,
 *    maintainer decision of 2026-11-05). A test whose observations
 *    vary between two unmutated runs is nondeterministic and judges nothing.
 *    The mutant is `killed` when an owner test on a reproducible route (a
 *    fixed seed, a fixed history, or an enumerated case) reports a law
 *    verdict, unless reach agreement is its only law, which makes it an
 *    `agreement-only-kill`. Failing that, a verdict on the random campaign
 *    makes it a `random-only-kill`, and a verdict on an unknown route an
 *    `unregistered-kill`; an owner test outside the framework's own checks
 *    that fails with no verdict, whatever its message, makes it `crashed`;
 *    and a failing framework check alone (a calibration, a probe
 *    calibration, or the determinism test) makes it a `framework-error`. A
 *    mutant that no owner test reaches is `unreached`; code that runs when
 *    a file loads the module reaches every test of that file (maintainer
 *    decision of 2026-11-06); a mutant that only nondeterministic owner tests
 *    could judge is `indeterminate`. A mutant under which the module throws
 *    while it loads fails every file that imports it before any test runs:
 *    an error outside any test, a `setup-error`. A run is cut off when it
 *    passes its first, short budget, and only the copy that ran past it is
 *    charged with that time (a copy whose file fails to load ends its turn
 *    there); it then runs again alone with the full limit
 *    (the short budget with confirmation, maintainer decision of
 *    2026-11-06): a run that ends within the full limit is judged as if it
 *    had never been cut off, so a slow kill is a kill. An owner test that
 *    does not end within the full limit cuts its file's run off, and the
 *    clock-cut run records nothing, not even its earlier verdicts; a kill in
 *    another owner still decides (a kill outranks a timeout, v19), and failing
 *    one, the mutant is a `timeout`, whatever any other owner reported. A copy
 *    cut off for spinning (its call budget ran out, not its clock) is a
 *    timeout as it stands: its rows are not judged, so a verdict it recorded
 *    before the cut does not kill. (The framework's `bounded work` law, which
 *    would judge such a verdict, is not built.) A copy that a batch skipped
 *    because an earlier copy killed the mutant runs again, through the batch,
 *    only while no kill is in hand, so every mutant gets an outcome and no
 *    other missing unit is rerun. A mutant that no owner test fails is a
 *    survivor: a `not-judged` when an owner test's observation or asserted
 *    value changed, a `branch-never-taken` when an `if` on its line never took
 *    one of its outcomes in an owner test, a `not-infected` when a comparison's
 *    operators agreed on every operand an owner test reached, a
 *    `not-distinguished` when its operator changes a value only on some
 *    inputs and no capture shows which (a loop's condition, an undefined call
 *    value, a dropped field, a skipped call, a logical operator), and
 *    `not-observed` otherwise: the mutant changed a value that no recorded
 *    observation showed. A test in a file that is not an
 *    oracle file never changes any of this, and runs only when the run asks
 *    for it (`--ordinary`, maintainer decision of 2026-11-06): then a
 *    survivor or an unreached mutant that an ordinary test reached reports
 *    the ordinary tests' outcome, for information. Only `killed` closes an owned
 *    mutant; every other class is a gap.
 * 5. **Authored mutants.** An authored mutant whose text occurs exactly once
 *    is judged by law 4 against the owners of the function it edits, without
 *    the branch-never-taken class, and is reported at the line of its edit; one
 *    whose text occurs zero or several times is `does-not-apply`. Its key is
 *    its id, whatever its file is called.
 * 6. **Keys.** Each mutant's key is its anchor:
 *    `file#function:operator:statement`, where `statement` is the text of the
 *    innermost statement that holds the site, as tokens joined by single
 *    spaces, in full; a repeat of the same anchor in one function gets `~n`
 *    in document order. Keys are unique.
 * 7. **Report completeness.** The summary lists every gap exactly once under
 *    its key, with its kind and line, lists every unowned mutant as a
 *    warning, and its counts of mutants, kills, gaps, and left-out probe code
 *    are the model's.
 * 8. **Key stability.** Adding an unrelated function, adding a probe guard to
 *    an existing function, or reformatting whitespace changes no existing
 *    mutant's key or outcome.
 * 9. **Incremental equals cold.** A check through the daemon (`--daemon`)
 *    reports, at every state of a sequence of edits, what a cold run of that
 *    state reports: the same exit status and refusal cause, the same run
 *    identity, results, and summary. Only how the result was produced may
 *    differ: durations, the options that name the output directory and the
 *    daemon, and the counts of reused and computed evidence. The edits change
 *    a test, a source statement, the source's line numbers, an owns list,
 *    the authored mutant, a helper module that one oracle file imports, the
 *    seed, and the set of oracle files; they also restart the daemon and
 *    revert the last edit. The law says nothing unless the daemon reuses
 *    evidence, so the reach requires a check that reused evidence, one that
 *    reused some and recomputed some, one that reused evidence from disk
 *    after a restart, and, for each content edit, a cold result that the
 *    edit changed: an edit that changes nothing cannot expose a stale cache.
 *    One daemon serves a package, across crashes, reboots, and concurrent
 *    starts: two checks started at once, a check after the daemon was
 *    killed (its socket and lock left behind), after a reboot (its socket
 *    gone), after its process id went to a live process, two checks at
 *    once after a crash, a check started during a stop, two checks at
 *    once after the CLI's code changed, a check from a second install of
 *    the CLI at another path with other code (the daemon serves only its
 *    own code), a check after a native addon was
 *    installed into the dependency tree (the pool follows it), and a
 *    check whose daemon cannot open its session (it reports the cold
 *    run's error), two checks at once on a session whose failure is
 *    larger than a socket's buffer (each hears all of it), a check whose
 *    daemon holds it past the CLI's wait for a daemon and then dies (the
 *    time a daemon holds a check is not waiting, so the CLI starts a fresh
 *    one), a check sent to a daemon killed before it reads (the
 *    connection resets), a check right after a session's failure was fixed
 *    (a fresh daemon, not the old error), and a check after a prebuilt
 *    addon was added into an existing build/Release or a scoped one into
 *    an existing scope directory each report
 *    what the cold run reports; once `--stop-daemon` returns, no daemon
 *    process serves the package.
 * 10. **The runner runs the package as Vitest does.** From any install path
 *    (one with a space and `#` included), for any spelling of `--source`
 *    (`./`, a redundant segment, an absolute path through a symbolic link
 *    to the package), the run completes and reports the same result; a
 *    source outside the package refuses the run. An owned module imported
 *    through one of Vite's asset or worker queries (`?raw`, `?url`, or the
 *    `?worker&url` a worker is imported with) is loaded by Vite as written,
 *    so the query import reads the module's own text (a test's `?raw` import
 *    is checked against the file). A worker's code that Vite loads this way
 *    is not instrumented: a stated limit, with no witness for `?worker&url`.
 *    Any other query on an owned module (`?t=`, `?import`) is served the
 *    instrumented copy. A source that imports
 *    a subpath of a workspace dependency sees one instance of that
 *    dependency, as Vitest gives it; a devDependency that no test loads and
 *    that cannot be built does not refuse the run; and a package with a
 *    native addon anywhere in its dependency tree (a `binding.gyp`, or a
 *    prebuilt `.node` file in a dependency of a dependency) runs in child
 *    processes, and the run's inputs name the pool.
 * 11. **Streaming.** The CLI prints each gap as its mutant is judged, one line
 *    each (stream.mjs), and the summary repeats those gap lines: the streamed
 *    gap lines are the report's gaps, each printed once, none missing.
 * 12. **A report-shaped ending.** A run never ends with a bare stack trace
 *    (gap-report-model-oracle.mjs states the law beside its check). Every
 *    refusal of laws 3 and 10 (a broken owns declaration, no oracle file, no
 *    owner, a source outside the package, `test.projects`, a Vitest that
 *    does not load, a config that throws when it loads or has no default
 *    export, a setup file that throws, an owner that fails with no mutant
 *    active) exits 2 and
 *    prints `refused: <cause>` and then `fix: <directive>`, with no stack
 *    frames; the directive offers no way around the fix. The block names the
 *    run's output directory, which holds a results.json with status
 *    `refused`, the same cause and directive, and a summary.md. A refusal
 *    through the daemon ends the same way, in the output directory of the
 *    CLI that asked.
 *
 * Authority: the maintainer's decisions in the gap-check design runs v11, v14,
 * and v19 (2026-11-04 and 2026-11-05; the design notes are kept by the project
 * that adopted this CLI, not in this package): a kill is a law verdict on a
 * deterministic route, and a crash, a timeout, a driver failure, or an
 * ordinary-test kill is not (v11 P7, v14 P6, v19 P3); the route comes from
 * registration (v19 A4); gaps are judged across every owner of a function,
 * and owning an entry owns its static call tree (v19 P6, v19.1, v19.2); the
 * probe form (v11, confirmed 2026-11-05: "this is a standalone framework now
 * so we can't use the devBuild() stuff"; its guard revised 2026-11-08 to a
 * function-local `probing` constant, because the bare `NODE_ENV` comparison
 * throws where there is no `process` and a module-level constant is not
 * folded in a module with imports); only probe-only code is left
 * out (v19 P5, A5); gaps are anchored by function and normalized statement
 * text with an occurrence index (v11, "An allowance lists its gaps"); unowned
 * code is a warning (v14 P7); and no quiet exclusions (the project's oracle guide). Law 1's
 * operator list is the CLI's documented interface. ORC-006 names the outcome
 * kinds this report must keep distinct: assertion failure, timeout, setup
 * failure, runtime failure outside the comparison, unreached, and survival.
 * A kill by reach agreement alone is a gap (maintainer decision, 2026-11-05).
 * Law 9 is the maintainer's: incremental runs must be fast enough for an
 * agent that checks hundreds of times, through a daemon whose evidence
 * table is a disk-backed JSON store, and an incremental run must
 * equal a cold one (v19.3, 2026-11-05); the daemon is a cache over the
 * evidence, never the record (v19 freeze). Law 10 and the setup error at
 * load, the one-daemon clause, and the builtin-spy clause of law 3 come
 * from the review of the CLI's pull request and TanStack DB's conversion
 * (2026-11-08); the refusal of `test.projects` is the maintainer's choice
 * of that date over running each project. Law 12 is the maintainer's
 * decision of 2026-11-10: "we should never just crash -- the cli should also
 * return something sensible".
 *
 * Limits. Sources are one file of exported functions and classes over one
 * number. A hang is generated only as an owner test that waits on a promise
 * that never settles, under a 1 s first budget and a 6 s full limit
 * (`--first-limit`, `--hang-limit`); a slow run that ends is only a
 * witness, a test that waits 3 s before it judges. Not generated: a busy
 * loop, a slow run past the full limit that would still end, a hang in an
 * ordinary or nondeterministic test, a setup error other than a throw at
 * module load from a function the module calls with 0, multi-line
 * conditions, nested functions, object-literal methods, accessors, and
 * class-field arrows in code that a test calls (the static oracle judges
 * their ownership), two functions on one line,
 * `await`, `new`, and `void` statements, `--only`, `--sample`, and
 * `--diff-base`, re-exports, namespace imports, and calls into another
 * package (a package's tree stops at its boundary, by the maintainer's
 * decision of 2026-11-05). A module-level probe guard, a guard declared
 * in a block of the function beside its probe, and a parameter or function
 * named `probing` are not generated. A probe-bound state is not generated, so the claim that
 * reach agreement kills every probe mutant is not checked. Gap answers and
 * the gate are not part of the CLI until answers become evidence-log events,
 * which waits on the maintainer's decision about how an answer maps to a law.
 * Law 9's edits do not include a file that a test reads through `fs`, an
 * environment variable other than the seed, a new file that changes how an
 * unchanged import resolves, a change to the Vite config or the installed
 * packages, or checks at once other than the two that start the daemon.
 * The harness keeps every global a copy defines configurable, by wrapping
 * `Object.defineProperty`, `Object.defineProperties`, and
 * `Reflect.defineProperty`, so that each copy in the shared realm starts
 * from the worker's first globals: a test that inspects a global's
 * descriptor or the identity of those functions can behave differently
 * under the report, which law 3's capture clause does not cover
 * (maintainer decision, 2026-11-08; such a test belongs outside the
 * owns-declaring files). The daemon count after a stop is read from the process list. Two
 * daemon defects have no observation here: a stale lock removed without
 * the atomic claim (two daemons serve until the loser sees its lock taken,
 * within 2 s), and a stop that releases the lock before it closes the
 * store (each check has already flushed its evidence); their mutants
 * survive. So does a restart that ends queued requests unanswered: the
 * CLI reads an unanswered connection as a daemon that died, starts a fresh
 * one, and gives up only after three deaths in one check. A reset
 * connection (ECONNRESET) is generated, but macOS reports it as an end of
 * stream, so its reading as a dead daemon is fixed by inspection. So are a
 * daemon whose CLI modules fail to load (the CLI imports them first and
 * fails the same way), two CLIs racing on a failing daemon's error file
 * (two checks at once on a failing session are generated, not that
 * interleaving), and a CLI that hears `closing` from the failing daemon it
 * started. The wait for a daemon is shortened to 3 s only for the check
 * whose daemon is paused for 4 s; a daemon that hangs while it holds a
 * check holds the CLI too. A package installed into an ancestor
 * node_modules is not generated. A daemon stuck closing (the CLI gives up
 * after its wait) and a stop that waits for the close are not generated.
 * Cut-off
 * charging is judged only where it changes an outcome: under one budget
 * (`--first-limit` equal to `--hang-limit`), where a misplaced cut is a
 * timeout at once; under two budgets a misplaced cut only costs a
 * confirming run, which no law here measures. A copy that failed to load in
 * a batch cut off later is run again rather than judged from its rows, so
 * its setup error keeps Vitest's message. Native addons only as a
 * `binding.gyp` beside the workspace dependency or a prebuilt `.node` file
 * in its dependency's directory; an addon that ships only as an optional
 * platform package is not detected (optional dependencies are not
 * followed). `test.projects` only as one project without `extends`.
 *
 * Structure:
 *   1. The grammar draws functions, classes, owners, tests, an authored
 *      mutant, a declaration fault, and an edit for the stability law.
 *      `resolve` renders them to files and lays out lines.
 *   2. The model runs each mutant through a small interpreter of that grammar
 *      and predicts every report fact, without the instrumenter or the CLI.
 *   3. The driver writes a scratch package, runs the real CLI on it, and
 *      records its results, summary, and exit status. For law 9 it then
 *      applies each edit, and runs each state cold and through the daemon.
 *   4. The check compares them law by law.
 */
import { spawn, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fc from 'fast-check'
import { declareOracle } from '../src/oracle-declaration.ts'
import { socketOf, stateDirOf } from './daemon.mjs'
import { oracleProperty, pass, violation } from '../src/oracle-property.ts'

import {
  SOURCE,
  LIB,
  quote,
  statement,
  edits,
  daemonEvents,
  histories,
  push,
  judging,
  witness,
  resolveHistory,
  probeHelpers,
  ownersOf,
  interpret,
  refusal,
  ownsNothing,
  MODULE_DATA,
  model,
  edited,
  AUTHORED,
  initialState,
  fixtureFiles,
  written,
  writeFixture,
  applyEdit,
  endingOf,
  refusalBreach,
  readSummary,
  removePath,
  sourceArgument,
  ENV_PREFIX,
} from './gap-report-model-oracle.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, `..`)

// ## Production driver
//
// The driver writes the plan into a scratch package inside this directory, so
// the package resolves its own TypeScript and Vitest, and runs the
// real CLI on it with a fixed seed. It names no test files: the CLI must find
// the oracle files and their owners itself. Each oracle file registers each
// test's route through `__oracleRoute`, as the framework does, unless the
// history says not to. The driver records the exit status, each mutant's
// result, and the summary's counts, gap keys, and unowned keys. A stability
// history runs the CLI again on the edited source.
// The child gets a clean environment: no state from this Vitest worker.
const cleanEnv = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) =>
        !name.startsWith(`VITEST`) &&
        !name.startsWith(`${ENV_PREFIX}_`) &&
        // The variables Vitest sets in this process, which a shell that
        // runs the CLI does not have.
        name !== `TEST` &&
        name !== `NODE_ENV`,
    ),
  )

/**
 * The CLI's arguments for one run of a fixture: cold, or through the daemon
 * (law 9), and where the run writes its report.
 */
function cliArgs(
  dir,
  files,
  {
    seed = 1,
    daemon = false,
    cli = here,
    ordinary = false,
    sources = `${SOURCE},${LIB}`,
    budget = `two`,
    outName = daemon ? `out-daemon` : `out`,
  } = {},
) {
  const out = join(dir, outName)
  rmSync(out, { recursive: true, force: true })
  // The CLI runs from the package directory. A daemon check names its paths
  // relative to there, as an author types them, and the daemon must read
  // them as the CLI's caller meant them.
  const path = (absolute) => (daemon ? relative(repo, absolute) : absolute)
  const args = [
    join(cli, `index.mjs`),
    ...(daemon ? [`--daemon`] : []),
    `--package`,
    path(dir),
    `--source`,
    sources,
    `--seed`,
    String(seed),
    `--env-prefix`,
    ENV_PREFIX,
    // Four warm contexts run mutants in parallel; results do not depend on
    // the count.
    `--contexts`,
    `4`,
    // A fixture's tests run in milliseconds. A 1 s first budget cuts off
    // the slow witness, and the 6 s full limit lets it end; each hang costs
    // about 7 s. With one budget, a run past 6 s is a timeout at once.
    `--first-limit`,
    budget === `one` ? `6000` : `1000`,
    `--hang-limit`,
    `6000`,
    `--out`,
    path(out),
  ]
  if (ordinary) args.push(`--ordinary`)
  if (files[AUTHORED] !== undefined)
    args.push(`--mutants`, path(join(dir, `mutants`)))
  return { args, out }
}

/**
 * Writes the fixture's files and runs the CLI on it. A file of an earlier
 * state that this state lacks is removed.
 */
function runCli(dir, files, how = {}) {
  writeFixture(dir, files)
  const before = new Set(filesUnder(dir))
  const { args, out } = cliArgs(dir, files, how)
  const child = spawnSync(process.execPath, args, {
    cwd: repo,
    encoding: `utf8`,
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
    env: cleanEnv(),
  })
  const run = readRun(dir, out, child.status, child.stderr, how.cli ?? here)
  // What the run wrote beside its output directory and outside the package's
  // own state (`.oracle-gaps`), as a path relative to the package.
  const strayWrites = filesUnder(dir).filter(
    (file) =>
      !before.has(file) &&
      !KNOWN_STRAY_WRITES.test(file) &&
      !OWN_WRITES.some((home) => file === home || file.startsWith(`${home}/`)),
  )
  return { ...run, strayWrites }
}

/** Relative paths of the files under a directory, not inside node_modules. */
function filesUnder(root, within = ``) {
  return readdirSync(join(root, within), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = within === `` ? entry.name : `${within}/${entry.name}`
      if (entry.name === `node_modules`) return []
      return entry.isDirectory() ? filesUnder(root, path) : [path]
    },
  )
}

// Where a run may write in the package: its output directories and its own
// state (the CLI's `out` and `out-daemon` in the fixture, and `.oracle-gaps`).
const OWN_WRITES = [`out`, `out-daemon`, `.oracle-gaps`]
// A workspace dependency's one-file bundle, written in that dependency's own
// `.oracle-gaps` folder (check.mjs, workspaceBundles). This is a known stray
// write, reported from date-fns (maintainer decision, 2026-11-10: a limit,
// not a fix), so the law does not judge it; the law still judges every other
// file outside the output directory and the package's `.oracle-gaps`.
const KNOWN_STRAY_WRITES = /(^|\/)\.oracle-gaps\/bundle-[0-9a-f]{16}\.mjs$/

/** Runs the CLI several times at once on one state of the fixture. */
async function runClisAtOnce(dir, files, hows) {
  writeFixture(dir, files)
  return Promise.all(
    hows.map(async (how) => {
      const { args, out } = cliArgs(dir, files, how)
      const child = spawn(process.execPath, args, {
        cwd: repo,
        env: { ...cleanEnv(), ...how.env },
        stdio: [`ignore`, `ignore`, `pipe`],
      })
      let stderr = ``
      child.stderr.on(`data`, (chunk) => {
        stderr += chunk
      })
      const status = await new Promise((resolvePromise) => {
        const timer = setTimeout(() => child.kill(), 300_000)
        child.on(`close`, (code) => {
          clearTimeout(timer)
          resolvePromise(code)
        })
      })
      return readRun(dir, out, status, stderr, how.cli ?? here)
    }),
  )
}

// Output with each scratch directory named, as a path or as the file URL the
// stack spells it by (its escapes included).
function namedScratch(text, names) {
  let named = text
  for (const [path, name] of names)
    if (path !== undefined)
      named = named
        .replaceAll(pathToFileURL(path).href, name)
        .replaceAll(path, name)
  return named
}

/** What one run of the CLI reported, from its exit status and its files. */
// A gap line the CLI streams to stderr as its mutant is judged (stream.mjs):
// its class, its line, and its id.
const streamedGap =
  /^(?:not-judged|indeterminate|dead-code|branch-never-taken|not-infected|not-observed|not-distinguished|unreached|random-only-kill|agreement-only-kill|unregistered-kill|framework-error|timeout|setup-error|crashed|does-not-apply) L(?:\d+|\?) (\S+) /

function readRun(dir, out, status, stderr, cli) {
  // The output names the CLI directory that ran and the package, as scratch
  // directories do, before it is cut to its last characters.
  const scratch = [
    [cli, `<cli>`],
    [dir, `<package>`],
  ]
  const named = status === 0 ? undefined : namedScratch(`${stderr}`, scratch)
  let results
  let report
  let summary = ``
  try {
    report = JSON.parse(readFileSync(join(out, `results.json`), `utf8`))
    results = report.results
    summary = readFileSync(join(out, `summary.md`), `utf8`)
  } catch {
    // A run that wrote no report is recorded by its exit status and output.
  }
  // Each streamed gap, by its key: a line whose id names no reported mutant
  // is kept as it is, so it cannot match.
  const keyById = new Map((results ?? []).map((r) => [r.id, r.key]))
  const streamed = `${stderr ?? ``}`
    .split(`\n`)
    .flatMap((line) => {
      const id = line.match(streamedGap)?.[1]
      return id === undefined ? [] : [keyById.get(id) ?? `unknown id ${id}`]
    })
    .sort()
  // A refused run's results.json holds the refusal, not results (law 12).
  if (results === undefined) report = undefined
  return {
    // How a run that did not complete ended, read from the whole of its
    // stderr and its output directory (law 12).
    ending:
      status === 0
        ? undefined
        : endingOf(status, stderr, out, (text) => namedScratch(text, scratch)),
    exit: status,
    stderr: named === undefined ? undefined : named.slice(-1500),
    reported: results !== undefined,
    streamed,
    // Law 9 compares everything the run reports except how it was
    // produced: durations, the options it was given (the output directory
    // and the daemon flag differ by construction), and the counts of reused
    // and computed evidence.
    // Paths are recorded relative to the package, so two runs of one
    // history in different scratch directories record the same report.
    report:
      report &&
      JSON.parse(
        JSON.stringify({
          run: report.run,
          excluded: report.excluded,
          nondeterministic: report.nondeterministic,
          results: report.results.map(({ seconds, ...rest }) => rest),
          summary,
        }).replaceAll(`${dir}/`, `<package>/`),
      ),
    evidence: report?.evidence,
    // A refused run is compared by the cause it names.
    refusal: named?.match(/^refused: (.*)$/m)?.[1],
    mutants: (results ?? []).map((r) => ({
      key: r.key,
      source: r.source,
      function: r.function,
      line: r.line,
      operator: r.operator,
      authored: r.authored === true,
      outcome: r.outcome,
      class: r.class,
      laws: r.laws,
      probe: r.probeGuard === true,
      ordinaryOutcome: r.testOutcome !== undefined,
    })),
    ...readSummary(summary),
  }
}

/**
 * Law 9: the daemon checks each state of the steps, and the same state is
 * run cold. A cold run is deterministic, so a state seen before (after
 * `restart` or `revert`) keeps its first cold result.
 */
/**
 * A copy of the CLI beside this one, so that its relative imports resolve:
 * for law 9's `cli` edit, and for a history that installs the CLI under a
 * path with a space and `#`.
 */
function copyCli(plan) {
  const copy = mkdtempSync(
    join(
      here,
      `..`,
      plan.cliPath === `spaced`
        ? `oracle-gaps-mutant cli #`
        : `oracle-gaps-mutant-cli-`,
    ),
  )
  cpSync(here, copy, {
    recursive: true,
    filter: (path) => !/\.scratch-|node_modules/.test(path),
  })
  return copy
}

/**
 * The daemons that serve a package, by process id: the processes running
 * daemon.mjs for it, as the operating system lists them.
 */
function daemonsOf(dir) {
  const listed = spawnSync(`ps`, [`-A`, `-o`, `pid=,command=`], {
    encoding: `utf8`,
  }).stdout
  return listed
    .split(`\n`)
    .filter(
      (line) => line.includes(`daemon.mjs --package`) && line.includes(dir),
    )
    .map((line) => Number(line.trim().split(/\s+/)[0]))
}

// The faults under which a check's session cannot open, cold or through the
// daemon. A package's TypeScript is no input to a session: the CLI analyzes
// with its own compiler, so no TypeScript fault opens a session.
const sessionFaults = new Set([`brokenVitest`])

async function incremental(dir, plan, cli, copy, observe, states) {
  const reportFile = join(copy, `report.mjs`)
  const reportText = readFileSync(reportFile, `utf8`)
  const RUN_LINE = '`Run ${run.id}. Inputs: ${run.inputs}.`'
  if (!reportText.includes(RUN_LINE))
    throw new Error(`the cli edit no longer finds the summary's run line`)
  const cold = new Map()
  const fingerprint = (files, state, other = false) =>
    JSON.stringify([files, state.seed, state.cliEdited, other])
  cold.set(fingerprint(fixtureFiles(plan), initialState(plan)), cli)
  // A cold result without the run identity, which every edit changes, so
  // that two states compare by what they report.
  const result = (run) =>
    JSON.stringify([
      run.exit,
      run.refusal,
      run.report && {
        ...run.report,
        run: undefined,
        summary: run.report.summary.replace(/^Run \w+/m, `Run`),
      },
    ])
  const trail = [initialState(plan)]
  // The steps that made each state after the first, so a revert knows what
  // it undid.
  const made = []
  let reverted
  let previous = cli
  // A second install of the CLI, at another path, whose summary reads
  // otherwise, so its code differs from the first install's (`otherInstall`).
  let other
  const otherCli = () => {
    if (other === undefined) {
      other = copyCli({ cliPath: `plain` })
      writeFileSync(
        join(other, `report.mjs`),
        reportText.replace(
          RUN_LINE,
          '`Run ${run.id} (other install). Inputs: ${run.inputs}.`',
        ),
      )
    }
    return other
  }
  const checkAt = async (step) => {
    const state = trail.at(-1)
    writeFileSync(
      reportFile,
      state.cliEdited
        ? reportText.replace(
            RUN_LINE,
            '`Run ${run.id} (edited). Inputs: ${run.inputs}.`',
          )
        : reportText,
    )
    const files = fixtureFiles(resolveHistory(state.history), state)
    const key = fingerprint(files, state, step === `otherInstall`)
    const how = {
      seed: state.seed,
      cli: step === `otherInstall` ? otherCli() : copy,
      ordinary: plan.ordinary,
      sources: sourceArgument(plan, `${dir}.link`),
      budget: plan.budget,
    }
    // The first check may be two at once, which must reach one daemon, and
    // so are the two after a crash.
    const twice =
      (step === `start` && plan.concurrentStart) ||
      step === `crashAtOnce` ||
      step === `cliAtOnce`
    // The daemon's checks run before the cold run: a daemon's state must not
    // depend on a cold run between its checks (a session fixed while
    // requests keep coming, `fixSession`).
    const [daemon, ...others] = twice
      ? await runClisAtOnce(dir, files, [
          { ...how, daemon: true },
          { ...how, daemon: true, outName: `out-daemon-2` },
        ])
      : await daemonChecks(step, files, how)
    if (!cold.has(key)) cold.set(key, runCli(dir, files, how))
    const coldRun = cold.get(key)
    for (const [i, run] of [daemon, ...others].entries())
      observe(`incremental`, {
        step: i === 0 ? step : `${step} (a second check at once)`,
        cold: {
          exit: coldRun.exit,
          refusal: coldRun.refusal,
          report: coldRun.report,
        },
        daemon: {
          exit: run.exit,
          refusal: run.refusal,
          ending: run.ending,
          report: run.report,
          // The first line of a failure, for the message; readRun has named
          // the scratch package and CLI copy in it.
          stderr: run.stderr?.split(`\n`)[0],
        },
      })
    if (twice && step === `start`)
      states.add(`two checks started the daemon at once`)
    // A session that cannot open, heard by two checks at once; one that
    // fails while the CLI that started its daemon is connected and unread;
    // and one whose failure, larger than a socket's buffer, a queued
    // request hears.
    if (
      twice &&
      step === `start` &&
      sessionFaults.has(plan.fault) &&
      [daemon, ...others].every((run) => run.refusal !== undefined)
    )
      states.add(`two checks at once on a session that cannot open`)
    if (plan.fault === `brokenVitest` && daemon.refusal !== undefined)
      states.add(`a session failure larger than a socket buffer`)
    const after = {
      crash: `a check after a daemon crash`,
      reboot: `a check after a reboot`,
      reusedPid: `a check after the daemon's process id was reused`,
      crashAtOnce: `two checks at once after a crash`,
      stopAtOnce: `a check during a stop`,
      cliAtOnce: `two checks at once after a code change`,
      dieMidCheck: `a check whose daemon died during it`,
      resetBeforeRead: `a check whose connection was reset`,
      fixSession: `a check after the session's failure was fixed`,
      otherInstall: `a check from another install of the CLI`,
    }[step]
    if (after && [daemon, ...others].every((run) => run.reported))
      states.add(after)
    if (plan.cliPath === `spaced` && daemon.reported)
      states.add(`the daemon ran from a path with a space and #`)
    const reused = daemon.evidence?.reused ?? 0
    const computed = daemon.evidence?.computed ?? 0
    if (step !== `start` && reused > 0)
      states.add(`incremental check reused evidence`)
    if (step !== `start` && reused > 0 && computed > 0)
      states.add(`incremental check reused some evidence and recomputed some`)
    if (step === `restart` && reused > 0)
      states.add(`evidence reused after a daemon restart`)
    // Undoing an edit to a file returns to a state the daemon has seen, so
    // it reruns nothing.
    if (
      step === `revert` &&
      [
        `test`,
        `source`,
        `prepend`,
        `owns`,
        `authored`,
        `helper`,
        `newOracle`,
      ].includes(reverted) &&
      reused > 0 &&
      computed === 0
    )
      states.add(`a revert of a file edit reran nothing`)
    // The other install's summary reads otherwise by construction, so its
    // check is no edit, and the next edit is compared with the state before.
    if (step === `otherInstall`) return
    // An edit that changes the cold result is one a stale cache could miss.
    if (step !== `start` && result(previous) !== result(coldRun))
      states.add(`edit ${step} changed the cold result`)
    previous = coldRun
  }
  const stop = () =>
    spawnSync(
      process.execPath,
      [join(copy, `index.mjs`), `--stop-daemon`, `--package`, dir],
      { cwd: repo, encoding: `utf8`, timeout: 60_000, env: cleanEnv() },
    )
  // One check through the daemon, with what the step does to the daemon
  // meanwhile: paused once the check has begun for longer than the CLI
  // waits for a daemon, then killed (`dieMidCheck`), or stopped and killed
  // before it reads the request, which resets the connection
  // (`resetBeforeRead`).
  async function daemonChecks(step, files, how) {
    if (step !== `dieMidCheck` && step !== `resetBeforeRead`)
      return [runCli(dir, files, { ...how, daemon: true })]
    // A daemon that this check's CLI starts itself is the one that dies.
    if (step === `dieMidCheck`) stop()
    const [pid] = daemonsOf(dir)
    if (step === `resetBeforeRead` && pid) process.kill(pid, `SIGSTOP`)
    // The time a daemon holds a request is the check's, not time spent
    // waiting for a daemon, so a CLI that waits 3 s for one still outlasts
    // a daemon that holds its check for 4 s.
    const running = runClisAtOnce(dir, files, [
      {
        ...how,
        daemon: true,
        env: step === `dieMidCheck` ? { ORACLE_GAPS_WAIT_MS: `3000` } : {},
      },
    ])
    let paused = false
    if (step === `resetBeforeRead`) {
      await new Promise((r) => setTimeout(r, 500))
      if (pid) process.kill(pid, `SIGKILL`)
    } else {
      // Mid-check: the daemon has written this check's state file. A check
      // that ends first (a refusal runs nothing) leaves its daemon alone.
      const started = join(dir, `out-daemon`, `state.json`)
      let finished = false
      running.then(() => {
        finished = true
      })
      for (let waited = 0; !finished && waited < 60_000; waited += 50) {
        const [running] = daemonsOf(dir)
        if (running && existsSync(started)) {
          process.kill(running, `SIGSTOP`)
          await new Promise((r) => setTimeout(r, 4000))
          process.kill(running, `SIGKILL`)
          paused = !finished
          break
        }
        await new Promise((r) => setTimeout(r, 50))
      }
    }
    const runs = await running
    if (paused && runs[0].reported)
      states.add(`a check whose daemon held it past the CLI's wait, then died`)
    return runs
  }
  // Kills the package's daemons as a crash or a power loss would, leaving
  // what they wrote; returns their process ids.
  const crash = async () => {
    const killed = daemonsOf(dir)
    for (const pid of killed) process.kill(pid, `SIGKILL`)
    while (daemonsOf(dir).length > 0)
      await new Promise((r) => setTimeout(r, 50))
    return killed
  }
  try {
    await checkAt(`start`)
    for (const step of plan.steps) {
      if (step === `restart`) stop()
      else if (step === `crash` || step === `crashAtOnce`) await crash()
      else if (step === `reboot` || step === `reusedPid`) {
        const [dead] = await crash()
        rmSync(socketOf(realpathSync(dir)), { force: true })
        // A live process now has the dead daemon's id.
        const lock = join(stateDirOf(realpathSync(dir)), `daemon.lock`)
        if (step === `reusedPid` && dead !== undefined && existsSync(lock))
          writeFileSync(
            lock,
            readFileSync(lock, `utf8`).replace(
              String(dead),
              String(process.pid),
            ),
          )
      } else if (step === `stopAtOnce`) {
        const stopping = new Promise((resolvePromise) =>
          spawn(
            process.execPath,
            [join(copy, `index.mjs`), `--stop-daemon`, `--package`, dir],
            { cwd: repo, env: cleanEnv(), stdio: `ignore` },
          ).on(`close`, resolvePromise),
        )
        await checkAt(step)
        await stopping
        continue
      } else if (step === `otherInstall`) {
        // The check runs from the other install; no file changes.
      } else if (step === `revert`) {
        if (trail.length > 1) trail.pop()
        reverted = made.pop()
      } else {
        trail.push(applyEdit(trail.at(-1), step))
        made.push(step)
      }
      await checkAt(step)
    }
  } finally {
    stop()
    if (other !== undefined) rmSync(other, { recursive: true, force: true })
    // One daemon serves a package, so once it is stopped none is left. A
    // daemon that exits takes a moment to close its contexts.
    let left = daemonsOf(dir)
    for (let waited = 0; left.length > 0 && waited < 20_000; waited += 250) {
      await new Promise((r) => setTimeout(r, 250))
      left = daemonsOf(dir)
    }
    observe(`daemons`, { left: left.length })
    for (const pid of left) {
      try {
        process.kill(pid)
      } catch {
        // It exited meanwhile.
      }
    }
  }
}

async function driver(plan, observe) {
  // A package that resolves no TypeScript lives outside this repository.
  const dir = realpathSync(
    mkdtempSync(
      plan.fault === `noTypescript`
        ? join(realpathSync(tmpdir()), `gap-fixture-`)
        : join(here, `.scratch-`),
    ),
  )
  // A history with steps runs its own copy of the CLI, which the `cli` edit
  // changes; a history that installs the CLI under a path with a space and
  // `#` runs every check from such a copy.
  let copy
  try {
    if (plan.cliPath === `spaced` || plan.steps.length > 0) copy = copyCli(plan)
    // A symbolic link to the package, for sources spelled through it.
    symlinkSync(dir, `${dir}.link`, `dir`)
    const files = fixtureFiles(plan)
    const how = {
      ordinary: plan.ordinary,
      sources: sourceArgument(plan, `${dir}.link`),
      budget: plan.budget,
      cli: plan.cliPath === `spaced` ? copy : here,
    }
    const cli = runCli(dir, files, how)
    // How many units were computed or reused says how the result was
    // produced, not what it is, so it is not observed.
    observe(`cli`, { ...cli, evidence: undefined })
    // Reach comes from what the CLI reported, mapped onto the plan.
    const states = new Set()
    // Each kind of declaration fault is its own state, so each refusal has
    // a history that depends on it.
    if (plan.fault !== `none` && cli.exit !== 0)
      states.add(`refused ${plan.fault}`)
    // A config fault in a run that owns nothing: the config loads before the
    // analysis reads ownership, so the config fault is the one named.
    if (
      configFaults.includes(plan.fault) &&
      cli.exit !== 0 &&
      ownsNothing(plan)
    )
      states.add(`a config fault in a run that owns nothing`)
    if (analyzedFaults.includes(plan.fault) && cli.exit === 0)
      states.add(`analyzed ${plan.fault}`)
    const kindAt = new Map(
      plan.functions.flatMap((fn) =>
        fn.body.map((s) => [`${fn.file}:${s.line}`, s.kind]),
      ),
    )
    for (const m of cli.mutants) {
      if (m.authored) {
        const others = cli.mutants.filter((x) => x.authored && x.key !== m.key)
        if (
          others.some(
            (x) =>
              x.outcome !== `does-not-apply` &&
              m.outcome !== `does-not-apply` &&
              (x.class ?? x.outcome) !== (m.class ?? m.outcome),
          )
        )
          states.add(`two authored mutants judged apart`)
        states.add(
          m.outcome !== `does-not-apply`
            ? `authored mutant`
            : plan.authored.kind === `ambiguous`
              ? `ambiguous authored mutant`
              : `stale authored mutant`,
        )
        continue
      }
      if (m.probe) {
        if (m.function === `w_probeonly`) states.add(`derived probe helper`)
        if (m.function === `w_callschain`)
          states.add(`derived probe helper chain`)
        continue
      }
      const generatedFn = plan.functions.find(
        (fn) => fn.generated && fn.id === m.function,
      )
      if (
        generatedFn &&
        generatedFn.owners.length === 0 &&
        plan.wholeFile !== `none` &&
        m.outcome !== `unowned`
      )
        states.add(`owned by a whole-file entry`)
      if (m.function === `w_overloaded` && m.outcome !== `unowned`)
        states.add(`overloaded function owned`)
      if (m.function === `w_both` && m.outcome === `killed`)
        states.add(`killed on both routes`)
      if (m.function === `wg0` && m.outcome === `killed`)
        states.add(`owned across files`)
      if (m.function === `wg1` && m.outcome === `killed`)
        states.add(`owned through an aliased import`)
      if (m.source === LIB && m.outcome === `unowned`)
        states.add(`unowned in another file`)
      if (m.function === `w_valued` && m.outcome === `killed`)
        states.add(`owned through a value`)
      if (m.function === `W3.run` && m.outcome === `killed`)
        states.add(`owned through a field`)
      if (m.function === `W7.constructor` && m.outcome === `killed`)
        states.add(`constructor owned through new`)
      if (m.function === `W4.step` && m.outcome === `unowned`)
        states.add(`a constructed class brings only what is referenced`)
      if (m.function === `W6.step` && m.outcome !== `unowned`)
        states.add(`a class passed as a value brings its methods`)
      if (
        m.function === `w_assert` &&
        m.outcome === `killed` &&
        m.laws?.includes(`(unnamed)`)
      )
        states.add(`killed under an unnamed law`)
      if (m.function === `w_getter` && m.outcome === `killed`)
        states.add(`a getter the capture left unread`)
      if (m.function === `unused` && m.outcome === `unreached`)
        states.add(`an uncalled function in an owned function is a gap`)
      if (m.function === `w_spy` && m.outcome === `killed`)
        states.add(`a builtin spy the capture left uncalled`)
      if (m.function === `w_shared` && m.class === `branch-never-taken`)
        states.add(`a test that depends on an earlier test`)
      if (m.function === `w_late` && m.outcome === `killed`)
        states.add(`a kill after a caught verdict`)
      if (m.function === `w_prop` && m.outcome === `killed`)
        states.add(`a kill through state an earlier test stored`)
      if (m.function === `w_load` && m.outcome === `killed`)
        states.add(`a mutant of code run at module load killed`)
      if (
        MODULE_DATA.some((d) => d.id === m.function) &&
        m.outcome === `killed`
      )
        states.add(`a mutant of module data killed through its reader`)
      if (
        m.function === `w_memo` &&
        m.operator === `if-false` &&
        m.outcome === `killed`
      )
        states.add(`a module-level cache judged afresh`)
      if (m.function === `w_campaigns` && m.outcome === `random-only-kill`)
        states.add(`second campaign's route attributed`)
      if (m.function === `w_soft` && m.outcome === `random-only-kill`)
        states.add(`a soft verdict keeps its campaign's route`)
      if (m.function === `W5.step` && m.outcome === `killed`)
        states.add(`owned through bind`)
      if (kindAt.get(`${m.source}:${m.line}`) === `oldProbe`)
        states.add(`old probe form judged`)
      if (
        kindAt.get(`${m.source}:${m.line}`) === `mixed` &&
        m.operator === `if-true`
      )
        states.add(`production beside a probe`)
      if (
        kindAt.get(`${m.source}:${m.line}`) === `elseIf` &&
        m.operator === `if-true`
      )
        states.add(`production else judged`)
      if (m.function === `reportAndPush`) states.add(`mixed helper judged`)
      if (m.operator === `bool-flip` && !m.probe && m.outcome === `killed`)
        states.add(`a boolean flip killed`)
      if (
        m.operator === `value-undefined` &&
        !m.probe &&
        m.outcome === `killed`
      )
        states.add(`a value-position call killed`)
      if (m.operator === `loop-false` && m.outcome === `killed`)
        states.add(`a loop that never runs killed`)
      if (m.operator === `field-drop` && m.outcome === `killed`)
        states.add(`a dropped field killed`)
      if (m.operator === `arithmetic-swap` && m.outcome === `killed`)
        states.add(`an arithmetic swap killed`)
      if (m.function === `w_leaf` && m.outcome !== `unowned`)
        states.add(`owned through a call chain`)
      if (m.function === `W0.step` && m.outcome !== `unowned`)
        states.add(`method owned through this`)
      if (m.function === `w_union` && m.outcome === `killed`)
        states.add(`killed by a second owner`)
      if (m.function === `w_crosskill` && m.outcome === `killed`)
        states.add(`a kill in one owner after a gap in another`)
      if (m.function === `w_flakykill` && m.outcome === `killed`)
        states.add(`a kill after a nondeterministic verdict in its file`)
      if (
        m.function === `w_load` &&
        m.operator === `if-true` &&
        m.outcome === `killed`
      )
        states.add(`a mutant that changes a value only at load killed`)
      if (
        m.function === `w_otherinfect` &&
        m.outcome === `killed` &&
        cli.mutants.filter(
          (x) => x.function === `w_otherinfect` && x.outcome === `killed`,
        ).length >= 2
      )
        states.add(`each owner's value change killed its own mutant`)
      if (
        m.function === `w_dep` &&
        m.operator === `value-undefined` &&
        m.outcome === `crashed`
      )
        states.add(`a workspace dependency's state judged fresh`)
      if (
        m.function === `w_shrink` &&
        m.operator === `if-true` &&
        m.class === `not-judged`
      )
        states.add(`a shrinking calibration passes under a mutant`)
      if (m.function === `w_fcprop` && m.outcome === `killed`)
        states.add(`a test.prop kill whose last run passed`)
      if (m.function === `w_cleanup` && m.outcome === `killed`)
        states.add(`a kill whose test's cleanup then threw`)
      if (m.function === `w_iowait` && m.outcome === `killed`)
        states.add(`a copy waiting on I/O killed, not cut for idleness`)
      if (m.function === `w_slowkill` && m.outcome === `killed`)
        states.add(`a slow kill past the first time limit killed`)
      if (m.function === `w_hang` && m.outcome === `timeout`)
        states.add(`a hang alone timed out`)
      if (m.function === `w_hangkill` && m.outcome === `killed`)
        states.add(`a hang in one owner and a kill in another killed`)
      if (m.function === `w_hangsurvive` && m.outcome === `timeout`)
        states.add(`a hang in one owner and a survivor in another timed out`)
      const named = {
        killed: `killed`,
        'random-only-kill': `random-only kill`,
        'agreement-only-kill': `agreement-only kill`,
        'unregistered-kill': `unregistered kill`,
        crashed: `crash gap`,
        'framework-error': `framework-only failure`,
        unreached: `unreached`,
        unowned: `unowned`,
        timeout: `timeout`,
      }[m.outcome]
      if (named) states.add(named)
      if (m.class === `not-judged`) states.add(`not judged`)
      if (m.class === `branch-never-taken`) states.add(`branch never taken`)
      if (m.class === `not-infected`) states.add(`not infected`)
      if (m.class === `not-observed`) states.add(`not observed`)
      if (m.class === `not-distinguished`) states.add(`not distinguished`)
      if (m.class === `indeterminate`) states.add(`indeterminate`)
    }
    // A batch that a hang cut off reran its other items in a new context.
    if (cli.evidence?.rerun > 0)
      states.add(`a batch cut off by a hang reran the rest`)
    // A loop that never ends was cut off by its call budget.
    if (cli.evidence?.spin > 0) states.add(`a spin cut off by its call budget`)
    // A hang that waited on nothing was cut off for idleness.
    if (cli.evidence?.idle > 0) states.add(`a hang cut off for idleness`)
    // A mutant that changed no value was judged from the unmutated runs.
    if (cli.evidence?.unchanged > 0)
      states.add(`a mutant that changes no value judged without a run`)
    // The runner loaded the package's own config, in the form it has: a
    // kill shows that its tests ran.
    if (cli.mutants.some((m) => m.outcome === `killed`)) {
      if (plan.config === `async`)
        states.add(`a config exported as an async function ran`)
      if (plan.configFile === `vitest.config.ts`)
        states.add(`a config in vitest.config.ts ran`)
      if (plan.configEnv)
        states.add(`a config that reads Vitest's environment ran`)
      if (plan.native === `gyp`)
        states.add(`a package with a native addon ran in child processes`)
      if (plan.native === `deep`)
        states.add(
          `a package with a prebuilt addon deep in its tree ran in child processes`,
        )
      if (plan.setupGlobal)
        states.add(`a setup file that defines a fixed global ran in every copy`)
      if (plan.depSubpath)
        states.add(`a source that imports a dependency's subpath ran`)
      if (plan.unbuiltDep)
        states.add(`a package with an unbuilt devDependency ran`)
      if (plan.cliPath === `spaced`)
        states.add(`the CLI ran from a path with a space and #`)
    }
    if (cli.mutants.some((m) => m.outcome === `setup-error`)) {
      states.add(`a setup error`)
      if (
        plan.budget === `one` &&
        cli.mutants.some((m) => m.outcome === `timeout`)
      )
        states.add(`a setup error beside a timeout under one budget`)
    }
    if (plan.ordinary && cli.mutants.some((m) => m.ordinaryOutcome))
      states.add(`ordinary tests run when asked`)
    if (!plan.ordinary && plan.tests.some((t) => t.file === `c`))
      states.add(`ordinary tests left out by default`)
    if (plan.stability !== `none` && cli.exit === 0) {
      const moved = { ...files, [SOURCE]: edited(plan) }
      // The evidence counts are not observed, as for `cli`: they depend on
      // timing (oracles-followups.md G1). Verdicts and keys are.
      observe(`stability`, { ...runCli(dir, moved, how), evidence: undefined })
      states.add(`stability rerun`)
    }
    if (plan.steps.length > 0)
      await incremental(dir, plan, cli, copy, observe, states)
    for (const state of states) observe(`reach`, state)
  } finally {
    if (copy) rmSync(copy, { recursive: true, force: true })
    removePath(`${dir}.link`)
    written.delete(dir)
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // Cleanup must not replace the observation or its failure.
    }
  }
}

// ## Comparison
//
// The check matches the CLI's mutants to the model's by function, line,
// operator, and order on the line, then checks each law in turn and reports
// the first that fails. A run that must be refused is checked for that
// alone. A run that did not complete fails `completion`, so a crash of the
// tool is not read as a wrong enumeration.
/**
 * Law 9: each check through the daemon reports what the cold run of the same
 * state reports. A refused state is compared by the cause it names.
 */
function incrementalCheck(observations) {
  for (const { value } of observations.filter(
    (o) => o.checkpoint === `incremental`,
  )) {
    const { step, cold, daemon } = value
    if (
      daemon.exit !== cold.exit ||
      daemon.refusal !== cold.refusal ||
      (cold.report !== undefined) !== (daemon.report !== undefined)
    )
      return violation(
        `incremental`,
        `after ${step}, the daemon's check exited ${daemon.exit} (${daemon.refusal ?? daemon.stderr ?? `no refusal`}) and the cold run exited ${cold.exit} (${cold.refusal ?? `no refusal`})`,
        `incremental equals cold`,
        { actual: daemon, expected: cold },
      )
    // A refusal through the daemon ends as a cold refusal does (law 12):
    // the CLI that asked the daemon writes it to its own output directory.
    if (cold.refusal !== undefined) {
      const breach = refusalBreach(daemon.ending, { outKnown: true })
      if (breach)
        return violation(
          `incremental`,
          `after ${step}, through the daemon, ${breach}`,
          `report-shaped ending`,
        )
    }
    if (!cold.report) continue
    if (JSON.stringify(daemon.report) === JSON.stringify(cold.report)) continue
    const at = cold.report.results.findIndex(
      (r, i) => JSON.stringify(r) !== JSON.stringify(daemon.report.results[i]),
    )
    return violation(
      `incremental`,
      `after ${step}, the daemon's report differs from the cold run's${at >= 0 ? ` at ${cold.report.results[at].key}` : ``}`,
      `incremental equals cold`,
      at >= 0
        ? {
            actual: daemon.report.results[at],
            expected: cold.report.results[at],
          }
        : { actual: daemon.report, expected: cold.report },
    )
  }
  return undefined
}

/**
 * Law 9's daemon is one per package: checks started at once reach it, and
 * once it is stopped no daemon serves the package.
 */
function daemonCheck(observations) {
  const left = observations.find((o) => o.checkpoint === `daemons`)?.value?.left
  if (left > 0)
    return violation(
      `daemons`,
      `${left} daemon${left === 1 ? `` : `s`} still serve${left === 1 ? `s` : ``} the package after --stop-daemon`,
      `one daemon`,
    )
  return undefined
}

function check(plan, observations, expected) {
  const cli = observations.find((o) => o.checkpoint === `cli`)?.value
  if (!cli) return violation(`cli`, `no CLI run was observed`, `completion`)
  if (cli.strayWrites?.length > 0)
    return violation(
      `cli`,
      `the run wrote ${cli.strayWrites.join(`, `)} outside its output directory and the package's .oracle-gaps`,
      `output namespace`,
    )
  if (expected.refused) {
    if (cli.exit === 0)
      return violation(
        `cli`,
        `the run completed although ${expected.refused.cause} must refuse it`,
        `ownership`,
      )
    if (!`${cli.stderr}`.includes(expected.refused.cause))
      return violation(
        `cli`,
        `the refusal does not name ${expected.refused.cause}: ${cli.stderr}`,
        `ownership`,
      )
    if (
      expected.refused.detail &&
      !`${cli.stderr}`.includes(expected.refused.detail)
    )
      return violation(
        `cli`,
        `the refusal does not give the failing test's error, ${expected.refused.detail}: ${cli.stderr}`,
        `ownership`,
      )
    // Law 12: the refusal is one block with its fix, and the output
    // directory the run was given holds it.
    // Every e2e run names its output directory (`--out`), so even a
    // refusal of its arguments is written there.
    const breach = refusalBreach(cli.ending, {
      cause: expected.refused.cause,
      outKnown: true,
    })
    if (breach) return violation(`cli`, breach, `report-shaped ending`)
    return incrementalCheck(observations) ?? daemonCheck(observations) ?? pass
  }
  if (cli.exit !== 0 || !cli.reported)
    return violation(
      `cli`,
      `the CLI did not complete (exit ${cli.exit}): ${cli.stderr ?? `no results`}`,
      `completion`,
    )
  if (!`${cli.report?.run?.inputs}`.includes(`pool ${expected.pool}`))
    return violation(
      `cli`,
      `the run did not use the ${expected.pool} pool: ${cli.report?.run?.inputs}`,
      `completion`,
    )
  const seen = new Map()
  const actual = cli.mutants
    .filter((m) => !m.authored)
    .map((m) => {
      const key = `${m.source} ${m.line} ${m.operator}`
      const ordinal = seen.get(key) ?? 0
      seen.set(key, ordinal + 1)
      return { ...m, ordinal }
    })
  const site = (m) =>
    `${m.source}:${m.function}:${m.line}:${m.operator}#${m.ordinal}`
  if (
    actual.map(site).sort().join() !== expected.mutants.map(site).sort().join()
  )
    return violation(`cli`, `the mutant set differs`, `enumeration`, {
      actual: actual.map(site).sort(),
      expected: expected.mutants.map(site).sort(),
    })
  const pairs = expected.mutants.map((m) => [
    m,
    actual.find((a) => site(a) === site(m)),
  ])
  for (const [owed, got] of pairs)
    if (owed.probe !== got.probe)
      return violation(
        `cli`,
        `${site(got)}: probe code is ${got.probe}, owed ${owed.probe}`,
        `probe-only code`,
        { actual: got, expected: owed },
      )
  for (const [owed, got] of pairs) {
    if (owed.probe) continue
    const kind = got.class ?? got.outcome
    if (kind !== owed.kind)
      return violation(
        `cli`,
        `${site(got)}: ${kind}, owed ${owed.kind}`,
        owed.kind === `unowned` || kind === `unowned`
          ? `ownership`
          : `classification`,
        { actual: got, expected: owed },
      )
  }
  // Each gap is streamed once as its mutant is judged (stream.mjs), and the
  // streamed gaps are the report's gaps, each once.
  if (JSON.stringify(cli.streamed) !== JSON.stringify(cli.gaps))
    return violation(
      `cli`,
      `the streamed gap lines are not the report's gaps: ${cli.streamed.length} streamed, ${cli.gaps.length} reported`,
      `streaming`,
      { actual: cli.streamed, expected: cli.gaps },
    )
  for (const [owed, got] of pairs)
    if (!owed.probe && got.ordinaryOutcome !== owed.ordinaryOutcome)
      return violation(
        `cli`,
        `${site(got)}: the ordinary tests' outcome is ${got.ordinaryOutcome ? `` : `not `}reported, owed ${owed.ordinaryOutcome ? `reported` : `not reported`}`,
        `ordinary tier`,
        { actual: got, expected: owed },
      )
  // Each authored mutant, by its key: its id, whatever its file is called.
  const authoredGot = cli.mutants.filter((m) => m.authored)
  if (authoredGot.length !== expected.authoredAll.length)
    return violation(
      `cli`,
      `${authoredGot.length} authored mutants are reported, owed ${expected.authoredAll.length}`,
      `authored mutants`,
    )
  for (const owed of expected.authoredAll) {
    const got = authoredGot.find((m) => m.key === owed.key)
    const kind = got && (got.class ?? got.outcome)
    if (kind !== owed.kind)
      return violation(
        `cli`,
        `the authored mutant ${owed.id} is ${kind}, owed ${owed.kind}`,
        `authored mutants`,
        { actual: kind, expected: owed.kind },
      )
    if (owed.line !== undefined && got.line !== owed.line)
      return violation(
        `cli`,
        `the authored mutant ${owed.id} is reported at line ${got.line}, owed ${owed.line}`,
        `authored mutants`,
      )
  }
  for (const [owed, got] of pairs)
    if (got.key !== owed.key)
      return violation(
        `cli`,
        `${site(got)}: key ${JSON.stringify(got.key)}, owed ${JSON.stringify(owed.key)}`,
        `keys`,
        { actual: got.key, expected: owed.key },
      )
  if (
    cli.gaps.join(`\n`) !== expected.gaps.join(`\n`) ||
    JSON.stringify(cli.entries) !== JSON.stringify(expected.entries) ||
    cli.unowned.join(`\n`) !== expected.unowned.join(`\n`) ||
    JSON.stringify(cli.counts) !== JSON.stringify(expected.counts)
  )
    return violation(
      `cli`,
      `the summary does not list exactly the owed gaps, unowned warnings, and counts`,
      `report completeness`,
      {
        actual: {
          entries: cli.entries,
          unowned: cli.unowned,
          counts: cli.counts,
        },
        expected: {
          entries: expected.entries,
          unowned: expected.unowned,
          counts: expected.counts,
        },
      },
    )
  const moved = observations.find((o) => o.checkpoint === `stability`)?.value
  if (moved) {
    if (moved.exit !== 0 || !moved.reported)
      return violation(
        `stability`,
        `the CLI did not complete on the edited source (exit ${moved.exit}): ${moved.stderr ?? `no results`}`,
        `completion`,
      )
    const describe = (m) => `${m.key} ${m.class ?? m.outcome} ${m.probe}`
    const before = cli.mutants.map(describe).sort()
    const keys = new Set(cli.mutants.map((m) => m.key))
    const after = moved.mutants
      .filter((m) => keys.has(m.key))
      .map(describe)
      .sort()
    if (before.join(`\n`) !== after.join(`\n`))
      return violation(
        `stability`,
        `the ${plan.stability} edit changed existing keys or outcomes`,
        `key stability`,
        { actual: after, expected: before },
      )
  }
  return incrementalCheck(observations) ?? daemonCheck(observations) ?? pass
}

declareOracle({
  check: [check, incrementalCheck, daemonCheck, refusalBreach],
  model: [model, interpret, ownersOf, probeHelpers],
  grammar: [histories],
})

// ## Calibrations
//
// Each one hands the check a wrong report, so a check that cannot see the
// difference fails here instead of passing every CLI.
const corruptCli = (change) => (trace) => {
  const index = trace.findIndex((o) => o.checkpoint === `cli`)
  if (index < 0) return undefined
  const value = change(structuredClone(trace[index].value))
  if (value === undefined) return undefined
  return trace.map((o, i) => (i === index ? { ...o, value } : o))
}
const firstWhere = (predicate, change) =>
  corruptCli((cli) => {
    if (cli.exit !== 0) return undefined
    const m = cli.mutants.find((x) => !x.authored && predicate(x))
    if (!m) return undefined
    change(m)
    return cli
  })
const calibrations = [
  {
    name: `a refused run is reported as complete`,
    law: `ownership`,
    corrupt: corruptCli((cli) =>
      cli.exit === 0 ? undefined : { ...cli, exit: 0 },
    ),
  },
  {
    name: `a mutant is dropped from the enumeration`,
    law: `enumeration`,
    corrupt: corruptCli((cli) => {
      const index = cli.mutants.findIndex((m) => !m.authored)
      if (cli.exit !== 0 || index < 0) return undefined
      cli.mutants.splice(index, 1)
      return cli
    }),
  },
  {
    name: `production code is reported as probe code`,
    law: `probe-only code`,
    corrupt: firstWhere(
      (m) => !m.probe,
      (m) => {
        m.probe = true
      },
    ),
  },
  {
    name: `a crash is reported as a kill`,
    law: `classification`,
    corrupt: firstWhere(
      (m) => !m.probe && m.outcome === `crashed`,
      (m) => {
        m.outcome = `killed`
      },
    ),
  },
  {
    name: `an owned mutant is reported as unowned`,
    law: `ownership`,
    corrupt: firstWhere(
      (m) => !m.probe && m.outcome !== `unowned`,
      (m) => {
        m.outcome = `unowned`
        delete m.class
      },
    ),
  },
  {
    name: `a key drops its statement text`,
    law: `keys`,
    corrupt: firstWhere(
      () => true,
      (m) => {
        m.key = m.key.slice(0, m.key.lastIndexOf(`:`))
      },
    ),
  },
  {
    name: `the summary omits a gap`,
    law: `report completeness`,
    corrupt: corruptCli((cli) => {
      if (cli.exit !== 0 || cli.gaps.length === 0) return undefined
      cli.gaps.shift()
      return cli
    }),
  },
  {
    name: `an edit moves a key`,
    law: `key stability`,
    corrupt: (trace) => {
      const cli = trace.find((o) => o.checkpoint === `cli`)?.value
      const index = trace.findIndex((o) => o.checkpoint === `stability`)
      if (!cli || index < 0) return undefined
      const value = structuredClone(trace[index].value)
      const keys = new Set(cli.mutants.map((m) => m.key))
      const kept = value.mutants.find((m) => keys.has(m.key))
      if (!kept) return undefined
      kept.key = `${kept.key}~moved`
      return trace.map((o, i) => (i === index ? { ...o, value } : o))
    },
  },
]

calibrations.push({
  name: `the daemon reports another outcome than the cold run`,
  law: `incremental equals cold`,
  corrupt: (trace) => {
    const index = trace.findIndex(
      (o) => o.checkpoint === `incremental` && o.value.daemon.report,
    )
    if (index < 0) return undefined
    const value = structuredClone(trace[index].value)
    const changed = value.daemon.report.results[0]
    if (!changed) return undefined
    changed.outcome = changed.outcome === `killed` ? `unreached` : `killed`
    return trace.map((o, i) => (i === index ? { ...o, value } : o))
  },
})

calibrations.push({
  name: `a daemon is left after --stop-daemon`,
  law: `one daemon`,
  corrupt: (trace) => {
    const index = trace.findIndex((o) => o.checkpoint === `daemons`)
    if (index < 0) return undefined
    return trace.map((o, i) => (i === index ? { ...o, value: { left: 1 } } : o))
  },
})

// Law 9's states: reuse, a mix of reuse and recomputation, reuse from disk
// after a restart, and each content edit changing the cold result, without
// which a stale cache would match the cold run by chance.
const incrementalStates = [
  `incremental check reused evidence`,
  `incremental check reused some evidence and recomputed some`,
  `evidence reused after a daemon restart`,
  `a revert of a file edit reran nothing`,
  ...edits
    .filter((edit) => !daemonEvents.has(edit) && edit !== `fixSession`)
    .map((edit) => `edit ${edit} changed the cold result`),
  `a check whose daemon died during it`,
  `a check whose daemon held it past the CLI's wait, then died`,
  `a check whose connection was reset`,
  `a check after a daemon crash`,
  `a check after a reboot`,
  `a check after the daemon's process id was reused`,
  `two checks at once after a crash`,
  `a check during a stop`,
  `two checks at once after a code change`,
  `a check from another install of the CLI`,
  `two checks started the daemon at once`,
  `the daemon ran from a path with a space and #`,
]
// The static states (probe structure and ownership through the reference
// tree) are gap-report-static-oracle's: it reaches each in every campaign,
// in-process. This oracle still judges those laws in every history it runs,
// and counts how often it reaches them.
const staticStates = [
  `production beside a probe`,
  `production else judged`,
  `derived probe helper`,
  `mixed helper judged`,
  `owned through a call chain`,
  `method owned through this`,
  `derived probe helper chain`,
  `overloaded function owned`,
  `owned by a whole-file entry`,
  `old probe form judged`,
  `owned across files`,
  `owned through an aliased import`,
  `unowned in another file`,
  `owned through a value`,
  `owned through a field`,
  `a constructed class brings only what is referenced`,
  `constructor owned through new`,
  `a class passed as a value brings its methods`,
  `owned through bind`,
]
const required = [
  `killed by a second owner`,
  `killed`,
  `random-only kill`,
  `agreement-only kill`,
  `unregistered kill`,
  `crash gap`,
  `framework-only failure`,
  `indeterminate`,
  `not judged`,
  `branch never taken`,
  `not infected`,
  `not observed`,
  `not distinguished`,
  `unreached`,
  `unowned`,
  `authored mutant`,
  `stale authored mutant`,
  `ambiguous authored mutant`,
  `stability rerun`,
  `refused badEntry`,
  `refused missingSource`,
  `refused nonLiteral`,
  `refused brokenOwner`,
  `killed on both routes`,
  `killed under an unnamed law`,
  `second campaign's route attributed`,
  `a soft verdict keeps its campaign's route`,
  `a getter the capture left unread`,
  `a test that depends on an earlier test`,
  `a kill after a caught verdict`,
  `a kill through state an earlier test stored`,
  `a mutant of code run at module load killed`,
  `a mutant of module data killed through its reader`,
  `a module-level cache judged afresh`,
  `ordinary tests run when asked`,
  `ordinary tests left out by default`,
  `two authored mutants judged apart`,
  `timeout`,
  `a kill after a nondeterministic verdict in its file`,
  `a kill in one owner after a gap in another`,
  `a slow kill past the first time limit killed`,
  `a mutant that changes a value only at load killed`,
  `a mutant that changes no value judged without a run`,
  `a boolean flip killed`,
  `a value-position call killed`,
  `a loop that never runs killed`,
  `a dropped field killed`,
  `an arithmetic swap killed`,
  `a hang cut off for idleness`,
  `a spin cut off by its call budget`,
  `a copy waiting on I/O killed, not cut for idleness`,
  `a kill whose test's cleanup then threw`,
  `a test.prop kill whose last run passed`,
  `a shrinking calibration passes under a mutant`,
  `a workspace dependency's state judged fresh`,
  `each owner's value change killed its own mutant`,
  `a hang alone timed out`,
  `a hang in one owner and a kill in another killed`,
  `a hang in one owner and a survivor in another timed out`,
  `a batch cut off by a hang reran the rest`,
  `a config exported as an async function ran`,
  `a config in vitest.config.ts ran`,
  `a config that reads Vitest's environment ran`,
  `a package with a native addon ran in child processes`,
  `a setup file that defines a fixed global ran in every copy`,
  `a package with a prebuilt addon deep in its tree ran in child processes`,
  `a source that imports a dependency's subpath ran`,
  `a package with an unbuilt devDependency ran`,
  `a builtin spy the capture left uncalled`,
  `an uncalled function in an owned function is a gap`,
  `the CLI ran from a path with a space and #`,
  `a setup error`,
  `a setup error beside a timeout under one budget`,
  `refused projects`,
  `refused outsideSource`,
  `analyzed noTypescript`,
  `analyzed apiLessTypescript`,
  `refused brokenVitest`,
  `refused configThrows`,
  `refused configNoDefault`,
  `refused setupThrows`,
  `edit fixSession changed the cold result`,
  `a check after the session's failure was fixed`,
  `two checks at once on a session that cannot open`,
  `a session failure larger than a socket buffer`,
  `a config fault in a run that owns nothing`,
  ...incrementalStates,
]
// The faults the CLI analyzes anyway: a package's TypeScript is no input.
const analyzedFaults = [`noTypescript`, `apiLessTypescript`]
// The faults found when the package's Vitest and config load, before the
// analysis.
const configFaults = [
  `brokenVitest`,
  `projects`,
  `configThrows`,
  `configNoDefault`,
]
const faults = [
  `badEntry`,
  `missingSource`,
  `nonLiteral`,
  `brokenOwner`,
  `projects`,
  `outsideSource`,
  `brokenVitest`,
  `configThrows`,
  `configNoDefault`,
  `setupThrows`,
  ...analyzedFaults,
]
const separate = [
  `ordinary tests left out by default`,
  `two authored mutants judged apart`,
  `a package with a prebuilt addon deep in its tree ran in child processes`,
  `a setup error`,
  `a setup error beside a timeout under one budget`,
  `stale authored mutant`,
  `ambiguous authored mutant`,
  ...faults
    .filter((fault) => !analyzedFaults.includes(fault))
    .map((fault) => `refused ${fault}`),
  ...analyzedFaults.map((fault) => `analyzed ${fault}`),
  `edit fixSession changed the cold result`,
  `a check after the session's failure was fixed`,
  `two checks at once on a session that cannot open`,
  `a session failure larger than a socket buffer`,
  `a config fault in a run that owns nothing`,
  ...incrementalStates,
]
const witnessed = required.filter((s) => !separate.includes(s))

// A constructed history builds from a generated base whose first function is
// owned by file a (one owned function, not a whole file), so a random
// `ownerless` or an all-unowned base cannot refuse a state it names. Its declaration
// alternates between `declareOracle` and `oracleProperty` across the list, so
// both forms reach the states they name; a build that names a declaration
// (`neither`, `both`) keeps it.
const withDeclaration = (constructed) =>
  constructed.map((item, index) => ({
    ...item,
    build: (generated) =>
      item.build({
        ...generated,
        declaration: index % 2 === 0 ? `declareOracle` : `oracleProperty`,
        ownerless: false,
        owners: [`a`, ...generated.owners.slice(1)],
      }),
  }))

oracleProperty({
  id: `oracle-gaps.report`,
  law: {
    statement: `The gap report enumerates the promised operator mutants, leaves out exactly the probe-only code, discovers every oracle that owns a function's call tree and refuses broken ownership, judges each mutant only by its owners' tests on their registered routes and counts only law verdicts on reproducible routes as kills, which outrank a run that never ends, anchors each mutant by its function and normalized statement, lists every gap and unowned mutant once with consistent counts, keeps keys stable under unrelated edits, reports through one daemon per package what a cold run reports at every state of a sequence of edits, and runs the package as Vitest does from any install path and any --source spelling: one instance of each workspace dependency, no refusal over an unbuildable devDependency, child processes for a native addon anywhere in the tree, a capture that a test's builtin spies cannot see, and a refusal of test.projects; and every run that does not complete ends, cold or through the daemon, with a refusal that exits 2, prints a refused: block and one fix: directive with no stack trace, and writes the refusal to the run's output directory.`,
    authority: `The maintainer's decisions in design runs v11, v14, and v19 (2026-11-04 and 2026-11-05), not in this package's records, including that a kill by reach agreement alone is a gap and that an incremental run through the daemon equals a cold one (v19.3); the project's oracle guide on quiet exclusions; the oracle rubric's outcome kinds (ORC-006); the CLI's documented operator list in schemata.mjs.`,
    limits: `Law 12 judges refusals only: no legal history reaches an internal error, so its shape (exit 3, the stack in error.log) is not judged; argument refusals are the static oracle's; the check's rejection of a stack trace, a missing fix, and a wrong exit code is calibrated in the static oracle, through the same refusalBreach, and here only a refused run reported as complete is calibrated, because each calibration here runs real CLI histories. Hangs only as an owner test that awaits a promise that never settles, under a 1 s first budget and a 6 s full limit, and a slow run only as one witness that waits 3 s before it judges; busy loops only on instrumented code (cut by the call budget), no slow runs past the full limit that would end, hangs in ordinary or nondeterministic tests, setup errors other than a throw at module load, loops, multi-line conditions, two functions on one line, or await, new, and void statements; nested functions, object-literal methods, accessors, and class-field arrows only where no test calls them (their ownership is the static oracle's); two source files of one package, with no re-exports, namespace imports, or calls into another package; no --only, --sample, or --diff-base; a derived class's file is instrumented and its sites are judged as unowned, but no test imports or constructs the class, so its no-mutant and super-region behavior is the static oracle's (in-process), not this oracle's; package configs only in vite.config.ts, vitest.config.ts, or vite.config.mjs, as an object or a sync or async function, with no plugins of their own and test.projects only as a refusal; no probe-bound states, so reach agreement's killing of probe mutants is not checked; no gap answers or gate; law 9's edits leave out files read through fs, other environment variables, new files that change how an unchanged import resolves, Vite config and installed-package changes, and concurrent checks other than two that start the daemon; cut-off charging judged only under one budget; native addons only as a binding.gyp or a prebuilt .node file, not as optional platform packages; daemon races (two CLIs reading one error file, a CLI hearing closing from the failing daemon it started, a reset connection on macOS) fixed by inspection; a workspace dependency's one-file bundle is written in that dependency's own .oracle-gaps folder, a known stray write (date-fns report), which the stray-write check excludes; the runner's copies and Vitest configs (.oracle-gaps-PID*) sit at the package root and are removed when the run closes, so a killed run leaves them there, and the stray-write check runs after close and cannot see them; module-level data only as three \`const\` declarations of the main source (an object literal, an array that holds a function, and a boolean), read in place, with no data imported from another file, destructured, reassigned, or declared as an enum or a default export.`,
  },
  histories: {
    arbitrary: histories,
    states: required,
    measured: staticStates,
    runs: 2,
    fixedSeeds: [20261105],
    constructed: withDeclaration([
      {
        name: `every outcome class`,
        enters: witnessed,
        // A whole-file owns entry would own the unowned witness, so the
        // construction keeps ownership per function.
        build: (generated) => ({
          ...generated,
          witness: `capture`,
          wholeFile: `none`,
          fault: `none`,
          authored: { stmt: 0, kind: `apply` },
          stability: `insertGuard`,
          steps: null,
          ordinary: true,
          // react-db's form: an async function, in the file Vitest reads first.
          config: `async`,
          configFile: `vitest.config.ts`,
          configEnv: true,
          native: `gyp`,
          setupGlobal: true,
          // A subpath import, an unbuilt devDependency, a `./` spelling, and
          // a CLI installed under a path with a space and `#`.
          depSubpath: true,
          unbuiltDep: true,
          sourceSpelling: `dot`,
          cliPath: `spaced`,
          boot: false,
          budget: `two`,
        }),
      },
      {
        // A mutant that throws while the module loads (the booted `f0`'s
        // `if (x > 100) throw` forced true), and, in the same group of four
        // mutants and so the same batch, a mutant whose owner test in file
        // b then hangs. Under one budget a run past it is final, so a
        // watchdog that charges b's hang to the copy that failed to load
        // reports that mutant as a timeout instead of a setup error.
        name: `a load failure beside a hang`,
        enters: [
          `a setup error`,
          `a setup error beside a timeout under one budget`,
        ],
        build: (generated) => ({
          ...generated,
          functions: [
            [
              { kind: `push`, quote: `'` },
              { kind: `throwIf`, message: `plain` },
            ],
            [{ kind: `push`, quote: `'` }],
          ],
          containers: [],
          overloads: [],
          owners: [`a`, `b`],
          library: [],
          libraryOwners: [],
          runes: [],
          wholeFile: `none`,
          witness: false,
          tests: [
            { ...judging(`a`, `fixed seed`, 1), fn: 0 },
            {
              ...judging(`b`, `fixed seed`, 1, { judges: false, hangs: true }),
              fn: 1,
            },
          ],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          boot: true,
          budget: `one`,
        }),
      },
      {
        name: `a stale authored mutant and a reformat`,
        enters: [`stale authored mutant`, `stability rerun`],
        build: (generated) => ({
          ...generated,
          witness: false,
          functions: [
            [
              { kind: `push`, quote: `'` },
              ...generated.functions[0].slice(0, 4),
            ],
            ...generated.functions.slice(1),
          ],
          fault: `none`,
          authored: { stmt: 0, kind: `stale` },
          stability: `reformat`,
        }),
      },
      {
        name: `an ambiguous authored mutant`,
        enters: [`ambiguous authored mutant`],
        build: (generated) => ({
          ...generated,
          witness: false,
          functions: [
            [
              { kind: `push`, quote: `'` },
              ...generated.functions[0].slice(0, 4),
            ],
            ...generated.functions.slice(1),
          ],
          wholeFile: `none`,
          fault: `none`,
          authored: { stmt: 0, kind: `ambiguous` },
        }),
      },
      {
        // Two small owned functions, so that each check is quick, and every
        // edit in an order where each one changes the cold result: file b's
        // helper (only b's evidence is recomputed), the seed, a revert to
        // the state before it (all reused), then the rest, and a restart.
        name: `an edit sequence through the daemon`,
        enters: incrementalStates,
        build: (generated) => ({
          ...generated,
          functions: [
            [{ kind: `if`, op: `>`, k: 4, not: false, quote: `'` }],
            [{ kind: `push`, quote: `'` }],
          ],
          containers: [],
          overloads: [],
          owners: [`a`, `b`],
          library: [],
          libraryOwners: [],
          wholeFile: `none`,
          template: false,
          tests: [
            { ...judging(`a`, `fixed seed`, 5), fn: 0 },
            { ...judging(`b`, `fixed seed`, 1), fn: 1 },
          ],
          witness: false,
          authored: { stmt: 0, kind: `apply` },
          fault: `none`,
          stability: `none`,
          // Two checks at once start the daemon, from a CLI installed under
          // a path with a space and `#`.
          concurrentStart: true,
          cliPath: `spaced`,
          native: `none`,
          steps: [
            `helper`,
            `seed`,
            `revert`,
            `test`,
            `revert`,
            `test`,
            `source`,
            `prepend`,
            `owns`,
            `authored`,
            `newOracle`,
            `cli`,
            `cliAtOnce`,
            // A second install's check, then the first install's again.
            `otherInstall`,
            `test`,
            `restart`,
            // The daemon this check's CLI starts dies during the check.
            `dieMidCheck`,
            `crash`,
            `reboot`,
            `reusedPid`,
            `crashAtOnce`,
            `stopAtOnce`,
            `addAddon`,
            `test`,
            // The only addon is one built into an existing build/Release,
            // and a daemon with a cached pool sees it.
            `addAddon`,
            `addRelease`,
            `resetBeforeRead`,
            // With no addon left, a scoped one is installed into a scope
            // directory that already exists.
            `addRelease`,
            `addScopedAddon`,
          ],
        }),
      },
      {
        // Two authored mutants in one source file, one killed and one a
        // not-judged gap: a run that let one see the other's patch would
        // judge them alike.
        name: `two authored mutants`,
        enters: [
          `two authored mutants judged apart`,
          `a package with a prebuilt addon deep in its tree ran in child processes`,
        ],
        build: (generated) => ({
          ...generated,
          functions: [
            [{ kind: `push`, quote: `'` }],
            [{ kind: `push`, quote: `'` }],
          ],
          containers: [],
          overloads: [],
          owners: [`a`, `a`],
          wholeFile: `none`,
          witness: false,
          tests: [
            { ...judging(`a`, `fixed seed`, 1), fn: 0 },
            { ...judging(`a`, `fixed seed`, 1, { judges: false }), fn: 1 },
          ],
          authored: { stmt: 0, kind: `apply` },
          secondAuthored: true,
          fault: `none`,
          stability: `none`,
          steps: null,
          // A prebuilt addon two levels down: the run uses child processes.
          native: `deep`,
        }),
      },
      {
        // An ordinary test exists, and the run does not ask for it.
        name: `ordinary tests left out by default`,
        enters: [`ordinary tests left out by default`],
        // One owned function with no oracle test, so it is unreached, and
        // an ordinary test that calls it: asked, its outcome is reported.
        build: (generated) => ({
          ...generated,
          functions: [[{ kind: `push`, quote: `'` }]],
          containers: [],
          overloads: [],
          owners: [`a`],
          wholeFile: `none`,
          witness: false,
          tests: [{ ...judging(`c`, `case`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          ordinary: false,
          steps: null,
        }),
      },
      {
        // test.projects in a run whose owns entries own no selected source:
        // the run refuses for the config, which loads before the analysis.
        name: `a config fault in a run that owns nothing`,
        enters: [`a config fault in a run that owns nothing`],
        build: (generated) => ({
          ...generated,
          fault: `projects`,
          // Nothing owns anything: no function owners, no library owners,
          // no module data owners, no whole-file entry.
          owners: [],
          dataOwners: [],
          library: [],
          libraryOwners: [],
          containers: [],
          overloads: [],
          wholeFile: `none`,
          witness: false,
          authored: null,
          steps: null,
        }),
      },
      ...faults.map((fault) => ({
        name: `a declaration fault: ${fault}`,
        enters: analyzedFaults.includes(fault)
          ? [`analyzed ${fault}`]
          : [
              `refused ${fault}`,
              ...(fault === `brokenVitest`
                ? [
                    `two checks at once on a session that cannot open`,
                    `a session failure larger than a socket buffer`,
                    `edit fixSession changed the cold result`,
                    `a check after the session's failure was fixed`,
                  ]
                : []),
            ],
        // A session that cannot open is checked through the daemon too, and
        // fixed once; a long failure is heard by two checks at once, then by
        // a fresh daemon's check (fixing it reruns the whole generated
        // campaign).
        build: (generated) => ({
          ...generated,
          fault,
          ...(fault === `brokenVitest`
            ? { steps: [`restart`, `fixSession`], concurrentStart: true }
            : {}),
        }),
      })),
    ]),
  },
  resolve: resolveHistory,
  model,
  driver,
  check,
  calibrations,
  timeout: 900_000,
})
