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
 *    condition of a `for`, `while`, or `do` loop, `delete-call` for a
 *    call statement, `return-undefined` for a returned expression that is
 *    not a call (value-undefined covers one) and not already `undefined`,
 *    and `optional-chain` for a property or element read through `?.`
 *    whose object may be nullish (F17). Each names its function and its line: a class's
 *    method, accessor, or field function by `Class.member`, any other
 *    function by its own name (an object literal's method by its property),
 *    a function exported with no name of its own by the name an import
 *    gives it (`default` for `export default` and `module.exports =`, the
 *    export's name for `exports.name =`), module-level data (a top-level variable whose initializer is not a
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
 *    test file that calls `oracleProperty`, or passes a literal `owns` list
 *    in an object-literal argument of any call, such as a wrapper's
 *    (`registerX('id', { owns })`), which forwards it to `oracleProperty`.
 *    An `owns` key inside an assertion's arguments is not read. The
 *    file's owns is the union of its lists. Each entry names a source
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
 *    a gap. An owns entry that names nothing and an owns list that is not a
 *    literal each make the run fail and name the cause, because each would
 *    otherwise hide gaps. An owner whose tests fail with no mutant active
 *    blocks the mutants it owns (law 14); it is named with its failing test
 *    and its error, and the
 *    baseline's replay command, pasted into a POSIX shell in the package,
 *    runs that test alone, though its suite's name holds regular-expression
 *    and shell syntax and other tests' names extend it or repeat its own
 *    (the classify oracle's law 9 over generated names), and though the
 *    run's config is one that only `--config` names, beside a config that
 *    Vitest discovers and that includes no test (F12). The CLI's
 *    capture must not change what a test observes: an owner that passes
 *    alone passes under the CLI, even when it counts the reads of a getter
 *    on a value it asserts on, or spies on the builtins a value is scanned
 *    with (`Object.keys`, `Object.getPrototypeOf`,
 *    `Object.getOwnPropertyDescriptor`) and counts their calls. A Vitest
 *    config that defines `test.projects`, which the runner cannot honor,
 *    refuses the run and names `test.projects` (maintainer decision of
 *    2026-11-08), rather than leave every mutant unreached. The run loads
 *    the config Vitest would load in the package: the first of Vitest's
 *    config names in the package's directory or, failing that, in the
 *    nearest parent directory that has one, as Vitest's own find-up does
 *    (maintainer decision, 2026-11-11), so a parent's config that defines
 *    `test.projects` refuses the run too; or the one `--config`
 *    names, relative to `--package`, even where Vitest would discover
 *    another (maintainer finding F12, 2026-11-10),
 *    as Vitest loads it, in its own format: an `.mjs` or `.mts` config, or
 *    a `.js` or `.ts` one in a package whose module type is `module`, is an
 *    ES module, so a top-level await in it loads, even in a package with no
 *    module type (F13); a `.cjs` or `.cts` config, or a `.js` or `.ts` one
 *    in a package with no module type, is CommonJS, so its `require` and
 *    `require.resolve` work (review of 2026-11-11). It names that config in
 *    the line `config: <file>` once the config has loaded, or prints `no config file:
 *    Vitest's default discovery` when there is none. Its process prints no
 *    MaxListenersExceededWarning, with eleven warm contexts too (F15): each
 *    context is a Vitest instance that listens on the process, and the
 *    runner accounts for each listener it holds.
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
 *    one, the mutant is a `timeout`, whatever any other owner reported. The
 *    confirming runs of one mutant share its budget: the larger of
 *    `--mutant-limit` (30 s by default) and ten times its owner files'
 *    unmutated time (maintainer disposition G1, 2026-11-11). Its
 *    confirmations run in its owner files' order, and each gets at most what
 *    the budget has left after the seconds of its earlier confirmed runs,
 *    reused ones included, so the outcome is a function of the runs, not of
 *    their order or of reuse (law 9 checks a second daemon check of the same
 *    state); one that the budget cuts, or that gets nothing, is a timeout; so
 *    a mutant that is slow in two owners, whose confirmations together pass
 *    the budget, is a `timeout`, and a kill in an earlier owner still
 *    decides. A copy
 *    cut off for spinning (its call budget ran out, not its clock) is a
 *    timeout as it stands: its rows are not judged, so a verdict it recorded
 *    before the cut does not kill. (The framework's `bounded work` law, which
 *    would judge such a verdict, is not built.) A copy that a batch skipped
 *    because an earlier copy killed the mutant runs again, through the batch,
 *    only while no kill is in hand, so every mutant gets an outcome and no
 *    other missing unit is rerun. A test's work is the number of site
 *    evaluations that its instrumented production code made (the capture's
 *    call count, never a time): a call statement, a call whose value is
 *    used, a comparison, an `if`, each pass of a loop's condition. A
 *    passing, deterministic owner test on a reproducible or random route,
 *    that made no timer and held no I/O open, and that registers a work bound beside
 *    its route (`__oracleWorkBound`, which `oracleProperty`'s `work`
 *    option calls) and whose work under the mutant is more than that ratio
 *    of its unmutated work fails the mutant under law `work bound` on its
 *    route, as a law verdict does (maintainer decision, 2026-11-12: a
 *    shortcut for speed is owed a cost law). A mutant that no owner test
 *    fails is a survivor: a `not-judged` when an owner test's observation
 *    or asserted value changed, an `extra-work` when no observation changed
 *    and an owner test that reached it, on a reproducible or random route,
 *    whose count could not follow the clock (no timer made by any path,
 *    `node:timers/promises` included, no clock read, and no I/O held
 *    open; a wait of one turn, `setImmediate`, is no clock), did more work
 *    (a shortcut whose deletion only costs time); a test whose count could
 *    follow the clock, or that registered no route, judges no work, so its
 *    rise leaves the class as it was, and a bound never kills where an idle
 *    replay would not (the PR #48 reviews' F1 and F5; the maintainer's
 *    decision of 2026-11-12 under P3), a
 *    `branch-never-taken` when an `if` on its line never took
 *    one of its outcomes in an owner test, a `not-infected` when a comparison's
 *    operators agreed on every operand an owner test reached, a
 *    `not-distinguished` when its operator changes a value only on some
 *    inputs and no capture shows which (a loop's condition, an undefined call
 *    value, a dropped field, a skipped call, a logical operator, a returned
 *    value made undefined, a plain read in place of `?.`), and
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
 *    the authored mutant, a helper module that one oracle file imports, a
 *    module that a test imports only where its output differs, the
 *    seed, and the set of oracle files; they also restart the daemon and
 *    revert the last edit. The law says nothing unless the daemon reuses
 *    evidence, so the reach requires a check that reused evidence, one that
 *    reused some and recomputed some, one that reused evidence from disk
 *    after a restart, and, for each content edit, a cold result that the
 *    edit changed: an edit that changes nothing cannot expose a stale cache.
 *    Each warm context caches the modules it read, so the reach also
 *    requires an edit that changed the cold result after a hang replaced
 *    the only context (which ran every file), and an edit of a module that
 *    only mutated runs load, which no unmutated run records as an input.
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
 *    instrumented copy. A test file's own environment pragma
 *    (`// @vitest-environment <name>`), another than the config's, holds in
 *    every copy of the file, as in its baseline (review of A1, 2026-11-11).
 *    A run writes nothing in the package but the output
 *    directory that `--out` names there: the daemon's state, the workspace
 *    dependencies' bundles, and a default output directory are in the OS
 *    temp directory (maintainer decision, 2026-11-11: the working files stay
 *    out of the repository). While it runs, it writes only its session
 *    directory `.oracle-gaps-<pid>/` there, beside no test, so a Vitest run
 *    started meanwhile finds none of the runner's files (maintainer
 *    disposition G4, 2026-11-11, and the freeze's namespacing decision of
 *    2026-11-10); a stopped run leaves that directory, and the next run
 *    removes it. The daemon's state, removed between checks as the OS cleans
 *    its temp directory, is a cold start (law 9). A source that imports
 *    a subpath of a workspace dependency sees one instance of that
 *    dependency, as Vitest gives it; a devDependency that no test loads and
 *    that cannot be built does not refuse the run; and a package with a
 *    native addon anywhere in its dependency tree (a `binding.gyp`, or a
 *    prebuilt `.node` file in a dependency of a dependency) runs in child
 *    processes, and the run's inputs name the pool.
 * 11. **Streaming.** The CLI prints each gap as its mutant is judged, one line
 *    each (stream.mjs), and the summary repeats those gap lines: the streamed
 *    gap lines are the report's gaps, each printed once, none missing. While a
 *    copy runs past the heartbeat interval (30 s; the driver shortens it), the
 *    CLI prints `busy: <id> in <file> for <n>s` at each interval: the
 *    mutant's id, or `baseline`, and a test file that runs it; a mutant whose
 *    run reaches a slow owner test is named in one (maintainer disposition
 *    G1, 2026-11-11).
 * 12. **A report-shaped ending.** A run never ends with a bare stack trace
 *    (gap-report-model-oracle.mjs states the law beside its check). Every
 *    refusal of laws 3 and 10 (a broken owns declaration, no oracle file, no
 *    owner, a source outside the package, `test.projects`, a Vitest that
 *    does not load, a config that throws when it loads or has no default
 *    export) exits 2 and
 *    prints `refused: <cause>` and then `fix: <directive>`, with no stack
 *    frames; the directive offers no way around the fix. The block names the
 *    run's output directory, which holds a results.json with status
 *    `refused`, the same cause and directive, and a summary.md. A refusal
 *    through the daemon ends the same way, in the output directory of the
 *    CLI that asked.
 * 13. **Stopping.** A run stopped by SIGTERM or SIGINT ends within 30 s, and
 *    once it has ended no process it started is left: its Vitest workers,
 *    as child processes or as threads, and the processes their tests start
 *    (maintainer disposition G2, 2026-11-11: "the CLI must never leave
 *    workers running").
 * 14. **The report leads with the baseline** (the v20 freeze's one loop:
 *    test results and gaps together, 2026-11-10). Before any mutant, every
 *    test file runs once with no mutant active, an ordinary file too. The
 *    stdout opens with each file's result and its test counts, a failing
 *    file's failing test and its error, and its replay command; then one
 *    line for each failing oracle file that names it, its failing test, and
 *    the step that unblocks the mutants it owns (G13); then, when an oracle
 *    file failed, `Provisional:` with how many mutants are blocked. A
 *    failing oracle file, or a setup file that throws and fails every file,
 *    refuses nothing: a mutant that a failing oracle file owns and no
 *    passing owner kills is `blocked`, a gap, and the rest are judged
 *    (maintainer disposition G5, 2026-11-11, and the freeze's decision 2: a
 *    RED baseline gives a provisional report). With `--only`, the baseline
 *    runs only the selected mutants' owners (and the ordinary files with
 *    `--ordinary`), and each selected mutant is judged as the full run
 *    judges it. The last stdout line is the run's done line (law 15),
 *    `oracle-gaps: done completed, <n> gaps, report <path>` (G6): exit 0
 *    means the check ran to its end, not that it found no gaps.
 * 15. **The stream's lines are greppable** (the maintainer's request of
 *    2026-11-12, relayed by the coordinator, with its decisions of the same
 *    day: the same prefixes on stdout and stderr, and a line for a stopped
 *    run). An agent acts on a check's results as they stream, so every line
 *    the CLI writes for the check starts with `oracle-gaps: ` and then its
 *    kind: `config`, `note`, `baseline`, `blocked`, `progress`, `gap`,
 *    `busy`, or `done`. Only an indented line under a baseline failure, a
 *    refusal's `refused:` and `fix:` block, and a line Node writes for the
 *    process are not. The baseline ends with one decisive line before any
 *    mutant runs: `oracle-gaps: baseline all <n> oracle files pass`, or
 *    `oracle-gaps: baseline <k> of <n> oracle files failed (provisional)`.
 *    The stdout's baseline, blocked, and gap lines carry the same prefixes.
 *    The run's last line is its done line: `completed, <n> gaps[
 *    (provisional)], report <its summary.md>` on stdout, `refused[, report
 *    <its summary.md>]` after a refusal's block, or `stopped (<signal>)`
 *    after a stop. A check through the daemon streams the same lines.
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
 * that never settles, under a 1 s first budget and a 20 s full limit
 * (`--first-limit`, `--hang-limit`, and a 15 s `--mutant-limit`); a slow run
 * that ends is only a witness, a test that waits 3 s where its output
 * changed and then judges, or 10 s in two one-test owners without judging. Not generated: a busy
 * loop, a slow run past the full limit that would still end, a hang in an
 * ordinary or nondeterministic test, a setup error other than a throw at
 * module load from a function the module calls with 0, multi-line
 * conditions, nested functions, object-literal methods, accessors, and
 * class-field arrows in code that a test calls (the static oracle judges
 * their ownership), two functions on one line,
 * `await`, `new`, and `void` statements, `--only` outside a stopped run,
 * `--sample`, and `--diff-base`, re-exports, namespace imports, and calls into another
 * package (a package's tree stops at its boundary, by the maintainer's
 * decision of 2026-11-05). A module-level probe guard, a guard declared
 * in a block of the function beside its probe, and a parameter or function
 * named `probing` are not generated. A probe-bound state is not generated, so the claim that
 * reach agreement kills every probe mutant is not checked. Gap answers and
 * the gate are not part of the CLI until answers become evidence-log events,
 * which waits on the maintainer's decision about how an answer maps to a law.
 * Law 9 judges the witness module's outcome classes along one edit
 * sequence only, the constructed history "an edit sequence over the witness
 * module" (a test edit, a helper edit, and a revert): a generated history
 * with the witness module takes no steps, so longer or other edit sequences
 * over those classes are not drawn. Each such step costs a cold run of the
 * witness module, and one campaign in six drew a history that ran past the
 * test's limit (maintainer decision, 2026-11-11; this oracle owns the gap).
 * Law 9's edits come only between checks: a file saved during a check is
 * not generated, so the runner's handling of an input that changes while a
 * run runs (it invalidates the input and does not store the run) is fixed
 * by inspection; a witness needs a step that edits a file between a unit's
 * start and its end.
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
  witnessSteps,
  budgetSteps,
  streamKinds,
  baselineVerdict,
  verdictLine,
  doneLine,
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
  altConfigPath,
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
  outsideRepository,
  ENV_PREFIX,
  MUTANT_LIMIT_MS,
  HEARTBEAT_MS,
  FULL_LIMIT_MS,
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
// The heartbeat comes every HEARTBEAT_MS, not every 30 s, so that a slow
// test's wait spans it (law 11).
const cleanEnv = () => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) =>
        !name.startsWith(`VITEST`) &&
        !name.startsWith(`${ENV_PREFIX}_`) &&
        // The variables Vitest sets in this process, which a shell that
        // runs the CLI does not have.
        name !== `TEST` &&
        name !== `NODE_ENV`,
    ),
  ),
  ORACLE_GAPS_HEARTBEAT_MS: String(HEARTBEAT_MS),
})

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
    config,
    contexts = 4,
    only,
    pool,
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
    // Four warm contexts run mutants in parallel, or eleven, past the
    // process's ten listeners of one event, or one, which runs everything
    // in a fixed order; results do not depend on the count.
    `--contexts`,
    String(contexts),
    // A fixture's tests run in milliseconds. A 1 s first budget cuts off
    // the slow witnesses, and the full limit lets them end; a hang is cut
    // for idleness. With one budget, a run past the full limit is a timeout
    // at once.
    `--first-limit`,
    budget === `one` ? String(FULL_LIMIT_MS) : `1000`,
    `--hang-limit`,
    String(FULL_LIMIT_MS),
    // The budget that a mutant's confirming runs share, the full limit of
    // one copy: one slow owner's confirmation fits it, two do not (law 4).
    `--mutant-limit`,
    String(MUTANT_LIMIT_MS),
    `--out`,
    path(out),
  ]
  if (only !== undefined) args.push(`--only`, only.join(`,`))
  if (pool !== undefined) args.push(`--pool`, pool)
  if (ordinary) args.push(`--ordinary`)
  // A config under a name Vitest does not discover, relative to --package.
  if (config !== undefined) args.push(`--config`, config)
  if (files[AUTHORED] !== undefined)
    args.push(`--mutants`, path(join(dir, `mutants`)))
  return { args, out }
}

/** The `--config` and `--contexts` a plan's runs pass. */
const configArgs = (plan) => ({
  config: plan.configPlace === `named` ? plan.configPath : undefined,
  contexts: plan.contexts,
})

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
  const run = readRun(
    dir,
    out,
    child.status,
    child.stderr,
    how.cli ?? here,
    child.stdout,
  )
  // The command the baseline printed to replay a failing owner (law 3).
  const replay = `${child.stderr ?? ``}`
    .split(`\n`)
    .find((line) => line.startsWith(`  replay: `))
    ?.slice(`  replay: `.length)
  return { ...run, strayWrites: strays(dir, before), replay }
}

/**
 * What a run has written in the package outside the output directories the
 * driver names (`--out`), as paths relative to the package: the files under
 * `dir` that were not in `before`. While a run runs (`running`), its session
 * directory, `.oracle-gaps-<pid>/` (its capture setup and Vitest configs,
 * which resolve the package's modules from there), is its own too.
 */
const strays = (dir, before, running = false) =>
  filesUnder(dir).filter(
    (file) =>
      !before.has(file) &&
      !(running && /^\.oracle-gaps-\d+\//.test(file)) &&
      !OWN_WRITES.some((home) => file === home || file.startsWith(`${home}/`)),
  )

/**
 * A run that the driver stops by `signal` while the stop witness's test
 * spins (law 13). The CLI runs only the witness's mutants (`ids`), with
 * Vitest's workers in `pool`, in one context. Once the spinning test has
 * recorded its own process and the child process it started, the driver
 * lists what the run has written so far beside its output directory and
 * the package's `.oracle-gaps` (law 10's namespace, while the run runs, not
 * only after it closes), sends the signal to the CLI, and waits for the CLI
 * to end. A second later, each recorded process must have ended.
 *
 * With `when` `after`, the run is not stopped while it runs: the witness
 * does not spin, the run's process holds its exit for 500 ms once it has
 * printed its done line (`ORACLE_GAPS_TEST_HOLD_EXIT_MS`, a hook for this
 * driver), and the driver sends the signal once that line is on stdout
 * (review of #46, F3). The run then ends as it completed, with exactly one
 * done line. With `warm`, the driver sends the signal while the run warms
 * its config (`ORACLE_GAPS_TEST_WARM_PROBE`, a hook that writes its marker there
 * and then waits, as a config load does, on a service in the run's group
 * that the signal ends, with a handler that takes 200 ms to exit, as
 * Vitest's does; re-review N1). The run then ends stopped, with exactly
 * one done line and no refusal.
 */
async function stoppedRun(dir, files, how, ids, { signal, pool, when }) {
  const after = when === `after`
  const warm = when === `warm`
  // With `abort`, no signal comes: a test of file a aborts the run's
  // process (`GAP_ABORT`), in worker threads, so the abort ends the process
  // that runs the check, as a V8 out-of-memory abort does. The run then
  // ends with one error line per stream that names how its process ended,
  // and exits 3 (the coordinator's decision of 2026-11-12 on P10).
  const abort = when === `abort`
  writeFixture(dir, files)
  const before = new Set(filesUnder(dir))
  const pids = mkdtempSync(join(realpathSync(tmpdir()), `gap-stop-`))
  const { args } = cliArgs(dir, files, {
    ...how,
    outName: `out-stop`,
    contexts: 1,
    only: ids,
    pool: abort ? `threads` : pool,
  })
  const child = spawn(process.execPath, args, {
    cwd: repo,
    env: after
      ? { ...cleanEnv(), ORACLE_GAPS_TEST_HOLD_EXIT_MS: `500` }
      : warm
        ? { ...cleanEnv(), ORACLE_GAPS_TEST_WARM_PROBE: join(pids, `warming`) }
        : abort
          ? { ...cleanEnv(), GAP_ABORT: `1` }
          : { ...cleanEnv(), GAP_STOP_DIR: pids },
    stdio: [`ignore`, `pipe`, `pipe`],
  })
  let stdout = ``
  let stderr = ``
  child.stdout.on(`data`, (chunk) => {
    stdout += chunk
  })
  child.stderr.on(`data`, (chunk) => {
    stderr += chunk
  })
  let exited = false
  let exitCode
  const exit = new Promise((resolvePromise) =>
    child.on(`exit`, (code) => {
      exited = true
      exitCode = code
      resolvePromise(true)
    }),
  )
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  for (
    let waited = 0;
    !exited &&
    !abort &&
    (after
      ? !stdout.includes(`oracle-gaps: done completed`)
      : warm
        ? !existsSync(join(pids, `warming`))
        : readdirSync(pids).length < 2) &&
    waited < 120_000;
    waited += 50
  )
    await sleep(50)
  // Spun: the witness's test spins (with `after`, the done line came while
  // the run's process still held its exit; with `warm`, the run was warming
  // its config).
  // With `abort`, the run's own end is the event: it ended unstopped.
  if (abort) await Promise.race([exit, sleep(120_000)])
  const spun = abort
    ? exited
    : after
      ? stdout.includes(`oracle-gaps: done completed`) && !exited
      : warm
        ? existsSync(join(pids, `warming`)) && !exited
        : readdirSync(pids).length >= 2
  const strayWhileRunning = strays(dir, before, true)
  if (!abort) child.kill(signal)
  const ended = await Promise.race([exit, sleep(30_000).then(() => false)])
  await sleep(1000)
  const alive = readdirSync(pids)
    .filter((name) => /^\d+$/.test(name))
    .map(Number)
    .filter((pid) => {
      try {
        process.kill(pid, 0)
        return true
      } catch {
        return false
      }
    })
  // What the run left running is stopped here, so that it cannot slow the
  // next history.
  for (const pid of alive)
    try {
      process.kill(pid, `SIGKILL`)
    } catch {
      // It ended meanwhile.
    }
  if (!ended) child.kill(`SIGKILL`)
  rmSync(pids, { recursive: true, force: true })
  return {
    signal,
    pool,
    spun,
    ended,
    survivors: alive.length,
    strayWhileRunning,
    when: when ?? `run`,
    // Whether a refusal's block reached stderr: a stop is never a refusal.
    refused: stderr.split(`\n`).some((line) => line.startsWith(`refused: `)),
    exit: exitCode,
    // Both streams' lines (law 15), with the scratch paths named.
    stream: streamOf(stderr.split(`\n`), (text) =>
      namedScratch(text, [
        [how.cli ?? here, `<cli>`],
        [dir, `<package>`],
      ]),
    ),
    stdoutStream: streamOf(stdout.split(`\n`), (text) =>
      namedScratch(text, [
        [how.cli ?? here, `<cli>`],
        [dir, `<package>`],
      ]),
    ),
    // The session directories in the package once it has ended: a stopped
    // run leaves its own, and the next run removes it.
    sessions: readdirSync(dir).filter((name) =>
      /^\.oracle-gaps-\d+$/.test(name),
    ),
    // What else it left in the package.
    left: strays(dir, before).filter(
      (file) => !/^\.oracle-gaps-\d+\//.test(file),
    ),
  }
}

/**
 * Runs a baseline's replay command as an author pastes it into a POSIX
 * shell in the package, with this repository's Vitest on the path, and
 * names the tests it ran (passed or failed) by their full names, the suites'
 * names and the test's joined by a space.
 */
function replayed(dir, command) {
  if (command === undefined) return undefined
  const scratch = mkdtempSync(join(realpathSync(tmpdir()), `gap-replay-`))
  try {
    const report = join(scratch, `report.json`)
    spawnSync(
      `sh`,
      [`-c`, `${command} --reporter=json --outputFile='${report}'`],
      {
        cwd: dir,
        encoding: `utf8`,
        timeout: 120_000,
        env: {
          ...cleanEnv(),
          PATH: `${join(here, `..`, `node_modules`, `.bin`)}:${process.env.PATH}`,
        },
      },
    )
    if (!existsSync(report)) return []
    return JSON.parse(readFileSync(report, `utf8`))
      .testResults.flatMap((file) => file.assertionResults)
      .filter((test) => test.status === `passed` || test.status === `failed`)
      .map((test) => test.fullName)
      .sort()
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
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

// Where a run may write in the package: only the output directories the
// driver names with `--out` (`out`, `out-daemon`, `out-stop`, and
// `out-only`). The daemon's state, the workspace dependencies' one-file
// bundles, and a default output directory live in the OS temp directory
// (maintainer decision, 2026-11-11: the gap check's working files stay out
// of the repository), so a package, and a workspace dependency in it, keeps
// nothing of a run.
const OWN_WRITES = [`out`, `out-daemon`, `out-stop`, `out-only`]

/** Runs the CLI several times at once on one state of the fixture. */
async function runClisAtOnce(dir, files, hows) {
  writeFixture(dir, files)
  return Promise.all(
    hows.map(async (how) => {
      const { args, out } = cliArgs(dir, files, how)
      const child = spawn(process.execPath, args, {
        cwd: repo,
        env: { ...cleanEnv(), ...how.env },
        stdio: [`ignore`, `pipe`, `pipe`],
      })
      // Both streams, as runCli reads them: law 15 judges each run's lines,
      // its stdout's done line included.
      let stdout = ``
      let stderr = ``
      child.stdout.on(`data`, (chunk) => {
        stdout += chunk
      })
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
      return readRun(dir, out, status, stderr, how.cli ?? here, stdout)
    }),
  )
}

// Output with each scratch directory named, as a path or as the file URL the
// stack spells it by (its escapes included). A scratch package lies inside
// the CLI's directory (`.scratch-*` beside the CLI), so the longest path is
// named first, whatever the order of `names`: naming the CLI first would
// leave `<cli>/.scratch-XXXX`, a random name, in the trace. The runner's own
// files carry the CLI's process id (its session directory,
// `.oracle-gaps/session-<pid>`, and its copies of test files,
// `.oracle-gaps-<pid>-<n>-<file>`, check.mjs), and Vitest names such a file
// when it fails to load, so the id is named too.
function namedScratch(text, names) {
  let named = text
  const longestFirst = names
    .filter(([path]) => path !== undefined)
    .sort(([a], [b]) => b.length - a.length)
  for (const [path, name] of longestFirst)
    named = named
      .replaceAll(pathToFileURL(path).href, name)
      .replaceAll(path, name)
  return named
    .replaceAll(/\.oracle-gaps-\d+/g, `.oracle-gaps-<pid>`)
    .replaceAll(/session-\d+/g, `session-<pid>`)
}

/** What one run of the CLI reported, from its exit status and its files. */
// A gap line the CLI streams to stderr as its mutant is judged (stream.mjs):
// its class, its line, and its id, after the stream's prefix (law 15).
const streamedGap =
  /^oracle-gaps: gap (?:not-judged|extra-work|indeterminate|dead-code|outside-annotation|branch-never-taken|not-infected|not-observed|not-distinguished|unreached|random-only-kill|agreement-only-kill|unregistered-kill|framework-error|timeout|setup-error|crashed|does-not-apply|blocked) L(?:\d+|\?) (\S+) /

/**
 * What law 15 judges of a run's stderr, as relations that do not depend on
 * the order in which its contexts finished:
 * - `strays`: each line, once, that is neither a line of a stream kind
 *   (`oracle-gaps: <kind> `), an indented line under a baseline failure, a
 *   refusal's block (`refused:` up to its `fix:` line), nor a line Node
 *   writes for the process (a warning);
 * - `verdicts`: the decisive baseline lines;
 * - `mutantBeforeVerdict`: whether a gap line, a count of judged mutants,
 *   or a heartbeat that names a mutant came before the first verdict;
 * - `last`: the last line, which ends a run that did not complete.
 */
function streamOf(lines, name) {
  const kinds = new RegExp(`^oracle-gaps: (?:${streamKinds.join(`|`)}) `)
  const strays = new Set()
  let inRefusal = false
  for (const line of lines) {
    if (line === ``) continue
    if (line.startsWith(`refused: `)) inRefusal = true
    const ending = inRefusal
    if (line.startsWith(`fix: `)) inRefusal = false
    if (
      ending ||
      kinds.test(line) ||
      line.startsWith(`  `) ||
      /^\((?:node:\d+|Use `node)/.test(line)
    )
      continue
    strays.add(name(line).slice(0, 300))
  }
  const verdict = (line) => baselineVerdict.test(line)
  const first = lines.findIndex(verdict)
  const mutantLine = (line) =>
    streamedGap.test(line) ||
    line.startsWith(`oracle-gaps: progress judged `) ||
    (line.startsWith(`oracle-gaps: busy `) &&
      !line.startsWith(`oracle-gaps: busy baseline `))
  const before = first < 0 ? lines : lines.slice(0, first)
  return {
    strays: [...strays].sort().slice(0, 10),
    verdicts: lines.filter(verdict),
    mutantBeforeVerdict: before.some(mutantLine),
    last: name(lines.filter((line) => line !== ``).at(-1) ?? ``),
    // How many done lines the stream has: exactly one, its last.
    dones: lines.filter((line) => line.startsWith(`oracle-gaps: done `)).length,
    // The notes, each once, named as the trace names paths, and with the
    // output directory's name left out: a cold run and a check through the
    // daemon name different ones.
    notes: [
      ...new Set(
        lines
          .filter((line) => line.startsWith(`oracle-gaps: note `))
          .map((line) => name(line).replace(/\/out(?:-[\w-]+)?\//g, `/<out>/`)),
      ),
    ].sort(),
  }
}

function readRun(dir, out, status, stderr, cli, stdout) {
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
  const lines = `${stderr ?? ``}`.split(`\n`)
  // Each heartbeat (law 11): what the busy copy runs (a mutant's id, or
  // `baseline`) and its test file, relative to the package, once for each
  // pair. How long the copy had run, and so how many times it beat, is a
  // clock reading, which the trace leaves out.
  const heartbeats = [
    ...new Set(
      lines.flatMap((line) => {
        const beat = line.match(/^oracle-gaps: busy (\S+) in (\S+) for \d+s$/)
        return beat ? [JSON.stringify({ label: beat[1], file: beat[2] })] : []
      }),
    ),
  ]
    .sort()
    .map((beat) => JSON.parse(beat))
  // The stdout summary's lead, up to its first blank line (law 14), its
  // last line, and the files the baseline lines on stderr name. Since the
  // stream has no blank line (law 15), the lead is the whole stdout, whose
  // notes name the run's scratch directory: each line names it as the
  // trace names paths, so two runs of one history record one lead.
  const printed = `${stdout ?? ``}`
    .split(`\n`)
    .filter((line, i, all) => all.slice(i).some(Boolean))
  const blank = printed.indexOf(``)
  return {
    lead: (blank < 0 ? printed : printed.slice(0, blank)).map((line) =>
      namedScratch(line, scratch),
    ),
    lastLine: printed.at(-1) && namedScratch(printed.at(-1), scratch),
    // The stdout's own lines of the stream's kinds: the gap lines under
    // their functions, as the stream prints them (law 15).
    stdoutGaps: printed.filter((line) => streamedGap.test(line)).length,
    baselineFiles: lines.flatMap((line) => {
      const file = line.match(
        /^oracle-gaps: baseline (?:pass|fail) (\S+)(?: \(ordinary\))?: /,
      )?.[1]
      return file === undefined ? [] : [file]
    }),
    heartbeats,
    // The config the run says it used (law 3), and the warnings Node printed
    // for the process.
    configLines: lines.filter((line) =>
      line.startsWith(`oracle-gaps: config `),
    ),
    // The stream's grammar (law 15), recorded as relations so that a trace
    // does not depend on the order in which contexts finished.
    stream: streamOf(lines, (text) => namedScratch(text, scratch)),
    // The stdout's lines, judged as the stderr's are (review of #46, F1 and
    // F2): every line of either stream is a line of the stream.
    stdoutStream: streamOf(`${stdout ?? ``}`.split(`\n`), (text) =>
      namedScratch(text, scratch),
    ),
    // The output directory the run was given, as the trace names it: the
    // final line names its report there.
    outDir: namedScratch(out, scratch),
    // Whether the run captured its tests' own console output there.
    captured: (() => {
      try {
        return readFileSync(join(out, `test-output.log`)).length > 0
      } catch {
        return false
      }
    })(),
    warnings: lines.filter((line) => /MaxListenersExceededWarning/.test(line)),
    // How a run that did not complete ended, read from the whole of its
    // stderr and its output directory (law 12).
    ending:
      status === 0
        ? undefined
        : endingOf(
            status,
            stderr,
            out,
            (text) => namedScratch(text, scratch),
            stdout,
          ),
    exit: status,
    // An internal error's stack is in the run's error.log (law 12), which
    // the scratch directory's removal takes with it: a failure keeps it.
    stderr:
      named === undefined
        ? undefined
        : `${status === 3 && existsSync(join(out, `error.log`)) ? `error.log: ${namedScratch(readFileSync(join(out, `error.log`), `utf8`), scratch).slice(0, 2000)}\n` : ``}${named.slice(-1500)}`,
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
      id: r.id,
      // The owner files whose tests reached it, relative to the package.
      oracleFiles: (r.oracleFiles ?? []).map((file) => relative(dir, file)),
      ordinaryFiles: (r.ordinaryFiles ?? []).map((file) => relative(dir, file)),
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
  // Whether the daemon's last check cut a run off, which replaces the
  // context that ran it. With one context, that is the context that read
  // every file before.
  let replacedOnly = false
  // Whether the daemon's last check cut a batch off.
  let cutBefore = false
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
      ...configArgs(plan),
      // After the `config` edit, `--config` names the second config.
      ...(state.altConfig ? { config: altConfigPath(plan) } : {}),
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
          notes: coldRun.stream.notes,
        },
        daemon: {
          exit: run.exit,
          refusal: run.refusal,
          ending: run.ending,
          report: run.report,
          // The stream through the daemon (law 15): both streams' lines.
          stream: run.stream,
          stdoutStream: run.stdoutStream,
          // The first line of a failure, for the message; readRun has named
          // the scratch package and CLI copy in it.
          stderr: run.stderr?.split(`\n`)[0],
        },
      })
    if (twice && step === `start`)
      states.add(`two checks started the daemon at once`)
    if (
      daemonConfigFaults.includes(plan.fault) &&
      daemon.exit === 2 &&
      coldRun.exit === 2
    )
      states.add(`a config refusal through the daemon`)
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
      cleanState: `a check after the OS cleaned the daemon's state`,
      recheck: plan.functions.some((fn) => fn.id === `w_slowpair`)
        ? `a second daemon check of the budget witness's state`
        : undefined,
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
    // The witness module's hangs are cut off in every cold run. A daemon
    // check after an edit that cut off fewer runs than the cold run of the
    // same state reused a timed-out run, so law 9 judged a timeout that came
    // from the store.
    if (
      plan.witness !== false &&
      step !== `start` &&
      !daemonEvents.has(step) &&
      reused > 0 &&
      (daemon.evidence?.cut ?? 0) < (coldRun.evidence?.cut ?? 0)
    )
      states.add(`a timed-out run reused after an edit`)
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
    if (step !== `start` && result(previous) !== result(coldRun)) {
      states.add(`edit ${step} changed the cold result`)
      // The daemon's previous check cut a run off, so the only context, which
      // ran every file, was replaced. Whether the replacement read the edited
      // file again is not observed; the constructed history's order makes it
      // read it.
      if (replacedOnly)
        states.add(
          `an edit that changed the cold result after a hang replaced the only context`,
        )
      // A batch of the daemon's previous check was cut off by a hang, and
      // the edit changed a module that only mutated runs load: the copies
      // that finished before the hang must keep it as an input. Which copy
      // loaded it is not observed; the history's order puts it before the hang.
      if (step === `lazy` && plan.lazyGate && cutBefore)
        states.add(
          `a lazy edit changed the cold result after a batch was cut off`,
        )
    }
    cutBefore = (daemon.evidence?.cut ?? 0) > 0
    replacedOnly = plan.contexts === 1 && cutBefore
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
      } else if (step === `cleanState`) {
        // The OS cleans its temp directory: the daemon's state goes, the
        // daemon itself may still run.
        rmSync(stateDirOf(realpathSync(dir)), { recursive: true, force: true })
      } else if (step === `recheck`) {
        // Nothing changes: the daemon checks the same state again.
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
  // A package that resolves no TypeScript, has no config, or has its
  // config in its parent directory lives outside this repository
  // (`outsideRepository`); the last in a directory `pkg` of the scratch
  // directory, which holds its config.
  const scratch = realpathSync(
    mkdtempSync(
      outsideRepository(plan)
        ? join(realpathSync(tmpdir()), `gap-fixture-`)
        : join(here, `.scratch-`),
    ),
  )
  const dir = plan.configPlace === `parent` ? join(scratch, `pkg`) : scratch
  mkdirSync(dir, { recursive: true })
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
      ...configArgs(plan),
    }
    const { replay, ...cli } = runCli(dir, files, how)
    // How many units were computed or reused says how the result was
    // produced, not what it is, so it is not observed.
    observe(`cli`, { ...cli, evidence: undefined })
    // A failing owner's replay, run as the author would run it (law 3).
    if (plan.fault === `brokenOwner`)
      observe(`replay`, { command: replay, ran: replayed(dir, replay) })
    // Reach comes from what the CLI reported, mapped onto the plan.
    const states = new Set()
    if (cli.exit === 0 && !plan.consoleOutput)
      states.add(`a completed run whose tests wrote nothing`)
    // Law 14: a partial run of one owned function's mutants, whose baseline
    // runs only their owners.
    const chosen = cli.mutants.find(
      (m) => !m.authored && !m.probe && m.outcome !== `unowned`,
    )
    if (cli.exit === 0 && plan.onlyRun && chosen) {
      const ids = cli.mutants
        .filter((m) => !m.authored && m.function === chosen.function)
        .map((m) => m.id)
      const partial = runCli(dir, files, {
        ...how,
        only: ids,
        outName: `out-only`,
      })
      observe(`partial`, {
        function: chosen.function,
        source: chosen.source,
        exit: partial.exit,
        baselineFiles: partial.baselineFiles,
        mutants: partial.mutants.map((m) => ({
          key: m.key,
          kind: m.class ?? m.outcome,
        })),
      })
      if (partial.exit === 0) states.add(`a partial run of one function`)
      if (partial.exit === 0 && plan.fault === `brokenOwner`)
        states.add(`a partial run beside a failing owner`)
    }
    // Law 13: each stop run, once the CLI has judged the stop witness.
    const stopIds = cli.mutants
      .filter((m) => m.function === `w_stop`)
      .map((m) => m.id)
    let previousSessions = []
    // A session directory is named by the process that made it, which
    // differs on every run, and two names sort by their pids. The law reads
    // only whether a later run kept an earlier run's directory, so the
    // observation holds counts, which no name or order changes: how many
    // session directories the package has once the run ended, and how many
    // of them the previous stopped run had left.
    if (cli.exit === 0 && stopIds.length > 0)
      for (const stop of plan.stopRuns) {
        const run = await stoppedRun(dir, files, how, stopIds, stop)
        const stopped = {
          ...run,
          sessions: {
            present: run.sessions.length,
            kept: run.sessions.filter((name) => previousSessions.includes(name))
              .length,
          },
        }
        observe(`stopped`, stopped)
        if (previousSessions.length > 0)
          states.add(`a run after a stopped one that left its session`)
        previousSessions = run.sessions
        if (!stopped.spun) continue
        if (stop.when === `after`) {
          states.add(`a stop signal after the completed line`)
          continue
        }
        if (stop.when === `warm`) {
          states.add(`a stop signal while the config warms`)
          continue
        }
        if (stop.when === `abort`) {
          states.add(`a run whose process aborted`)
          continue
        }
        states.add(`a run stopped by ${stop.signal} while a worker spun`)
        states.add(
          `a stopped run whose workers are ${stop.pool === `forks` ? `child processes` : `threads`}`,
        )
      }
    // Each kind of declaration fault is its own state, so each refusal has
    // a history that depends on it.
    if (plan.fault !== `none` && cli.exit !== 0)
      states.add(`refused ${plan.fault}`)
    // A failing owner and a throwing setup file block mutants (law 14).
    if (
      blockingFaults.includes(plan.fault) &&
      cli.exit === 0 &&
      cli.mutants.some((m) => m.outcome === `blocked`)
    )
      states.add(`blocked by ${plan.fault}`)
    // A refused run's output is recorded with its scratch paths named, and
    // this package lies inside the CLI's directory: the case in which the
    // naming order decides whether a random name stays in the trace.
    if (cli.exit !== 0 && dir.startsWith(`${how.cli}/`))
      states.add(`a refused run whose package lies inside the CLI's directory`)
    // A failing owner's replay printed in a package whose config only
    // `--config` names, beside a discovered config that includes no test.
    if (
      plan.fault === `brokenOwner` &&
      plan.configPlace === `named` &&
      replay !== undefined
    )
      states.add(`a failing owner replayed under a config that --config names`)
    if (
      plan.fault === `brokenOwner` &&
      plan.configPlace === `parent` &&
      replay !== undefined
    )
      states.add(`a failing owner replayed under its parent's config`)
    // A parent's config that defines test.projects: Vitest loads it, so the
    // run refuses as for the package's own (law 3).
    if (
      plan.fault === `projects` &&
      plan.configPlace === `parent` &&
      cli.exit !== 0
    )
      states.add(`refused projects in a parent's config`)
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
      if (m.operator === `return-undefined` && m.class === `not-distinguished`)
        states.add(`a returned value made undefined not distinguished`)
      if (m.operator === `optional-chain` && m.class === `not-distinguished`)
        states.add(`a plain read in place of ?. not distinguished`)
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
      if (m.function === `w_slowpair` && m.outcome === `timeout`)
        states.add(`confirmations past a mutant's budget timed out`)
      if (cli.heartbeats.some((beat) => beat.label === m.id))
        states.add(`a heartbeat named a busy mutant`)
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
      if (m.class === `extra-work`) states.add(`extra work`)
      if (m.outcome === `killed` && m.laws?.includes(`work bound`))
        states.add(`killed by a work bound`)
      // The same in a generated function, whose tests' bounds the plan
      // derives (measured: how often generated histories reach the law).
      const inGenerated = /^(?:f\d+|C\d\.)/.test(m.function ?? ``)
      if (inGenerated && m.class === `extra-work`)
        states.add(`extra work in a generated function`)
      if (
        inGenerated &&
        m.outcome === `killed` &&
        m.laws?.includes(`work bound`)
      )
        states.add(`killed by a work bound in a generated function`)
      // The early return whose extra work no test judges (law 4).
      if (
        m.operator === `if-false` &&
        m.class === `not-observed` &&
        m.function === `w_fastclocked`
      )
        states.add(
          `a work rise in tests that reach the clock by every path judged nothing`,
        )
      if (
        m.operator === `if-false` &&
        m.outcome === `killed` &&
        m.function === `w_fastturn`
      )
        states.add(`a work rise in a test that waited a turn killed`)
      if (
        m.operator === `if-false` &&
        m.class === `not-observed` &&
        m.function === `w_fastplain`
      )
        states.add(`a work rise on an unregistered route judged nothing`)
      if (m.class === `branch-never-taken`) states.add(`branch never taken`)
      if (m.class === `not-infected`) states.add(`not infected`)
      if (m.class === `not-observed`) states.add(`not observed`)
      // A survivor whose test observes a draw from Math.random: the copy
      // that ran the mutant drew what the original drew.
      if (m.function === `w_draws` && m.class === `not-observed`)
        states.add(`a draw from Math.random repeats in a mutant's copy`)
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
      if (plan.configPath === `vitest.config.ts`)
        states.add(`a config in vitest.config.ts ran`)
      if (plan.configPlace === `named`)
        states.add(`a config that --config names ran`)
      if (plan.configPlace === `none`)
        states.add(`a package with no config ran`)
      if (plan.configPlace === `parent`)
        states.add(`a package whose parent directory has its config ran`)
      if (plan.packageType === `commonjs` && plan.configAwait)
        states.add(`an awaiting config in a package with no module type ran`)
      // A CommonJS config that calls `require` and `require.resolve`: by
      // its extension, or as JavaScript or TypeScript in a package with no
      // module type.
      if (plan.configRequire && /\.c[jt]s$/.test(plan.configPath))
        states.add(`a .cjs or .cts config that calls require ran`)
      if (plan.configRequire && /(?<!\.[cm])\.[jt]s$/.test(plan.configPath))
        states.add(
          `a .js or .ts config in a package with no module type that calls require ran`,
        )
      if (plan.contexts > 10) states.add(`a run with eleven contexts`)
      if (
        plan.pragma &&
        cli.mutants.some(
          (m) =>
            m.outcome === `killed` && m.oracleFiles.includes(`tests/a.test.ts`),
        )
      )
        states.add(`a file whose pragma names another environment judged`)
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
      rmSync(scratch, { recursive: true, force: true })
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
      `the run wrote ${cli.strayWrites.join(`, `)} in the package outside its output directory`,
      `output namespace`,
    )
  // No run warns that its process leaks listeners (F15): each warm context
  // is a Vitest instance that listens on the process, and the runner
  // accounts for every one it holds.
  if (cli.warnings?.length > 0)
    return violation(
      `cli`,
      `the run warned: ${cli.warnings[0]}`,
      `process warnings`,
    )
  // A run whose contexts loaded its config names it once, or says it found
  // none, whether it then completes or refuses; a run refused before its
  // config loaded names none (law 3).
  if (JSON.stringify(cli.configLines) !== JSON.stringify(expected.configLines))
    return violation(
      `cli`,
      `the run named its config as ${JSON.stringify(cli.configLines)}, owed ${JSON.stringify(expected.configLines)}`,
      `config`,
      { actual: cli.configLines, expected: expected.configLines },
    )
  const stream = streamBreach(`cli`, cli, expected, plan)
  if (stream) return stream
  // Through the daemon, each check streams the same kinds of line, and a
  // completed one ends with its done line (law 15). The state of each step
  // differs, so its verdict and counts are judged by law 9's comparison.
  for (const { value } of observations.filter(
    (o) => o.checkpoint === `incremental`,
  )) {
    const { daemon, cold } = value
    const ends = endsBreach(daemon)
    if (ends)
      return violation(
        `incremental`,
        `through the daemon at ${value.step}: ${ends.difference}`,
        `greppable stream`,
        ends.extra,
      )
    // A refusal through the daemon prints the cold run's notes (review of
    // #46, F4): the notes of the session that failed reach the CLI.
    if (
      cold.exit !== 0 &&
      daemon.exit === cold.exit &&
      JSON.stringify(daemon.stream.notes) !== JSON.stringify(cold.notes)
    )
      return violation(
        `incremental`,
        `the refusal through the daemon at ${value.step} prints the notes ${JSON.stringify(daemon.stream.notes)}, and the cold run ${JSON.stringify(cold.notes)}`,
        `greppable stream`,
        { actual: daemon.stream.notes, expected: cold.notes },
      )
    if (daemon.stream.mutantBeforeVerdict)
      return violation(
        `incremental`,
        `through the daemon at ${value.step}, a line about a mutant came before the decisive baseline line`,
        `greppable stream`,
      )
  }
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
  // A heartbeat names what its busy copy runs: a mutant, and a test file
  // that runs it (an owner file whose tests reached it, an ordinary file for
  // the ordinary tier, any oracle file for an authored mutant), or the
  // baseline and a test file. Each mutant whose run reaches a slow owner
  // test keeps a copy busy past the interval, so a heartbeat names it.
  const byId = new Map(cli.mutants.map((m) => [m.id, m]))
  for (const beat of cli.heartbeats) {
    const m = byId.get(beat.label)
    const runsIt =
      beat.label === `baseline`
        ? /^tests\/[abc]\.test\.ts$/.test(beat.file)
        : m?.authored
          ? /^tests\/\w+\.test\.ts$/.test(beat.file) &&
            beat.file !== `tests/c.test.ts`
          : [...(m?.oracleFiles ?? []), ...(m?.ordinaryFiles ?? [])].includes(
              beat.file,
            )
    if (!runsIt)
      return violation(
        `cli`,
        `a heartbeat names ${beat.label} in ${beat.file}, which does not run it`,
        `streaming`,
        { actual: beat },
      )
  }
  for (const [owed, got] of pairs)
    if (owed.heartbeat && !cli.heartbeats.some((beat) => beat.label === got.id))
      return violation(
        `cli`,
        `${site(got)}: no heartbeat named it while its slow owner test ran`,
        `streaming`,
        { actual: cli.heartbeats, expected: got.id },
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
  // Law 13, and law 10's namespace while a run runs: a stopped run had
  // written nothing beside its output directory and the package's
  // `.oracle-gaps` (where Vitest's include could find it), and once the CLI
  // ends, no process the run started is left.
  // A stopped run may leave its session directory, and only that; the next
  // run removes it (maintainer decision, 2026-11-11).
  const stops = observations.filter((o) => o.checkpoint === `stopped`)
  for (const { value } of stops) {
    if (value.left?.length > 0)
      return violation(
        `stopped`,
        `the stopped run left ${value.left.join(`, `)} in the package`,
        `output namespace`,
      )
    if (value.sessions?.kept > 0)
      return violation(
        `stopped`,
        `the run after a stopped one left ${value.sessions.kept} of its session directories in the package`,
        `output namespace`,
      )
  }
  for (const { value } of observations.filter(
    (o) => o.checkpoint === `stopped`,
  )) {
    const how = `${value.signal}, workers as ${value.pool}`
    if (value.strayWhileRunning.length > 0)
      return violation(
        `stopped`,
        `while it ran, the run had written ${value.strayWhileRunning.join(`, `)} in the package outside its output directory`,
        `output namespace`,
        { actual: value.strayWhileRunning, expected: [] },
      )
    if (!value.ended)
      return violation(
        `stopped`,
        `the CLI did not end within 30 s of ${how}`,
        `stopping`,
      )
    if (value.survivors > 0)
      return violation(
        `stopped`,
        `${value.survivors} of the processes the run started outlived the CLI (${how})`,
        `stopping`,
        { actual: value.survivors, expected: 0 },
      )
    // A stopped run ends both streams with its stopped line, and one that
    // had printed its completed line ends as it completed (law 15).
    const ends = value.spun ? endsBreach(value) : undefined
    if (ends)
      return violation(
        `stopped`,
        `the run sent ${how}${value.when === `run` ? `` : ` (${value.when})`}: ${ends.difference}`,
        `greppable stream`,
        ends.extra,
      )
    const owedEnd =
      value.when === `after`
        ? `oracle-gaps: done completed`
        : value.when === `abort`
          ? `oracle-gaps: done error, the run's process exited with SIGABRT`
          : `oracle-gaps: done stopped (${value.signal})`
    if (value.spun && value.when === `warm` && value.refused)
      return violation(
        `stopped`,
        `the run stopped while its config warmed reported a refusal`,
        `greppable stream`,
      )
    if (value.spun && !value.stream.last.startsWith(owedEnd))
      return violation(
        `stopped`,
        `the stopped run's last line is ${JSON.stringify(value.stream.last)}, not ${owedEnd}`,
        `greppable stream`,
      )
  }
  const lead = leadBreach(plan, cli, observations, expected)
  if (lead) return lead
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

/**
 * Law 15: the stream's lines are greppable. Every line a run writes to
 * stderr is a line of one of the stream's kinds, `oracle-gaps: <kind> `
 * (config, note, baseline, blocked, progress, gap, busy, done), an indented
 * line under a baseline failure, a refusal's block, or a line Node writes
 * for the process. A run that judges mutants prints its one decisive
 * baseline line before any gap line, count of judged mutants, or heartbeat
 * that names a mutant, and its stdout prints each gap once, on a line of
 * the gap kind. The ends of a run (`oracle-gaps: done …`) are judged with
 * the lead (completed), the refusal law (refused), and the stop law
 * (stopped). `run` is a run as readRun records it, observed at
 * `checkpoint`.
 */
function streamBreach(checkpoint, run, expected, plan) {
  const breach = (difference, extra) =>
    violation(checkpoint, difference, `greppable stream`, extra)
  const ends = endsBreach(run)
  if (ends) return breach(ends.difference, ends.extra)
  if (run.stream.mutantBeforeVerdict)
    return breach(
      `a line about a mutant came before the decisive baseline line`,
    )
  if (run.exit !== 0 || expected.refused) return undefined
  // A note names the log once the run captured its tests' console output
  // (review of #46, F2; re-review N2), and only then. File a's test that
  // writes to the process's streams runs once file a loads, so its output
  // must be captured; a setup file that throws fails every file before any
  // test runs, and a file a with no such test writes nothing.
  const writes =
    plan.consoleOutput &&
    expected.baseline.find((b) => b.file === `tests/a.test.ts`)?.loads
  if (writes && !run.captured)
    return breach(
      `file a's test wrote to the console, and the run captured none of it`,
    )
  const outputNotes = run.stream.notes.filter((note) =>
    /^oracle-gaps: note test output in \S+test-output\.log$/.test(note),
  )
  const owedNotes = run.captured ? 1 : 0
  if (outputNotes.length !== owedNotes)
    return breach(
      `the run names its tests' console output in ${outputNotes.length} notes, owed ${owedNotes} (captured: ${run.captured}): ${JSON.stringify(run.stream.notes)}`,
    )
  const verdict = verdictLine(
    expected.baseline.filter((b) => !b.ordinary).length,
    expected.blocking.length,
  )
  if (JSON.stringify(run.stream.verdicts) !== JSON.stringify([verdict]))
    return breach(
      `the stream's decisive baseline lines are ${JSON.stringify(run.stream.verdicts)}, owed ${JSON.stringify([verdict])}`,
      { actual: run.stream.verdicts, expected: [verdict] },
    )
  if (run.stdoutGaps !== expected.gaps.length)
    return breach(
      `the stdout has ${run.stdoutGaps} gap lines for ${expected.gaps.length} gaps`,
    )
  return undefined
}

/**
 * What law 15 judges of every run, on both streams, whatever its outcome:
 * no stray line, and exactly one done line, which ends each stream, the
 * same on both, of the kind its exit status says (0 completed, 2 refused,
 * 3 error, and a signal's code stopped). Undefined when it holds.
 */
function endsBreach(run) {
  const streams = [
    [`stderr`, run.stream],
    [`stdout`, run.stdoutStream],
  ]
  for (const [where, stream] of streams)
    if (stream.strays.length > 0)
      return {
        difference: `the run wrote a line on ${where} that is not a line of the stream: ${stream.strays[0]}`,
        extra: { actual: stream.strays, expected: [] },
      }
  for (const [where, stream] of streams)
    if (stream.dones !== 1 || !stream.last.startsWith(`oracle-gaps: done `))
      return {
        difference: `${where} has ${stream.dones} done lines and ends with ${JSON.stringify(stream.last)}`,
      }
  if (run.stream.last !== run.stdoutStream.last)
    return {
      difference: `stderr ends with ${JSON.stringify(run.stream.last)} and stdout with ${JSON.stringify(run.stdoutStream.last)}`,
    }
  const kind = run.stream.last
    .slice(`oracle-gaps: done `.length)
    .match(/^\w+/)?.[0]
  const owed =
    { 0: `completed`, 2: `refused`, 3: `error` }[run.exit] ?? `stopped`
  if (kind !== owed)
    return {
      difference: `the run exited ${run.exit} and its done line says ${kind}, not ${owed}`,
    }
  return undefined
}

/**
 * Law 14: the report leads with the baseline. The stdout opens with each
 * test file's result and its test counts, a failing file's failing test and
 * its error, and a line for each failing oracle file that names it, its
 * failing test, and the step that unblocks the mutants it owns; then, when
 * an oracle file failed, the provisional status with how many mutants are
 * blocked. Its last line says the check completed, with its gap count. A
 * failing owner's replay runs exactly its failing test. A partial run
 * (`--only`) runs the baseline of the selected mutants' owners alone, and
 * judges each selected mutant as the full run does.
 */
function leadBreach(plan, cli, observations, expected) {
  const span = (text) => `\` ${text} \``
  const counted = (n, thing) => `${n} ${thing}${n === 1 ? `` : `s`}`
  const breach = (difference) =>
    violation(`cli`, difference, `baseline lead`, { actual: cli.lead })
  for (const b of expected.baseline) {
    const name = `${b.file}${b.ordinary ? ` (ordinary)` : ``}`
    const at = cli.lead.findIndex(
      (line) =>
        line.startsWith(`oracle-gaps: baseline pass ${name}: `) ||
        line.startsWith(`oracle-gaps: baseline fail ${name}: `),
    )
    if (at < 0) return breach(`the stdout gives no baseline line for ${name}`)
    const owed = !b.loads
      ? `oracle-gaps: baseline fail ${name}: did not load: `
      : b.failed > 0
        ? `oracle-gaps: baseline fail ${name}: ${b.failed} of ${counted(b.ran, `test`)} failed`
        : `oracle-gaps: baseline pass ${name}: ${counted(b.ran, `test`)}${b.skipped > 0 ? `, ${b.skipped} skipped` : ``}`
    if (b.loads ? cli.lead[at] !== owed : !cli.lead[at].startsWith(owed))
      return breach(
        `the baseline line of ${name} is ${cli.lead[at]}, owed ${owed}`,
      )
    if (
      b.test !== undefined &&
      cli.lead[at + 1] !== `  failing: ${span(b.test)}: ${span(b.error)}`
    )
      return breach(
        `the baseline of ${name} does not name its failing test ${b.test} and its error`,
      )
  }
  // The one decisive baseline line (law 15): every oracle file passed, or
  // how many failed.
  const verdict = verdictLine(
    expected.baseline.filter((b) => !b.ordinary).length,
    expected.blocking.length,
  )
  const verdicts = cli.lead.filter((line) => baselineVerdict.test(line))
  if (verdicts.length !== 1 || verdicts[0] !== verdict)
    return breach(
      `the stdout's decisive baseline lines are ${JSON.stringify(verdicts)}, owed ${JSON.stringify([verdict])}`,
    )
  const blocked = cli.lead.filter((line) =>
    line.startsWith(`oracle-gaps: blocked `),
  )
  if (blocked.length !== expected.blocking.length)
    return breach(
      `${blocked.length} blocked lines for ${expected.blocking.length} failing oracle files`,
    )
  for (const f of expected.blocking) {
    const at = f.test === undefined ? `` : ` at ${span(f.test)}`
    const line = `oracle-gaps: blocked ${span(`tests/${f.file}.test.ts`)} fails with no mutant active${at}, `
    if (
      !blocked.some(
        (l) => l.startsWith(line) && l.endsWith(`then check again.`),
      )
    )
      return breach(
        `no blocked line names tests/${f.file}.test.ts, its failing test, and the step that unblocks it`,
      )
  }
  const blockedCount = expected.entries.filter(
    (e) => e.kind === `blocked`,
  ).length
  const provisional = cli.lead.filter((line) =>
    line.startsWith(`oracle-gaps: note provisional: `),
  )
  if (
    provisional.length !== (expected.blocking.length > 0 ? 1 : 0) ||
    (provisional[0] !== undefined &&
      !provisional[0].startsWith(
        `oracle-gaps: note provisional: ${counted(blockedCount, `mutant`)} `,
      ))
  )
    return breach(
      `the stdout does not say that the report is provisional, with ${blockedCount} blocked mutants`,
    )
  const done = doneLine(
    expected.gaps.length,
    expected.blocking.length > 0,
    cli.outDir,
  )
  if (cli.lastLine !== done)
    return violation(
      `cli`,
      `the last stdout line is ${JSON.stringify(cli.lastLine)}, not ${JSON.stringify(done)}`,
      `baseline lead`,
    )
  // The failing owner's replay runs exactly its failing test (law 3).
  if (expected.replayed) {
    const replay = observations.find((o) => o.checkpoint === `replay`)?.value
    if (JSON.stringify(replay?.ran) !== JSON.stringify(expected.replayed))
      return violation(
        `replay`,
        `the replay command ${JSON.stringify(replay?.command)} ran ${JSON.stringify(replay?.ran)}, owed only ${JSON.stringify(expected.replayed)}`,
        `ownership`,
        { actual: replay?.ran, expected: expected.replayed },
      )
  }
  const partial = observations.find((o) => o.checkpoint === `partial`)?.value
  if (partial) {
    if (partial.exit !== 0)
      return violation(
        `partial`,
        `the partial run exited ${partial.exit}`,
        `completion`,
      )
    const owners = ownersOf(plan)
    const fnIds = new Set(
      expected.mutants
        .filter(
          (m) => m.function === partial.function && m.source === partial.source,
        )
        .map((m) => m.fnId),
    )
    const files = [...new Set([...fnIds].flatMap((id) => [...owners(id)]))]
      .filter((file) => file !== `c`)
      .map((file) => `tests/${file}.test.ts`)
    if (plan.ordinary) files.push(`tests/c.test.ts`)
    if (
      JSON.stringify([...partial.baselineFiles].sort()) !==
      JSON.stringify(files.sort())
    )
      return violation(
        `partial`,
        `the partial run of ${partial.function} ran the baseline of ${JSON.stringify(partial.baselineFiles)}, owed its owners ${JSON.stringify(files)}`,
        `baseline lead`,
        { actual: partial.baselineFiles, expected: files },
      )
    const full = new Map(cli.mutants.map((m) => [m.key, m.class ?? m.outcome]))
    const differs = partial.mutants.find((m) => full.get(m.key) !== m.kind)
    if (differs)
      return violation(
        `partial`,
        `the partial run judged ${differs.key} ${differs.kind}, and the full run ${full.get(differs.key)}`,
        `baseline lead`,
      )
  }
  return undefined
}

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
    // A refused run that says it completed: exit 0, and the completed done
    // line that ends both its streams (law 15's shape of a completion), so
    // only the law that the run must refuse rejects it.
    corrupt: corruptCli((cli) => {
      if (cli.exit === 0) return undefined
      const done = `oracle-gaps: done completed, 0 gaps, report ${cli.outDir.replaceAll(`\\`, `/`)}/summary.md`
      const completed = (stream) => ({ ...stream, last: done, dones: 1 })
      return {
        ...cli,
        exit: 0,
        stream: completed(cli.stream),
        stdoutStream: completed(cli.stdoutStream),
      }
    }),
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
    // A CLI that never prints one gap: the summary drops it from its keys,
    // its entries, and its count, and the stream drops its line, while
    // results.json keeps the mutant as a gap. The report agrees with itself,
    // so streaming (law 11, which compares the stream with the summary) holds,
    // and only law 7, which compares the summary with the model, can see it.
    // Dropping the key from the summary alone, as this calibration first did,
    // is a law 11 violation too, and since the streaming check was added
    // (#12) that check rejects it first, so law 7 was never calibrated.
    corrupt: corruptCli((cli) => {
      if (cli.exit !== 0 || cli.gaps.length === 0) return undefined
      // Keys are unique (law 6), so filtering by the key drops one gap.
      const [key] = cli.gaps
      cli.gaps = cli.gaps.filter((k) => k !== key)
      cli.streamed = cli.streamed.filter((k) => k !== key)
      cli.entries = cli.entries.filter((e) => e.key !== key)
      if (cli.counts) cli.counts.gaps -= 1
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

// Laws 10, 11, and 13 on what a run does while it runs. Each changes a
// trace that holds the observation, so a check that cannot see the
// difference passes it.
const corruptStopped = (change) => (trace) => {
  const index = trace.findIndex(
    (o) => o.checkpoint === `stopped` && o.value.spun,
  )
  if (index < 0) return undefined
  const value = change(structuredClone(trace[index].value))
  return trace.map((o, i) => (i === index ? { ...o, value } : o))
}
calibrations.push(
  {
    name: `a stopped run leaves a process it started running`,
    law: `stopping`,
    corrupt: corruptStopped((value) => ({ ...value, survivors: 1 })),
  },
  {
    name: `a stopped run had written a copy beside the tests`,
    law: `output namespace`,
    corrupt: corruptStopped((value) => ({
      ...value,
      strayWhileRunning: [`tests/.oracle-gaps-1-1-a.test.ts`],
    })),
  },
  {
    name: `a busy mutant is named in no heartbeat`,
    law: `streaming`,
    corrupt: corruptCli((cli) =>
      cli.exit !== 0 || cli.heartbeats.length === 0
        ? undefined
        : { ...cli, heartbeats: [] },
    ),
  },
  {
    name: `a heartbeat names a file that does not run its mutant`,
    law: `streaming`,
    corrupt: corruptCli((cli) => {
      const beat = cli.heartbeats.find((b) => b.label !== `baseline`)
      if (cli.exit !== 0 || !beat) return undefined
      return {
        ...cli,
        heartbeats: [{ ...beat, file: `tests/elsewhere.test.ts` }],
      }
    }),
  },
  // Law 15: a line without the stream's prefix, the decisive baseline line
  // after a mutant's line, a completed run that ends with the old
  // completion line, and a stopped run that ends with no done line.
  {
    name: `a streamed line has no prefix`,
    law: `greppable stream`,
    corrupt: corruptCli((cli) => ({
      ...cli,
      stream: { ...cli.stream, strays: [`judged 25 of 100 mutants`] },
    })),
  },
  {
    name: `the decisive baseline line comes after a mutant's line`,
    law: `greppable stream`,
    corrupt: corruptCli((cli) =>
      cli.exit !== 0
        ? undefined
        : { ...cli, stream: { ...cli.stream, mutantBeforeVerdict: true } },
    ),
  },
  {
    name: `a completed run ends without its done line`,
    law: `baseline lead`,
    corrupt: corruptCli((cli) =>
      cli.exit !== 0 ? undefined : { ...cli, lastLine: `completed: 3 gaps` },
    ),
  },
  {
    name: `a raw line reaches the stdout`,
    law: `greppable stream`,
    corrupt: corruptCli((cli) => ({
      ...cli,
      stdoutStream: {
        ...cli.stdoutStream,
        strays: [`raw stdout from a test`],
      },
    })),
  },
  {
    name: `a run ends with two done lines`,
    law: `greppable stream`,
    corrupt: corruptCli((cli) => ({
      ...cli,
      stream: { ...cli.stream, dones: 2 },
    })),
  },
  {
    name: `a refusal through the daemon drops the cold run's notes`,
    law: `greppable stream`,
    // A config the session cannot load, checked cold and through the
    // daemon: its notes are Vite's.
    history: { constructed: `a declaration fault: configThrows` },
    corrupt: (trace) => {
      const index = trace.findIndex(
        (o) =>
          o.checkpoint === `incremental` &&
          o.value.cold.exit !== 0 &&
          o.value.cold.notes.length > 0,
      )
      if (index < 0) return undefined
      const value = structuredClone(trace[index].value)
      value.daemon.stream.notes = []
      return trace.map((o, i) => (i === index ? { ...o, value } : o))
    },
  },
  {
    // A note whenever file a loads, whether or not a test wrote (re-review
    // N2).
    name: `a run names a test-output log it never captured`,
    law: `greppable stream`,
    history: { constructed: `a load failure beside a hang` },
    corrupt: corruptCli((cli) =>
      cli.exit !== 0 || cli.captured
        ? undefined
        : {
            ...cli,
            stream: {
              ...cli.stream,
              notes: [
                ...cli.stream.notes,
                `oracle-gaps: note test output in <package>/<out>/test-output.log`,
              ],
            },
          },
    ),
  },
  {
    name: `a stopped run ends without its done line`,
    law: `greppable stream`,
    corrupt: corruptStopped((value) => ({
      ...value,
      stream: { ...value.stream, last: `` },
    })),
  },
)

// Law 9's states: reuse, a mix of reuse and recomputation, reuse from disk
// after a restart, and each content edit changing the cold result, without
// which a stale cache would match the cold run by chance.
const incrementalStates = [
  `incremental check reused evidence`,
  `incremental check reused some evidence and recomputed some`,
  `evidence reused after a daemon restart`,
  `a revert of a file edit reran nothing`,
  ...edits
    .filter(
      (edit) =>
        !daemonEvents.has(edit) && edit !== `fixSession` && edit !== `lazy`,
    )
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
  `a check after the OS cleaned the daemon's state`,
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
  `extra work`,
  `killed by a work bound`,
  `a work rise in tests that reach the clock by every path judged nothing`,
  `a work rise in a test that waited a turn killed`,
  `a work rise on an unregistered route judged nothing`,
  `branch never taken`,
  `not infected`,
  `not observed`,
  `a draw from Math.random repeats in a mutant's copy`,
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
  `blocked by brokenOwner`,
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
  `a returned value made undefined not distinguished`,
  `a plain read in place of ?. not distinguished`,
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
  `confirmations past a mutant's budget timed out`,
  `a heartbeat named a busy mutant`,
  `a run stopped by SIGTERM while a worker spun`,
  `a run stopped by SIGINT while a worker spun`,
  `a stop signal after the completed line`,
  `a stop signal while the config warms`,
  `a run whose process aborted`,
  `a config refusal through the daemon`,
  `a completed run whose tests wrote nothing`,
  `a stopped run whose workers are child processes`,
  `a stopped run whose workers are threads`,
  `a run after a stopped one that left its session`,
  `a batch cut off by a hang reran the rest`,
  `a config exported as an async function ran`,
  `a config in vitest.config.ts ran`,
  `a config that --config names ran`,
  `a package with no config ran`,
  `a package whose parent directory has its config ran`,
  `a failing owner replayed under its parent's config`,
  `refused projects in a parent's config`,
  `an awaiting config in a package with no module type ran`,
  `a .cjs or .cts config that calls require ran`,
  `a .js or .ts config in a package with no module type that calls require ran`,
  `a run with eleven contexts`,
  `a file whose pragma names another environment judged`,
  `a second daemon check of the budget witness's state`,
  `a failing owner replayed under a config that --config names`,
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
  `a refused run whose package lies inside the CLI's directory`,
  `analyzed noTypescript`,
  `analyzed apiLessTypescript`,
  `refused brokenVitest`,
  `refused configThrows`,
  `refused configNoDefault`,
  `refused configNull`,
  `refused configSyntax`,
  `blocked by setupThrows`,
  `a partial run of one function`,
  `a partial run beside a failing owner`,
  `edit fixSession changed the cold result`,
  `a check after the session's failure was fixed`,
  `two checks at once on a session that cannot open`,
  `a session failure larger than a socket buffer`,
  `a config fault in a run that owns nothing`,
  ...incrementalStates,
  `a timed-out run reused after an edit`,
  `an edit that changed the cold result after a hang replaced the only context`,
  `edit lazy changed the cold result`,
  `a lazy edit changed the cold result after a batch was cut off`,
]
// The faults the CLI analyzes anyway: a package's TypeScript is no input.
const analyzedFaults = [`noTypescript`, `apiLessTypescript`]
// The faults that fail test files with no mutant active, which block the
// mutants those files own and refuse nothing (law 14).
const blockingFaults = [`brokenOwner`, `setupThrows`]
// The faults found when the package's Vitest and config load, before the
// analysis.
const configFaults = [
  `brokenVitest`,
  `projects`,
  `configThrows`,
  `configNoDefault`,
  `configNull`,
  `configSyntax`,
]
// The config faults whose refusal is also checked through the daemon.
const daemonConfigFaults = [
  `configThrows`,
  `configNoDefault`,
  `configNull`,
  `configSyntax`,
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
  `configNull`,
  `configSyntax`,
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
  `a config refusal through the daemon`,
  `a completed run whose tests wrote nothing`,
  ...faults
    .filter(
      (fault) =>
        !analyzedFaults.includes(fault) && !blockingFaults.includes(fault),
    )
    .map((fault) => `refused ${fault}`),
  ...blockingFaults.map((fault) => `blocked by ${fault}`),
  `a partial run of one function`,
  `a partial run beside a failing owner`,
  ...analyzedFaults.map((fault) => `analyzed ${fault}`),
  `edit fixSession changed the cold result`,
  `a check after the session's failure was fixed`,
  `two checks at once on a session that cannot open`,
  `a session failure larger than a socket buffer`,
  `a config fault in a run that owns nothing`,
  `a refused run whose package lies inside the CLI's directory`,
  // The config and contexts states have constructed histories of their own.
  `a config that --config names ran`,
  `a package with no config ran`,
  `a package whose parent directory has its config ran`,
  `a failing owner replayed under its parent's config`,
  `refused projects in a parent's config`,
  `an awaiting config in a package with no module type ran`,
  `a .cjs or .cts config that calls require ran`,
  `a .js or .ts config in a package with no module type that calls require ran`,
  `confirmations past a mutant's budget timed out`,
  `a second daemon check of the budget witness's state`,
  `a run with eleven contexts`,
  `a failing owner replayed under a config that --config names`,
  ...incrementalStates,
  `a timed-out run reused after an edit`,
  `an edit that changed the cold result after a hang replaced the only context`,
  `edit lazy changed the cold result`,
  `a lazy edit changed the cold result after a batch was cut off`,
]
const witnessed = required.filter((s) => !separate.includes(s))

// A constructed history builds from a generated base whose first function is
// owned by file a (one owned function, not a whole file), so a random
// `ownerless` or an all-unowned base cannot refuse a state it names. Where
// its `owns` is written alternates between a wrapper's call and
// `oracleProperty` across the list, so both forms reach the states they name;
// a build that names a declaration (`neither`, `both`) keeps it.
const withDeclaration = (constructed) =>
  constructed.map((item, index) => ({
    ...item,
    build: (generated) =>
      item.build({
        ...generated,
        declaration: index % 2 === 0 ? `wrapper` : `oracleProperty`,
        ownerless: false,
        owners: [`a`, ...generated.owners.slice(1)],
      }),
  }))

oracleProperty({
  id: `oracle-gaps.report`,
  law: {
    statement: `The gap report enumerates the promised operator mutants, leaves out exactly the probe-only code, discovers every oracle that owns a function's call tree and refuses broken ownership, judges each mutant only by its owners' tests on their registered routes and counts only law verdicts on reproducible routes as kills, which outrank a run that never ends, anchors each mutant by its function and normalized statement, lists every gap and unowned mutant once with consistent counts, keeps keys stable under unrelated edits, reports through one daemon per package what a cold run reports at every state of a sequence of edits, and bounds the runs that confirm a mutant's cut-off copies by one budget per mutant and names each busy mutant in a heartbeat while it runs, leaves nothing in the package and writes nothing where Vitest's include could find it while it runs, leaves no process running once it is stopped, runs the package as Vitest does from any install path and any --source spelling: one instance of each workspace dependency, no refusal over an unbuildable devDependency, child processes for a native addon anywhere in the tree, a capture that a test's builtin spies cannot see, and a refusal of test.projects; leads its report with every test file's baseline, blocks only the mutants a failing oracle file owns and judges the rest, prints every line of its stream with the prefix oracle-gaps: and its kind, one decisive baseline line before any mutant, and a done line last, and every run that does not complete ends, cold or through the daemon, with a refusal that exits 2, prints a refused: block and one fix: directive with no stack trace, and writes the refusal to the run's output directory.`,
    authority: `The maintainer's decisions in design runs v11, v14, and v19 (2026-11-04 and 2026-11-05), not in this package's records, including that a kill by reach agreement alone is a gap and that an incremental run through the daemon equals a cold one (v19.3); the project's oracle guide on quiet exclusions; the oracle rubric's outcome kinds (ORC-006); the CLI's documented operator list in schemata.mjs; the maintainer's dispositions G1, G2, G4, G5, G6, and G13 of the framework papercut ledger (2026-11-11) and the v20 freeze's namespacing, one-loop, and provisional-report decisions (2026-11-10); the maintainer's request for a greppable stream (2026-11-12, relayed by the coordinator with its decisions of that day: the same prefixes on stdout and stderr, a done line for a stopped run, and no --max-gaps).`,
    limits: `Law 12 judges refusals only: no legal history reaches an internal error, so its shape (exit 3, the stack in error.log) is not judged; argument refusals are the static oracle's; the check's rejection of a stack trace, a missing fix, and a wrong exit code is calibrated in the static oracle, through the same refusalBreach, and here only a refused run reported as complete is calibrated, because each calibration here runs real CLI histories. Hangs only as an owner test that awaits a promise that never settles, under a 1 s first budget and a 20 s full limit, and a slow run only as two witnesses whose tests wait where the output changed, 3 s in one that then judges and 10 s in two one-test owners of one that does not; busy loops only on instrumented code (cut by the call budget), no slow runs past the full limit that would end, hangs in ordinary or nondeterministic tests, setup errors other than a throw at module load, loops, multi-line conditions, two functions on one line, or await, new, and void statements; nested functions, object-literal methods, accessors, and class-field arrows only where no test calls them (their ownership is the static oracle's); two source files of one package, with no re-exports, namespace imports, or calls into another package; --only only in a stopped run and a partial run of one function's mutants, and no --sample or --diff-base; the baseline's failures only as one failing owner test that throws an error and a setup file that throws, so a baseline law violation's law and counterexample lines are the classify oracle's; a derived class's file is instrumented and its sites are judged as unowned, but no test imports or constructs the class, so its no-mutant and super-region behavior is the static oracle's (in-process), not this oracle's; package configs only as vite.config or vitest.config with one of the extensions .ts, .mts, .cts, .js, .mjs, and .cjs (not every pair), as config/gap-vitest with the same extension through --config, or none, as an object or a sync or async function, with no plugins of their own and test.projects only as a refusal, and only under the package's own package.json; a top-level await only in an ES module config and require only in a CommonJS one, as Vitest itself loads no other; a --config outside the package is refused by design, through the rule for paths outside the package (args.mjs), and no history generates one; contexts only one, four, or eleven, and process warnings judged only as MaxListenersExceededWarning on the CLI's own stderr (a daemon's process warnings go to its log); a context that fails to open gives back its listener allowance, which no observation shows (a kept allowance only raises the limit, so no warning follows), so that accounting is fixed by inspection; no probe-bound states, so reach agreement's killing of probe mutants is not checked; no gap answers or gate; law 9 judges the witness module's outcome classes along one constructed edit sequence only (a test edit, a helper edit, and a revert), and the budget witness's along one constructed second check with nothing changed, because a generated history with the witness module or the budget witness takes no steps (maintainer decision, 2026-11-11, and the runtime review's P1-a, 2026-11-12; this oracle owns the gap); law 9's edits come only between checks, so a file saved during a check is not generated (the runner invalidates a known input that changed while a run ran and does not store that run, which only inspection fixes; a witness needs a step that edits a file between a unit's start and its end), and a module that a run first loads and that changes during that same run is stored under its later hash; law 9's edits leave out files read through fs, other environment variables, new files that change how an unchanged import resolves, Vite config and installed-package changes, and concurrent checks other than two that start the daemon; cut-off charging judged only under one budget; native addons only as a binding.gyp or a prebuilt .node file, not as optional platform packages; daemon races (two CLIs reading one error file, a CLI hearing closing from the failing daemon it started, a reset connection on macOS) fixed by inspection; the runner's copies of the test files exist only in memory, and its harness and Vitest configs sit in the package's .oracle-gaps-<pid>, which the next run removes once a killed run has left it (judged after two stopped runs, not after a SIGKILL); a default --out is judged by the static oracle, and these runs name --out in the package; the namespace is checked after each run and, in a stopped run, while the run runs; a slow kill in a later owner, after earlier owners' confirmations spent the budget, becomes a timeout (owner order; not generated); the Vitest 5 path of the copies' pragma read and of the runner is verified from Vitest 5's source only, since the Vitest 5 CI job runs no gap oracle; a batch whose run reports an error outside any test reruns each copy alone (unitsBatch, runAlone) with its first budget, and a copy cut there is kept as a timeout with no confirmation, a defect older than this oracle's budget work that no history reaches (no history has an error outside any test beside a slow copy), recorded here with that trace for the maintainer; stale-session removal is scoped to this host's session directories (a host file), and is not judged across pid namespaces; the stop law covers SIGTERM and SIGINT sent to the CLI, not a SIGKILL of the CLI (its group then ends at the next check of its parent, by inspection) or a signal sent to the daemon, and its witness is one test that spins synchronously and starts one child process; the mutant budget is witnessed as two slow owners whose confirmations pass the --mutant-limit floor, not through its multiple of the owners' unmutated time, and authored mutants have no confirmations to budget; the witness w_slowpair is a wall-clock window, since the CLI's budget has no controlled clock and a fixture cannot see the time the CLI measures for its file: with one-test owner files p and q of measured unmutated time t each (a file first in its context pays the instrumented transform too), a wait W of 10 s, a 20 s --hang-limit and a 15 s --mutant-limit, it tells a budget from none only while (a) its first attempt is cut, W > 1 s + 3t, (b) its two confirmations do not fit the budget, 2W > max(15 s, 10 x 2t), and (c) each would fit its own full limit, W < 20 s + 3t; (b) is the binding one, so it holds while the two files' time stays under about 2 s together (about 1 s each, some 20 times the authoring machine's idle and 5 to 10 times its loaded measurements), and under one budget a run's overhead must stay under 10 s + 3t; CI runners measure 1.5 to 2.3 times the idle machine; beyond that w_slowpair would read not-judged; a heartbeat is owed only where a slow test waits 3 s against a 2 s interval, twice the first budget, so that no copy cut at its first budget beats, and each beat is observed as its mutant and file, not how long or how often it beat; a config only in the package's parent directory is generated one level up, in a temporary directory with no package.json (so its .js or .ts name is CommonJS), as a plain config, one that throws, one with no default export, or one that defines test.projects; a config two or more levels up, or a parent config beside a package config, is not generated, and the order in one directory follows Vitest's configFiles list by inspection; a package with no config lives in a temporary directory, where no parent has a config; a counterexample shrinks through at most six histories, so it can be larger than the smallest that fails; module-level data only as four \`const\` declarations of the main source (an object literal, an array that holds a function, a boolean, and an object of two methods), read in place, with no data imported from another file, destructured, reassigned, or declared as an enum or a default export; the work law only through shortcut witnesses (an early return before a counting loop with a bound twin of ratio 2, and a push beside one that calls String with a bound twin of ratio 1), the early return in tests that reach the clock by each watched path and in tests that wait a turn, a generated test's bound of 1 derived from its plan (which no generated function's mutant reached in the 36 fixed-seed units), and one warm-cache witness whose selection reproduces observations but not work; work is the capture's count of site evaluations per test, so code with no site (a plain assignment, a for...of pass, a builtin's own work) counts nothing and a test's histories are summed, and a test whose work varies between the unmutated runs while its observations agree is not generated.`,
  },
  histories: {
    // A failing history shrinks through at most six smaller ones. Each runs
    // the real CLI, through the daemon too, about thirty times (some 20 s,
    // a minute with hangs), so unbounded shrinking outlasts the 900 s test
    // limit, and the campaign would end in a timeout, not in the law
    // verdict its first failure holds. The counterexample is the smallest
    // of those seven histories, its law the first failure's.
    arbitrary: fc.limitShrink(histories, 6),
    states: required,
    measured: [
      ...staticStates,
      `extra work in a generated function`,
      `killed by a work bound in a generated function`,
    ],
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
          configPlace: `discovered`,
          packageType: `module`,
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
          // Oracle file a names its own environment in a pragma (law 10).
          pragma: true,
          // Stopped while the stop witness spins, once by each signal and
          // in each pool (law 13).
          stopRuns: [
            { signal: `SIGTERM`, pool: `forks`, when: `run` },
            { signal: `SIGINT`, pool: `threads`, when: `run` },
            { signal: `SIGINT`, pool: `threads`, when: `after` },
            { signal: `SIGINT`, pool: `threads`, when: `warm` },
            { signal: `SIGINT`, pool: `threads`, when: `abort` },
          ],
          // File a writes to the console, so the run captures it.
          consoleOutput: true,
        }),
      },
      {
        // The budget witness checked through the daemon twice with nothing
        // changed between: the second check reuses the confirmations the
        // first ran, and must report what a cold run reports (law 9, with
        // the budget of law 4).
        name: `a second daemon check of the budget witness`,
        enters: [
          `a second daemon check of the budget witness's state`,
          `confirmations past a mutant's budget timed out`,
        ],
        build: (generated) => ({
          ...generated,
          functions: [[{ kind: `push`, quote: `'` }]],
          containers: [],
          overloads: [],
          owners: [`a`],
          library: [],
          libraryOwners: [],
          runes: [],
          wholeFile: `none`,
          witness: `budget`,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: budgetSteps,
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
          `a completed run whose tests wrote nothing`,
        ],
        build: (generated) => ({
          ...generated,
          // No test writes to the console: no log, and no note.
          consoleOutput: false,
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
            // File b's function is unowned under the second config.
            `config`,
            `config`,
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
            // The OS cleans the daemon's state while the daemon runs, after
            // the restart's check reused evidence from disk.
            `cleanState`,
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
      // The config the run loads (F12, F13) and its contexts (F15): each
      // history kills a push in one owned function, so its tests ran.
      ...[
        [
          `a config that --config names`,
          `a config that --config names ran`,
          { configPlace: `named`, setupGlobal: true },
        ],
        [
          `a package with no config`,
          `a package with no config ran`,
          { configPlace: `none`, configEnv: false, setupGlobal: false },
        ],
        [
          `an awaiting config in a package with no module type`,
          `an awaiting config in a package with no module type ran`,
          {
            configFile: `vite.config.mjs`,
            configPlace: `discovered`,
            packageType: `commonjs`,
            configAwait: true,
          },
        ],
        // CommonJS configs that call `require` and `require.resolve`, which
        // Vitest loads (review of 2026-11-11).
        [
          `a .cjs config that calls require`,
          `a .cjs or .cts config that calls require ran`,
          {
            configFile: `vitest.config.cjs`,
            configPlace: `discovered`,
            configRequire: true,
          },
        ],
        [
          `a .ts config in a package with no module type that calls require`,
          `a .js or .ts config in a package with no module type that calls require ran`,
          {
            configFile: `vite.config.ts`,
            configPlace: `discovered`,
            packageType: `commonjs`,
            configRequire: true,
          },
        ],
        [
          `a run with eleven contexts`,
          `a run with eleven contexts`,
          { contexts: 11 },
        ],
        // A config only in the package's parent directory, which Vitest
        // finds (maintainer decision, 2026-11-11): the run loads it; a
        // failing owner's replay, pasted in the package, finds its test
        // under it; and one that defines test.projects refuses the run.
        [
          `a package whose parent directory has its config`,
          `a package whose parent directory has its config ran`,
          { configPlace: `parent`, configEnv: false, setupGlobal: false },
        ],
        [
          `a failing owner under its parent's config`,
          `a failing owner replayed under its parent's config`,
          { configPlace: `parent`, fault: `brokenOwner` },
        ],
        [
          `test.projects in a parent's config`,
          `refused projects in a parent's config`,
          { configPlace: `parent`, fault: `projects` },
        ],
      ].map(([name, state, fields]) => ({
        name,
        enters: [state],
        build: (generated) => ({
          ...generated,
          functions: [[{ kind: `push`, quote: `'` }]],
          containers: [],
          overloads: [],
          owners: [`a`],
          wholeFile: `none`,
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ...fields,
        }),
      })),
      {
        // A failing owner in a package whose config only `--config` names,
        // beside a discovered config that includes no test: its replay runs
        // the failing test alone only under the named config (F12, law 3).
        name: `a failing owner under a config that --config names`,
        enters: [
          `a failing owner replayed under a config that --config names`,
          `blocked by brokenOwner`,
          `a partial run of one function`,
          `a partial run beside a failing owner`,
        ],
        // The failing owner, file b, owns the second function and nothing
        // else that the generated base could leave out: so a mutant that
        // only it owns is blocked whatever the base holds.
        build: (generated) => ({
          ...generated,
          functions: [
            [{ kind: `push`, quote: `'` }],
            [{ kind: `push`, quote: `'` }],
          ],
          containers: [],
          overloads: [],
          owners: [`a`, `b`],
          wholeFile: `none`,
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `brokenOwner`,
          configPlace: `named`,
          stability: `none`,
          steps: null,
          cliPath: `plain`,
          // A partial run of file a's function, which file b, the failing
          // owner, does not own.
          onlyRun: true,
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
          // no module data or unnamed export owners, no whole-file entry,
          // and no `..gen` module, whose function file a owns.
          owners: [],
          dotGen: false,
          dataOwners: [],
          exportOwners: [],
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
          : blockingFaults.includes(fault)
            ? [`blocked by ${fault}`]
            : [
                `refused ${fault}`,
                // The CLI runs from this directory, so the scratch package
                // lies inside it.
                ...(fault === `badEntry`
                  ? [
                      `a refused run whose package lies inside the CLI's directory`,
                    ]
                  : []),
                ...(fault === `brokenVitest`
                  ? [
                      `two checks at once on a session that cannot open`,
                      `a session failure larger than a socket buffer`,
                      `edit fixSession changed the cold result`,
                      `a check after the session's failure was fixed`,
                    ]
                  : []),
                // A config the session cannot load is refused through the
                // daemon with the cold run's lines (law 15; review F4).
                ...(daemonConfigFaults.includes(fault)
                  ? [`a config refusal through the daemon`]
                  : []),
              ],
        // A session that cannot open is checked through the daemon too, and
        // fixed once; a long failure is heard by two checks at once, then by
        // a fresh daemon's check (fixing it reruns the whole generated
        // campaign).
        build: (generated) => ({
          ...generated,
          fault,
          ...(fault === `badEntry`
            ? { cliPath: `plain`, configPlace: `discovered` }
            : {}),
          ...(fault === `brokenVitest`
            ? {
                steps: [`restart`, `fixSession`],
                concurrentStart: true,
                // A history with the witness module takes no other steps.
                witness: false,
              }
            : {}),
          ...(daemonConfigFaults.includes(fault)
            ? { steps: [`recheck`], witness: false }
            : {}),
        }),
      })),
      {
        // Law 9 over the witness module's outcome classes: its hangs are
        // recomputed after the test edit and reused after the helper edit,
        // which changes only file b. Generated histories with the witness
        // module take no steps, so this is the one sequence that judges
        // them (maintainer decision, 2026-11-11). Everything else is the
        // cheapest legal setting, so that the history costs about two cold
        // runs and four daemon checks of the witness module.
        name: `an edit sequence over the witness module`,
        enters: [`a timed-out run reused after an edit`],
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
          runes: [],
          derived: null,
          dotGen: false,
          dataOwners: [],
          exportOwners: [],
          importer: `none`,
          wholeFile: `none`,
          template: false,
          tests: [
            { ...judging(`a`, `fixed seed`, 5), fn: 0 },
            { ...judging(`b`, `fixed seed`, 1), fn: 1 },
          ],
          witness: `capture`,
          authored: null,
          secondAuthored: false,
          fault: `none`,
          stability: `none`,
          ordinary: false,
          config: `object`,
          configEnv: false,
          setupGlobal: false,
          native: `none`,
          depSubpath: false,
          unbuiltDep: false,
          boot: false,
          budget: `two`,
          cliPath: `plain`,
          concurrentStart: false,
          configFile: `vite.config.ts`,
          configPlace: `discovered`,
          packageType: `module`,
          configAwait: false,
          configRequire: false,
          contexts: 4,
          sourceSpelling: `plain`,
          steps: witnessSteps,
        }),
      },
      {
        // One context runs every file. A hang in file a's test replaces it
        // after it read file b's helper module, and the context that
        // replaces it reads the helper again in b's mutant runs. The helper
        // edit then changes b's verdicts, and the daemon must invalidate the
        // helper in the new context.
        name: `an edit that changed the cold result after a hang replaced the only context`,
        enters: [
          `an edit that changed the cold result after a hang replaced the only context`,
        ],
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
          runes: [],
          derived: null,
          dotGen: false,
          dataOwners: [],
          exportOwners: [],
          importer: `none`,
          wholeFile: `none`,
          template: false,
          tests: [
            {
              ...judging(`a`, `fixed seed`, 7, { judges: false, hangs: true }),
              fn: 0,
            },
            { ...judging(`b`, `fixed seed`, 1), fn: 1 },
          ],
          witness: false,
          authored: null,
          secondAuthored: false,
          fault: `none`,
          stability: `none`,
          ordinary: false,
          native: `none`,
          boot: false,
          budget: `two`,
          cliPath: `plain`,
          concurrentStart: false,
          contexts: 1,
          steps: [`helper`],
        }),
      },
      {
        // File b's verdict waits on a module that it imports only where the
        // output differs, so only mutated runs load it. The edit closes that
        // gate: the cold run then reports b's mutants as survivors, and the
        // daemon must not reuse a kill that read the old module.
        name: `an edit to a module that only mutated runs load`,
        enters: [`edit lazy changed the cold result`],
        build: (generated) => ({
          ...generated,
          functions: [[{ kind: `push`, quote: `'` }]],
          containers: [],
          overloads: [],
          owners: [`b`],
          library: [],
          libraryOwners: [],
          runes: [],
          derived: null,
          dotGen: false,
          dataOwners: [],
          exportOwners: [],
          importer: `none`,
          wholeFile: `none`,
          template: false,
          tests: [{ ...judging(`b`, `fixed seed`, 1), fn: 0 }],
          witness: false,
          authored: null,
          secondAuthored: false,
          fault: `none`,
          stability: `none`,
          ordinary: false,
          native: `none`,
          boot: false,
          cliPath: `plain`,
          concurrentStart: false,
          lazyGate: true,
          steps: [`lazy`],
        }),
      },
      {
        // The same lazy gate in one context, where a hang later in a batch
        // cuts it off: the copies before the hang finished, and one of them
        // loaded the lazy module, so their units must keep it as an input.
        name: `a lazy module loaded before a hang in the same batch`,
        enters: [
          `a lazy edit changed the cold result after a batch was cut off`,
        ],
        build: (generated) => ({
          ...generated,
          functions: [
            [{ kind: `push`, quote: `'` }],
            [{ kind: `if`, op: `>`, k: 4, not: false, quote: `'` }],
          ],
          containers: [],
          overloads: [],
          owners: [`a`, `b`],
          library: [],
          libraryOwners: [],
          runes: [],
          derived: null,
          dotGen: false,
          dataOwners: [],
          exportOwners: [],
          importer: `none`,
          wholeFile: `none`,
          template: false,
          tests: [
            { ...judging(`b`, `fixed seed`, 1), fn: 1 },
            {
              ...judging(`b`, `fixed seed`, 7, { judges: false, hangs: true }),
              fn: 1,
            },
          ],
          witness: false,
          authored: null,
          secondAuthored: false,
          fault: `none`,
          stability: `none`,
          ordinary: false,
          native: `none`,
          boot: false,
          budget: `two`,
          cliPath: `plain`,
          concurrentStart: false,
          contexts: 1,
          lazyGate: true,
          steps: [`lazy`],
        }),
      },
    ]),
  },
  resolve: resolveHistory,
  model,
  driver,
  check,
  calibrations,
  timeout: 900_000,
})
