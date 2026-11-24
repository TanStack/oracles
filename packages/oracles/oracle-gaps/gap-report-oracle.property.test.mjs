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
 *    other missing unit is rerun. A mutant is judged without a run, from
 *    its owners' unmutated runs, only when no owner's unmutated run reached
 *    its site with a value that the mutant changes (v21.2 P5 and R-equiv: a
 *    mutant changes nothing only when its completion, a value or a thrown
 *    error, equals the original's). So a `?.` whose object was `undefined`
 *    or `null` there runs, since a plain read throws on it, as does a
 *    comparison whose operators disagreed on its operands, an `if` whose
 *    condition took the outcome its mutant forces the other way, and a site
 *    of any other operator that was reached. A test's work is the number of site
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
 *    One edit lands during a check (`midrun`): a test of file a, whose
 *    context has loaded file b's helper, rewrites it before file b's runs
 *    read it. A run that the edit overlapped may report either text, so
 *    that check is not compared; the runner must not store such a run, so
 *    the next check, with nothing changed, equals a cold run of the state
 *    after the edit.
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
 *    process serves the package. The daemon runs one check at a time, so of
 *    two checks at once on one state, the one it runs second reuses every
 *    run the first stored and computes none that was not cut off (where no
 *    test reads the clock), by the CLI's own count of runs that ended
 *    without a cut. Which of the two it runs first is a race between two
 *    processes, outside the contract: the pair is recorded by what each
 *    check did, the check that computed first and ties by their records,
 *    never by which process started first (issue #82). The constructed edit
 *    sequence holds each pair in the daemon together, through a test-only
 *    hold released by the daemon's count of accepted requests, so its reach
 *    names a measured overlap, not two processes' timing. A completed check
 *    through the daemon names its own report in its done line.
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
 *    2026-11-10). A run removes that directory when it ends, also when a
 *    stop or an abort of its check's process ends it (README: "A run leaves
 *    nothing in the repository"; register C 2026-11-18, "A run that ends
 *    removes its session directory"); only a run whose own process is killed
 *    before it cleans up leaves it, and the next run removes it. A run
 *    stopped before its first statement removes nothing, so the run before
 *    it must not rely on it. The daemon's state, removed between checks as the OS cleans
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
 *    CLI that asked. Any other error is an internal error, a bug in the
 *    CLI: it exits 3, says so in one `oracle-gaps: error` line on stderr
 *    with no stack frames, and keeps its stack in the error.log of the
 *    run's output directory (ending.mjs).
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
 *    `busy`, `error`, or `done`. Only the declared exempt lines below are
 *    not. The baseline ends with one decisive line before any
 *    mutant runs: `oracle-gaps: baseline all <n> oracle files pass`, or
 *    `oracle-gaps: baseline <k> of <n> oracle files failed (provisional)`.
 *    The stdout's baseline, blocked, and gap lines carry the same prefixes.
 *    The stdout lists each gap the run reports in its results.json on
 *    exactly one gap line, under that gap's id, with the gap's kind, line,
 *    and change, and lists no gap line that results.json does not report
 *    (P10, one diagnostic per failure), cold and through the daemon. The
 *    law compares the stdout with the run's own report, by id: whether the
 *    report's gaps are the owed ones is the enumeration, probe-only code,
 *    classification, authored mutants, and report completeness laws'
 *    question, so a mutant the model owes another outcome is named there,
 *    at its site, not counted here as a missing or extra line.
 *    The run's last line is its done line: `completed, <n> gaps[
 *    (provisional)], report <its summary.md>` on stdout, `refused[, report
 *    <its summary.md>]` after a refusal's block, `error, log <its
 *    error.log>` after an internal error's one `error` line, or `stopped
 *    (<signal>)` after a stop. An `error` line is an internal error's one
 *    diagnostic (P10, one diagnostic per failure; the register's C entry
 *    "The internal-error line", 2026-11-16): a run that ends through its
 *    ending (`done error, log <log>`) writes exactly one, on stderr, naming
 *    that log with its line breaks escaped, and every other run writes none.
 *    The law holds for every run, whatever its end: an internal error's
 *    lines are lines of the stream. The declared exempt lines (v21.2 P10,
 *    I3, R10; the register's M entries of 2026-11-16, "P10 exemptions
 *    ratified", "`--help` is exempt", and "Other tools' output is exempt")
 *    are the stdout summary (unused: the CLI prefixes it), refusal blocks,
 *    indented baseline lines under a prefixed head line, `--help`'s usage
 *    text, and the lines and blocks that Node, V8, esbuild, and Vite print;
 *    each is told by its own shape, and no other line is exempt. A check through the daemon streams the same lines. The
 *    first line, on both streams, of a run that starts a check names its
 *    stream log, `oracle-gaps: note log <out>/stream.log`, and that file
 *    holds the stderr's lines, in order, cold and through the daemon (the
 *    maintainer's decision of 2026-11-12: an agent that runs a check in the
 *    background learns from the run itself where to read it). A refusal
 *    after the check started has that line and then its done line on
 *    stdout; a refusal of the run's arguments comes before any check, and
 *    its stdout is its done line alone. A stop owes the same ends on every
 *    platform (C 2026-11-13, "Stop window on every platform"): its note, and
 *    then exactly one done line on each stream. Only two stops owe nothing:
 *    a SIGKILL-equivalent (L1; on win32, child.kill), which no history sends,
 *    and a stop that lands before the CLI's first statement, which ends the
 *    process before any line (outcome a of the spawn-delay law, C 2026-11-13
 *    under P10, flagged for the maintainer): it must then write nothing at
 *    all, no line and no stream log.
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
 * Law 9's edits come between checks, except the mid-run edit (`midrun`),
 * which a test of the package lands while a check through the daemon runs:
 * the check it overlaps must report, for each mutant, what a cold run of
 * the state before or after the edit reports, and the runner must store no
 * run under a text it did not read (see the limits). An edit can change a
 * file that a test reads through `fs` (`fsData`). Law 9's edits do not
 * include an environment variable other than the seed, a new file that changes how an
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
  lstatSync,
  statSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { hostname, tmpdir } from 'node:os'
import {
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fc from 'fast-check'
import { socketOf, stateDirOf } from './daemon.mjs'
import { isWithin, posix, realPathOf } from './paths.mjs'
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
  fixturePathOf,
  written,
  writeFixture,
  applyEdit,
  endingOf,
  refusalBreach,
  readSummary,
  readCodeSpan,
  removePath,
  sourceArgument,
  outsideRepository,
  ENV_PREFIX,
  MUTANT_LIMIT_MS,
  HEARTBEAT_MS,
  FULL_LIMIT_MS,
  NO_LATER_STEPS,
  NO_STOPS,
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
// A PATH that names no command (`psMissing`): a supervised run must need no
// external command, such as `ps`, which a slim container lacks and whose
// BusyBox form has no `-p` (review of #57, A7). The CLI, Vitest's workers and
// the fixture's processes all start through process.execPath, so nothing else
// reads PATH. POSIX only: win32 runs no supervisor (until #79), and its PATH
// also finds the system's libraries.
let emptyPath
const pathEnv = (how) => {
  if (how.psMissing !== true || process.platform === `win32`) return {}
  emptyPath ??= mkdtempSync(join(realpathSync(tmpdir()), `gap-no-ps-`))
  return { PATH: emptyPath }
}

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
    // `default` leaves `--out` out, so the CLI picks its own output
    // directory (args.mjs): the run's first stdout line names it.
    outMode = `explicit`,
    config,
    contexts = 4,
    only,
    pool,
  } = {},
) {
  const out = outMode === `default` ? undefined : join(dir, outName)
  if (out !== undefined) rmSync(out, { recursive: true, force: true })
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
  ]
  if (out !== undefined) args.push(`--out`, path(out))
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

// ### Bounded retention: the law over one call's retention lines
//
// The retention hook (ORACLE_GAPS_TEST_RETENTION, retention-hook.mjs) writes
// one line per batch, however the batch ends (runner law L2): settled, cut
// off, or rejected. Each line names the check's output directory (`run`), the
// process that wrote it (`pid`), and the batch's own index within its check
// (`batch`, from 0, taken when the batch starts). The law over one CLI call's
// lines, independent of every counter the CLI keeps:
//
// - Ownership: a line is the call's own when its pid is the pid the call's
//   check wrote (check.pid). The one other pid allowed is a daemon that the
//   driver killed during the call and saw die (daemonChecks), or the daemon
//   that held the call's check until its CLI fell back cold (heldPhase: the
//   cold check then wrote check.pid); its lines judge that process's batches
//   up to its death, or up to the hold, which the driver releases only after
//   the call ended. A line from any other pid, or with no pid, is a breach:
//   two processes ran one call's check.
// - One line per batch: a check that ran to its report owns lines whose
//   indices are exactly 0..n-1, each once. A check that ended before its
//   report (a rejected batch, a stop) or a killed daemon may leave the
//   batches it was running unlogged, so there each index appears at most
//   once. A rejected batch's own line, with its state after retirement, is
//   owed.
// - Retirement: after a settled batch, no Vite node names one of its copies
//   (copyNodes), no non-copy file has more than one node beyond the measured
//   plain-plus-?raw pair (nonCopyDup), and Vitest's state (filesMap, pathsSet,
//   idMap, errorsSet, leakSet) has its size before the batch. Vite's totals
//   (`vite.*`) are not compared: Vite caches non-copy modules legitimately
//   (register: #61 retention decisions (3)).
// - No stale entry, before any batch: every indexOf entry names a live
//   context at its own slot, every contextSpecs key a live context, and no
//   context that left the live array is unclosed by Vitest's own state
//   (staleIndexed, staleSpecs, staleOpen).
// - A cold check's store keeps nothing (register: #61 retention decisions
//   (1)): of the entries the check gave its store, none is reachable after a
//   full collection (`held`). A daemon's store keeps its entries by design,
//   so `held` is judged on cold calls only.
//
// The breaches are returned as sorted names, so a passing call observes [].
function retentionBreaches(
  lines,
  { checkPid, killed, complete, cold, rejectBatch = 0 },
) {
  const breaches = new Set()
  const own = lines.filter(
    (line) => line.pid !== undefined && line.pid === checkPid,
  )
  const dead = lines.filter(
    (line) => killed !== undefined && line.pid === killed,
  )
  if (own.length + dead.length < lines.length) breaches.add(`foreignLine`)
  const indices = (group) =>
    group.map((line) => line.batch).sort((a, b) => a - b)
  const once = (group) =>
    indices(group).every(
      (index, i, all) => Number.isInteger(index) && index !== all[i - 1],
    )
  const exact = (group) => indices(group).every((index, i) => index === i)
  if (!(complete ? exact(own) : once(own))) breaches.add(`batchIndex`)
  if (!once(dead)) breaches.add(`killedIndex`)
  if (
    rejectBatch > 0 &&
    !own.some(
      (line) => line.batch === rejectBatch - 1 && line.after !== undefined,
    )
  )
    breaches.add(`rejectLine`)
  for (const line of [...own, ...dead]) {
    if ((line.copyNodes ?? 0) !== 0) breaches.add(`copyNodes`)
    if ((line.nonCopyDup ?? 0) !== 0) breaches.add(`nonCopyDup`)
    if (cold && line.held !== 0) breaches.add(`held`)
    for (const key of Object.keys(line.before ?? {}))
      if (
        !key.startsWith(`vite.`) &&
        ((key.startsWith(`stale`) && line.before[key] !== 0) ||
          (line.after !== undefined && line.before[key] !== line.after[key]))
      )
        breaches.add(key)
  }
  return [...breaches].sort()
}

// One hook file per package, in its own temporary directory (removed with the
// package, `dropHook`): a daemon keeps the environment of the call that
// started it, so every call for this package writes to the same file.
const hookFiles = new Map()
let runSeq = 0
const hookOf = (dir) => {
  if (!hookFiles.has(dir))
    hookFiles.set(
      dir,
      join(mkdtempSync(join(tmpdir(), `gap-retention-`)), `retention.jsonl`),
    )
  return hookFiles.get(dir)
}
const dropHook = (dir) => {
  const file = hookFiles.get(dir)
  hookFiles.delete(dir)
  if (file) rmSync(dirname(file), { recursive: true, force: true })
}
// The pid of the process that ran a check, which the hook writes into the check's output directory.
const checkPidOf = (out) =>
  existsSync(join(out, `check.pid`))
    ? Number(readFileSync(join(out, `check.pid`), `utf8`))
    : undefined
const retentionLinesOf = (file) =>
  existsSync(file)
    ? readFileSync(file, `utf8`)
        .split(`\n`)
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : []
// The lines of the check that wrote to `out`. A default output directory is
// known only from the run's note line, which spells it in forward slashes on
// win32 (the Windows paths rule), so both spellings are compared that way.
const linesOfRun = (lines, out) =>
  lines.filter(
    (line) =>
      out !== undefined &&
      typeof line.run === `string` &&
      posix(line.run) === posix(out),
  )
// The output directory a run without `--out` chose: its note line names the
// stream log there (law 15).
const chosenOut = (stdout) =>
  `${stdout ?? ``}`
    .split(`\n`)[0]
    .match(/^oracle-gaps: note log (.*)\/stream\.log$/)?.[1]

/**
 * Writes the fixture's files and runs the CLI on it. A file of an earlier
 * state that this state lacks is removed.
 */
// A calibration's lines that another writer printed on the CLI's stderr
// (`foreign`), put before its last line, the done line, where a block that
// Node, V8, or esbuild prints comes before the CLI's own ending. Only the
// stream calibrations set it (streamCalibrations); with none, the stderr is
// read as the CLI wrote it.
function beforeLastLine(stderr, foreign) {
  if (foreign === undefined) return stderr
  const lines = `${stderr ?? ``}`.split(`\n`)
  const last = lines.findLastIndex((line) => line !== ``)
  lines.splice(last, 0, ...foreign)
  return lines.join(`\n`)
}

function runCli(dir, files, how = {}) {
  writeFixture(dir, files)
  const before = new Set(filesUnder(dir))
  const { args, out: outBase } = cliArgs(dir, files, how)
  // Each call has its own output directory: its retention lines are then its own, even when a
  // daemon serves several checks of one test. A run with the default output directory names
  // no --out (the CLI picks a fresh one). `outBreak` puts a line break in its name, where the
  // platform allows one, so that a line that names the directory must escape it.
  const out =
    outBase === undefined
      ? undefined
      : `${outBase}-${++runSeq}${how.outBreak ? `\nbreak` : ``}`
  if (out !== undefined) args[args.indexOf(`--out`) + 1] = out
  if (how.logBlocked) mkdirSync(join(out, `stream.log`), { recursive: true })
  // The retention hook (ORACLE_GAPS_TEST_RETENTION): one line per batch,
  // written beside the run's own temporary files, not in the package.
  // One hook file per package: a daemon keeps the environment of the call that started it, so every call
  // for this package writes to the same file; each line names its run (below).
  const hook = hookOf(dir)
  const child = spawnSync(process.execPath, args, {
    cwd: repo,
    encoding: `utf8`,
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
    // A constructed history that runs unsupervised (`unsupervised`): the path
    // win32 takes, so the POSIX oracle reaches the daemon request that names no
    // directory (ORACLE_GAPS_TEST_UNSUPERVISED, index.mjs).
    env: {
      ...cleanEnv(),
      ORACLE_GAPS_TEST_RETENTION: hook,
      // The slow kill's hold reads this run's stream log (beatHold in the
      // model): a cold run with an --out of its own. A daemon keeps the
      // environment of the call that started it, so a check through the
      // daemon names no log, and its slow kill waits as before.
      ...(out !== undefined && how.daemon !== true
        ? { GAP_BEAT_LOG: join(out, `stream.log`) }
        : {}),
      ...pathEnv(how),
      ...how.env,
      ...(how.unsupervised === true
        ? { ORACLE_GAPS_TEST_UNSUPERVISED: `1` }
        : {}),
    },
  })
  // Each line names its check's output directory, so this call keeps every
  // line for its own directory, whichever process wrote it (retentionBreaches
  // judges the writer).
  // A default output directory is removed once the run is read, so its
  // check's pid and lines are read first.
  const ranIn = out ?? chosenOut(child.stdout)
  const checkPid = ranIn === undefined ? undefined : checkPidOf(ranIn)
  const retention = linesOfRun(retentionLinesOf(hook), ranIn)
  // The supervisor relays a child's stderr to stream.log as it relays it to
  // stderr (index.mjs), so another writer's lines are in the log too: a
  // foreign calibration puts them in both, before the done line.
  const log = ranIn === undefined ? undefined : join(ranIn, `stream.log`)
  if (how.foreign !== undefined && log !== undefined && existsSync(log))
    writeFileSync(log, beforeLastLine(readFileSync(log, `utf8`), how.foreign))
  const run = readRun(
    dir,
    out,
    child.status,
    beforeLastLine(child.stderr, how.foreign),
    how.cli ?? here,
    child.stdout,
  )
  // The command the baseline printed to replay a failing owner (law 3).
  // On win32 the CLI prints the PowerShell line (its POSIX form is not printed).
  const label =
    process.platform === `win32` ? `  replay (PowerShell): ` : `  replay: `
  const replay = `${child.stderr ?? ``}`
    .split(`\n`)
    .find((line) => line.startsWith(label))
    ?.slice(label.length)
  return {
    ...run,
    strayWrites: strays(dir, before, out && relative(dir, out)),
    replay,
    retention,
    checkPid,
    // Whether this run named its stream log to the slow kill's hold.
    beatHeld: out !== undefined && how.daemon !== true,
  }
}

/**
 * What a run has written in the package outside the output directories the
 * driver names (`--out`), as paths relative to the package: the files under
 * `dir` that were not in `before`. While a run runs (`running`), its session
 * directory, `.oracle-gaps-<pid>/` (its capture setup and Vitest configs,
 * which resolve the package's modules from there), is its own too.
 */
const strays = (dir, before, own, running = false) =>
  filesUnder(dir).filter(
    (file) =>
      !before.has(file) &&
      !(running && /^\.oracle-gaps-\d+\//.test(file)) &&
      // The one path a run may write under: the --out the driver gave it (cliArgs names it).
      // A run with the default output directory may write nothing in the package.
      !(own !== undefined && (file === own || file.startsWith(`${own}/`))),
  )

/**
 * Writes the driver's preload for a stop before the CLI's first statement into
 * `dir`, and returns its path: it marks `mark`, then waits (60 s at most, then
 * fails loudly) for a release that the driver never writes.
 */
function writePreload(dir, mark) {
  const path = join(dir, `hold.cjs`)
  writeFileSync(
    path,
    [
      `const { existsSync, writeFileSync } = require('node:fs')`,
      `writeFileSync(${JSON.stringify(mark)}, '')`,
      `for (let waited = 0; !existsSync(${JSON.stringify(`${mark}.release`)}); waited += 10) {`,
      `  if (waited >= 60000) throw new Error('the hold before the CLI started was not ended by a stop within 60 s')`,
      `  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)`,
      `}`,
      ``,
    ].join(`\n`),
  )
  return path
}

// A pid that no process can have: above Linux's largest pid_max (2^22) and
// macOS's 99999, and not a multiple of 4, as every win32 pid is (review of
// #164, F7). A dead process's pid could be given to the CLI itself, which
// would take the directory as its own home.
const KILLED_PID = 2 ** 30 + 1
/**
 * Leaves in package `dir` the session directory of a run on this host whose
 * process was killed before it cleaned up (SIGKILL), and returns its name: a
 * pid that no process runs under, and its `host` file, which is how the CLI
 * tells a directory of this host's from one that a container sharing the
 * package left.
 */
function killedSession(dir) {
  const name = `.oracle-gaps-${KILLED_PID}`
  mkdirSync(join(dir, name), { recursive: true })
  writeFileSync(join(dir, name, `host`), hostname())
  return name
}

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
 * With `when` `after` (constructed only), the run is not stopped while it
 * runs: the witness does not spin, the run's process holds its exit once it
 * has printed its done line, until the driver releases it
 * (`ORACLE_GAPS_TEST_HOLD_UNTIL`, a hook for this driver), and the driver sends
 * the signal once that line is on stdout (review of #46, F3). The run then ends as it completed, with exactly one
 * done line. With `warm`, the driver sends the signal while the run warms
 * its config (`ORACLE_GAPS_TEST_WARM_PROBE`, a hook that writes its marker there
 * and then waits, as a config load does, on a service in the run's group
 * that the signal ends, with a handler that takes 200 ms to exit, as
 * Vitest's does; re-review N1). The run then ends stopped, with exactly
 * one done line and no refusal. With `spawn` (constructed only), the signal
 * comes once the CLI is held at its start, `delay` ms after the hold's marker:
 * after the started marker when `onStart`, or before the CLI's first statement.
 * With `kill` (constructed only), the driver kills the CLI with SIGKILL while
 * the witness spins, and its check's process group too (the child's pid
 * beside the started marker, POSIX), as an out-of-memory killer or a closed
 * terminal can: the CLI runs no code after it, so it writes no done line
 * (L1), and leaves its session directory, with the `host` file it wrote, for
 * the next run. Its claim on its output directory is left too, so the driver
 * deletes `<out>/run.pid`, as the next run's refusal tells a user to.
 */
async function stoppedRun(
  dir,
  files,
  how,
  ids,
  { signal, pool, when, delay = 0, onStart = false },
) {
  // `spawn`: the signal comes as the CLI starts, while the CLI is held there:
  // after its started marker (`onStart`), or before its first statement (the
  // driver's preload, below).
  const atSpawn = when === `spawn`
  const after = when === `after`
  const warm = when === `warm`
  // `note` (constructed only): the run is held right after its note line
  // (ORACLE_GAPS_TEST_PAUSE_AT=note), the driver sends the stop, and then
  // releases the hold, so the stop is taken before the check starts any process.
  const atNote = when === `note`
  // With `abort`, no signal comes: the CLI aborts its check's process after the
  // session has begun (`ORACLE_GAPS_TEST_ABORT_AT`), as a V8 out-of-memory
  // abort does, whatever the test files do. The run then ends with one error
  // line per stream that names how its process ended, and exits 3 (the
  // coordinator's decision of 2026-11-12 on P10).
  const abort = when === `abort`
  const kill = when === `kill`
  writeFixture(dir, files)
  const before = new Set(filesUnder(dir))
  const pids = mkdtempSync(join(realpathSync(tmpdir()), `gap-stop-`))
  // win32 cannot deliver a signal to a Node process: kill ends it at once, with
  // no stopped line. There the stop is the CLI's test stop hook (the file it
  // names, as a SIGINT), so the run is observed as SIGINT (see below).
  const win = process.platform === `win32`
  const stopFile = `${pids}-stop`
  const { args, out: given } = cliArgs(dir, files, {
    ...how,
    outName: `out-stop`,
    contexts: 1,
    only: ids,
    pool: abort ? `threads` : pool,
  })
  // The started marker: the CLI writes it as its first statement (index.mjs).
  const startedPath = kill ? `${pids}-started` : join(pids, `started`)
  // The retention hook is set on every stop, so a stopped run's completed batches are judged too.
  // Every stop of a history writes under out-stop, so this run's lines are the ones appended after
  // the lines already in the file.
  const hook = hookOf(dir)
  const earlierLines = retentionLinesOf(hook).length
  const base = {
    ...cleanEnv(),
    ORACLE_GAPS_TEST_RETENTION: hook,
    ...pathEnv(how),
    // A constructed history that runs unsupervised (`unsupervised`): the path
    // win32 takes, so its stop is the unsupervised run's own stopped line on
    // POSIX too (ORACLE_GAPS_TEST_UNSUPERVISED).
    ...(how.unsupervised === true
      ? { ORACLE_GAPS_TEST_UNSUPERVISED: `1` }
      : {}),
  }
  // The driver's hold before the CLI's first statement (a spawn stop without
  // `onStart`, POSIX): a preload writes its marker and waits for a release that
  // never comes, so a signal sent once the marker exists lands before any CLI
  // code runs, and its default action ends the process (outcome a of the
  // spawn-delay law). The preload is the driver's, not the CLI's: it stands for
  // a slow start of Node itself. Its wait fails loudly after 60 s. win32 cannot
  // deliver a signal, so there the spawn stop is the test stop file alone.
  const preStart = atSpawn && !onStart && !win
  const heldPath = join(pids, `held`)
  const preload = preStart ? writePreload(pids, heldPath) : undefined
  const env = {
    ...(atSpawn || kill ? { ORACLE_GAPS_TEST_STARTED: startedPath } : {}),
    // The constructed witness holds the CLI after its marker until the CLI has
    // kept the stop the driver sends on seeing the marker (or, on win32, until
    // the test stop file exists), so the stop lands during the CLI's loads,
    // whatever the load on the machine (review of #57, A4).
    ...(atSpawn && onStart
      ? { ORACLE_GAPS_TEST_PAUSE_AFTER_STARTED: `1` }
      : {}),
    ...(atNote
      ? {
          ORACLE_GAPS_TEST_PAUSE_AT: `note`,
          ORACLE_GAPS_TEST_PAUSE_MARKER: join(pids, `at-note`),
          ORACLE_GAPS_TEST_PAUSE_UNTIL: join(pids, `note-release`),
        }
      : {}),
    ...(after
      ? {
          ...base,
          ORACLE_GAPS_TEST_HOLD_UNTIL: join(pids, `after-release`),
        }
      : warm
        ? { ...base, ORACLE_GAPS_TEST_WARM_PROBE: join(pids, `warming`) }
        : abort
          ? { ...base, ORACLE_GAPS_TEST_ABORT_AT: `check` }
          : { ...base, GAP_STOP_DIR: pids }),
  }
  if (win) env.ORACLE_GAPS_TEST_STOP = stopFile
  const child = spawn(
    process.execPath,
    preload === undefined ? args : [`--require`, preload, ...args],
    { cwd: repo, env, stdio: [`ignore`, `pipe`, `pipe`] },
  )
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
    !atSpawn &&
    (after
      ? !stdout.includes(`oracle-gaps: done completed`)
      : warm
        ? !existsSync(join(pids, `warming`))
        : atNote
          ? !existsSync(join(pids, `at-note`))
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
    : atSpawn
      ? !exited
      : after
        ? stdout.includes(`oracle-gaps: done completed`) && !exited
        : warm
          ? existsSync(join(pids, `warming`)) && !exited
          : atNote
            ? existsSync(join(pids, `at-note`)) && !exited
            : readdirSync(pids).length >= 2
  const strayWhileRunning = strays(
    dir,
    before,
    given === undefined ? undefined : relative(dir, given),
    true,
  )
  // A spawn stop waits for its hold's marker (event-driven, 30 s cap), then
  // its drawn delay, and then signals. The hold, not the delay, decides where
  // the stop lands: a hold released by time would end before a long delay.
  const holdMark = onStart ? startedPath : preStart ? heldPath : undefined
  if (atSpawn && holdMark !== undefined)
    for (
      let waited = 0;
      !existsSync(holdMark) && !exited && waited < 30_000;
      waited += 1
    )
      await sleep(1)
  if (atSpawn) await sleep(delay)
  if (kill) {
    // The check's group first (its leader's pid is beside the started
    // marker), then the CLI: no process of the run gets to clean up.
    const leaderFile = `${startedPath}.child`
    const leader = existsSync(leaderFile)
      ? Number(readFileSync(leaderFile, `utf8`))
      : 0
    if (leader > 0)
      try {
        process.kill(-leader, `SIGKILL`)
      } catch {
        // The group has ended.
      }
    child.kill(`SIGKILL`)
  } else if (!abort) {
    if (win) writeFileSync(stopFile, ``)
    else child.kill(signal)
  }
  // The `after` stop is sent while the exit is held, and the `note` stop while
  // the run is held at its note; each hold is released now.
  if (after) writeFileSync(join(pids, `after-release`), ``)
  if (atNote) writeFileSync(join(pids, `note-release`), ``)
  // The hold beside the release file is marked when the CLI could not release it.
  const unreleased = join(pids, `after-release.unreleased`)
  const ended = await Promise.race([exit, sleep(30_000).then(() => false)])
  await sleep(1000)
  if (existsSync(unreleased))
    throw new Error(`the stop's hold was never released`)
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
  // Whether the CLI wrote its started marker before the signal (outcomes a and
  // b), whether the driver's hold before it was reached, and whether the
  // supervisor had started its run's child (its pid beside the marker): a stop
  // the CLI kept during its loads ends it before any child starts.
  const startMarks = atSpawn
    ? {
        started: existsSync(startedPath),
        held: preStart ? existsSync(heldPath) : undefined,
        childStarted: existsSync(`${startedPath}.child`),
      }
    : {}
  rmSync(pids, { recursive: true, force: true })
  rmSync(stopFile, { force: true })
  if (kill) rmSync(`${startedPath}.child`, { force: true })
  if (kill) rmSync(startedPath, { force: true })
  const out = given ?? chosenOut(stdout) ?? join(dir, `no-output`)
  // A killed CLI's claim names a dead pid, which the next run refuses ("Stale
  // claims refuse; no takeover"); its fix line tells the user to delete it.
  if (kill) rmSync(join(out, `run.pid`), { force: true })
  const scratchNames = [
    [how.cli ?? here, `<cli>`],
    [dir, `<package>`],
    ...(given === undefined ? [[out, `<out>`]] : []),
  ]
  const result = {
    // The signal the CLI took: the hook's SIGINT on win32.
    signal: kill ? `SIGKILL` : win ? `SIGINT` : signal,
    ...startMarks,
    stdoutLength: stdout.length,
    stderrLength: stderr.length,
    pool,
    spun,
    ended,
    survivors: alive.length,
    strayWhileRunning,
    when: when ?? `run`,
    // The batches this run completed, each with its retention line (the hook above).
    retention: linesOfRun(retentionLinesOf(hook).slice(earlierLines), out),
    checkPid: checkPidOf(out),
    // Whether a refusal's block reached stderr: a stop is never a refusal.
    refused: stderr.split(`\n`).some((line) => line.startsWith(`refused: `)),
    exit: exitCode,
    // Both streams' lines (law 15), with the scratch paths named.
    stream: streamOf(stderr.split(`\n`), (text) =>
      namedScratch(text, scratchNames),
    ),
    stdoutStream: streamOf(stdout.split(`\n`), (text) =>
      namedScratch(text, scratchNames),
    ),
    outDir: namedScratch(out, scratchNames),
    log: streamLogOf(out, stderr, stdout, (text) =>
      namedScratch(text, scratchNames),
    ),
    // The session directories in the package once it has ended: a stopped
    // run removes its own, and one that a killed run left before it.
    sessions: readdirSync(dir).filter((name) =>
      /^\.oracle-gaps-\d+$/.test(name),
    ),
    // What else it left in the package.
    left: strays(dir, before, given && relative(dir, given)).filter(
      (file) => !/^\.oracle-gaps-\d+\//.test(file),
    ),
  }
  // A default output directory is the run's own scratch.
  if (given === undefined) rmSync(out, { recursive: true, force: true })
  return result
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
    const full = `${command} --reporter=json --outputFile='${report}'`
    // On win32 the line runs in PowerShell, as a user's typed line does: on stdin.
    if (process.platform === `win32`)
      spawnSync(`pwsh`, [`-NoProfile`, `-Command`, `-`], {
        cwd: dir,
        encoding: `utf8`,
        input: full,
        env: {
          ...process.env,
          PATH: [join(here, `../node_modules/.bin`), process.env.PATH].join(
            delimiter,
          ),
        },
      })
    else
      spawnSync(`sh`, [`-c`, full], {
        cwd: dir,
        encoding: `utf8`,
        timeout: 120_000,
        env: {
          ...cleanEnv(),
          PATH: `${join(here, `..`, `node_modules`, `.bin`)}:${process.env.PATH}`,
        },
      })
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

// What a directory holds: each file's relative path and its text.
const snapshotOf = (root) =>
  new Map(
    filesUnder(root).map((path) => [
      path,
      readFileSync(join(root, path), `utf8`),
    ]),
  )

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Runs the CLI twice on one output directory, the second while the first is
 * live (the first has printed its note, so it has its stream log). The first
 * run is the history's `cli`, and the second's ending is the `overlap`
 * observation (the coordinator's decision of 2026-11-13 on F4: a second run
 * refuses, and the first's stream log stays its own).
 */
/** The state each unwritable-log ending enters. */
const lostStateOf = {
  stop: `a stream log lost after its note, then stopped`,
  complete: `a stream log lost after its note, then completed`,
}

/** The state each claim scenario enters. */
const claimStateOf = {
  race: `two starts race for a stale claim`,
  stale: `a start refuses a stale claim`,
  empty: `a start refuses an empty claim`,
  unreadable: `a start refuses an unreadable claim`,
  dangling: `a start refuses a dangling claim`,
}

/**
 * Runs a claim scenario (the maintainer's decision, "Stale claims refuse; no
 * takeover"): a run.pid that names a dead pid (`stale`), an empty run.pid
 * (`empty`), a run.pid that is a directory (`unreadable`) or a link to no file
 * (`dangling`, which exists for a link and is missing for a read), or two starts
 * at once on a dead pid's claim (`race`). Every start refuses and names its
 * cause and its claim, writes no note, no log and no report, and leaves run.pid
 * as it was. A start that never ends is killed after 30 s, and its outcome is
 * other. The claim lives in a directory that `--out` names: a default output
 * directory is new for every run, so no claim can be there before it.
 */
async function claimScenarioRuns(dir, files, how, scenario) {
  const { args, out } = cliArgs(dir, files, {
    ...how,
    outMode: `explicit`,
    outName: `out-claim`,
  })
  mkdirSync(out, { recursive: true })
  const claim = join(out, `run.pid`)
  // The claim's text, or none: an unreadable claim is a directory, which no
  // read can take, and a dangling claim is a link to a file that is not there.
  const written = {
    empty: ``,
    race: `999999\n`,
    stale: `999999\n`,
    unreadable: undefined,
    dangling: undefined,
  }[scenario]
  const gone = join(out, `gone.pid`)
  if (scenario === `dangling`) symlinkSync(gone, claim, `file`)
  else if (written === undefined) mkdirSync(claim)
  else writeFileSync(claim, written)
  // Every start this driver spawns, so a failure here never leaves one running.
  const children = []
  const startRun = () => {
    const got = { stdout: ``, stderr: `` }
    const child = spawn(process.execPath, args, {
      cwd: repo,
      env: cleanEnv(),
      stdio: [`ignore`, `pipe`, `pipe`],
    })
    children.push(child)
    child.stdout.on(`data`, (chunk) => {
      got.stdout += chunk
    })
    child.stderr.on(`data`, (chunk) => {
      got.stderr += chunk
    })
    const timer = setTimeout(() => child.kill(`SIGKILL`), 30_000)
    return new Promise((resolvePromise) => {
      child.on(`close`, (code) => {
        clearTimeout(timer)
        resolvePromise({ ...got, code })
      })
    })
  }
  let runs
  try {
    runs = await Promise.all(
      scenario === `race` ? [startRun(), startRun()] : [startRun()],
    )
  } finally {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null)
        child.kill(`SIGKILL`)
  }
  // A refusal's cause and its fix line, as the start printed them. The scratch
  // names are normalized, so the observation does not depend on the run's paths.
  const names = [
    [out, `<out>`],
    [dir, `<package>`],
  ]
  const outcomeOf = (run) => {
    if (run.stdout.includes(`oracle-gaps: note log`)) return `claimed`
    const cause = run.stderr.match(/^refused: (.*)$/m)?.[1]
    if (cause === undefined || run.code !== 2) return `other`
    // The fix line is judged exactly: the claim's directive, named by the run.
    const fix = namedScratch(run.stderr.match(/^fix: (.*)$/m)?.[1] ?? ``, names)
    return `refused (${namedScratch(cause, names)}; fix ${fix})`
  }
  return {
    scenario,
    outcomes: runs.map(outcomeOf).sort(),
    // The claim is kept as it was, and nothing else is in the directory: a
    // refusal writes no note, no log, and no temp file.
    claimKept:
      scenario === `unreadable`
        ? existsSync(claim) && statSync(claim).isDirectory()
        : scenario === `dangling`
          ? lstatSync(claim, { throwIfNoEntry: false })?.isSymbolicLink() ===
              true && !existsSync(gone)
          : existsSync(claim) && readFileSync(claim, `utf8`) === written,
    otherFiles: readdirSync(out).filter((name) => name !== `run.pid`),
  }
}

/**
 * Runs a check whose stream log becomes a directory right after its note
 * (review of #57, F1). The supervisor pauses at the note (ORACLE_GAPS_TEST_PAUSE_AT),
 * the driver replaces stream.log with a directory, and the run is then stopped
 * (`stop`, through the test stop file) or allowed to complete (`complete`). The
 * stop file is written before the release, and the stop watcher starts only
 * once the supervisor runs, so the stop is taken by an event, not a timer.
 */
async function unwritableLogRuns(dir, files, how, ending) {
  // The driver swaps the log it names, so the run names its `--out`.
  const { args, out } = cliArgs(dir, files, {
    ...how,
    outMode: `explicit`,
    outName: `out-lost`,
  })
  const marker = join(dir, `lost-at-note`)
  const release = join(dir, `release-lost`)
  const stopFile = join(dir, `stop-lost`)
  const log = join(out, `stream.log`)
  const got = { stdout: ``, stderr: `` }
  const child = spawn(process.execPath, args, {
    cwd: repo,
    env: {
      ...cleanEnv(),
      ORACLE_GAPS_TEST_PAUSE_AT: `note`,
      ORACLE_GAPS_TEST_PAUSE_MARKER: marker,
      ORACLE_GAPS_TEST_PAUSE_UNTIL: release,
      ORACLE_GAPS_TEST_STOP: stopFile,
      // The unsupervised path (ORACLE_GAPS_TEST_UNSUPERVISED), which win32 takes:
      // the run's own process writes its stopped line (stopNow).
      ...(how.unsupervised === true
        ? { ORACLE_GAPS_TEST_UNSUPERVISED: `1` }
        : {}),
    },
    stdio: [`ignore`, `pipe`, `pipe`],
  })
  child.stdout.on(`data`, (chunk) => {
    got.stdout += chunk
  })
  child.stderr.on(`data`, (chunk) => {
    got.stderr += chunk
  })
  const exited = new Promise((resolvePromise) => {
    child.on(`close`, (code, signal) => resolvePromise({ code, signal }))
  })
  let hasEnded = false
  exited.then(() => {
    hasEnded = true
  })
  const timer = setTimeout(() => child.kill(`SIGKILL`), 60_000)
  try {
    for (let waited = 0; !existsSync(marker) && !hasEnded; waited += 1) {
      if (waited > 6000) throw new Error(`the run never reached its note`)
      await sleep(10)
    }
    if (existsSync(marker)) {
      rmSync(log, { force: true })
      mkdirSync(log)
      if (ending === `stop`) writeFileSync(stopFile, ``)
      writeFileSync(release, ``)
    }
    const { code, signal } = await exited
    const names = [
      [out, `<out>`],
      [dir, `<package>`],
    ]
    return {
      ending,
      exit: code,
      signal,
      stdout: namedScratch(got.stdout, names),
      stderr: namedScratch(got.stderr, names),
      logIsDirectory: existsSync(log) && statSync(log).isDirectory(),
    }
  } finally {
    clearTimeout(timer)
  }
}

/** A copy of `value` in which each refusal's pid is `<pid>`: a pid differs between runs. */
const pidFree = (value) =>
  JSON.parse(JSON.stringify(value).replaceAll(/pid \d+/g, `pid <pid>`))

/**
 * Runs a supervised check and SIGKILLs its supervisor once the child is running
 * (the child's pid is read from the started marker's `.child` file). The child's
 * watchdog (index.mjs) ends its group within a tick of losing its supervisor, so
 * the child must be gone within 5 s. The supervisor's own claim is left as a
 * SIGKILL leaves it: a stale claim, which the next run refuses (the stale-claim
 * histories). On win32 the supervisor's kill is TerminateProcess, and the child's
 * watchdog ends its tree with taskkill (index.mjs, watchSupervisor).
 */
async function supervisorDeathRuns(dir, files, how) {
  const { args } = cliArgs(dir, files, { ...how, outName: `out-death` })
  const started = join(dir, `death-started`)
  const paused = join(dir, `child-paused`)
  const release = join(dir, `child-release`)
  const supervisor = spawn(process.execPath, args, {
    cwd: repo,
    env: {
      ...cleanEnv(),
      ORACLE_GAPS_TEST_STARTED: started,
      // The child pauses silently, before its check, with its watchdog armed; the
      // driver releases it last.
      ORACLE_GAPS_TEST_PAUSE_AT: `child`,
      ORACLE_GAPS_TEST_PAUSE_MARKER: paused,
      ORACLE_GAPS_TEST_PAUSE_UNTIL: release,
    },
    stdio: [`ignore`, `pipe`, `pipe`],
  })
  // `exit`, not `close`: the child inherits the supervisor's stdout pipe, so
  // `close` waits until the child itself has ended, which would make the 5 s
  // check below measure a child that had already gone.
  let hasEnded = false
  const exited = new Promise((resolvePromise) => {
    supervisor.on(`exit`, (code, signal) => {
      hasEnded = true
      resolvePromise({ code, signal })
    })
  })
  let childPid
  let childGone = false
  const timer = setTimeout(() => supervisor.kill(`SIGKILL`), 60_000)
  try {
    for (let waited = 0; !existsSync(paused) && !hasEnded; waited += 1) {
      if (waited > 3000) throw new Error(`the supervised child never paused`)
      await sleep(10)
    }
    // A supervisor that ended before its child paused proves nothing about the
    // watchdog, so the witness fails rather than passing.
    if (!existsSync(paused))
      throw new Error(`the supervisor ended before its child paused`)
    childPid = Number(readFileSync(`${started}.child`, `utf8`))
    supervisor.kill(`SIGKILL`)
    const { signal } = await exited
    for (let waited = 0; waited < 5000; waited += 50) {
      try {
        process.kill(childPid, 0)
      } catch {
        childGone = true
        break
      }
      await sleep(50)
    }
    return { childGone, supervisorSignal: signal }
  } finally {
    clearTimeout(timer)
    // A child the watchdog did not end is still ours (its pid is recorded), so
    // the run leaves no process behind.
    if (childPid !== undefined && !childGone)
      try {
        process.kill(childPid, `SIGKILL`)
      } catch {
        // It ended on its own in the meantime.
      }
    // Released last, for the child's own pause.
    writeFileSync(release, ``)
  }
}

async function overlappingRuns(dir, files, how) {
  writeFixture(dir, files)
  const before = new Set(filesUnder(dir))
  const { args, out } = cliArgs(dir, files, how)
  // Both runs carry the retention hook; only the first one runs a check.
  const hook = hookOf(dir)
  const start = (holdUntilFile) => {
    const child = spawn(process.execPath, args, {
      cwd: repo,
      // The first run holds its exit (and its output claim) until the driver
      // releases it after the second run has been refused: the overlap is
      // deterministic (ORACLE_GAPS_TEST_HOLD_UNTIL, index.mjs).
      env: {
        ...cleanEnv(),
        ORACLE_GAPS_TEST_RETENTION: hook,
        ...(holdUntilFile === undefined
          ? {}
          : { ORACLE_GAPS_TEST_HOLD_UNTIL: holdUntilFile }),
      },
      stdio: [`ignore`, `pipe`, `pipe`],
    })
    const got = { stdout: ``, stderr: `` }
    child.stdout.on(`data`, (chunk) => {
      got.stdout += chunk
    })
    child.stderr.on(`data`, (chunk) => {
      got.stderr += chunk
    })
    const status = new Promise((resolvePromise) => {
      const timer = setTimeout(() => child.kill(), 300_000)
      child.on(`close`, (code) => {
        clearTimeout(timer)
        resolvePromise(code)
      })
    })
    return { got, status }
  }
  // The release file lives outside the package: a stray write there is judged.
  const releaseDir = mkdtempSync(join(realpathSync(tmpdir()), `gap-release-`))
  const releaseFile = join(releaseDir, `overlap-release`)
  const first = start(releaseFile)
  let firstEnded = false
  first.status.then(() => {
    firstEnded = true
  })
  // The first run's note is its first stdout line: its stream log exists. A
  // first run that ends first never had a live output directory, so the
  // overlap cannot be observed: the driver says so, rather than waiting.
  for (
    let waited = 0;
    !first.got.stdout.includes(`oracle-gaps: note log`) &&
    !firstEnded &&
    waited < 120_000;
    waited += 20
  )
    await sleep(20)
  if (!first.got.stdout.includes(`oracle-gaps: note log`))
    throw new Error(
      `the first run ended before its stream log existed; an overlap needs a live first run`,
    )
  const second = start()
  const secondStatus = await second.status
  writeFileSync(releaseFile, ``)
  const firstStatus = await first.status
  // A hold the CLI could not release is a driver fault, not an ending.
  if (existsSync(`${releaseFile}.unreleased`))
    throw new Error(`the overlap hold was never released`)
  const ended = readRun(
    dir,
    out,
    firstStatus,
    first.got.stderr,
    how.cli ?? here,
    first.got.stdout,
  )
  const refused = readRun(
    dir,
    out,
    secondStatus,
    second.got.stderr,
    how.cli ?? here,
    second.got.stdout,
  )
  const replay = first.got.stderr
    .split(`\n`)
    .find((line) => line.startsWith(`  replay: `))
    ?.slice(`  replay: `.length)
  return {
    cli: {
      ...ended,
      replay,
      strayWrites: strays(dir, before, relative(dir, out)),
      retention: linesOfRun(retentionLinesOf(hook), out),
      checkPid: checkPidOf(out),
    },
    overlap: {
      exit: refused.exit,
      // The first run's pid is its own; the refusal names it, and a pid differs
      // between two runs, so only the pid's place is observed.
      ending: pidFree(refused.ending),
      stream: pidFree(refused.stream),
      stdoutStream: pidFree(refused.stdoutStream),
    },
  }
}

// Where a run may write in the package: only the output directories the
// driver names with `--out` (`out`, `out-daemon`, `out-stop`, and
// `out-only`). The daemon's state, the workspace dependencies' one-file
// bundles, and a default output directory live in the OS temp directory
// (maintainer decision, 2026-11-11: the gap check's working files stay out
// of the repository), so a package, and a workspace dependency in it, keeps
// nothing of a run.

/**
 * How many runs a check computed that ended without a cut: the CLI's own
 * count (`evidence.ran`), which it reports under the retention test hook
 * that every run here sets. `computed - cut` counts cut events, not cut runs:
 * a cut copy that is confirmed adds a cut and no computed run, so the
 * difference can go below zero and hide a run computed again (review of
 * #126, F3).
 */
const computedRuns = (run) => run.evidence?.ran ?? 0

/**
 * What law 9 records of one check through the daemon: its exit, refusal,
 * ending, report, stream log, output directory (named `<out>`), whether and
 * how it read its report, and stream (law 15): both streams' lines, and the stdout's
 * gap lines in sorted order (an order is not part of the contract), judged
 * against its own results.json, and the first line of a failure, for the
 * message (readRun has named the scratch package and CLI copy in it).
 */
const checkRecord = (run) => ({
  exit: run.exit,
  refusal: run.refusal,
  ending: run.ending,
  report: run.report,
  stream: run.stream,
  stdoutStream: run.stdoutStream,
  // Its stream log, and the output directory it names.
  log: run.log,
  outDir: run.outDir,
  reported: run.reported,
  reportState: run.reportState,
  stdoutGaps: [...run.stdoutGaps].sort(),
  stderr: run.stderr?.split(`\n`)[0],
})

/**
 * Two checks at once, by role: the daemon's earlier check, which computed
 * more runs, first. Checks that computed as many are ordered by their
 * records, so the order is total and no tie falls back on which process the
 * driver started first (review of #126, F6).
 */
const byRole = (a, b) => {
  const work = computedRuns(b) - computedRuns(a)
  if (work !== 0) return work
  const [ra, rb] = [
    JSON.stringify(checkRecord(a)),
    JSON.stringify(checkRecord(b)),
  ]
  return ra < rb ? -1 : ra > rb ? 1 : 0
}

/**
 * Runs the CLI several times at once on one state of the fixture. `outs`
 * receives each call's output directory synchronously, before any call
 * starts, so a driver can watch the directory its own call writes.
 */
async function runClisAtOnce(dir, files, hows, outs = []) {
  writeFixture(dir, files)
  return Promise.all(
    hows.map(async (how) => {
      const { args, out: outBase } = cliArgs(dir, files, how)
      const out = outBase === undefined ? undefined : `${outBase}-${++runSeq}`
      outs.push(out)
      if (out !== undefined) args[args.indexOf(`--out`) + 1] = out
      const hook = hookOf(dir)
      const child = spawn(process.execPath, args, {
        cwd: repo,
        env: {
          ...cleanEnv(),
          ...pathEnv(how),
          ...how.env,
          ORACLE_GAPS_TEST_RETENTION: hook,
        },
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
        const timer = setTimeout(() => child.kill(), how.backstopMs ?? 300_000)
        child.on(`close`, (code) => {
          clearTimeout(timer)
          resolvePromise(code)
        })
      })
      // A default output directory is removed once the run is read, so its
      // check's pid and lines are read first.
      const ranIn = out ?? chosenOut(stdout)
      const retention = linesOfRun(retentionLinesOf(hook), ranIn)
      const checkPid = ranIn === undefined ? undefined : checkPidOf(ranIn)
      const run = readRun(dir, out, status, stderr, how.cli ?? here, stdout)
      return { ...run, retention, checkPid }
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
  // The CLI names its paths in forward slashes (the Windows paths rule), so a
  // scratch path is named in both spellings.
  for (const [path, name] of longestFirst)
    named = named
      .replaceAll(pathToFileURL(path).href, name)
      .replaceAll(path, name)
      .replaceAll(posix(path), name)
  // A run's default output directory is named by the default rule (a random run
  // name), so it is normalized the same way.
  return (
    named
      .replaceAll(
        /\S*oracle-gaps-[^/\s]+\/out\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}/g,
        `<default out>`,
      )
      .replaceAll(/\.oracle-gaps-\d+/g, `.oracle-gaps-<pid>`)
      .replaceAll(/session-\d+/g, `session-<pid>`)
      // A progress line's wall-clock durations ("in 0.2s") are live progress, not
      // outcome: results.json is the stable record (register: heartbeats are
      // progress). Every other field of the line stays.
      .replaceAll(/oracle-gaps: progress [^\\\n"]*/g, (line) =>
        line.replaceAll(/\b\d+(?:\.\d+)?s\b/g, `<t>`),
      )
  )
}

// The note a CLI writes when its daemon sent nothing within its bound and the
// check runs cold instead (R39: a cold fallback names its cause).
const coldFallbackNote =
  /^oracle-gaps: note the package's daemon sent nothing for \d+ s; this check runs cold/

// A run's own output directory, `out`, named `<out>` in each
// spelling the stack may use, wherever it is a whole path: not followed by
// a character that continues a directory's name (a word character, `-`, or
// a `.` before one).
function namedOut(text, out) {
  if (out === undefined) return text
  let named = text
  // The stream spells each control character in a path as its `\uXXXX`
  // escape (the register's C entry "The internal-error line", 2026-11-16).
  const escaped = (path) =>
    path.replace(
      /[\u0000-\u001f\u007f\u2028\u2029]/g,
      (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, `0`)}`,
    )
  const spellings = [pathToFileURL(out).href, out, posix(out)]
  for (const spelling of new Set([...spellings, ...spellings.map(escaped)])) {
    const pattern = spelling.replaceAll(/[.*+?^${}()|[\]\\]/g, `\\$&`)
    named = named.replaceAll(
      new RegExp(`${pattern}(?![\\w-]|\\.\\w)`, `g`),
      `<out>`,
    )
  }
  return named
}

/** What one run of the CLI reported, from its exit status and its files. */
// A gap line the CLI streams to stderr as its mutant is judged (stream.mjs):
// its class, its line, and its id, after the stream's prefix (law 15).
const streamedGap =
  /^oracle-gaps: gap (?:not-judged|extra-work|indeterminate|dead-code|outside-annotation|branch-never-taken|not-infected|not-observed|not-distinguished|unreached|random-only-kill|agreement-only-kill|unregistered-kill|framework-error|timeout|setup-error|crashed|does-not-apply|blocked) L(?:\d+|\?) (\S+) /

// The declared exempt lines that are not our own (v21.2 P10 and I3), each
// told by its own shape, never by its indentation alone: a block starts at
// a line that matches its `head` and goes on while its lines match its
// `body`. `blank` says that empty lines belong to it.
// - Under a baseline failure (`oracle-gaps: baseline fail …`), its indented
//   detail lines (`failing:`, `law:`, `counterexample:`, `replay:`).
// - Node's warning, `(node:<pid>) …`, the frames that `--trace-warnings`
//   adds under it (`    at …`), and its hint, which starts `(Use` and names `node --trace-…`.
// - V8's fatal block, as Node prints it when the heap runs out: its
//   banners (`<--- Last few GCs --->`, `<--- JS stacktrace --->`, `-----
//   Native stack trace -----`, `==== JS stack trace ====`), its GC lines
//   (`[<pid>:0x…] …`), `FATAL ERROR: …`, and its numbered frames, with
//   empty lines between them.
// - esbuild's message block (`✘ [ERROR] …` or `▲ [WARNING] …`, `X` and `!`
//   where it prints no symbols), with its indented location, code frame, and
//   notes, and the empty lines between them.
// - Vite's own line (`[vite] …` or `[vite:<plugin>] …`), with indented
//   lines under it.
// - Node's native backtrace of process.abort() on win32, the CLI's abort
//   witness (ORACLE_GAPS_TEST_ABORT_AT): a CRLF blank line that opens it
//   (`lead`, taken only when a native frame follows), its numbered native
//   frames (` N: <16 hex digits> …`), the JavaScript stack's header, and its
//   numbered frames with file, line and column. Every line ends CRLF, and a
//   blank CRLF line may separate its parts (the frames from the JavaScript
//   header). POSIX ends that abort with SIGABRT, which prints none.
const v8Line =
  /^(?:<--- .* --->|----- .* -----|==== .* =+|\[\d+:0x[0-9a-f]+\] .*|FATAL ERROR: .*|\s*\d+: .*|Security context: .*)$/
const exemptBlocks = [
  { head: /^oracle-gaps: baseline fail /, body: /^ {2}\S/ },
  { head: /^\(node:\d+\) /, body: /^(?: {4}at \S|\(Use `node --)/ },
  { head: /^\(Use `node --/, body: /^$/ },
  {
    head: /^(?:<--- Last few GCs --->|<--- JS stacktrace --->|FATAL ERROR: |----- Native stack trace -----)/,
    body: v8Line,
    blank: true,
  },
  {
    lead: /^\r$/,
    head: /^ {1,2}\d+: [0-9A-F]{16}(?: .*)?\r$/,
    // Node's frames: a native frame is its index, 16 hex digits of address and
    // a symbol that may be absent. A JavaScript frame is `N: name (file:line:col)`
    // or, when anonymous, `N: file:line:col`, with no space outside the name's
    // parentheses. A CRLF blank line may separate the parts.
    body: /^(?:\r|(?: {1,2}\d+: [0-9A-F]{16}(?: .*)?|----- JavaScript stack trace -----|\d+: (?:(?:new )?[^\s()]+ \(\S+:\d+:\d+\)|\S+:\d+:\d+))\r)$/,
  },
  {
    head: /^(?:✘|▲|X|!) \[(?:ERROR|WARNING)\] /,
    body: /^\s+\S/,
    blank: true,
  },
  { head: /^\[vite(?::[\w:-]+)?\] /, body: /^\s+\S/ },
]

/**
 * What law 15 judges of a run's stderr, as relations that do not depend on
 * the order in which its contexts finished:
 * - `strays`: each line, once, that is not a line of a stream kind
 *   (`oracle-gaps: <kind> `) and not one of P10's declared exempt lines
 *   (v21.2 P10 and I3; the register's M entries of 2026-11-16, "P10
 *   exemptions ratified" and "Other tools' output is exempt"), each told by
 *   its own shape (`exemptBlocks`): an indented line under a baseline
 *   failure, a refusal's block (`refused:` up to its `fix:` line), a block
 *   that Node or V8 prints, or a block that esbuild or Vite prints. An
 *   empty line is a stray unless it lies in or right before such a block;
 *   the text after the last line break is no line;
 * - `verdicts`: the decisive baseline lines;
 * - `mutantBeforeVerdict`: whether a gap line, a count of judged mutants,
 *   or a heartbeat that names a mutant came before the first verdict;
 * - `last`: the last line, which ends a run that did not complete;
 * - `errors`: how many internal error lines (`oracle-gaps: error `) it has,
 *   and `errorLogs`, the log each of them names (`its stack is in <log>`).
 */
/**
 * What the run's stream log says (the maintainer's decision of 2026-11-12:
 * the CLI writes its stream to `<out>/stream.log`, and its first line on
 * both streams names that log), as relations: the first line of each
 * stream, with scratch paths named, whether the log exists, and whether its
 * lines are the stderr's lines, in order.
 */
function streamLogOf(out, stderr, stdout, name) {
  // The lines of a text, its final newline ending the last line. A blank line
  // is a line: the log must equal the stderr's lines exactly (F10).
  const lines = (text) => `${text ?? ``}`.replace(/\n$/, ``).split(`\n`)
  let log
  try {
    log = readFileSync(join(out, `stream.log`), `utf8`)
  } catch {
    // No log: the run wrote none.
  }
  return {
    stderrFirst: name(lines(stderr)[0] ?? ``),
    stdoutFirst: name(lines(stdout)[0] ?? ``),
    exists: log !== undefined,
    equal:
      log !== undefined &&
      JSON.stringify(lines(log)) === JSON.stringify(lines(stderr)),
  }
}

function streamOf(lines, name) {
  const kinds = new RegExp(`^oracle-gaps: (?:${streamKinds.join(`|`)}) `)
  const strays = new Set()
  // The exempt block the line before belongs to, if any (exemptBlocks).
  let block
  let inRefusal = false
  const end = lines.findLastIndex((line) => line !== ``)
  for (const [at, line] of lines.entries()) {
    if (line === `` && at > end) continue
    if (line.startsWith(`refused: `)) inRefusal = true
    const ending = inRefusal
    if (line.startsWith(`fix: `)) inRefusal = false
    // A block that a line opens only when its head follows that line (`lead`).
    const opened = exemptBlocks.find(
      (b) =>
        b.lead?.test(line) &&
        b.head.test(lines.slice(at + 1).find((l) => l !== ``) ?? ``),
    )
    if (opened !== undefined) {
      block = opened
      continue
    }
    if (line === ``) {
      // An empty line belongs to a block that holds empty lines, or comes
      // right before the head of one (V8's fatal block starts so).
      const next = lines.slice(at + 1).find((l) => l !== ``) ?? ``
      const opens = exemptBlocks.find((b) => b.blank && b.head.test(next))
      if (ending || block?.blank || opens) continue
      strays.add(`(an empty line)`)
      continue
    }
    if (!block?.body.test(line)) block = undefined
    // A lead block opens only at its lead (below), never by its head alone.
    block ??= exemptBlocks.find((b) => !b.lead && b.head.test(line))
    if (ending || block || kinds.test(line)) continue
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
    // How many internal error lines: at most one, and only in a run that
    // exits 3 (law 12).
    errors: lines.filter((line) => line.startsWith(`oracle-gaps: error `))
      .length,
    errorLogs: lines.flatMap((line) => {
      const log = line.match(/^oracle-gaps: error .*; its stack is in (.*)$/)
      return log ? [name(log[1])] : []
    }),
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

// A run as the trace observes it: its heartbeats and their positions are
// progress (see heartbeatBreaches), and its evidence counts are timing.
function unbeaten(run) {
  return {
    ...run,
    evidence: undefined,
    beats: undefined,
    heartbeats: undefined,
    beatHeld: undefined,
  }
}

/**
 * Law 11, shape only (maintainer decision, 2026-11-14). A heartbeat names the
 * baseline or a mutant of this run, in a file that runs it, and a CLI prints
 * it only while its copy runs, so a beat after its mutant's own streamed gap
 * line names a mutant that was not running. Returns the breaches as text,
 * none in a correct run. The beats' set and count depend on wall-clock timing,
 * so they are progress, not outcome: no trace keeps them.
 */
function heartbeatBreaches(cli) {
  const byId = new Map((cli.mutants ?? []).map((m) => [m.id, m]))
  return (cli.beats ?? []).flatMap(({ label, file, index, finishedAt }) => {
    if (label === `baseline`)
      return /^tests\/[abc]\.test\.ts$/.test(file)
        ? []
        : [`baseline in ${file}: not a baseline file`]
    const m = byId.get(label)
    if (m === undefined) return [`${label} in ${file}: no mutant of this run`]
    if (finishedAt !== undefined && finishedAt < index)
      return [
        `${label} in ${file}: its gap line came first, so it was not running`,
      ]
    const runs = m.authored
      ? /^tests\/\w+\.test\.ts$/.test(file) && file !== `tests/c.test.ts`
      : [...(m.oracleFiles ?? []), ...(m.ordinaryFiles ?? [])].includes(file)
    return runs ? [] : [`${label} in ${file}: the file does not run it`]
  })
}

function readRun(dir, out, status, stderr, cli, stdout) {
  // A run without `--out` writes to the directory its stream log is in, which
  // its first stdout line names (law 15); that directory is removed after the
  // run is read, as the run's own scratch.
  const chosen =
    out ??
    `${stdout ?? ``}`
      .split(`\n`)[0]
      .match(/^oracle-gaps: note log (.*)\/stream\.log$/)?.[1]
  try {
    return readRunIn(
      dir,
      chosen ?? join(dir, `no-output`),
      status,
      stderr,
      cli,
      stdout,
      out === undefined ? chosen : undefined,
    )
  } finally {
    if (out === undefined && chosen !== undefined)
      rmSync(chosen, { recursive: true, force: true })
  }
}

// `derived` is the output directory the CLI chose (no `--out`), which is named
// `<out>` so that two runs of one history, each with its own directory, record
// the same trace (law 9's determinism).
function readRunIn(dir, out, status, stderr, cli, stdout, derived) {
  // The output names the CLI directory that ran and the package, as scratch
  // directories do, before it is cut to its last characters.
  const scratch = [
    [cli, `<cli>`],
    [dir, `<package>`],
    ...(derived === undefined ? [] : [[derived, `<out>`]]),
  ]
  // The run's own output directory is named `<out>` too, as a derived one
  // is, and only as a whole path, so a sibling whose name it begins
  // (`out-daemon-2-3` beside `out-daemon-2`) keeps its own name (review of
  // #126, F4). Two checks at once are given two directories, and which of
  // them the daemon runs first is a race (issue #82), so the name the driver
  // gave a check is no part of the trace.
  const name = (text) => namedScratch(namedOut(text, out), scratch)
  const named = status === 0 ? undefined : name(`${stderr}`)
  let results
  let report
  let summary = ``
  // The state of `results.json` in the output directory: missing, unparseable,
  // or read (review of #57, batch 3: the message names which).
  let reportState = `missing`
  try {
    const text = readFileSync(join(out, `results.json`), `utf8`)
    reportState = `unparseable`
    report = JSON.parse(text)
    results = report.results
    summary = readFileSync(join(out, `summary.md`), `utf8`)
    reportState = `read`
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
  // Each beat in stream order, with the stream index of its mutant's own
  // streamed gap line when that came first (law 11's shape). The driver
  // judges these with heartbeatBreaches; the trace observes only the breaches.
  const streamedAt = new Map()
  lines.forEach((line, index) => {
    const id = line.match(streamedGap)?.[1]
    if (id !== undefined && !streamedAt.has(id)) streamedAt.set(id, index)
  })
  const beats = lines.flatMap((line, index) => {
    const beat = line.match(/^oracle-gaps: busy (\S+) in (\S+) for \d+s$/)
    return beat
      ? [
          {
            label: beat[1],
            file: beat[2],
            index,
            finishedAt: streamedAt.get(beat[1]),
          },
        ]
      : []
  })
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
    // The gap lines are not in the lead: their order is live progress, not outcome
    // (C, 2026-11-13), and they are compared as a set in stdoutGaps.
    lead: (blank < 0 ? printed : printed.slice(0, blank))
      .filter((line) => !line.startsWith(`oracle-gaps: gap `))
      .map((line) => name(line)),
    lastLine: printed.at(-1) && name(printed.at(-1)),
    // The stdout's own lines of the gap kind: the gap lines under their
    // functions, as the stream prints them (law 15). Every line of the kind
    // is kept, so a line that does not read as a gap is judged, not lost.
    stdoutGaps: printed
      .filter((line) => line.startsWith(`oracle-gaps: gap `))
      .map((line) => name(line))
      .sort(),
    // The streamed gap lines on stderr, as a sorted set: their order is live
    // progress, not outcome (C, 2026-11-13), and each line is kept.
    stderrGaps: lines
      .filter((line) => streamedGap.test(line))
      .map((line) => name(line))
      .sort(),
    baselineFiles: lines.flatMap((line) => {
      const file = line.match(
        /^oracle-gaps: baseline (?:pass|fail) (\S+)(?: \(ordinary\))?: /,
      )?.[1]
      return file === undefined ? [] : [file]
    }),
    heartbeats,
    beats,
    // The config the run says it used (law 3), and the warnings Node printed
    // for the process.
    configLines: lines.filter((line) =>
      line.startsWith(`oracle-gaps: config `),
    ),
    // The stream's grammar (law 15), recorded as relations so that a trace
    // does not depend on the order in which contexts finished. The run's own
    // output directory is named `<out>`, a relation: two checks at once are
    // given two directories, and which of them the daemon runs first is a
    // race (issue #82), so the name the driver gave a check is no part of
    // the trace, while a line that names another run's directory still
    // shows it.
    stream: streamOf(lines, name),
    // The stdout's lines, judged as the stderr's are (review of #46, F1 and
    // F2): every line of either stream is a line of the stream.
    stdoutStream: streamOf(`${stdout ?? ``}`.split(`\n`), name),
    // The output directory the run was given, as the trace names it: the
    // final line names its report there.
    outDir: name(out),
    // The run's stream log, and the first line that names it.
    log: streamLogOf(out, stderr, stdout, (text) => name(text)),
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
      status === 0 ? undefined : endingOf(status, stderr, out, name, stdout),
    exit: status,
    // An internal error's stack is in the run's error.log (law 12), which
    // the scratch directory's removal takes with it: a failure keeps it.
    stderr:
      named === undefined
        ? undefined
        : `${status === 3 && existsSync(join(out, `error.log`)) ? `error.log: ${name(readFileSync(join(out, `error.log`), `utf8`)).slice(0, 2000)}\n` : ``}${named.slice(-1500)}`,
    reported: results !== undefined,
    reportState,
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
      // Forward slashes, as the CLI names its files (the Windows paths rule).
      oracleFiles: (r.oracleFiles ?? []).map((file) =>
        posix(relative(dir, file)),
      ),
      ordinaryFiles: (r.ordinaryFiles ?? []).map((file) =>
        posix(relative(dir, file)),
      ),
      key: r.key,
      source: r.source,
      function: r.function,
      line: r.line,
      operator: r.operator,
      // The code the operator replaces (a comparison's or a logical
      // operator's token, for a swap), which names the capture helper.
      original: r.original,
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

// The pid a test mark holds, once it is a positive integer. A mark is written whole,
// and the driver still parses it before it signals anything: process.kill(0) would
// signal the driver's own group.
const pidOf = (path) => {
  try {
    const text = readFileSync(path, `utf8`).trim()
    return /^[1-9]\d*$/.test(text) ? Number(text) : undefined
  } catch {
    return undefined
  }
}

// Whether a process runs. EPERM means it runs under another user.
const isAlive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === `EPERM`
  }
}

// Once a killed process has gone (its exit is observed, not waited for by the clock).
const waitGone = async (pid) => {
  for (let waited = 0; waited < 10_000 && isAlive(pid); waited += 20)
    await new Promise((r) => setTimeout(r, 20))
  return !isAlive(pid)
}

/**
 * The daemon that serves a package, by process id: the pid its lock names,
 * when that process runs. Read from the lock, not from `ps`: Windows has no
 * `ps` the driver can rely on, and a process's command line spells the path
 * in another form (review of #73).
 */
/**
 * The paths that the package's daemon stored any run under, from its
 * evidence store (evidence.mjs), or none when it has stored nothing.
 */
function storedInputs(dir) {
  const file = join(stateDirOf(realpathSync(dir)), `evidence.json`)
  if (!existsSync(file)) return []
  return JSON.parse(readFileSync(file, `utf8`)).flatMap((row) =>
    row.variants.flatMap((variant) => variant.inputs.map(([path]) => path)),
  )
}

function daemonsOf(dir) {
  let token
  try {
    token = readFileSync(
      join(stateDirOf(realPathOf(dir)), `daemon.lock`),
      `utf8`,
    )
  } catch {
    return []
  }
  const pid = Number(token.split(`:`)[0])
  return Number.isInteger(pid) && pid > 0 && isAlive(pid) ? [pid] : []
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
  // Whether the daemon's last check stored a run that spun (`spinData`).
  let spunBefore = false
  // Whether the daemon stored a run under the mid-run marker.
  let markerStored = false
  // How many runs the daemon computed in a check of a state that nothing
  // changed, where it owes none (undefined elsewhere).
  let unchangedComputed
  // The check through the daemon during which a mid-run edit landed, and a
  // cold run of the state before the edit (the `midrun` step).
  let midrunChecks
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
      outMode: plan.outMode,
      unsupervised: plan.unsupervised,
      psMissing: plan.psMissing,
      cli: step === `otherInstall` ? otherCli() : copy,
      ordinary: plan.ordinary,
      sources: sourceArgument(plan, `${dir}.link`),
      budget: plan.budget,
      ...configArgs(plan),
      // After the `config` edit, `--config` names the second config.
      ...(state.altConfig ? { config: altConfigPath(plan) } : {}),
      // A warm daemon's check under a 3 s bound (`shortWait`): one that works
      // longer tells its CLI so, by its beats.
      ...(plan.shortWait && step !== `start`
        ? { env: { ORACLE_GAPS_TEST_WAIT_MS: `3000` } }
        : {}),
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
    //
    // Two checks at once reach one daemon, which runs one check at a time,
    // in the order their requests reach it. That order is a race between
    // two processes and no part of the contract (daemon.mjs: "One check runs
    // at a time"), so either check may be the one the daemon runs first. The
    // pair is recorded by what each check did, not by which process the
    // driver started first: the check that computed more runs comes first,
    // as the daemon's earlier check, and the other is the later one. Each is
    // still judged in full, and a test's console output (the `note test
    // output` line) belongs to the check that ran the test (issue #82).
    //
    // A plan may hold the two in the daemon at once (`holdOverlap`, the
    // test-only hold ORACLE_GAPS_TEST_HOLD_OVERLAP): the first check the
    // daemon runs waits until the daemon has accepted the second request, a
    // count, never a time (R57). The hold pins the overlap, not the order:
    // either check may still be the one the daemon runs first. The daemon
    // writes the count to the mark when it releases the hold.
    const overlapMark =
      twice && plan.holdOverlap
        ? join(mkdtempSync(join(realpathSync(tmpdir()), `gap-overlap-`)), `n`)
        : undefined
    const hold = overlapMark
      ? { env: { ORACLE_GAPS_TEST_HOLD_OVERLAP: overlapMark } }
      : {}
    const [daemon, ...others] = twice
      ? (
          await runClisAtOnce(dir, files, [
            { ...how, daemon: true, ...hold },
            { ...how, daemon: true, outName: `out-daemon-2`, ...hold },
          ])
        ).sort(byRole)
      : await daemonChecks(step, files, how, () => {
          // The files of the state before this step's edit.
          const before = trail.at(-2)
          return fixtureFiles(resolveHistory(before.history), before)
        })
    // Whether the daemon held its first check until it had accepted both.
    const heldTogether =
      overlapMark !== undefined &&
      existsSync(overlapMark) &&
      Number(readFileSync(overlapMark, `utf8`)) >= 2
    if (overlapMark)
      rmSync(dirname(overlapMark), { recursive: true, force: true })
    if (!cold.has(key)) cold.set(key, runCli(dir, files, how))
    const coldRun = cold.get(key)
    if (plan.outMode === `default`)
      states.add(`a daemon check with the default output directory`)
    // A check through the daemon of a state that nothing changed reuses
    // every run that the store keeps (the README's reuse contract: a run is
    // reused while its inputs are unchanged), so where no test reads the
    // clock it computes no run that was not cut off (third and fourth
    // reviews of #55, F-A and F-A2). The incremental check judges the count.
    // The later of two checks at once is such a check: nothing changed
    // after the daemon's earlier check of the same state, whose evidence is
    // stored before it replies. So one of the two computes and the other
    // reuses, whichever order the daemon took them in.
    const reuseOwed = plan.tests.every((t) => !t.flaky)
    unchangedComputed =
      step === `recheck` && reuseOwed ? computedRuns(daemon) : undefined
    const laterComputed =
      twice && reuseOwed ? computedRuns(others[0]) : undefined
    for (const [i, run] of [daemon, ...others].entries()) {
      // A daemon's call: the daemon the driver killed during it, if any, or
      // the one that held its check until the CLI fell back, wrote the lines
      // of its own batches (daemonChecks, heldPhase).
      observe(
        `retention:daemon`,
        retentionBreaches(run.retention, {
          checkPid: run.checkPid,
          killed: run.killed ?? run.heldBy,
          complete: run.reported,
          cold: false,
        }),
      )
      observe(
        `retention:cold`,
        retentionBreaches(coldRun.retention, {
          checkPid: coldRun.checkPid,
          complete: coldRun.reported,
          cold: true,
        }),
      )
      observe(`incremental`, {
        step: i === 0 ? step : `${step} (a second check at once)`,
        markerStored,
        unchangedComputed: i === 0 ? unchangedComputed : laterComputed,
        midrun:
          i === 0 && step === `midrun` && midrunChecks
            ? {
                during: {
                  exit: midrunChecks.during.exit,
                  report: midrunChecks.during.report,
                  stream: midrunChecks.during.stream,
                  stdoutStream: midrunChecks.during.stdoutStream,
                  // The stream check (endsBreach) judges the log, the output directory
                  // and the results of the run too.
                  log: midrunChecks.during.log,
                  outDir: midrunChecks.during.outDir,
                  reported: midrunChecks.during.reported,
                  reportState: midrunChecks.during.reportState,
                  stdoutGaps: [...midrunChecks.during.stdoutGaps].sort(),
                },
                before: {
                  exit: midrunChecks.before.exit,
                  report: midrunChecks.before.report,
                },
                // Whether the edit landed in that check.
                landed: Boolean(midrunChecks.landed),
                // File b's own test, when it lands the edit (see below).
                editing:
                  plan.midrunBy === `b`
                    ? { file: `tests/b.test.ts` }
                    : undefined,
              }
            : undefined,
        cold: {
          exit: coldRun.exit,
          refusal: coldRun.refusal,
          report: coldRun.report,
          notes: coldRun.stream.notes,
          // An internal error's stack (its error.log, which readRun reads
          // for a run that exits 3), for the violation's message. Only
          // then: a completed run's stderr holds timings, which differ
          // between two runs of one history.
          stderr: coldRun.exit === 3 ? coldRun.stderr : undefined,
        },
        daemon: {
          ...checkRecord(run),
          // Whether its daemon held the check's reply and nothing ended it
          // while the CLI ran (`heldPhase`).
          held: run.held === true,
          // Whether a daemon wrote into that run's --out after its CLI fell
          // back (`heldPhase`).
          rewritten: run.rewritten ?? [],
          // Whether the daemon that held the check had ended by the time
          // its CLI had (`afterFallback`).
          daemonEnded: run.daemonEnded === true,
        },
      })
    }
    if (twice && step === `start`)
      states.add(`two checks started the daemon at once`)
    // A warm daemon's check under the short bound that cut a slow copy and
    // ran its 10 s confirmation (`shortWait`), and did not fall back.
    if (
      plan.shortWait &&
      step !== `start` &&
      daemon.reported &&
      (daemon.evidence?.cut ?? 0) > 0 &&
      !daemon.stream.notes.some((note) => coldFallbackNote.test(note)) &&
      plan.tests.some((t) => t.slow)
    )
      states.add(`a check through the daemon worked past its CLI's bound`)
    // Two checks held in the daemon at once, the earlier of which computed
    // runs and the later reused them: the state in which the order of the
    // two matters, and in which a daemon that served an overlapping request
    // from anything but the earlier check's store would compute again. The
    // overlap is the hold's count, not a reading of two processes' timing.
    if (
      twice &&
      heldTogether &&
      computedRuns(daemon) > 0 &&
      laterComputed === 0 &&
      (others[0].evidence?.reused ?? 0) > 0
    )
      states.add(
        `of two checks held in the daemon at once, one computed and the other reused`,
      )
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
    if (unchangedComputed === 0 && reused > 0) {
      states.add(`an unchanged check through the daemon computed nothing`)
      if (plan.prePlugin)
        states.add(
          `an unchanged check through the daemon computed nothing under a config's pre plugin`,
        )
      // A test that reads a source under test through fs and as a `?raw`
      // import reads the file's text, while the context serves the
      // instrumented text: two inputs (fourth review of #55, F-A2).
      if (plan.tests.some((t) => t.rawImport))
        states.add(
          `an unchanged check through the daemon computed nothing while a test read a source through fs`,
        )
    }
    // A daemon check after an edit that computed fewer runs cut off by their
    // call budget than the cold run of the same state reused such a run, so
    // law 9 judged a timeout that came from the store (#104). The witness's
    // spin (`w_spin`, file a only) is cut by a count the CLI records, its
    // call budget, so the number of such runs a check computes follows from
    // the history; the helper edit changes only file b, so the daemon reuses
    // the spun run. Runs cut by the clock (the hangs) are not counted: on main
    // a hang is final at once only when the sampler saw it idle, which load
    // decides, and otherwise its confirmation is cut short by its mutant's
    // budget and not stored (determinism under load, the register's C entry
    // of 2026-11-13, and v21.2 R57; #99 cuts hangs by state).
    if (
      plan.witness !== false &&
      step !== `start` &&
      !daemonEvents.has(step) &&
      reused > 0 &&
      (daemon.evidence?.spin ?? 0) < (coldRun.evidence?.spin ?? 0)
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
      // An edit of only a file a test reads through fs, by each kind of read.
      if (step === `fsData`)
        states.add(
          `an edit to data read through ${plan.fsRead} changed the cold result`,
        )
      // The daemon's previous check stored runs of file b's copies that read
      // the data and spun (`spinData`), a file that b's unmutated run never
      // reads: the runner must store each such run under the inputs it read
      // (F-D), so the edit makes the daemon compute it again (law 9).
      if (step === `fsData` && plan.spinData && spunBefore)
        states.add(
          `an edit to data that only a spun copy read changed the cold result`,
        )
      // The same, where each spun copy also threw outside its test, so the
      // CLI ran its batch's copies alone and stored the spun run from a run
      // alone (`spinThrows`; merge gate F4).
      if (step === `fsData` && plan.spinData && plan.spinThrows && spunBefore)
        states.add(
          `an edit to data that only a copy spun alone read changed the cold result`,
        )
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
    spunBefore = (daemon.evidence?.spin ?? 0) > 0
    replacedOnly = plan.contexts === 1 && cutBefore
    previous = coldRun
  }
  const stop = () =>
    spawnSync(
      process.execPath,
      [join(copy, `index.mjs`), `--stop-daemon`, `--package`, dir],
      { cwd: repo, encoding: `utf8`, timeout: 60_000, env: cleanEnv() },
    )
  // What a fallback leaves (`heldPhase`, `slowOpen`): once the CLI has
  // ended, whether the daemon that held its check still runs; the driver then
  // poisons the run's --out, takes what the directory holds, releases the
  // daemon (a file, never the clock), and runs one more check through the
  // daemon, which the daemon serves only after the check it held (its one
  // queue). Any file of the directory that is added, removed or changed by
  // then was written by the abandoned check (merge gate F2; delta 4, P11): the
  // run's printed summary would no longer match its --out, and a copy of the
  // cold check that reads the shared state.json (a setup that cannot
  // `inject`) could have read the daemon's mutant. The poison is the run's
  // results.json and an error.log, which a check removes as it starts (a
  // completed cold run leaves none). The daemon that held the check must
  // serve that next check (its served mark): a fallback leaves a healthy
  // daemon to serve later checks (delta 3).
  function afterFallback(run, files, how, { out, pid, release, served }) {
    run.daemonEnded = !isAlive(pid)
    run.heldBy = pid
    mkdirSync(out, { recursive: true })
    const poison = `{"poison":"written by the driver after the CLI ended"}\n`
    for (const name of [`results.json`, `error.log`])
      writeFileSync(join(out, name), poison)
    const left = snapshotOf(out)
    rmSync(served, { force: true })
    writeFileSync(release, ``)
    runCli(dir, files, { ...how, daemon: true, outName: `out-released` })
    const now = snapshotOf(out)
    // The files the abandoned check added, removed or changed, by name.
    run.rewritten = [...new Set([...left.keys(), ...now.keys()])]
      .filter((path) => left.get(path) !== now.get(path))
      .sort()
    run.held = true
    return (
      !run.daemonEnded &&
      run.rewritten.length === 0 &&
      pidOf(served) === pid &&
      run.exit === 0 &&
      run.reported &&
      run.stream.notes.some((note) => coldFallbackNote.test(note))
    )
  }
  // A pid a test mark holds, waited for: the hold has happened. Its backstop
  // fails loudly (R57).
  async function heldPid(mark, what) {
    for (let waited = 0; ; waited += 20) {
      const pid = pidOf(mark)
      if (pid !== undefined) return pid
      if (waited >= 60_000)
        throw new Error(
          `oracle-gaps.report: ${what} saw no daemon pause within 60 s`,
        )
      await new Promise((r) => setTimeout(r, 20))
    }
  }
  // A daemon start slower than the CLI's bound (merge gate delta 4, F-h): a
  // fresh daemon whose session takes longer to open than the CLI waits, held
  // by a count in place of the clock. The daemon holds its first check before
  // it runs until it has accepted a second request
  // (ORACLE_GAPS_TEST_HOLD_OVERLAP), so it sends its CLI nothing; that second
  // request is the driver's next check, sent only once the CLI has ended. The
  // CLI's bound (3 s) runs out and it checks cold, while its environment
  // carries the daemon's warm-up pause (`daemon-warm`), as the slow warm-up's
  // does. A test-only hook never changes an outcome (v21.2 G43): the cold
  // check owes a cold run's result in a cold run's time, whatever point the
  // daemon has reached, so the pause is the daemon's alone. Then the daemon
  // must still run, write nothing more into the run's --out, and serve the
  // next check (afterFallback).
  async function slowOpen(files, how) {
    const marks = mkdtempSync(join(realpathSync(tmpdir()), `gap-open-`))
    const release = join(marks, `release`)
    const served = join(marks, `served`)
    const outs = []
    const [run] = await runClisAtOnce(
      dir,
      files,
      [
        {
          ...how,
          daemon: true,
          env: {
            ORACLE_GAPS_TEST_HOLD_OVERLAP: join(marks, `overlap`),
            ORACLE_GAPS_TEST_PAUSE_AT: `daemon-warm`,
            ORACLE_GAPS_TEST_PAUSE_MARK: join(marks, `warm`),
            ORACLE_GAPS_TEST_PAUSE_RELEASE: release,
            ORACLE_GAPS_TEST_SERVED_MARK: served,
            ORACLE_GAPS_TEST_WAIT_MS: `3000`,
          },
          backstopMs: 120_000,
        },
      ],
      outs,
    )
    // The daemon that holds the check: the one the package's lock names.
    const [pid] = daemonsOf(dir)
    if (afterFallback(run, files, how, { out: outs[0], pid, release, served }))
      states.add(`a slow daemon start was served by the daemon`)
    return [run]
  }
  // A check through a daemon that stops answering, held at one named point
  // of the daemon's own (`pauseAt` in daemon.mjs), never by the clock, until
  // the driver releases it. A warm check first starts the daemon with the
  // pause disarmed (ORACLE_GAPS_TEST_PAUSE_ARM) and the warm state's files,
  // so the held check reaches a daemon whose session is open and that sends
  // its CLI nothing at the point; then the pause is armed. The points:
  // - `daemon-check` (`replyHeld`): before the check runs, so the daemon has
  //   written nothing into the run's --out, and only a real cold check gives
  //   the run its report (F7);
  // - `daemon-warm` (`slowStart: warm`): before the check warms its contexts,
  //   a healthy warm-up made slow (merge gate D1). The warm check is of the
  //   same state, so the held check reuses every run and starts no copy: only
  //   the drop at a phase's end can stop it before it writes the run's --out;
  // - `daemon-replace` (`slowStart: replace`): before a context warms in place
  //   of one a cut stopped, a slow config load in the middle of a phase (merge
  //   gate delta 4, P11). The warm check is of the state before the step's
  //   edit, so the held check computes the edited file's runs, and its hang
  //   is cut.
  // The held check's CLI waits 3 s (ORACLE_GAPS_TEST_WAIT_MS), so its bound
  // on a daemon that sends nothing comes early, and it writes no wait mark, so
  // nothing pauses it there. Each call's backstop (120 s) ends a CLI that
  // never ends, and the incremental check reports the stopped run as no cold
  // fallback. Once the CLI has ended, afterFallback judges what the daemon
  // left. Returns the held run and whether the fallback left what it owes.
  async function heldPhase(files, warmFiles, how, point) {
    const marks = mkdtempSync(join(realpathSync(tmpdir()), `gap-held-`))
    const pauseMark = join(marks, `pid`)
    const armMark = join(marks, `armed`)
    const release = join(marks, `release`)
    const served = join(marks, `served`)
    const pause = {
      ORACLE_GAPS_TEST_PAUSE_AT: point,
      ORACLE_GAPS_TEST_PAUSE_MARK: pauseMark,
      ORACLE_GAPS_TEST_PAUSE_ARM: armMark,
      ORACLE_GAPS_TEST_PAUSE_RELEASE: release,
      ORACLE_GAPS_TEST_SERVED_MARK: served,
    }
    stop()
    const [warmRun] = await runClisAtOnce(dir, warmFiles, [
      {
        ...how,
        daemon: true,
        outName: `out-warm`,
        env: pause,
        backstopMs: 120_000,
      },
    ])
    observe(
      `retention:warm`,
      retentionBreaches(warmRun.retention, {
        checkPid: warmRun.checkPid,
        complete: warmRun.reported,
        cold: false,
      }),
    )
    writeFileSync(armMark, ``)
    const outs = []
    const [run] = await runClisAtOnce(
      dir,
      files,
      [
        {
          ...how,
          daemon: true,
          env: { ...pause, ORACLE_GAPS_TEST_WAIT_MS: `3000` },
          backstopMs: 120_000,
        },
      ],
      outs,
    )
    const pid = await heldPid(pauseMark, `a check held at ${point}`)
    const left = afterFallback(run, files, how, {
      out: outs[0],
      pid,
      release,
      served,
    })
    rmSync(marks, { recursive: true, force: true })
    return [run, left]
  }
  // One check through the daemon, with what the step does to the daemon
  // meanwhile: paused once the check has begun for longer than the CLI
  // waits for a daemon, then killed (`dieMidCheck`), or stopped and killed
  // before it reads the request, which resets the connection
  // (`resetBeforeRead`). A plan whose warm daemon is replaced stops it after the
  // warm check, so the paused check is served by a daemon that did not serve it.
  async function daemonChecks(step, files, how, previousFiles) {
    // The mid-run edit: the check starts from the state before the edit,
    // with the edit marked pending, and a test lands it while the check
    // runs. File a's test edits file b's helper after its context loaded
    // it and before file b's runs read it; file b's own test edits its
    // helper, or the data file that it reads through fs, after b's judged
    // tests read them, so the run that lands the edit judged the old text.
    // That check may report, for each mutant, what a cold run of either
    // state reports (third review of #55, F-C: one extra cold run, of the
    // state before the edit); the runner must store no run under a text it
    // did not read (settleIn), so the next check, with nothing changed,
    // equals a cold run of the state after the edit.
    if (step === `midrun`) {
      // The edited file's key in the fixture's files (under the `link` test
      // root, the tests' files live where `tests` links to).
      const target = fixturePathOf(
        plan,
        plan.midrunTarget === `data` ? `tests/data.json` : `tests/strict.ts`,
      )
      const after = files[target]
      const value = after.includes(`true`)
      // The marker goes in the running daemon's session directory, where
      // the test finds it beside the runner's harness. With no daemon
      // running (a step before killed it), no edit lands.
      const [daemonPid] = daemonsOf(dir)
      const marker =
        daemonPid && join(dir, `.oracle-gaps-${daemonPid}`, `midrun.txt`)
      if (marker && existsSync(dirname(marker)))
        writeFileSync(marker, `pending:${value}\n`)
      const before = {
        ...files,
        [target]: after.replace(String(value), String(!value)),
      }
      const during = runCli(dir, before, { ...how, daemon: true })
      const landed =
        marker &&
        existsSync(marker) &&
        readFileSync(marker, `utf8`) === `done\n` &&
        readFileSync(join(dir, target), `utf8`) === after
      if (marker) rmSync(marker, { force: true })
      if (landed) {
        states.add(`an edit landed during a check through the daemon`)
        if (plan.midrunBy === `b`)
          states.add(
            `a run edited the ${plan.midrunTarget} it had read, during a check through the daemon`,
          )
      }
      const next = runCli(dir, files, { ...how, daemon: true })
      // The marker is out of a run's inputs by design; a runner that stored
      // a run under it would let the marker's edit, and not the helper's or
      // the data's, decide whether a run is stored.
      markerStored ||= storedInputs(dir).some((path) =>
        path.endsWith(`/midrun.txt`),
      )
      midrunChecks = { during, before: runCli(dir, before, how), landed }
      // The check the edit overlapped, through the daemon, and the cold run of
      // the state before the edit: each call's lines are judged as any call's.
      for (const run of [during, midrunChecks.before])
        observe(
          `retention:midrun`,
          retentionBreaches(run.retention, {
            checkPid: run.checkPid,
            complete: run.reported,
            cold: run === midrunChecks.before,
          }),
        )
      return [next]
    }
    if (step === `start` && plan.slowStart === `open`)
      return slowOpen(files, how)
    // A check held past its CLI's bound at one of the daemon's points
    // (`heldPhase`): its point, the warm check's files, and the state the
    // fallback enters when it leaves what it owes.
    const holding =
      step === `dieMidCheck` && plan.replyHeld
        ? [
            `daemon-check`,
            files,
            `a check whose daemon stopped answering ran cold`,
          ]
        : step === `start`
          ? undefined
          : plan.slowStart === `warm`
            ? [`daemon-warm`, files, `a slow warm-up was served by the daemon`]
            : plan.slowStart === `replace`
              ? [
                  `daemon-replace`,
                  previousFiles(),
                  `a check abandoned while a context warmed in place of a cut one wrote nothing more`,
                ]
              : undefined
    if (holding !== undefined) {
      const [point, warmFiles, state] = holding
      const [run, left] = await heldPhase(files, warmFiles, how, point)
      if (left) states.add(state)
      return [run]
    }
    if (step !== `dieMidCheck` && step !== `resetBeforeRead`)
      return [runCli(dir, files, { ...how, daemon: true })]
    stop()
    const marks = mkdtempSync(join(realpathSync(tmpdir()), `gap-pause-`))
    const pauseMark = join(marks, `pid`)
    const armMark = join(marks, `armed`)
    const waitMark = join(marks, `waited`)
    const servedMark = join(marks, `served`)
    const mid = step === `dieMidCheck`
    // A plan may disarm the pause (a constructed history): then nothing engages.
    const pause =
      plan.pauseEngages === false
        ? {}
        : {
            ORACLE_GAPS_TEST_PAUSE_AT: mid ? `daemon-reply` : `daemon-read`,
            ORACLE_GAPS_TEST_PAUSE_MARK: pauseMark,
            // The reset's pause waits for its arm, after the warm check; the
            // reply's engages at once.
            ...(mid ? {} : { ORACLE_GAPS_TEST_PAUSE_ARM: armMark }),
          }
    const env = {
      ...pause,
      ORACLE_GAPS_TEST_SERVED_MARK: servedMark,
      ...(mid
        ? {
            ORACLE_GAPS_TEST_WAIT_MS: `3000`,
            ORACLE_GAPS_TEST_WAIT_MARK: waitMark,
          }
        : {}),
    }
    // The warm daemon: an earlier check through it serves before the pause is
    // armed, so the reset hits a daemon with a session. Its pid is the one the
    // served mark holds (the witness for the warm label).
    let warm
    if (!mid) {
      const [warmRun] = await runClisAtOnce(dir, files, [
        { ...how, daemon: true, outName: `out-warm`, env },
      ])
      observe(
        `retention:warm`,
        retentionBreaches(warmRun.retention, {
          checkPid: warmRun.checkPid,
          complete: warmRun.reported,
          cold: false,
        }),
      )
      warm = pidOf(servedMark)
      // The warm daemon is stopped before the pause is armed: an armed daemon
      // holds the stop's own connection unread, so the stop would never end.
      if (plan.warmReplaced) stop()
      writeFileSync(armMark, ``)
    }
    let finished = false
    const running = runClisAtOnce(dir, files, [{ ...how, daemon: true, env }])
    running.then(() => {
      finished = true
    })
    // The pause's pid, as the daemon wrote it. No pause within 60 s, with the
    // check still running, is a failure of the test, not a skipped label.
    let pid
    for (let waited = 0; !finished; waited += 20) {
      pid = pidOf(pauseMark)
      if (pid !== undefined) break
      if (waited >= 60_000)
        throw new Error(
          `oracle-gaps.report: ${step} saw no daemon pause within 60 s`,
        )
      await new Promise((r) => setTimeout(r, 20))
    }
    // dieMidCheck's CLI marks its wait; a missing mark means the hold is not
    // observed (the label is absent), and the kill still comes.
    for (
      let waited = 0;
      pid !== undefined &&
      mid &&
      !finished &&
      !existsSync(waitMark) &&
      waited < 60_000;
      waited += 20
    )
      await new Promise((r) => setTimeout(r, 20))
    const held = mid && existsSync(waitMark)
    const killed = pid !== undefined && !finished
    if (killed) process.kill(pid, `SIGKILL`)
    const gone = killed ? await waitGone(pid) : false
    const runs = await running
    // The daemon the driver killed, once it is dead: its lines are its own.
    if (killed && !isAlive(pid)) runs[0].killed = pid
    if (runs[0].retention.some((line) => line.pid === runs[0].killed))
      states.add(`a killed daemon's retention lines were judged as its own`)
    rmSync(marks, { recursive: true, force: true })
    // Each label needs its pause's observation: a kill the driver sent and saw
    // through (gone), and the CLI's report of the check. A label without a pause
    // is attested, not observed, so it is an error rather than a state.
    const labels = []
    if (killed && gone && runs[0].reported) {
      if (mid) {
        labels.push(`a check whose daemon died during it`)
        if (held)
          labels.push(
            `a check whose daemon held it past the CLI's wait, then died`,
          )
      } else {
        labels.push(`a check whose connection was reset`)
        if (warm !== undefined && warm === pid)
          labels.push(`a warm daemon's connection was reset`)
        if (warm !== undefined && warm !== pid)
          states.add(`a warm daemon was replaced before the pause`)
      }
    }
    if (!killed) states.add(`a daemon pause that did not engage`)
    if (labels.length > 0 && !killed)
      throw new Error(
        `oracle-gaps.report: ${step} recorded ${labels.join(`, `)} without a daemon pause`,
      )
    // The warm label names the daemon that served the warm check. A reset of
    // another daemon carries no warm label, whatever the warm check served.
    if (labels.includes(`a warm daemon's connection was reset`) && warm !== pid)
      throw new Error(
        `oracle-gaps.report: ${step} recorded a warm daemon's connection was reset, but its daemon did not serve the warm check`,
      )
    for (const label of labels) states.add(label)
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
  // Calls are counted within this history, so two runs of one history name the same directories.
  runSeq = 0
  // A package that resolves no TypeScript, has no config, or has its
  // config in its parent directory lives outside this repository
  // (`outsideRepository`); the last in a directory `pkg` of the scratch
  // directory, which holds its config. A package whose config's test root is
  // the directory above it (`testRoots`) lies in `pkg` too, so the root holds
  // only the package.
  const scratch = realpathSync(
    mkdtempSync(
      outsideRepository(plan)
        ? join(realpathSync.native(tmpdir()), `gap-fixture-`)
        : plan.siblingDir
          ? `${here}-sibling-`
          : join(here, `.scratch-`),
    ),
  )
  const dir =
    plan.configPlace === `parent` || plan.testRoot === `parent`
      ? join(scratch, `pkg`)
      : scratch
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
    // A batch's closing rows written in two appends, around two polls of
    // its watchdog (`tornRows`). The hook's directory sits beside the package
    // and holds each batch's count and its witness markers.
    const tornPolls = `${dir}.torn-polls`
    if (plan.tornRows) mkdirSync(tornPolls, { recursive: true })
    const how = {
      ordinary: plan.ordinary,
      sources: sourceArgument(plan, `${dir}.link`),
      budget: plan.budget,
      outMode: plan.outMode,
      logBlocked: plan.logBlocked,
      unsupervised: plan.unsupervised,
      psMissing: plan.psMissing,
      cli: plan.cliPath === `spaced` ? copy : here,
      ...configArgs(plan),
      // A rejected batch ends through the internal error's ending, the one ending a history reaches that
      // names its log, so its output directory's name holds a line break where the platform allows one
      // (not on win32): its error line and done line must escape it (the register's C entry "The
      // internal-error line").
      ...(plan.rejectBatch > 0
        ? {
            env: { ORACLE_GAPS_TEST_REJECT_BATCH: String(plan.rejectBatch) },
            outBreak: process.platform !== `win32`,
          }
        : {}),
      foreign: plan.foreign,
    }
    // Two runs on one output directory: the second's refusal is its own
    // observation (overlappingRuns). A torn-row check runs with its env.
    const overlapping = plan.overlap
      ? await overlappingRuns(dir, files, how)
      : undefined
    const { replay, retention, checkPid, ...cli } =
      overlapping?.cli ??
      runCli(
        dir,
        files,
        plan.tornRows
          ? {
              ...how,
              env: { ...how.env, ORACLE_GAPS_TEST_TORN_ROWS: tornPolls },
            }
          : how,
      )
    if (overlapping) observe(`overlap`, overlapping.overlap)
    // The watchdog read a closing row while the worker wrote it: a hold
    // marks `reached` once two polls came after its first half. A hold that
    // waited 60 s with no poll marks `unreached`, and the witness fails
    // loudly rather than passing without its state.
    const holds = plan.tornRows ? readdirSync(tornPolls) : []
    rmSync(tornPolls, { recursive: true, force: true })
    const count = (suffix) =>
      holds.filter((name) => name.endsWith(suffix)).length
    const reached = count(`.reached`)
    // Each batch that ran marks `.begun`, and each batch's hold must mark
    // `.reached`: every batch's hold is witnessed, not only the first one's.
    // A plan with two contexts must begin two batches, which run concurrently
    // (a shared marker name, or a hold only the first batch takes, fails it).
    if (
      plan.tornRows &&
      (reached === 0 ||
        count(`.unreached`) > 0 ||
        reached !== count(`.begun`) ||
        (plan.contexts > 1 && count(`.begun`) < 2))
    )
      throw new Error(
        `the torn-row witness was not reached: ${reached} hold(s) completed, ${count(`.unreached`)} timed out, ${count(`.begun`)} batch(es) began (${holds.join(`, `)})`,
      )
    const tornRead = reached > 0
    // How many units were computed or reused says how the result was
    // produced, not what it is, so it is not observed. Heartbeats are progress,
    // not outcome (maintainer decision, 2026-11-14): their set depends on
    // wall-clock timing, so the trace keeps none of them, and their shape
    // breaches are observed as `beats`, which is empty in a correct run. A
    // rejected batch's run ends in an internal error: the baseline lines printed before its batch come in no fixed order, so it observes its exit, its
    // last line, the laws that judge the run before retention (the register: the order of streamed
    // lines is not part of the contract), both streams as law 15 reads them (relations that do not
    // depend on that order), and where its ending put its stack (law 12).
    observe(
      `cli`,
      plan.rejectBatch > 0
        ? {
            exit: cli.exit,
            lastLine: cli.lastLine,
            // The done line ends both streams (P10): stderr's last line.
            stderrLast: cli.stderr?.trimEnd().split(`\n`).at(-1),
            configLines: cli.configLines,
            strayWrites: cli.strayWrites,
            warnings: cli.warnings,
            stream: cli.stream,
            stdoutStream: cli.stdoutStream,
            // Its stream log (law 15): the note that names it, and its lines.
            log: cli.log,
            outDir: cli.outDir,
            errorLog: cli.ending?.errorLog,
            stackFrames: cli.ending?.stackFrames,
          }
        : unbeaten(cli),
    )
    observe(`beats`, { breaches: heartbeatBreaches(cli) })
    // Deterministic: the law's breaches (none), not the lines, whose batch
    // splits vary with hang cuts. A rejected batch (a constructed fault) ends
    // the check before its report, and owes its own line.
    observe(
      `retention`,
      retentionBreaches(retention, {
        checkPid,
        complete: cli.reported,
        cold: true,
        rejectBatch: plan.rejectBatch,
      }),
    )
    // A failing owner's replay, run as the author would run it (law 3).
    if (plan.fault === `brokenOwner`)
      observe(`replay`, { command: replay, ran: replayed(dir, replay) })
    // Reach comes from what the CLI reported, mapped onto the plan.
    const states = new Set()
    if (
      plan.rejectBatch > 0 &&
      retention.some(
        (line) =>
          line.pid === checkPid &&
          line.batch === plan.rejectBatch - 1 &&
          line.after !== undefined,
      )
    )
      states.add(`a rejected batch retired its copies and logged them`)
    // Law 12's internal error, where law 15 judges its lines: the run's own
    // ending (ending.mjs), not a process the supervisor saw end.
    if (cli.exit === 3 && cli.ending?.errorLog)
      states.add(`a run ended in an internal error`)
    if (retention.length > 1) states.add(`a check that ran more than one batch`)
    if (plan.claimScenario) {
      const claim = await claimScenarioRuns(dir, files, how, plan.claimScenario)
      observe(`claimScenario`, claim)
      states.add(claimStateOf[claim.scenario])
    }
    // Every platform has the supervisor (#201 ports it to win32), so the
    // witness runs on each: a win32 child's watchdog ends its tree by taskkill.
    if (plan.supervisorDeath) {
      observe(`supervisorDeath`, await supervisorDeathRuns(dir, files, how))
      states.add(`a supervised child exits when its supervisor is killed`)
    }
    if (plan.logLost) {
      observe(
        `unwritableLog`,
        await unwritableLogRuns(dir, files, how, plan.logLost),
      )
      states.add(lostStateOf[plan.logLost])
    }
    if (plan.outMode === `default`)
      states.add(`a run with the default output directory`)
    // The cold run is supervised, and its PATH named no command (POSIX: no `ps`).
    if (plan.psMissing && process.platform !== `win32` && cli.exit === 0)
      states.add(`a supervised check with no ps on its PATH`)
    // A blocked log refuses the run before its check starts, and only an
    // argument refusal comes before it (the model's `refusal`).
    const logRefused =
      plan.logBlocked && plan.fault !== `outsideSource` && cli.exit === 2
    if (logRefused) states.add(`a stream log that cannot be written`)
    if (overlapping && overlapping.overlap.exit === 2)
      states.add(`two runs on one output directory`)
    if (tornRead && cli.reported)
      states.add(`a capture row read while the worker wrote it`)
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
      observe(
        `retention:partial`,
        retentionBreaches(partial.retention, {
          checkPid: partial.checkPid,
          complete: partial.reported,
          cold: true,
        }),
      )
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
    // Whether an earlier stop run of this history ran a check, so its session
    // directory existed: the run after it starts on what that run left.
    let checkedBefore = false
    // How many session directories of its own the previous run left, when
    // the driver killed its CLI (`kill`): the directory the CLI wrote, with
    // its own `host` file, which the next run that opens a session removes.
    let killedLeft = 0
    // A session directory is named by the process that made it, which
    // differs on every run, and two names sort by their pids. The law reads
    // only whether a run left a directory of its own, and whether a later run
    // kept one that was there before it, so the observation holds counts,
    // which no name or order changes: how many session directories the
    // package has once the run ended, how many of them the run made (`own`),
    // and how many were there before it (`kept`).
    // Before each stop run that opens a session (every stop but one before
    // the CLI starts, as it starts, or at its note), the package holds the
    // session directory of a run on this host whose process was killed
    // before it cleaned up: a dead pid's directory with its `host` file, as
    // SIGKILL leaves it. The stopped run must remove it (law 10).
    // A drawn history switches no test-only hook on (v21.2 I16): its abort is
    // the CLI's own hook, so only a constructed history with `hookStops` may
    // carry one. Every stop of a win32 history goes through the test stop file,
    // so without `hookStops` a win32 history runs none (the same rule).
    if (!plan.hookStops && plan.stopRuns.some((stop) => stop.when === `abort`))
      throw new Error(
        `a history without hookStops drew an abort stop: a drawn field switched the abort hook on (I16)`,
      )
    const stops =
      process.platform === `win32` && !plan.hookStops ? [] : plan.stopRuns
    if (cli.exit === 0 && stopIds.length > 0)
      for (const stop of [
        ...stops,
        ...(plan.spawnStop
          ? [
              {
                signal: plan.spawnSignal,
                pool: `threads`,
                when: `spawn`,
                delay: plan.spawnDelay,
                onStart: plan.spawnOnStart,
              },
            ]
          : []),
      ]) {
        const opensSession = stop.when !== `spawn` && stop.when !== `note`
        const before = opensSession
          ? [...previousSessions, killedSession(dir)]
          : previousSessions
        const { retention, checkPid, ...run } = await stoppedRun(
          dir,
          files,
          how,
          stopIds,
          stop,
        )
        // A stopped check ends before its report: each index at most once.
        observe(
          `retention:stop`,
          retentionBreaches(retention, {
            checkPid,
            complete: false,
            cold: true,
          }),
        )
        const stopped = {
          ...run,
          // An abort ends the process that runs the check. Unsupervised (the
          // test-only hook, which runs the check as the CLI's own process), that
          // process is the CLI's own, so the run is killed before it cleans up;
          // supervised (every run on POSIX, and on win32 since the supervisor
          // covers it), the CLI outlives it and removes the session directory.
          killed:
            stop.when === `kill` ||
            (stop.when === `abort` && plan.unsupervised),
          sessions: {
            present: run.sessions.length,
            own: run.sessions.filter((name) => !before.includes(name)).length,
            kept: run.sessions.filter((name) => before.includes(name)).length,
          },
        }
        observe(`stopped`, stopped)
        if (plan.outMode === `default`)
          states.add(`a stop with the default output directory`)
        if (opensSession && stopped.spun)
          states.add(`a run after a killed one that left its session`)
        if (opensSession && stopped.spun && killedLeft > 0)
          states.add(`a run after a killed CLI that left its own session`)
        killedLeft =
          stop.when === `kill` && stopped.spun ? stopped.sessions.own : 0
        if (
          stop.when === `spawn` &&
          checkedBefore &&
          run.started === false &&
          run.held === true
        )
          states.add(`a stop before the CLI starts, after a stopped check`)
        if (opensSession && stopped.spun) checkedBefore = true
        previousSessions = run.sessions
        if (!stopped.spun) continue
        // A killed CLI owes no line (L1); its state is the next run's.
        if (stop.when === `kill`) continue
        if (stop.when === `after`) {
          states.add(`a stop signal after the completed line`)
          continue
        }
        // A spawn stop's state is the hold it landed in: before the CLI's
        // first statement (the driver's preload), or during the CLI's loads,
        // which the CLI kept, so its supervisor started no child (POSIX) and
        // the stopped line follows the note.
        if (stop.when === `spawn`) {
          if (run.started === false && run.held === true)
            states.add(`a stop before the CLI starts`)
          if (run.started === true && run.childStarted === false) {
            states.add(`a stop as the CLI starts`)
            if (run.signal === `SIGTERM`)
              states.add(`a stop by SIGTERM as the CLI starts`)
          }
          continue
        }
        if (stop.when === `warm`) {
          states.add(`a stop signal while the config warms`)
          continue
        }
        // The unsupervised run writes its own stopped line (stopNow): every
        // run on win32, and the constructed unsupervised history on POSIX.
        if (stop.when === `note`) {
          if (plan.unsupervised || process.platform === `win32`)
            states.add(`an unsupervised run stopped after its note`)
          continue
        }
        if (stop.when === `abort`) {
          states.add(`a run whose process aborted`)
          continue
        }
        states.add(`a run stopped by ${stopped.signal} while a worker spun`)
        states.add(
          `a stopped run whose workers are ${stop.pool === `forks` ? `child processes` : `threads`}`,
        )
      }
    // Each kind of declaration fault is its own state, so each refusal has
    // a history that depends on it. A run its blocked log refused never
    // reached its fault.
    if (plan.fault !== `none` && cli.exit !== 0 && !logRefused)
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
    // naming order decides whether a random name stays in the trace. The
    // label is judged against the path from the CLI's directory to the
    // package (`relative`), so it is never attested for a package that lies
    // outside: one in a directory beside the CLI's whose name extends it
    // (`siblingDir`) has its own state.
    const outsideCli = (() => {
      const path = relative(how.cli, dir)
      return path.startsWith(`..`) || isAbsolute(path)
    })()
    if (cli.exit !== 0 && dir !== how.cli && isWithin(how.cli, dir))
      states.add(`a refused run whose package lies inside the CLI's directory`)
    if (
      states.has(
        `a refused run whose package lies inside the CLI's directory`,
      ) &&
      outsideCli
    )
      throw new Error(
        `oracle-gaps.report: recorded a refused run whose package lies inside the CLI's directory, but ${relative(how.cli, dir)} lies outside it`,
      )
    if (cli.exit !== 0 && outsideCli && posix(dir).startsWith(posix(how.cli)))
      states.add(
        `a refused run whose package lies beside the CLI's directory, under a name that extends it`,
      )
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
    // The slow kill holds until a heartbeat names a mutant of its file
    // (beatHold), so a cold run that holds it has such a beat whatever the
    // load (#84). The state is entered only there: the slow kill is in the
    // plan, and the run named its stream log to the hold. Elsewhere a beat
    // follows timing (the first half's I/O wait, a run with the default
    // output directory), and a beat is progress (maintainer decision,
    // 2026-11-14), so it enters nothing. Which mutants beat is progress too,
    // so the state is entered here, before the mutants' own states.
    if (
      cli.beatHeld &&
      plan.functions.some((fn) => fn.id === `w_slowkill`) &&
      cli.mutants.some((m) => cli.heartbeats.some((b) => b.label === m.id))
    )
      states.add(`a heartbeat named a busy mutant`)
    // Each `optional` statement by the line of its read (its second line):
    // its links, the depth of the object that a falsy `x` leaves absent, and
    // that object, `undefined` or `null`.
    const optionalAt = new Map(
      plan.functions.flatMap((fn) =>
        fn.body
          .filter((s) => s.kind === `optional`)
          .map((s) => [`${fn.file}:${s.line + 1}`, s]),
      ),
    )
    // The link of each optional-chain mutant, counted from the chain's first
    // object: the CLI lists a read's links last link first, as its sites are
    // numbered.
    const linkOf = new Map()
    const linksSeen = new Map()
    for (const m of cli.mutants) {
      if (m.operator !== `optional-chain`) continue
      const at = `${m.source}:${m.line}`
      const statement = optionalAt.get(at)
      const ordinal = linksSeen.get(at) ?? 0
      linksSeen.set(at, ordinal + 1)
      // A `?.v` after an optional call is one more link.
      const count =
        statement && statement.links + (statement.call === `optional` ? 1 : 0)
      if (statement) linkOf.set(m, count - 1 - ordinal)
    }
    // A `binary-swap` of these goes through the capture's comparison helper;
    // the swap of `&&`, `||`, or `??` goes through its switch.
    const comparisonOperators = new Set([`===`, `!==`, `<`, `<=`, `>`, `>=`])
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
      // A plain read in place of `?.` where a passing owner test's object is
      // absent: the capture infects the site, the mutant runs, and the test
      // crashes on the TypeError that `?.` avoided.
      const statement = optionalAt.get(`${m.source}:${m.line}`)
      // The `?.v` after an optional call whose method ran and returned
      // nothing: that link's own object is absent.
      const afterCall =
        statement?.call === `optional` && linkOf.get(m) === statement.links
      if (
        m.operator === `optional-chain` &&
        m.outcome === `crashed` &&
        afterCall
      )
        states.add(
          `a plain read in place of ?. after an optional call that returned nothing crashed`,
        )
      // The `?.v` after an optional call whose method is absent: JavaScript
      // skips the call and the rest of the chain.
      if (
        m.operator === `optional-chain` &&
        m.class === `not-distinguished` &&
        afterCall &&
        statement.level === statement.links &&
        plan.tests.some((t) => t.input === 0)
      )
        states.add(
          `a plain read in place of ?. past a skipped optional call not distinguished`,
        )
      if (
        m.operator === `optional-chain` &&
        m.outcome === `crashed` &&
        statement &&
        !afterCall
      )
        states.add(
          statement.level > 0
            ? `a plain read in place of ?. on an absent nested object crashed`
            : statement.absent === `null`
              ? `a plain read in place of ?. on a null object crashed`
              : `a plain read in place of ?. on an undefined object crashed`,
        )
      // A plain read in place of a link past the one whose object is absent:
      // JavaScript short-circuits the rest of the chain, so the mutant
      // changes nothing there, and a test of a falsy input owes no crash.
      if (
        m.operator === `optional-chain` &&
        m.class === `not-distinguished` &&
        statement &&
        linkOf.get(m) > statement.level &&
        plan.tests.some((t) => t.input === 0)
      )
        states.add(
          `a plain read in place of ?. past a short-circuited link not distinguished`,
        )
      // A `?.` whose object is absent only while the module loads (a booted
      // first function runs with 0 there; its tests pass a truthy input): the
      // background row infects the site, the mutant runs, and the module
      // throws as it loads, an error outside any test.
      if (
        m.operator === `optional-chain` &&
        (m.class ?? m.outcome) === `setup-error`
      )
        states.add(
          `a plain read in place of ?. on an object absent only at load set up an error`,
        )
      // Each capture helper's kill, where its site's value changed in an
      // owner test: a mutant whose helper recorded no change is judged
      // without a run, and survives.
      if (m.operator === `return-undefined` && m.outcome === `killed`)
        states.add(`a returned value made undefined killed`)
      if (
        m.operator === `binary-swap` &&
        comparisonOperators.has(m.original) &&
        m.outcome === `killed`
      )
        states.add(`a comparison swap killed`)
      if (m.operator === `drop-not` && m.outcome === `killed`)
        states.add(`a dropped not killed`)
      if (m.operator === `delete-call` && m.outcome === `killed`)
        states.add(`a skipped call killed`)
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
      // Probe code is never work (maintainer decision, 2026-11-16; v21.2
      // R53, M-23): a generated function's production mutant that runs a
      // probe branch in place of a push (an elseIf's if-true, which calls
      // report()) under a test that declares a bound, on a route that judges
      // work (R19a: reproducible or random), is not killed by that bound. A
      // probe mutant is not judged, so it enters nothing here.
      if (
        inGenerated &&
        !m.probe &&
        m.operator === `if-true` &&
        /\breport \( \)/.test(m.key) &&
        !m.laws?.includes(`work bound`) &&
        plan.tests.some(
          (t) =>
            t.fn === m.function &&
            t.registered &&
            t.work !== null &&
            [`fixed seed`, `fixed history`, `case`, `random seed`].includes(
              t.route,
            ),
        )
      )
        states.add(
          `a probe branch's work under a generated test's bound judged nothing`,
        )
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
      if (plan.loadPlugin) states.add(loadPluginState)
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
      // The config sets `test.root` (issue #101), the root Vite names the
      // modules it resolves from.
      if (plan.testRoot !== `none`) states.add(testRootStates[plan.testRoot])
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
      const {
        retention: movedRetention,
        checkPid: movedPid,
        ...movedRun
      } = runCli(dir, moved, how)
      observe(`beats`, { breaches: heartbeatBreaches(movedRun) })
      observe(`stability`, unbeaten(movedRun))
      observe(
        `retention:stability`,
        retentionBreaches(movedRetention, {
          checkPid: movedPid,
          complete: movedRun.reported,
          cold: true,
        }),
      )
      states.add(`stability rerun`)
    }
    if (plan.steps.length > 0)
      // The first cold run keeps its retention lines and check pid: law 9's
      // cold result of the first state is this run (incremental).
      await incremental(
        dir,
        plan,
        { ...cli, retention, checkPid },
        copy,
        observe,
        states,
      )
    for (const state of states) observe(`reach`, state)
  } finally {
    if (copy) rmSync(copy, { recursive: true, force: true })
    removePath(`${dir}.link`)
    written.delete(dir)
    dropHook(dir)
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
function incrementalCheck(observations, expected, plan) {
  for (const { value } of observations.filter(
    (o) => o.checkpoint === `incremental`,
  )) {
    const { step, cold, daemon } = value
    // The check that a mid-run edit overlapped reports, for each mutant,
    // what a cold run of the state before the edit or of the state after
    // it reports, and exits as one of them does (F-C).
    if (value.midrun) {
      const { during, before } = value.midrun
      if (during.exit !== before.exit && during.exit !== cold.exit)
        return violation(
          `incremental`,
          `the check during the mid-run edit exited ${during.exit}, and the cold runs before and after the edit exited ${before.exit} and ${cold.exit}`,
          `incremental equals cold`,
        )
      const resultOf = (run, key) =>
        JSON.stringify(run.report?.results.find((r) => r.key === key))
      const keys = (run) =>
        JSON.stringify((run.report?.results ?? []).map((r) => r.key))
      if (keys(during) !== keys(before) && keys(during) !== keys(cold))
        return violation(
          `incremental`,
          `the check during the mid-run edit reported other mutants than the cold runs before and after the edit`,
          `incremental equals cold`,
        )
      // The editing file's own mutants in a check that the edit landed in
      // are not judged (maintainer decision, 2026-11-13): file b's baseline
      // reads the old text and its mutant runs read the new one, so their
      // results legitimately mix the two. This is the one place that
      // excludes them, and only when the edit landed (fourth review,
      // F-C1). Every other mutant is judged against both cold runs.
      const { editing, landed } = value.midrun
      const unjudged = (result) =>
        landed &&
        editing !== undefined &&
        (result.oracleFiles ?? []).some((file) => file.endsWith(editing.file))
      const allowed = (result) =>
        unjudged(result) ||
        JSON.stringify(result) === resultOf(before, result.key) ||
        JSON.stringify(result) === resultOf(cold, result.key)
      for (const result of during.report?.results ?? [])
        if (!allowed(result))
          return violation(
            `incremental`,
            `the check during the mid-run edit reported ${result.key} as neither cold run did, before or after the edit`,
            `incremental equals cold`,
            {
              actual: result,
              expected: [
                resultOf(before, result.key),
                resultOf(cold, result.key),
              ],
            },
          )
    }
    if (value.unchangedComputed > 0)
      return violation(
        `incremental`,
        `the check through the daemon at ${step}, of a state that nothing changed, computed ${value.unchangedComputed} runs that were not cut off, owed none`,
        `unchanged reuse`,
      )
    // A witness guard, not a law-9 requirement: the mid-run marker sits in
    // the daemon's own session directory, which is no input of a run by
    // design (ownHarness). The helper history is sensitive only while that
    // holds: the run that lands the edit also rewrites the marker, so a run
    // stored under the marker would not be stored at all, and the marker
    // would hide whether the runner stores the run under the helper's text
    // that it read.
    if (value.markerStored)
      return violation(
        `incremental`,
        `after ${step}, the daemon stored a run under the mid-run marker, a file in its own session directory`,
        `witness guard`,
      )
    // A check whose daemon stopped answering (`heldPhase`) ends as a cold run
    // does (R39: a cold fallback is not a failure): the CLI's own bound on a
    // daemon that sends nothing ends its wait, and it checks cold.
    if (daemon.daemonEnded)
      return violation(
        `incremental`,
        `after ${step}, the daemon that held the check had ended when its CLI fell back to a cold check; a fallback leaves the daemon to serve later checks`,
        `cold fallback`,
      )
    // A daemon that works tells its CLI so (its beats), so a check through a
    // working daemon never falls back, however long it runs (`shortWait`).
    if (
      !daemon.held &&
      daemon.stream.notes.some((note) => coldFallbackNote.test(note))
    )
      return violation(
        `incremental`,
        `after ${step}, the CLI fell back to a cold check while its daemon was working`,
        `cold fallback`,
      )
    if (daemon.held && daemon.exit !== cold.exit)
      return violation(
        `incremental`,
        `after ${step}, the daemon held the check and the CLI did not fall back to a cold check: it exited ${daemon.exit}${daemon.exit > 128 ? ` when the driver's backstop stopped it` : ``}, and the cold run exited ${cold.exit}`,
        `cold fallback`,
      )
    if (daemon.rewritten.length > 0)
      return violation(
        `incremental`,
        `after ${step}, the daemon ran the check after its CLI had ended, and wrote into that run's --out (${daemon.rewritten.join(`, `)})`,
        `cold fallback`,
      )
    if (
      daemon.exit !== cold.exit ||
      daemon.refusal !== cold.refusal ||
      (cold.report !== undefined) !== (daemon.report !== undefined)
    )
      return violation(
        `incremental`,
        `after ${step}, the daemon's check exited ${daemon.exit} (${daemon.refusal ?? daemon.stderr ?? `no refusal`}) and the cold run exited ${cold.exit} (${cold.refusal ?? `no refusal`})${cold.exit === 3 && cold.stderr ? `; its error log: ${cold.stderr}` : ``}`,
        `incremental equals cold`,
        { actual: daemon, expected: cold },
      )
    // A refusal through the daemon ends as a cold refusal does (law 12):
    // the CLI that asked the daemon writes it to its own output directory.
    if (cold.refusal !== undefined) {
      // As the cold refusal: the default directory is predicted by its rule.
      const breach = refusalBreach(daemon.ending, {
        outKnown: true,
        defaultOut: plan.outMode === `default`,
        logNote: owesNote(expected) ? logNoteOf(daemon) : undefined,
      })
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
  // An internal error comes first: it also leaves the session directory, so
  // the namespace law below would name only its symptom (issue #83). The
  // message carries the run's error.log (readRun).
  // A rejected batch (the constructed fault) is judged below, after retention.
  if (cli.exit === 3 && expected.rejectedBatch === undefined)
    return violation(
      `cli`,
      `the run ended in an internal error: ${cli.stderr ?? `no stderr`}`,
      `completion`,
    )
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
  // A second run on a live output directory refuses before it writes
  // anything (F4, the coordinator's decision of 2026-11-13): the refusal
  // names the directory, is one block with its fix, and its stdout is its
  // done line alone. The first run's own laws are judged on `cli`.
  const claim = observations.find(
    (o) => o.checkpoint === `claimScenario`,
  )?.value
  if (claim !== undefined) {
    // A stale claim refuses every start (the maintainer's decision, "Stale claims
    // refuse; no takeover"); each refusal names its cause and the claim.
    const cause = {
      empty: `run.pid in <out> does not name a pid`,
      unreadable: `run.pid in <out> can't be read`,
      // A link to no file is a claim that no read can take.
      dangling: `run.pid in <out> can't be read`,
      race: `run.pid names pid 999999, which is not running`,
      stale: `run.pid names pid 999999, which is not running`,
    }[claim.scenario]
    const refused = `refused (${cause}; fix if no run uses <out>, delete <out>/run.pid)`
    const owed = claim.scenario === `race` ? [refused, refused] : [refused]
    if (JSON.stringify(claim.outcomes) !== JSON.stringify(owed))
      return violation(
        `claimScenario`,
        `a ${claim.scenario} gave ${JSON.stringify(claim.outcomes)}, owed ${JSON.stringify(owed)}`,
        `ownership`,
      )
    if (!claim.claimKept || claim.otherFiles.length > 0)
      return violation(
        `claimScenario`,
        `a ${claim.scenario} wrote beyond its claim attempt: run.pid kept ${claim.claimKept}, other files ${JSON.stringify(claim.otherFiles)}`,
        `ownership`,
      )
  }
  const death = observations.find(
    (o) => o.checkpoint === `supervisorDeath`,
  )?.value
  if (death !== undefined && !death.childGone)
    return violation(
      `supervisorDeath`,
      `the supervised child outlived its supervisor, which was killed with SIGKILL`,
      `stopping`,
    )
  const lost = observations.find((o) => o.checkpoint === `unwritableLog`)?.value
  if (lost !== undefined) {
    // The stream log became a directory after the note. Whatever ends the run,
    // each stream ends with one done line, the same on both, the exit code is
    // the one that line owes, and no stack trace is printed (review of #57, F1).
    const doneOf = (text) =>
      text.split(`\n`).filter((line) => line.startsWith(`oracle-gaps: done `))
    const owedExit = (line) =>
      /done stopped \(SIGINT\)/.test(line)
        ? 128 + 2
        : /done completed/.test(line)
          ? 0
          : /done error/.test(line)
            ? 3
            : /done refused/.test(line)
              ? 2
              : undefined
    const outDone = doneOf(lost.stdout)
    const errDone = doneOf(lost.stderr)
    const streams = `${lost.stdout}${lost.stderr}`
    let difference
    if (outDone.length !== 1 || errDone.length !== 1)
      difference = `the lost log's run printed ${outDone.length} done lines on stdout and ${errDone.length} on stderr`
    else if (outDone[0] !== errDone[0])
      difference = `the done lines differ: ${JSON.stringify(outDone[0])} on stdout, ${JSON.stringify(errDone[0])} on stderr`
    else if (lost.exit !== owedExit(errDone[0]))
      difference = `the exit code is ${lost.exit}, owed ${owedExit(errDone[0])} for ${JSON.stringify(errDone[0])}`
    else if (/^\s+at \S/m.test(streams) || /^\w*Error: /m.test(streams))
      difference = `a stack trace was printed`
    if (difference !== undefined)
      return violation(`unwritableLog`, difference, `greppable stream`)
  }
  const overlap = observations.find((o) => o.checkpoint === `overlap`)?.value
  if (overlap !== undefined) {
    if (overlap.exit !== 2)
      return violation(
        `overlap`,
        `the second run on a live output directory exited ${overlap.exit}, not refusing it`,
        `ownership`,
      )
    const breach = refusalBreach(overlap.ending, {
      cause: `another run (pid `,
      outKnown: false,
    })
    if (breach) return violation(`overlap`, breach, `report-shaped ending`)
  }
  // Law 15 holds for every run, an internal error's included: its error line and its done line are lines of
  // the stream (v21.2 P10, I3, I7, R10). The rest of a rejected batch's ending is judged below, after
  // retention.
  const stream = streamBreach(`cli`, cli, expected, plan)
  if (stream) return stream
  // Bounded retention (retentionBreaches): every call's lines are its own
  // check's, or a daemon's that the driver killed, one per batch, and each
  // settled batch retired its copies, with no stale entry and no unit kept by
  // a cold store.
  const breached = observations.filter(
    (o) => o.checkpoint.startsWith(`retention`) && o.value.length > 0,
  )
  if (breached.length > 0)
    return violation(
      `retention`,
      `retention lines break the law: ${breached
        .map((o) => `${o.checkpoint} (${o.value.join(`, `)})`)
        .join(`; `)}`,
      `bounded retention`,
      { actual: breached.map((o) => [o.checkpoint, o.value]), expected: [] },
    )
  // A rejected batch (the constructed fault) ends the run as an internal error: exit 3 and its done line
  // (ending.mjs), no stack frame on stderr, and its stack in the output directory's error.log (law 12).
  // Retention and the stream law, with its one error line that names that log (endsBreach), were judged
  // above, so only the rest of the ending is judged here, and the run is then done.
  if (expected.rejectedBatch !== undefined) {
    if (
      cli.exit !== 3 ||
      !cli.lastLine?.startsWith(`oracle-gaps: done error, log `) ||
      !cli.stderrLast?.startsWith(`oracle-gaps: done error, log `)
    )
      return violation(
        `cli`,
        `the rejected batch owes exit 3 and an internal error's done line on both streams, got exit ${cli.exit} ending stdout with ${JSON.stringify(cli.lastLine)} and stderr with ${JSON.stringify(cli.stderrLast)}`,
        `internal error`,
      )
    if (cli.stackFrames || !cli.errorLog)
      return violation(
        `cli`,
        `the rejected batch owes its stack in error.log and none on stderr, got ${cli.stackFrames ? `stack frames on stderr` : `no stack frames on stderr`} and ${cli.errorLog ? `an` : `no`} error.log`,
        `internal error`,
      )
    return pass
  }
  // Through the daemon, each check streams the same kinds of line, and a
  // completed one ends with its done line (law 15). The state of each step
  // differs, so its verdict and counts are judged by law 9's comparison.
  for (const { value } of observations.filter(
    (o) => o.checkpoint === `incremental`,
  )) {
    const { daemon, cold } = value
    const ends = endsBreach(daemon, { checked: owesNote(expected) })
    if (ends)
      return violation(
        `incremental`,
        `through the daemon at ${value.step}: ${ends.difference}`,
        `greppable stream`,
        ends.extra,
      )
    // A completed check through the daemon names its own report in its
    // done line: the summary in the output directory its CLI was given,
    // which the trace names `<out>` (readRun), never another check's.
    if (
      daemon.exit === 0 &&
      !daemon.stream.last.endsWith(` report <out>/summary.md`)
    )
      return violation(
        `incremental`,
        `through the daemon at ${value.step}, the done line ${JSON.stringify(daemon.stream.last)} does not name the check's own report, <out>/summary.md`,
        `greppable stream`,
      )
    // The check that a mid-run edit overlapped streams as any check does.
    const duringEnds =
      value.midrun &&
      endsBreach(value.midrun.during, { checked: owesNote(expected) })
    if (duringEnds)
      return violation(
        `incremental`,
        `through the daemon during the mid-run edit: ${duringEnds.difference}`,
        `greppable stream`,
        duringEnds.extra,
      )
    // A completed check through the daemon lists its own gaps on stdout as
    // a cold run does: each gap of its results.json on one line, by id.
    for (const [where, run] of [
      [`at ${value.step}`, daemon],
      [`during the mid-run edit`, value.midrun?.during],
    ]) {
      const lines =
        run?.exit === 0 && run.report
          ? stdoutGapBreach(run.stdoutGaps, run.report.results)
          : undefined
      if (lines)
        return violation(
          `incremental`,
          `through the daemon ${where}: ${lines.difference}`,
          `greppable stream`,
          lines.extra,
        )
    }
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
    // A run with the default output directory (`--out` left out) has its
    // directory predicted by the default rule, not named by the driver.
    const breach = refusalBreach(cli.ending, {
      cause: expected.refused.cause,
      outKnown: true,
      defaultOut: plan.outMode === `default`,
      logNote: expected.refused.arguments ? undefined : logNoteOf(cli),
    })
    if (breach) return violation(`cli`, breach, `report-shaped ending`)
    // A refusal of the arguments, or before the check starts, writes no
    // stream log (F8, the coordinator's review of #57).
    if (expected.refused.arguments && cli.log.exists)
      return violation(
        `cli`,
        `the refusal before the check started wrote a stream log`,
        `greppable stream`,
      )
    return (
      incrementalCheck(observations, expected, plan) ??
      daemonCheck(observations) ??
      pass
    )
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
  // Law 11, shape only (maintainer decision, 2026-11-14): the driver observes
  // the heartbeats that break the shape, and a breach is a streaming failure.
  for (const { value } of observations.filter((o) => o.checkpoint === `beats`))
    if (value.breaches.length > 0)
      return violation(
        `cli`,
        `a heartbeat breaks its shape: ${value.breaches[0]}`,
        `streaming`,
        { actual: value.breaches },
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
  // Law 15's gap lines on stdout, judged once the report is: the stdout
  // repeats the run's own results.json, each gap on one line under its id.
  // A mutant whose outcome differs from the model's is named above, at its
  // site (classification), and not counted here as a missing or extra line.
  const lines = stdoutGapBreach(cli.stdoutGaps, cli.report.results)
  if (lines)
    return violation(`cli`, lines.difference, `greppable stream`, lines.extra)
  // Law 13, and law 10's namespace while a run runs: a stopped run had
  // written nothing beside its output directory and the package's
  // `.oracle-gaps` (where Vitest's include could find it), and once the CLI
  // ends, no process the run started is left.
  // A run removes its session directory when it ends, so a run that a stop
  // or an abort of its check's process ended leaves none of its own; only a
  // run whose own process was killed before it cleaned up leaves it, and the
  // next run removes it, with every other such directory of this host's
  // (README: "A run leaves nothing in the repository"; the maintainer
  // decision of 2026-11-11; register C 2026-11-18, "A run that ends removes
  // its session directory"). A stop before the CLI starts, as it starts, or
  // at its note runs no check, so it finds only what the run before it left.
  // The directory a killed CLI left holds the `host` file that CLI wrote, so
  // the next run's removal of it judges both halves: the write and the read.
  const stops = observations.filter((o) => o.checkpoint === `stopped`)
  for (const { value } of stops) {
    if (value.left?.length > 0)
      return violation(
        `stopped`,
        `the stopped run left ${value.left.join(`, `)} in the package`,
        `output namespace`,
      )
    if (!value.killed && value.sessions?.own > 0)
      return violation(
        `stopped`,
        `the stopped run left ${value.sessions.own} session directories of its own in the package`,
        `output namespace`,
      )
    if (value.sessions?.kept > 0)
      return violation(
        `stopped`,
        `the stopped run left ${value.sessions.kept} session directories that were in the package before it`,
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
    // The spawn-delay law (review of #57; C 2026-11-13 under P10): a stop
    // that lands before the CLI's first statement (no started marker) is
    // outcome (a): nothing on either stream, no stream log, and an exit by the
    // signal. Every other stop is outcome (b), judged below.
    if (value.spun && value.started === false) {
      if (
        value.stdoutLength === 0 &&
        value.stderrLength === 0 &&
        !value.log.exists &&
        value.exit !== 0
      )
        continue
      return violation(
        `stopped`,
        `a stop before the CLI started left output or a log (${how})`,
        `greppable stream`,
      )
    }
    // A stopped run ends both streams with its stopped line, and one that
    // had printed its completed line ends as it completed (law 15), on every
    // platform (C 2026-11-13, "Stop window on every platform"). Every stop
    // the driver sends on win32 goes through the CLI's test stop hook and is
    // taken as a SIGINT, so a done line is owed there too. The one stop that
    // owes none is a SIGKILL-equivalent, which no history sends here: a
    // win32 child.kill is TerminateProcess (C 2026-11-13, "Windows stops";
    // L1). An abort is the run's own end, which is judged as before.
    // A CLI killed with SIGKILL runs no code after it, so it owes no line
    // (L1); law 10 still judges what it left.
    if (value.when === `kill`) continue
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
          ? process.platform === `win32`
            ? // win32 has no signal that ends a process: the exit code names the abort.
              `oracle-gaps: done error, the run's process exited with code `
            : `oracle-gaps: done error, the run's process exited with SIGABRT`
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
  return (
    incrementalCheck(observations, expected, plan) ??
    daemonCheck(observations) ??
    pass
  )
}

/**
 * Law 15: the stream's lines are greppable. Every line a run writes to
 * stderr is a line of one of the stream's kinds, `oracle-gaps: <kind> `
 * (config, note, baseline, blocked, progress, gap, busy, done), an indented
 * line under a baseline failure, a refusal's block, or a line Node writes
 * for the process. A run that judges mutants prints its one decisive
 * baseline line before any gap line, count of judged mutants, or heartbeat
 * that names a mutant. The stdout's gap lines are judged after the report
 * (stdoutGapBreach). The ends of a run (`oracle-gaps: done …`) are judged with
 * the lead (completed), the refusal law (refused), and the stop law
 * (stopped). `run` is a run as readRun records it, observed at
 * `checkpoint`.
 */
// The stage at which a run refuses decides whether it owes its note (law 15,
// review of #57): a refusal of the arguments comes before any check, so its
// output is its done line alone. Both the cold run and a run through the daemon
// are judged by this one decision.
const owesNote = (expected) => !expected.refused?.arguments
function streamBreach(checkpoint, run, expected, plan) {
  const breach = (difference, extra) =>
    violation(checkpoint, difference, `greppable stream`, extra)
  const ends = endsBreach(run, { checked: owesNote(expected) })
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
  return undefined
}

/**
 * The line that names a run's stream log. On win32 the note names the log in
 * forward slashes (the Windows paths rule, register 2026-11-13); POSIX paths
 * are used unchanged.
 */
// The note names the log as every line of the stream names a path: forward
// slashes on win32, and each control character, a line break included, as its
// `\uXXXX` escape, so the note stays one line (the register's C entry "The
// internal-error line", 2026-11-16).
const logNoteOf = (run) => {
  const outDir = (
    process.platform === `win32` ? run.outDir.replaceAll(`\\`, `/`) : run.outDir
  ).replace(
    /[\u0000-\u001f\u007f\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, `0`)}`,
  )
  return `oracle-gaps: note log ${outDir}/stream.log`
}

/**
 * Law 15's gap lines on stdout, judged against the run's own results.json:
 * each gap it reports has exactly one gap line, which names its id, and
 * there is no other gap line. A result is a gap when it is neither a probe
 * guard nor `killed` or `unowned`, as the model counts gaps (every survivor
 * is a gap, P5). A line reads as `oracle-gaps: gap <kind> L<line> <id>
 * <change>`, and it shows the gap's kind (its class, or its outcome), its
 * line (`?` when the mutant never applied), and its change: two code spans
 * around ` → `, the code and its replacement, or the intent's span and
 * ` (authored by <author>)`. A span shows its code on one line, with each
 * run of whitespace as one space, whole or cut and ended with `...`; the
 * cut's length is the printer's choice. The comparison is by id, so a run
 * that prints one gap twice and drops another breaks it, though its count
 * holds. Whether results.json reports the owed gaps is not judged here:
 * the classification law names a mutant the model owes another outcome.
 * Undefined when it holds.
 */
function stdoutGapBreach(stdoutGaps, results) {
  const reported = results.filter(
    (r) =>
      r.probeGuard !== true &&
      ![`killed`, `unowned`].includes(r.class ?? r.outcome),
  )
  const byId = new Map(reported.map((m) => [m.id, m]))
  const lined = new Set()
  for (const line of stdoutGaps) {
    const read = readGapLine(line)
    if (read === undefined)
      return {
        difference: `the stdout's gap line ${JSON.stringify(line)} does not read as a kind, a line, an id, and a change`,
      }
    const gap = byId.get(read.id)
    if (gap === undefined)
      return {
        difference: `the stdout has a gap line for ${read.id}, which results.json does not report as a gap: ${JSON.stringify(line)}`,
      }
    if (lined.has(read.id))
      return {
        difference: `the stdout has two gap lines for ${read.id}: ${JSON.stringify(stdoutGaps.filter((l) => readGapLine(l)?.id === read.id))}`,
      }
    lined.add(read.id)
    const owed = {
      kind: gap.class ?? gap.outcome,
      line: gap.line === undefined ? `?` : String(gap.line),
    }
    const shows = gap.authored
      ? read.intent !== undefined &&
        showsCode(read.intent, gap.intent) &&
        read.author === gap.author
      : read.original !== undefined &&
        showsCode(read.original, gap.original) &&
        showsCode(read.replacement, gap.replacement)
    if (read.kind !== owed.kind || read.line !== owed.line || !shows)
      return {
        difference: `the stdout's gap line for ${read.id} is ${JSON.stringify(line)}, and results.json reports it as ${owed.kind} at line ${owed.line}, changing ${JSON.stringify(gap.authored ? gap.intent : `${gap.original} → ${gap.replacement}`)}`,
        extra: { actual: line, expected: { ...owed, id: read.id } },
      }
  }
  const unlined = reported.filter((m) => !lined.has(m.id)).map((m) => m.id)
  if (unlined.length > 0)
    return {
      difference: `results.json reports ${unlined.length} gaps that the stdout has no gap line for: ${unlined.join(`, `)}`,
      extra: { actual: stdoutGaps, expected: reported.map((m) => m.id) },
    }
  return undefined
}

/**
 * A gap line's fields, read from its text as an agent reads it: its kind,
 * line, id, and change. Undefined when the line does not read so.
 */
function readGapLine(line) {
  const head = line.match(/^oracle-gaps: gap ([\w-]+) L(\d+|\?) (\S+) (.*)$/)
  if (!head) return undefined
  const [, kind, at, id, change] = head
  const first = readCodeSpan(change)
  if (!first) return undefined
  const authored = first.after.match(/^ \(authored by (.*)\)$/)
  if (authored)
    return { kind, line: at, id, intent: first.code, author: authored[1] }
  if (!first.after.startsWith(` → `)) return undefined
  const second = readCodeSpan(first.after.slice(` → `.length))
  if (!second || second.after !== ``) return undefined
  return {
    kind,
    line: at,
    id,
    original: first.code,
    replacement: second.code,
  }
}

// Whether a span's code shows `text` on one line: each run of whitespace as
// one space, whole, or cut after a kept part and ended with `...`. Where the
// cut falls is not judged here: the classify oracle's law 8 (`shortened`)
// pins the printer's exact cut in-process.
const showsCode = (shown, text) => {
  const flat = String(text).replace(/\s+/g, ` `)
  return (
    shown === flat ||
    (shown.endsWith(`...`) &&
      shown.length > 3 &&
      shown.length - 3 < flat.length &&
      flat.startsWith(shown.slice(0, -3)))
  )
}

// A path as a line of the stream spells it: forward slashes, and each
// control character, a line break included, as its `\uXXXX` escape, so a
// path stays on its line (the register's C entry "The internal-error line",
// 2026-11-16).
const lineSpelling = (path) =>
  path
    .replaceAll(`\\`, `/`)
    .replace(
      /[\u0000-\u001f\u007f\u2028\u2029]/g,
      (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, `0`)}`,
    )

/**
 * What law 15 judges of every run, on both streams, whatever its outcome:
 * no stray line, and exactly one done line, which ends each stream, the
 * same on both, of the kind its exit status says (0 completed, 2 refused,
 * 3 error, and a signal's code stopped). With `checked`, the run started a
 * check, so its first line names its stream log. And law 12's one diagnostic per
 * failure (v21.2 P10 and R10; the register's C entry "The internal-error
 * line", 2026-11-16): an internal error that ends through its own ending,
 * whose done line names its log (`done error, log <log>`), wrote exactly one
 * error line, on stderr, which names the same log, the error.log of the
 * run's output directory when the run names one; every other run, the
 * supervisor's own exit 3 included (`done error, the run's process exited
 * …`), wrote none. Undefined when it holds.
 */
function endsBreach(run, { checked = true } = {}) {
  const streams = [
    [`stderr`, run.stream],
    [`stdout`, run.stdoutStream],
  ]
  // The run's first line on each stream names its stream log, and the log
  // holds the stderr's lines, in order (the maintainer's decision of
  // 2026-11-12), for every run that starts a check. A refusal of the run's
  // arguments comes before any check, and names no log.
  const note = logNoteOf(run)
  if (checked && (run.log.stderrFirst !== note || run.log.stdoutFirst !== note))
    return {
      difference: `the run's first lines are ${JSON.stringify([run.log.stderrFirst, run.log.stdoutFirst])}, not ${JSON.stringify(note)} on each stream`,
    }
  if (checked && !run.log.exists)
    return { difference: `the run wrote no stream.log` }
  if (checked && !run.log.equal)
    return {
      difference: `the run's stream.log is not its stderr, line for line`,
    }
  // A completed run's results.json sits beside its stream log, in the
  // directory the log names (law 15's stream log, the maintainer's decision
  // of 2026-11-12).
  if (checked && run.exit === 0 && run.reported === false)
    return {
      difference: `the run completed, but ${run.outDir}/results.json is ${run.reportState ?? `missing or unparseable`}, not beside its stream log`,
    }
  for (const [where, stream] of streams)
    if (stream.strays.length > 0)
      return {
        difference: `the run wrote ${stream.strays.length} lines on ${where} that are not lines of the stream: ${JSON.stringify(stream.strays)}`,
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
  const logged = run.stream.last.match(/^oracle-gaps: done error, log (.*)$/)
  const owedLogs = logged ? [logged[1]] : []
  if (
    JSON.stringify(run.stream.errorLogs) !== JSON.stringify(owedLogs) ||
    run.stream.errors !== owedLogs.length ||
    run.stdoutStream.errors !== 0
  )
    return {
      difference: `the run ended with ${JSON.stringify(run.stream.last)} and wrote ${run.stream.errors} internal error lines on stderr (naming ${JSON.stringify(run.stream.errorLogs)}) and ${run.stdoutStream.errors} on stdout, owed ${owedLogs.length} on stderr naming ${JSON.stringify(owedLogs)} and none on stdout`,
    }
  if (logged && run.outDir !== undefined) {
    const log = `${lineSpelling(run.outDir)}/error.log`
    if (logged[1] !== log)
      return {
        difference: `the run's internal error names its log as ${JSON.stringify(logged[1])}, owed ${JSON.stringify(log)}, its output directory's error.log`,
      }
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
// A checker calibration's wrong beat observation: one breach of the shape law,
// set in a run that completed (a run that did not complete has no beats).
const corruptBeats = (breach) => (trace) => {
  const cli = trace.find((o) => o.checkpoint === `cli`)?.value
  const index = trace.findIndex((o) => o.checkpoint === `beats`)
  if (cli?.exit !== 0 || index < 0) return undefined
  return trace.map((o, i) =>
    i === index ? { ...o, value: { breaches: [breach] } } : o,
  )
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
      const done = `oracle-gaps: done completed, 0 gaps, report ${posix(cli.outDir)}/summary.md`
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

// The editing file's exemption in the check that a mid-run edit overlaps
// holds only when the edit landed (fourth review of #55, F-C1): with no
// edit, that check reads one state, so a mutant of file b that it reports
// as neither cold run does, killed for survived, is a violation.
calibrations.push({
  name: `the check a mid-run edit did not reach flips a mutant of the editing file`,
  law: `incremental equals cold`,
  history: {
    constructed: `a test edits the helper it read, during a check through the daemon`,
  },
  corrupt: (trace) => {
    const index = trace.findIndex(
      (o) => o.checkpoint === `incremental` && o.value.midrun?.editing,
    )
    if (index < 0) return undefined
    const value = structuredClone(trace[index].value)
    const owned = value.midrun.during.report?.results.find((r) =>
      (r.oracleFiles ?? []).some((file) => file.endsWith(`tests/b.test.ts`)),
    )
    if (!owned) return undefined
    // The edit did not land, and the check reports file b's mutant
    // survived where it ran killed, or killed where it survived.
    value.midrun.landed = false
    owned.outcome = owned.outcome === `survived` ? `killed` : `survived`
    delete owned.by
    delete owned.detail
    return trace.map((o, i) => (i === index ? { ...o, value } : o))
  },
})

// In the check that a mid-run edit reached, only the editing file's own
// mutants go unjudged: a wrong result for another file's mutant there is
// still a violation (sixth review of #55).
calibrations.push({
  name: `the check a mid-run edit reached reports another file's mutant as neither cold run did`,
  law: `incremental equals cold`,
  history: {
    constructed: `a test edits the helper it read, during a check through the daemon`,
  },
  corrupt: (trace) => {
    const index = trace.findIndex(
      (o) => o.checkpoint === `incremental` && o.value.midrun?.landed,
    )
    if (index < 0) return undefined
    const value = structuredClone(trace[index].value)
    const other = value.midrun.during.report?.results.find(
      (r) =>
        (r.oracleFiles ?? []).length > 0 &&
        (r.oracleFiles ?? []).every(
          (file) => !file.endsWith(`tests/b.test.ts`),
        ),
    )
    if (!other) return undefined
    other.outcome = other.outcome === `survived` ? `killed` : `survived`
    delete other.by
    delete other.laws
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
    // The defect of issue #150: a run that a stop or an abort of its check's
    // process ended left its own session directory, which a run stopped
    // before it starts cannot remove.
    name: `a stopped run leaves its own session directory`,
    law: `output namespace`,
    history: {
      constructed: `a stop before the CLI starts, after a stopped check`,
    },
    corrupt: corruptStopped((value) => ({
      ...value,
      killed: false,
      sessions: { ...value.sessions, own: 1 },
    })),
  },
  {
    name: `a stopped run keeps a killed run's session directory`,
    law: `output namespace`,
    history: {
      constructed: `a stop before the CLI starts, after a stopped check`,
    },
    corrupt: corruptStopped((value) => ({
      ...value,
      sessions: { ...value.sessions, kept: 1 },
    })),
  },
  {
    name: `a heartbeat names a file that does not run its mutant`,
    law: `streaming`,
    corrupt: corruptBeats(
      `sut.ts:M1 in tests/elsewhere.test.ts: the file does not run it`,
    ),
  },
  {
    name: `a heartbeat names a mutant whose gap line came first`,
    law: `streaming`,
    corrupt: corruptBeats(
      `sut.ts:M1 in tests/a.test.ts: its gap line came first, so it was not running`,
    ),
  },
  {
    name: `a heartbeat names no mutant of its run`,
    law: `streaming`,
    corrupt: corruptBeats(
      `sut.ts:M999 in tests/a.test.ts: no mutant of this run`,
    ),
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
  // Law 15's gap lines on stdout against results.json, by id: a printer
  // that prints one gap twice and drops another keeps the count of lines,
  // and one that prints a gap under its id with another line number keeps
  // the ids. A count of lines sees neither.
  {
    name: `the stdout prints one gap twice and drops another`,
    law: `greppable stream`,
    corrupt: corruptCli((cli) =>
      cli.exit !== 0 || cli.stdoutGaps.length < 2
        ? undefined
        : {
            ...cli,
            stdoutGaps: [cli.stdoutGaps[0], ...cli.stdoutGaps.slice(0, -1)],
          },
    ),
  },
  {
    name: `a stdout gap line gives another line than results.json`,
    law: `greppable stream`,
    corrupt: corruptCli((cli) => {
      const [first, ...rest] = cli.stdoutGaps
      if (cli.exit !== 0 || first === undefined) return undefined
      const moved = first.replace(
        /^(oracle-gaps: gap \S+ L)(\d+|\?) /,
        (_, head, at) => `${head}${at === `?` ? 1 : Number(at) + 1} `,
      )
      return { ...cli, stdoutGaps: [moved, ...rest] }
    }),
  },
  // The #102 symptom: one gap's line is missing, and no other line repeats.
  {
    name: `the stdout drops a gap line`,
    law: `greppable stream`,
    corrupt: corruptCli((cli) =>
      cli.exit !== 0 || cli.stdoutGaps.length === 0
        ? undefined
        : { ...cli, stdoutGaps: cli.stdoutGaps.slice(0, -1) },
    ),
  },
  {
    name: `a stdout gap line shows another change`,
    law: `greppable stream`,
    corrupt: corruptCli((cli) => {
      const at = cli.stdoutGaps.findIndex((line) => line.includes(` → `))
      if (cli.exit !== 0 || at < 0) return undefined
      const changed = cli.stdoutGaps[at].replace(
        / → .*$/,
        ` → \`\`\`\` another replacement \`\`\`\``,
      )
      return {
        ...cli,
        stdoutGaps: cli.stdoutGaps.map((line, i) =>
          i === at ? changed : line,
        ),
      }
    }),
  },
  {
    name: `a stdout gap line names another kind`,
    law: `greppable stream`,
    corrupt: corruptCli((cli) => {
      const [first, ...rest] = cli.stdoutGaps
      if (cli.exit !== 0 || first === undefined) return undefined
      const renamed = first.replace(/^oracle-gaps: gap (\S+) /, (_, kind) =>
        kind === `unreached`
          ? `oracle-gaps: gap not-observed `
          : `oracle-gaps: gap unreached `,
      )
      return { ...cli, stdoutGaps: [renamed, ...rest] }
    }),
  },
  {
    name: `a stdout gap line does not read as a gap`,
    law: `greppable stream`,
    corrupt: corruptCli((cli) => {
      const [first, ...rest] = cli.stdoutGaps
      if (cli.exit !== 0 || first === undefined) return undefined
      const unread = first.replace(/ L(\d+|\?) (\S+) .*$/, ` L$1 $2 no change`)
      return { ...cli, stdoutGaps: [unread, ...rest] }
    }),
  },
  {
    name: `the stdout has a gap line for a mutant that is not a gap`,
    law: `greppable stream`,
    corrupt: corruptCli((cli) => {
      const killed = cli.report?.results.find(
        (r) => r.outcome === `killed` && r.probeGuard !== true,
      )
      const [first, ...rest] = cli.stdoutGaps
      if (cli.exit !== 0 || !killed || first === undefined) return undefined
      const moved = first.replace(
        / L(\d+|\?) (\S+) /,
        (_, at) => ` L${at} ${killed.id} `,
      )
      return { ...cli, stdoutGaps: [moved, ...rest] }
    }),
  },
  // Through the daemon: a check that drops one gap line from its stdout.
  {
    name: `a check through the daemon drops a gap line`,
    law: `greppable stream`,
    corrupt: (trace) => {
      const index = trace.findIndex(
        (o) =>
          o.checkpoint === `incremental` &&
          o.value.daemon.exit === 0 &&
          o.value.daemon.stdoutGaps?.length > 0,
      )
      if (index < 0) return undefined
      const value = structuredClone(trace[index].value)
      value.daemon.stdoutGaps = value.daemon.stdoutGaps.slice(1)
      return trace.map((o, i) => (i === index ? { ...o, value } : o))
    },
  },
  // Through the daemon: a completed check whose done line names another
  // check's report, on both streams alike, so that only the law that a
  // check names its own report rejects it.
  {
    name: `a check through the daemon names another check's report`,
    law: `greppable stream`,
    history: {
      constructed: `an unchanged check through the daemon under a config's pre plugin`,
    },
    corrupt: (trace) => {
      const own = ` report <out>/summary.md`
      const index = trace.findIndex(
        (o) =>
          o.checkpoint === `incremental` &&
          o.value.daemon.exit === 0 &&
          o.value.daemon.stream.last.endsWith(own),
      )
      if (index < 0) return undefined
      const value = structuredClone(trace[index].value)
      const other = (last) =>
        last.replace(own, ` report <package>/out-daemon-2/summary.md`)
      value.daemon.stream.last = other(value.daemon.stream.last)
      value.daemon.stdoutStream.last = other(value.daemon.stdoutStream.last)
      return trace.map((o, i) => (i === index ? { ...o, value } : o))
    },
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
                `oracle-gaps: note test output in <out>/test-output.log`,
              ],
            },
          },
    ),
  },
  {
    // A completed run that starts a check, so its log is judged (law 15).
    name: `the stream log misses a line`,
    law: `greppable stream`,
    history: { constructed: `two authored mutants` },
    corrupt: corruptCli((cli) =>
      cli.exit !== 0
        ? undefined
        : { ...cli, log: { ...cli.log, equal: false } },
    ),
  },
  {
    name: `the line that names the stream log comes after another line`,
    law: `greppable stream`,
    history: { constructed: `two authored mutants` },
    corrupt: corruptCli((cli) =>
      cli.exit !== 0
        ? undefined
        : {
            ...cli,
            log: {
              ...cli.log,
              stderrFirst: `oracle-gaps: config vite.config.ts`,
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

// Law 15's exempt lines are told by their own shapes (exemptBlocks): another
// writer's block on the CLI's stderr is no stray, and the CLI's own line with
// no prefix is one, indented or not. Each calibration runs the rejected-batch
// history with lines that another writer printed before its done line
// (`foreign`, beforeLastLine) and one line of our own with no prefix, and the
// stream law must name that line alone as a stray: so the block's lines are
// exempt, and our line is not (the register's M entries of 2026-11-16, "P10
// exemptions ratified" and "Other tools' output is exempt").
const ownLine = `judged 25 of 100 mutants`
const foreignBlocks = {
  // V8's fatal block, as Node 22 prints it when the heap runs out.
  [`a V8 fatal block`]: [
    ``,
    `<--- Last few GCs --->`,
    ``,
    `[4242:0x7f8b5c008000]     1234 ms: Mark-Compact 2040.5 (2083.4) -> 2039.9 (2083.4) MB, pooled: 0 MB, 1033.97 / 0.00 ms  (average mu = 0.112, current mu = 0.029) allocation failure; scavenge might not succeed`,
    ``,
    ``,
    `<--- JS stacktrace --->`,
    ``,
    `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`,
    `----- Native stack trace -----`,
    ``,
    ` 1: 0x1001b3a7c node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/usr/local/bin/node]`,
    ` 2: 0x10036d2e4 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [/usr/local/bin/node]`,
  ],
  // A warning under --trace-warnings: its frames instead of its hint.
  [`a traced warning's frames`]: [
    `(node:4242) Warning: a warning a test raised`,
    `    at emitWarning (node:internal/process/warning:190:3)`,
    `    at file:///tmp/package/tests/a.test.ts:3:9`,
  ],
  // Node's native backtrace of process.abort() on win32, as CI captured it
  // (the CLI's abort witness, after its session opens): every line ends CRLF,
  // a blank line opens it, then its numbered native frames, the JavaScript
  // stack's header, and its numbered frames with their file, line and column.
  [`a win32 abort's native backtrace`]: [
    `\r`,
    ` 1: 00007FF686B89D86 node::GetNodeReport+74070\r`,
    ` 2: 000001A6F574F64D \r`,
    `\r`,
    `----- JavaScript stack trace -----\r`,
    `1: checkCold (<cli>/index.mjs:636:47)\r`,
    `2: processTicksAndRejections (node:internal/process/task_queues:105:5)\r`,
  ],
  // esbuild's block for a syntax error in a module the config imports, as
  // Vite 7.3.7 with esbuild 0.28.2 prints it.
  [`an esbuild block`]: [
    `✘ [ERROR] Unexpected end of file`,
    ``,
    `    helper.ts:2:0:`,
    `      2 │ `,
    `        ╵ ^`,
    ``,
  ],
}
calibrations.push(
  ...Object.entries(foreignBlocks).map(([block, lines]) => ({
    name: `${block} beside our own line with no prefix`,
    law: `greppable stream`,
    difference: `that are not lines of the stream: ${JSON.stringify([ownLine])}`,
    history: { constructed: `a batch whose run rejects` },
    driver: (plan, observe) =>
      driver({ ...plan, foreign: [ownLine, ...lines] }, observe),
  })),
  {
    // Indentation alone exempts no line: only a baseline failure's details.
    name: `our own indented line with no prefix`,
    law: `greppable stream`,
    difference: `that are not lines of the stream: ${JSON.stringify([`  ${ownLine}`])}`,
    history: { constructed: `a batch whose run rejects` },
    driver: (plan, observe) =>
      driver({ ...plan, foreign: [`  ${ownLine}`] }, observe),
  },
  {
    // The win32 backtrace's shape is exact: a line after its JavaScript frames
    // that is no frame (no file, line and column) is our line, not Node's.
    name: `a win32 abort's native backtrace with a line that is no frame`,
    law: `greppable stream`,
    difference: `that are not lines of the stream: ${JSON.stringify([`3: a line with no location\r`, ownLine])}`,
    history: { constructed: `a batch whose run rejects` },
    driver: (plan, observe) =>
      driver(
        {
          ...plan,
          foreign: [
            ownLine,
            `\r`,
            ` 1: 00007FF686B89D86 node::GetNodeReport+74070\r`,
            `----- JavaScript stack trace -----\r`,
            `1: checkCold (<cli>/index.mjs:628:47)\r`,
            `3: a line with no location\r`,
          ],
        },
        observe,
      ),
  },
  {
    // A frame-shaped line of ours (`N: text at file:line:col`, the form Node
    // never prints: a JavaScript frame names a function in parentheses, or
    // is `file:line:col` alone) is a stray, not a Node frame.
    name: `a win32 abort's native backtrace with a frame-shaped line of ours`,
    law: `greppable stream`,
    difference: `that are not lines of the stream: ${JSON.stringify(
      [`3: our own message at x.mjs:1:2\r`, ownLine].sort(),
    )}`,
    history: { constructed: `a batch whose run rejects` },
    driver: (plan, observe) =>
      driver(
        {
          ...plan,
          foreign: [
            ownLine,
            `\r`,
            ` 1: 00007FF686B89D86 node::GetNodeReport+74070\r`,
            `----- JavaScript stack trace -----\r`,
            `1: checkCold (<cli>/index.mjs:636:47)\r`,
            `3: our own message at x.mjs:1:2\r`,
          ],
        },
        observe,
      ),
  },
  {
    // The lead is required: a native frame that opens no CRLF blank line is
    // no part of Node's backtrace, so its lines are strays.
    name: `a win32 abort's native frames without their CRLF lead are strays`,
    law: `greppable stream`,
    difference: `that are not lines of the stream: ${JSON.stringify(
      [
        ` 1: 00007FF686B89D86 node::GetNodeReport+74070\r`,
        `----- JavaScript stack trace -----\r`,
        `1: checkCold (<cli>/index.mjs:636:47)\r`,
        ownLine,
      ].sort(),
    )}`,
    history: { constructed: `a batch whose run rejects` },
    driver: (plan, observe) =>
      driver(
        {
          ...plan,
          foreign: [
            ownLine,
            ` 1: 00007FF686B89D86 node::GetNodeReport+74070\r`,
            `----- JavaScript stack trace -----\r`,
            `1: checkCold (<cli>/index.mjs:636:47)\r`,
          ],
        },
        observe,
      ),
  },
)

// The states of a config's test root, one for each shape (`testRoots` in the
// model, issue #101). Each shape has its own constructed history.
// The state of a config plugin that loads test files itself, with a sync read
// (`loadPlugin`), which its own constructed history reaches.
const loadPluginState = `a config whose plugin loads test files with a sync read ran`
const testRootStates = {
  tests: `a config whose test root is a subdirectory ran`,
  parent: `a config whose test root is above the package ran`,
  outside: `a config whose test root holds no test file ran`,
  link: `a config whose test root is a symbolic link ran`,
}
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
        !daemonEvents.has(edit) &&
        ![`fixSession`, `lazy`, `fsData`, `midrun`].includes(edit),
    )
    .map((edit) => `edit ${edit} changed the cold result`),
  `a check whose daemon died during it`,
  `a check whose daemon held it past the CLI's wait, then died`,
  // The retention law's second writer: lines of a daemon the driver killed.
  `a killed daemon's retention lines were judged as its own`,
  `a warm daemon's connection was reset`,
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
  `of two checks held in the daemon at once, one computed and the other reused`,
]
// Law 9's states that a constructed history of their own reaches, not the
// edit sequence: the mid-run edit, and an edit to data a test reads through
// fs, by each read.
const ownedIncrementalStates = [
  `edit midrun changed the cold result`,
  `an edit landed during a check through the daemon`,
  `a run edited the helper it had read, during a check through the daemon`,
  `an unchanged check through the daemon computed nothing`,
  `an unchanged check through the daemon computed nothing under a config's pre plugin`,
  `an unchanged check through the daemon computed nothing while a test read a source through fs`,
  `a capture row read while the worker wrote it`,
  `a run edited the data it had read, during a check through the daemon`,
  `edit fsData changed the cold result`,
  `an edit to data read through sync changed the cold result`,
  `an edit to data read through promise changed the cold result`,
  `an edit to data read through callback changed the cold result`,
  `an edit to data read through statDir changed the cold result`,
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
// The supervisor-death state: a supervised child ends when its supervisor is
// killed. Every platform runs a supervisor (#201), so the state is required on
// each (I11, R56: no OS lacks the mechanism).
const supervision = [`a supervised child exits when its supervisor is killed`]
// A supervised check with no `ps` on its PATH (review of #57, A7) is a state of
// every supervised run; its witness is POSIX only, for a reason the OS gives.
// The `ps` witness is POSIX only for a reason the OS gives: `ps` is a POSIX
// tool, and the watchdog reads a pid's liveness with signal 0 (paths.mjs, alive),
// which needs no `ps` on either platform.
const posixPs =
  process.platform === `win32`
    ? []
    : [`a supervised check with no ps on its PATH`]
// The spawn stops that need a signal delivered to the CLI's process: SIGTERM,
// and a stop before the CLI's first statement, whose only witness is a signal's
// default action. win32 cannot deliver a signal to a Node process (its kill is
// TerminateProcess, a SIGKILL-equivalent that owes no line, L1), so these
// states are POSIX only (register "Platform-scoped reach (#73)").
const posixStarts =
  process.platform === `win32`
    ? []
    : [
        `a stop before the CLI starts`,
        `a stop by SIGTERM as the CLI starts`,
        `a stop before the CLI starts, after a stopped check`,
      ]
// The states of the constructed history `a value change at a ?. read and at
// a return` (see there), which `every outcome class` does not name.
const changedValues = [
  `a plain read in place of ?. on an undefined object crashed`,
  `a plain read in place of ?. on a null object crashed`,
  `a plain read in place of ?. on an absent nested object crashed`,
  `a plain read in place of ?. past a short-circuited link not distinguished`,
  `a plain read in place of ?. past a skipped optional call not distinguished`,
  `a plain read in place of ?. after an optional call that returned nothing crashed`,
  `a returned value made undefined killed`,
]
// The state of the constructed history `a ?. read of an object absent only
// at load` (see there).
const loadOnlyAbsent = `a plain read in place of ?. on an object absent only at load set up an error`
const required = [
  // Reached only by its own constructed history (see there): no generated
  // history kills the CLI.
  `a run after a killed CLI that left its own session`,
  // Reached only by the constructed history of the disarmed pause (see there).
  `a daemon pause that did not engage`,
  // Reached by its own constructed history (see there).
  `a probe branch's work under a generated test's bound judged nothing`,
  // Gated by the constructed history of a replaced warm daemon (see there):
  // no generated history takes a reset step, which arms a daemon pause.
  `a warm daemon was replaced before the pause`,
  `two starts race for a stale claim`,
  `a start refuses a stale claim`,
  `a start refuses an empty claim`,
  `a start refuses an unreadable claim`,
  ...supervision,
  `a stream log lost after its note, then stopped`,
  `a stream log lost after its note, then completed`,
  `a stop as the CLI starts`,
  `a stream log that cannot be written`,
  `two runs on one output directory`,
  `a run with the default output directory`,
  `a stop with the default output directory`,
  `a daemon check with the default output directory`,
  `a start refuses a dangling claim`,
  `an unsupervised run stopped after its note`,
  ...posixStarts,
  ...posixPs,
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
  // Each capture helper records a change where its site's value changed in
  // an owner test, so the mutant runs (see `changedValues`).
  ...changedValues,
  loadOnlyAbsent,
  `a comparison swap killed`,
  `a dropped not killed`,
  `a skipped call killed`,
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
  `a run stopped by SIGINT while a worker spun`,
  `a stop signal after the completed line`,
  `a stop signal while the config warms`,
  `a config refusal through the daemon`,
  `a completed run whose tests wrote nothing`,
  `a stopped run whose workers are child processes`,
  `a stopped run whose workers are threads`,
  `a run after a killed one that left its session`,
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
  ...Object.values(testRootStates),
  loadPluginState,
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
  ...ownedIncrementalStates,
  `a timed-out run reused after an edit`,
  `an edit that changed the cold result after a hang replaced the only context`,
  `edit lazy changed the cold result`,
  `a lazy edit changed the cold result after a batch was cut off`,
  `a rejected batch retired its copies and logged them`,
  `a run ended in an internal error`,
  // Reached only by the constructed history of a held check (`heldPhase`).
  `a check whose daemon stopped answering ran cold`,
  // Gated by its constructed history; generated histories reach it when
  // they draw `spinData` with an fs read and the data's edit.
  `an edit to data that only a spun copy read changed the cold result`,
  `a refused run whose package lies beside the CLI's directory, under a name that extends it`,
  `an edit to data that only a copy spun alone read changed the cold result`,
  `a slow warm-up was served by the daemon`,
  `a check through the daemon worked past its CLI's bound`,
  `a slow daemon start was served by the daemon`,
  `a check abandoned while a context warmed in place of a cut one wrote nothing more`,
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
// The states that each named constructed history enters, and only that
// history: they are not witnessed by "every outcome class" (a named history
// of its own must enter them, or registration fails).
const ownHistoryStates = [
  `a run after a killed CLI that left its own session`,
  `two starts race for a stale claim`,
  `a start refuses a stale claim`,
  `a start refuses an empty claim`,
  `a start refuses an unreadable claim`,
  ...supervision,
  `a stream log lost after its note, then stopped`,
  `a stream log lost after its note, then completed`,
  `a stop as the CLI starts`,
  `a stream log that cannot be written`,
  `two runs on one output directory`,
  `a run with the default output directory`,
  `a stop with the default output directory`,
  `a daemon check with the default output directory`,
  `a start refuses a dangling claim`,
  `an unsupervised run stopped after its note`,
  ...posixStarts,
  ...posixPs,
]
const separate = [
  ...ownHistoryStates,
  ...changedValues,
  loadOnlyAbsent,
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
  ...Object.values(testRootStates),
  loadPluginState,
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
  ...ownedIncrementalStates,
  `a timed-out run reused after an edit`,
  `an edit that changed the cold result after a hang replaced the only context`,
  `edit lazy changed the cold result`,
  `a lazy edit changed the cold result after a batch was cut off`,
  `a rejected batch retired its copies and logged them`,
  `a run ended in an internal error`,
  `a check whose daemon stopped answering ran cold`,
  `an edit to data that only a spun copy read changed the cold result`,
  `a refused run whose package lies beside the CLI's directory, under a name that extends it`,
  `an edit to data that only a copy spun alone read changed the cold result`,
  `a slow warm-up was served by the daemon`,
  `a check through the daemon worked past its CLI's bound`,
  `a slow daemon start was served by the daemon`,
  `a check abandoned while a context warmed in place of a cut one wrote nothing more`,
]
// A stop by SIGTERM exists only where Node can deliver it: on win32 kill is
// TerminateProcess, so there the stop law is judged by SIGINT (the test stop
// hook), and the SIGTERM state is not required (a declared platform bound).
const posixStops =
  process.platform === `win32`
    ? []
    : [`a run stopped by SIGTERM while a worker spun`]
// The run whose process aborts is declared on every platform (platform-scoped
// reach: the state is required everywhere, and a platform's witness reaches it).
// On POSIX the witness is the test's SIGABRT. The win32 witness (process.abort
// through ORACLE_GAPS_TEST_ABORT_AT, under the supervisor) comes with the win32
// supervisor in #79; until then the Windows end-to-end job stays non-blocking
// under C entry (c).
const everyStops = [`a run whose process aborted`]
// The states that only their own constructed histories set up, so that
// `every outcome class` names none of them: the disarmed pause and the
// replaced warm daemon need a history field (`pauseEngages`, `warmReplaced`)
// that only those histories set; and a probe branch under a generated
// test's bound needs a generated test whose input declares a bound, while
// `every outcome class` gives its generated tests input 1, which declares
// none.
const constructedOnly = [
  `a daemon pause that did not engage`,
  `a warm daemon was replaced before the pause`,
  `a probe branch's work under a generated test's bound judged nothing`,
]
// The stop-specific states of `every outcome class`, split between its two halves.
// The SIGTERM state is declared on POSIX only (posixStops), so only there is it named.
const stopsFirst = [
  ...posixStops,
  `a run stopped by SIGINT while a worker spun`,
  `a stopped run whose workers are child processes`,
  `a stopped run whose workers are threads`,
  `a run after a killed one that left its session`,
  `a stop signal after the completed line`,
]
const stopsSecond = [
  `a stop signal while the config warms`,
  `a run whose process aborted`,
]
const witnessed = [...required, ...posixStops, ...everyStops].filter(
  (s) => !separate.includes(s) && !constructedOnly.includes(s),
)
// Every state of `witnessed` that the stop runs of either half do not own.
const witnessedRest = witnessed.filter(
  (state) => !stopsFirst.includes(state) && !stopsSecond.includes(state),
)

// A constructed history of one owned function, judged by one fixed-seed test of
// file a, in an ES module config that Vitest discovers: the base of the
// test-root histories (`testRoots` in the model) and of the load plugin's.
// `fields` sets the config's test root, a setup file that defines a fixed
// global (which Vitest reads from the root as well), and the load plugin. The
// history sets `tornRows: false`, because the torn-row witness needs a batch
// hold that it does not produce.
const oneOwnerHistory = (generated, fields) => ({
  ...generated,
  functions: [[{ kind: `if`, op: `>`, k: 4, not: false, quote: `'` }]],
  containers: [],
  overloads: [],
  owners: [`a`],
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
  tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
  witness: false,
  authored: null,
  secondAuthored: false,
  fault: `none`,
  stability: `none`,
  steps: null,
  ordinary: false,
  native: `none`,
  boot: false,
  budget: `two`,
  cliPath: `plain`,
  concurrentStart: false,
  contexts: 1,
  tornRows: false,
  prePlugin: false,
  testRoot: `none`,
  configPlace: `discovered`,
  configFile: `vitest.config.ts`,
  packageType: `module`,
  config: `object`,
  configEnv: false,
  setupGlobal: false,
  loadPlugin: false,
  ...fields,
})

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
        // The end-to-end dimensions a generated base may draw: a construction
        // that does not name them runs without them (review of #57, apiLess).
        logBlocked: false,
        overlap: false,
        spawnStop: false,
        stopWitness: false,
        claimScenario: false,
        psMissing: false,
        declaration: index % 2 === 0 ? `wrapper` : `oracleProperty`,
        ownerless: false,
        owners: [`a`, ...generated.owners.slice(1)],
      }),
  }))

// Law 9 over the witness module's outcome classes, along the one edit
// sequence that a history with the witness module takes (witnessSteps): its
// hangs are recomputed after the test edit and reused after the helper edit,
// which changes only file b, and so is its spin, whose reuse is the state "a
// timed-out run reused after an edit". Generated histories with the witness
// module take no steps, so this is the one sequence that judges them
// (maintainer decision, 2026-11-11). Everything else is the cheapest legal
// setting. The whole module along this sequence cost one CI job (#106, #145),
// so it runs as two constructed histories, one for each half of the module
// (captureA and captureB in the model, whose union is the module and which
// share no function): cheaper histories of equal reach and equal kills, by
// the maintainer's decision "A one-history job over budget is cut by cost"
// (2026-11-16; v21.2 R7, R55 (b)). Each costs about two cold runs and four
// daemon checks of its half.
const witnessEditSequence = (witness) => (generated) => ({
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
  witness,
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
})

oracleProperty({
  id: `oracle-gaps.report`,
  law: {
    statement: `The gap report enumerates the promised operator mutants, leaves out exactly the probe-only code, discovers every oracle that owns a function's call tree and refuses broken ownership, judges each mutant only by its owners' tests on their registered routes and counts only law verdicts on reproducible routes as kills, which outrank a run that never ends, anchors each mutant by its function and normalized statement, lists every gap and unowned mutant once with consistent counts, keeps keys stable under unrelated edits, reports through one daemon per package what a cold run reports at every state of a sequence of edits, and bounds the runs that confirm a mutant's cut-off copies by one budget per mutant and names in each heartbeat a mutant that is running, in a file that runs it, leaves nothing in the package and writes nothing where Vitest's include could find it while it runs, leaves no process running once it is stopped, runs the package as Vitest does from any install path and any --source spelling: one instance of each workspace dependency, no refusal over an unbuildable devDependency, child processes for a native addon anywhere in the tree, a capture that a test's builtin spies cannot see, and a refusal of test.projects; leads its report with every test file's baseline, blocks only the mutants a failing oracle file owns and judges the rest, prints every line of its stream with the prefix oracle-gaps: and its kind, one decisive baseline line before any mutant, and a done line last, and every run that does not complete ends, cold or through the daemon, with a refusal that exits 2, prints a refused: block and one fix: directive with no stack trace, and writes the refusal to the run's output directory.`,
    authority: `The maintainer's decisions in design runs v11, v14, and v19 (2026-11-04 and 2026-11-05), not in this package's records, including that a kill by reach agreement alone is a gap and that an incremental run through the daemon equals a cold one (v19.3); the project's oracle guide on quiet exclusions; the oracle rubric's outcome kinds (ORC-006); the CLI's documented operator list in schemata.mjs; the maintainer's dispositions G1, G2, G4, G5, G6, and G13 of the framework papercut ledger (2026-11-11) and the v20 freeze's namespacing, one-loop, and provisional-report decisions (2026-11-10); the maintainer's request for a greppable stream (2026-11-12, relayed by the coordinator with its decisions of that day: the same prefixes on stdout and stderr, a done line for a stopped run, and no --max-gaps).`,
    limits: `Law 12 judges refusals. The one internal error a history reaches is the constructed rejected-batch history (rejectBatch, a test-only fault that rejects a batch's run after its copies are in Vitest's and Vite's state). Its run is judged in this order: the output namespace, process warnings, and config lines, as for any run; then bounded retention, which owes the rejected batch's own line with its state after retirement; then the stream law (law 15) on both streams, as for any run, so its error line and its done line carry the prefix, and no other line does not, which the state \`a run ended in an internal error\` declares; then exit 3 with an internal error's done line last on both streams, no stack frame on stderr, and an error.log in its output directory. What the error.log's stack says is not judged. An internal error that no fault constructs is a completion failure, reported before the stream law; an internal error through the daemon is reached by no history, and its ending is the same function's (endRun), by inspection. The internal error's lines follow the register's C entry "The internal-error line" (2026-11-16): the general law (endsBreach) owes every run that ends through endRun one error line on stderr naming the done line's log, the output directory's error.log, and none on stdout, and owes the supervisor's own exit 3 none. The message's escape is witnessed by the fault's message, which holds a line break and a forged done line after it; the log path's escape only on POSIX, where the rejected batch's output directory holds a line break (a name on win32 cannot). Paths in a completed run's lines (the results note, the done line's report, the test-output note) are escaped the same way, by inspection: no completed history names such a directory. P10's exempt lines (v21.2 P10 and I3) are read by their own shapes (exemptBlocks), never by indentation alone: a baseline failure's indented details, a refusal's block, Node's warning with its \`--trace-warnings\` frames and its hint, V8's fatal block, esbuild's message block, and Vite's own \`[vite]\` line. The V8, traced-warning, and esbuild blocks are calibrated beside our own line with no prefix (the stream calibrations put them before the rejected-batch run's done line, and the law must name our line alone); no generated history prints any of them or a Vite line, and a shape of those tools that exemptBlocks does not name is read as a stray. The stdout summary's exemption is unused and not exercised: the CLI prefixes every summary line (its summary, legend, and function kinds). \`--help\` prints its usage text with no prefix and no done line, exempt by the register's M entry "\`--help\` is exempt" (2026-11-16), and the static oracle's Help law owes exactly that text; \`--stop-daemon\` prints nothing and exits 0, read the same way as a command outside the run protocol (C, pending ratification), and this oracle runs it without observing its streams. A syntax error in a module that the config imports lets the esbuild that Vite bundles configs with print its block before the refusal (trace, Vite 7.3.7, esbuild 0.28.2: \`✘ [ERROR] Unexpected end of file\`, an empty line, \`    helper.ts:2:0:\`, the code frame, then the refused block): its lines are exempt by the register's M entry "Other tools' output is exempt" (2026-11-16), the refusal and the done line around them keep the prefix, and no history generates it. Bounded retention reads the hook's lines (retention-hook.mjs). Its count of one line per batch (runner law L2) rests on the index the hook takes when a batch starts, so a CLI that skipped a batch's index and its line together, or that omitted only the line of a check's last batch, keeps the indices 0..n-1 and is not seen; a check that ended before its report (the rejected batch, a stopped run) and a daemon the driver killed are judged for at most one line per index, since the batches they were running at their end owe none. A line's process is told by check.pid, which the check writes, and the driver itself knows only the daemon it killed. The cold store's law (held) counts the entries given to the store's put that a full collection leaves reachable, so a store that kept only a part of an entry (its unit without the entry) is not seen; staleOpen reads Vitest's own close state (closingPromise, set when close starts), so a close that starts and never resolves is the runner oracle's (L8); and a context replaced after a check's last batch is observed only by a later check's first batch through the daemon. The run whose process aborts is declared on every platform. Its win32 witness (process.abort through ORACLE_GAPS_TEST_ABORT_AT, under the win32 supervisor) lands in #79; until then the Windows end-to-end job is non-blocking (C entry (c)). On win32 Node cannot deliver SIGTERM (its kill is TerminateProcess, which ends the process with no stopped line), so the stop states that name SIGTERM are required on POSIX only, and a stop there goes through the CLI's test stop hook and is observed as SIGINT, which owes its done line as any stop does (no history sends a win32 child.kill, the SIGKILL-equivalent that owes none); every SIGINT state stays required on win32. A stop as the CLI starts lands only in one of two holds: the driver's own preload before the CLI's first statement (outcome a, nothing written; POSIX only, since its witness is a signal's default action), or the CLI's hold after its started marker, which the stop the CLI keeps releases (outcome b, judged only when the supervisor started no child); a stop during Node's own start between the two is not generated, since its outcome follows timing. The drawn spawn delay is a wait inside a hold, so it cannot move a stop out of it. Stop runs that land while the config warms (ORACLE_GAPS_TEST_WARM_PROBE) are still drawn, and on win32 every drawn stop goes through ORACLE_GAPS_TEST_STOP: each is a test-only hook that a drawn field switches, main's pattern, which the review of #57 (A3) brought to the maintainer; only the stop after the completed line (ORACLE_GAPS_TEST_HOLD_UNTIL) was made constructed-only. A missing \`ps\` is generated only as a PATH that names no command, on POSIX, where the run is supervised. The unsupervised path (stopNow, every win32 stop) is reached on POSIX by one constructed history whose stop is held at the run's note, before the check starts a process: an unsupervised POSIX run has no group to end, so a stop while the witness's test spins leaves that test's own child (measured; C 2026-11-13, Windows (e)), which win32 ends with the job object libuv puts its children in. Argument refusals are the static oracle's; the check's rejection of a stack trace, a missing fix, and a wrong exit code is calibrated in the static oracle, through the same refusalBreach, and here only a refused run reported as complete is calibrated, because each calibration here runs real CLI histories. Law 15's stdout gap lines are judged against each completed run's own results.json, by id: the cold run, and each check through the daemon (every step's check and the check that a mid-run edit overlaps); a stopped run and a refusal list no gaps and are not judged so. A line's change is read loosely: its code on one line, whole or cut after a kept part and ended with \`...\`; where the printer cuts (60 code points, kept 57) is the classify oracle's law 8 (\`shortened\`), in-process. A line with any text after its change does not read and fails loudly: the \` (cause: <cause>)\` suffix that #99 adds to timeout lines is not read yet, so whichever of #99 and #115 lands second extends readGapLine. Hangs only as an owner test that awaits a promise that never settles, under a 1 s first budget and a 20 s full limit, and a slow run only as two witnesses whose tests wait where the output changed, 3 s in one that then judges and 10 s in two one-test owners of one that does not; busy loops only on instrumented code (cut by the call budget), no slow runs past the full limit that would end, hangs in ordinary or nondeterministic tests, setup errors other than a throw at module load, loops, multi-line conditions, two functions on one line, or await, new, and void statements; nested functions, object-literal methods, accessors, and class-field arrows only where no test calls them (their ownership is the static oracle's); two source files of one package, with no re-exports, namespace imports, or calls into another package; --only only in a stopped run and a partial run of one function's mutants, and no --sample or --diff-base; the baseline's failures only as one failing owner test that throws an error and a setup file that throws, so a baseline law violation's law and counterexample lines are the classify oracle's; a derived class's file is instrumented and its sites are judged as unowned, but no test imports or constructs the class, so its no-mutant and super-region behavior is the static oracle's (in-process), not this oracle's; package configs only as vite.config or vitest.config with one of the extensions .ts, .mts, .cts, .js, .mjs, and .cjs (not every pair), as config/gap-vitest with the same extension through --config, or none, as an object or a sync or async function, with no plugins of their own except one enforce: 'pre' transform that appends a comment to each module of the package (prePlugin) and a plugin whose load reads each test file with a sync read (loadPlugin), drawn for a config in ES module syntax and reached by its own constructed history too; a plugin whose output depends on anything but the module's text (a sidecar file it reads) and an environment variable that changes between checks are not generated, since the runner tracks neither yet and the daemon's environment is fixed when it starts (F-A1: the maintainer decided on 2026-11-13 that the daemon tracks both and restarts when they change, in the next pull request); and test.projects only as a refusal, and only under the package's own package.json; the supervisor-death state is required and entered only off win32: win32 has no supervisor until #79, so there the state is not reached and its history is not judged (platform-scoped reach; the win32 run is unsupervised, which register C entry (e) of #58 records as not guaranteeing that no process outlives the CLI); a config's test.root only in four shapes, drawn for an ES module config that Vitest discovers in the package (the randomness-wins decision, 2026-11-16) and each reached by its own constructed history of one owner and one context, where the test files' globs and the setup file are relative to the root (issue #101): the directory that holds the tests, the directory above the package, a directory of the package that holds no test file, and the package's tests as a symbolic link to the directory that holds them (required on every platform, since Windows creates the link as the driver's other links); not under --config (nor in a history whose config edit names a second config), a CommonJS config, a parent's config, test.projects, several contexts with different roots, or a root that is the filesystem's root; the runner serves each copy of a test file by its absolute path, through its pre plugin's load (which answers before the config's own plugins) and through its read of the copy's path for Vitest's pragma read (serveCopies), and histories run copies only in Vite's server environments (node and the pragma's ssr environment): jsdom and happy-dom, Vite's client environment, are not generated (the #103 merge-gate review ran jsdom by hand under all five root shapes, and the copies loaded in each); a top-level await only in an ES module config and require only in a CommonJS one, as Vitest itself loads no other; a --config outside the package is refused by design, through the rule for paths outside the package (args.mjs), and no history generates one; contexts only one, four, or eleven, and process warnings judged only as MaxListenersExceededWarning on the CLI's own stderr (a daemon's process warnings go to its log); a context that fails to open gives back its listener allowance, which no observation shows (a kept allowance only raises the limit, so no warning follows), so that accounting is fixed by inspection; no probe-bound states, so reach agreement's killing of probe mutants is not checked; no gap answers or gate; law 9 judges the witness module's outcome classes along one constructed edit sequence only (a test edit, a helper edit, and a revert), which runs as two constructed histories, one for each half of the module (captureA and captureB, whose union is the module and which share no function; a function stays with the functions its tests or statements read), since the whole module along it took one CI job (#106, #145; maintainer decision "A one-history job over budget is cut by cost", 2026-11-16), so an interaction between functions of different halves, beyond the ones the split keeps together, is not judged along the sequence (the whole module runs together in \`every outcome class\` and in generated histories, which take no steps); and the budget witness's outcome classes along one constructed second check with nothing changed, because a generated history with the witness module or the budget witness takes no steps (maintainer decision, 2026-11-11, and the runtime review's P1-a, 2026-11-12; this oracle owns the gap); the state "a timed-out run reused after an edit" counts only runs cut by their call budget (the spin, in the first half), a count the CLI records, by the maintainer's decision "#104 state narrowed, #99 restores" (2026-11-17), which narrows "#90 job stays blocking" for that state only: the reuse of a run cut by the clock (a hang) is judged by law 9 but not required, because on main a hang's timeout is stored only when the sampler saw the copy idle, which load decides, and otherwise its confirmation is cut short by its mutant's budget and not kept (#104); #99 makes a hang a state-based no-progress kill and restores the reach as "a run killed for no progress, reused after an edit" (#156); law 9's edits come between checks, except one, midrun, which lands during a check through the daemon: a test of file a, whose context has loaded file b's helper, rewrites the helper in the baseline's first run of file a, before file b's runs read it, in one context or several; or a test of file b rewrites its own helper, or the data file that its verdict read through a sync fs read, after file b's judged tests read them, in the run that judges with the old text (review of #55, F1); that check must report, for each mutant, what a cold run of the state before the edit or of the state after it reports, and exit as one of them does (third review of #55, F-C), compared per mutant result rather than per file; when file b's own test lands the edit, b's baseline reads the old text and b's mutant runs read the new one, so b's own mutants in that check are not judged, since their results legitimately mix the two texts (maintainer decision, 2026-11-13), while every other mutant there is judged against both cold runs, with the check's exit code, its mutants' keys, and its stream; the stronger follow-up compares each run's raw outcome with the cold outcome of the state that run read; and the next check, with nothing changed, must equal a cold run of the state after the edit, compared for equality of results only, not for what the daemon reused or computed (the runner's rule: a run whose input changed after the run read it is invalidated and not stored, settleIn); a check through the daemon of a state that nothing changed must compute no run that was not cut off, judged where no test reads the clock (F-A, F-A2), and a test's fs read of a file and the module that the context serves from it are two inputs, each under its own hash (F-A2); an edit during a mutant run is not generated, and a file is edited mid-run only by the run's own tests, not by another process at an arbitrary time; a file that a test reads through fs is edited only as one JSON file that file b's verdict reads by a sync, a promise, or a callback read, or by a sync read after it stats its own directory and tests that it exists (statDir: the directory is an input as a directory, not by its content, and is not itself edited), each read first checking that its fs function keeps its own name and length (the runner stores a run under the files in the package that its copy reads with readFileSync, readFile, existsSync, or statSync, or the fs/promises readFile or stat, each with its hash at the copy's first read; a read outside the package or under node_modules, from a worker thread or a child process that a test starts, or through any other fs API, which includes readdir, opendir, glob, globSync, createReadStream, realpath, lstat, access, open, a read through a file descriptor (read, readSync, readv, fstat, fstatSync, and readFileSync or readFile given a file descriptor), copyFile and copyFileSync, cp and cpSync, openAsBlob, statfs, readlink, the callback stat, exists, watch, watchFile, and the fs/promises access, open, and glob, is no input, and none is generated: the maintainer decided on 2026-11-13 that every fs read except watch and watchFile is an input, which a follow-up of #55 implements, and until then this oracle owns the gap); a run cut off by its clock writes no closing row, so it is stored under its file's known inputs only, while a run that spun ends and keeps the inputs it named (F-D), in a batch as alone; a spun copy that reads a file that its file's unmutated run never reads is generated (spinData: file b's verdict tests that read the data spin on the function they test while it is open), and the data's edit is judged by law 9 for copies that spin in a batch; a copy that spins alone (runAlone, after a batch with an error outside any test) is generated too (spinThrows: each spun copy schedules an error that fires after its test), and its data's edit is judged the same way; an error outside any test only from a copy that spins, so the alone path's other units (a slow copy's confirmation) stay unwitnessed; a test that rewrites a file it read with the same text makes the next check compute that run again (1 run in the self-edit histories), since the edit changes the file's modification time: the daemon is conservative there, nothing goes stale, and content keys (D10) remove it, with a selfWrite dimension in that pull request; the mid-run marker sits in the daemon's session directory, .oracle-gaps-<pid>, whose location predates #55; the runner's hash memo knows a file by its size and modification time, so an edit that keeps both is not seen, and no history makes one (D10, planned in phase 2, A5); law 9's edits leave out other environment variables, new files that change how an unchanged import resolves, Vite config and installed-package changes, and concurrent checks other than two that start the daemon; cut-off charging judged only under one budget; native addons only as a binding.gyp or a prebuilt .node file, not as optional platform packages; a scratch package lies in the CLI's directory (.scratch-*), in a directory beside it whose name extends the CLI directory's name (siblingDir, drawn), or in the OS temp directory, so the driver's inside-the-CLI label is judged against a prefix that is not a parent; a CLI path spelled with another drive-letter case or separator than the package's is win32-only and not generated; daemon races (two CLIs reading one error file, a CLI hearing closing from the failing daemon it started, a reset connection on macOS) fixed by inspection; a daemon that stops answering only at four holds, each released by a count, never by time: a fresh daemon's first check held before it runs until the daemon accepts the driver's next request (ORACLE_GAPS_TEST_HOLD_OVERLAP), which stands in for a session slower to open than the bound while the CLI carries the warm-up pause; and, after a warm check with the pause disarmed (ORACLE_GAPS_TEST_PAUSE_ARM), the daemon's own pauses (pauseAt): before a check runs (daemon-check), before a check that reuses every run warms its contexts (daemon-warm), and before a context warms in place of one that a cut stopped, after the test edit (daemon-replace), each released by the driver's file once the CLI has ended; the CLI's bound is the socket's idle timeout on a daemon that sends nothing (60 s; these histories shorten it to 3 s), a wall-clock bound that changes the run's path and never its outcome; its cold check must equal a cold run (law 9's cold fallback, R39), and it never holds, since only the daemon gives its session the pauses (G43: a hook changes no outcome); the daemon must still run after the fallback, must leave the run's --out as the CLI left it once released (every file's text, with a poison the driver writes into its results.json and error.log), and must serve the next check (its served mark); the daemon drops a check whose CLI has gone before it runs, at each phase's end, and after each context that warms in place of a cut one, which is the one stretch inside a phase with no running copy to beat, and a check ends only once every context's share of a phase has; not witnessed: a gone CLI found while two contexts are both warming in place of cut ones (the wait for every context's share is by inspection), and a copy that starts in the moment between the CLI's bound and the daemon's reading of the closed connection, which runs to its end and writes into the run's --out (the race is the bound's own, a wall clock's, and no history generates it); the held warm-up and the held re-warm rely on the warm daemon's check reaching its hold within the 3 s bound, as the shortWait history relies on its first copy starting within it, and the driver's wait for the hold fails loudly otherwise; the one beat left, a running copy's poll, is witnessed by a warm daemon's check under the 3 s bound while a copy waits 10 s (shortWait); a CLI whose daemon is closing and hung waits 60 s and fails with an internal error rather than checking cold, and --stop-daemon against a hung daemon has no bound (merge gate F3; owed: a constructed history that closes a held daemon, issue #135); a fallback whose cold check refuses is not generated (law 9's refusal-notes comparison would see the fallback note); the runner's copies of the test files exist only in memory, and its harness and Vitest configs sit in the package's .oracle-gaps-<pid>, which the next run removes once a killed run has left it (judged after two stopped runs, not after a SIGKILL); a default --out is judged here too: the default-directory histories (a stop, a daemon check, and the unsupervised daemon check) run without --out, and their directory is named <default out> in the trace; the namespace is checked after each run and, in a stopped run, while the run runs; a slow kill in a later owner, after earlier owners' confirmations spent the budget, becomes a timeout (owner order; not generated); the Vitest 5 path of the copies' pragma read and of the runner is verified from Vitest 5's source only, since the Vitest 5 CI job runs no gap oracle; a batch whose run reports an error outside any test reruns each copy alone (unitsBatch, runAlone) with its first budget, and a copy cut there is kept as a timeout with no confirmation, a defect older than this oracle's budget work that no history reaches (no history has an error outside any test beside a slow copy), recorded here with that trace for the maintainer; stale-session removal is scoped to this host's session directories (a host file), and is not judged across pid namespaces; a generated history stops only while the witness spins, or aborts, and on win32 not at all, since every other stop switches a test-only hook (the hold after the completed line, the warm probe, and on win32 the test stop file; randomness wins, 2026-11-16), so only the halves of every outcome class stop with one; the stop law covers SIGTERM and SIGINT sent to the CLI; a SIGKILL of a supervisor is witnessed on POSIX by the constructed history "a supervised child exits when its supervisor is killed" (its child exits within the watchdog tick), and a signal sent to the daemon is not witnessed here, and its witness is one test that spins synchronously and starts one child process; the mutant budget is witnessed as two slow owners whose confirmations pass the --mutant-limit floor, not through its multiple of the owners' unmutated time, and authored mutants have no confirmations to budget; the witness w_slowpair is a wall-clock window, since the CLI's budget has no controlled clock and a fixture cannot see the time the CLI measures for its file: with one-test owner files p and q of measured unmutated time t each (a file first in its context pays the instrumented transform too), a wait W of 10 s, a 20 s --hang-limit and a 15 s --mutant-limit, it tells a budget from none only while (a) its first attempt is cut, W > 1 s + 3t, (b) its two confirmations do not fit the budget, 2W > max(15 s, 10 x 2t), and (c) each would fit its own full limit, W < 20 s + 3t; (b) is the binding one, so it holds while the two files' time stays under about 2 s together (about 1 s each, some 20 times the authoring machine's idle and 5 to 10 times its loaded measurements), and under one budget a run's overhead must stay under 10 s + 3t; CI runners measure 1.5 to 2.3 times the idle machine; beyond that w_slowpair would read not-judged; heartbeats are checked for shape only (maintainer decision "Heartbeats are progress, not outcome", 2026-11-14): each names a mutant of the run, or the baseline, in a file that runs it, and a beat after its mutant's own gap line is a breach, while their set and count, which depend on timing, are not compared and no busy mutant's beat is owed; the shape law reads "was running" only against a mutant's own streamed gap line, so a beat that names a killed mutant (which streams no line) after it finished, or a mutant that has not started, is not a breach; the state "a heartbeat named a busy mutant" is required (maintainer decision "#90 job stays blocking", 2026-11-16) and is entered only through a deterministic hold (#84): the slow kill's test, where its output differs, holds until the run's stream log has one more heartbeat that names a mutant in its file, released by the CLI's own line and never by the clock, so a cold run that holds it has such a beat on any machine; the state is entered only by a cold run that has the slow kill and named its stream log to the hold (\`every outcome class\`, which pins its own --out, and drawn histories with the slow kill and an --out), and a beat anywhere else enters nothing: a check through the daemon (a daemon keeps the environment of the call that started it), a stop run, a run with the default output directory, and the first half of the witness sequence (no slow kill; its I/O wait spans the interval by timing) run unheld, and their beats are progress only; a held copy that no beat releases is cut by the CLI's budget and is judged \`timeout, owed killed\` (the bound of 2,400 polls on the hold is a backstop that the CLI's 15 s budget and 20 s limit always reach first); a config only in the package's parent directory is generated one level up, in a temporary directory with no package.json (so its .js or .ts name is CommonJS), as a plain config, one that throws, one with no default export, or one that defines test.projects; a config two or more levels up, or a parent config beside a package config, is not generated, and the order in one directory follows Vitest's configFiles list by inspection; a package with no config lives in a temporary directory, where no parent has a config; a counterexample shrinks through at most six histories, and within half the unit's timeout, so it can be larger than the smallest that fails; in CI's random units it does not shrink (GAP_E2E_SHRINKS=0, the maintainer's decision "Shrink briefly in CI", 2026-11-17), and its history is filed whole; module-level data only as four \`const\` declarations of the main source (an object literal, an array that holds a function, a boolean, and an object of two methods), read in place, with no data imported from another file, destructured, reassigned, or declared as an enum or a default export; the work law only through shortcut witnesses (an early return before a counting loop with a bound twin of ratio 2, and a push beside one that calls String with a bound twin of ratio 1), the early return in tests that reach the clock by each watched path and in tests that wait a turn, a generated test's bound of 1 derived from its plan; probe code is never work (maintainer decision, 2026-11-16), so the model and the capture count no probe-only site, and only a constructed history (a probe branch under a generated test's work bound) reaches a probe branch beside a bound: the fixed seeds' generated histories reach neither that state nor \`killed by a work bound in a generated function\`, which stays measured; work counts are observed only through a bound's ratio and a rise, never as numbers (v21.2 O1), so a counter that skips every site on a probe's line, which drops only the condition sites of an elseIf that run once on both sides, survives (mutant M6, equivalent under these observations), while one that skips every site of a function that holds probe code is killed (M7), and one warm-cache witness whose selection reproduces observations but not work; work is the capture's count of site evaluations per test, so code with no site (a plain assignment, a for...of pass, a builtin's own work) counts nothing and a test's histories are summed, and a test whose work varies between the unmutated runs while its observations agree is not generated. The skip law (law 4: a mutant is judged without a run only where no owner's unmutated run reached its site with a value that the mutant changes) is judged through the kills, crashes, and setup errors of mutants whose value changed, and through the survivors of those whose value did not: for \`?.\` on an \`undefined\` and a \`null\` object (the drawn \`absentObjects\`), on an absent object two or three links deep, and past a link whose object is absent, where JavaScript short-circuits the rest of the chain so a plain read there changes nothing (the drawn \`optionalChains\`), and for a returned value made \`undefined\`, in the constructed history \`a value change at a ?. read and at a return\`; for a \`?.\` whose object is absent only while the module loads (a booted first function), in \`a ?. read of an object absent only at load\`, whose mutant throws as the module loads and is a setup error; and for a comparison swap, a dropped \`!\`, a skipped call, a boolean flip, a forced \`if\`, a loop that never runs, a dropped field, a value-position call, and an arithmetic swap, by the witness module's kills under \`every outcome class\`. A logical operator's swap (\`&&\`, \`||\`, \`??\`) has no killable site in the grammar (its only sites are probe guards and the old probe form), so that its switch infects the site on every reach is fixed by inspection. The switch's extra infection (it infects on every reach, including a \`return-undefined\` of a value that is already \`undefined\`) costs a run and changes no outcome only because its active form computes exactly the mutated expression; the \`?.\` helper's active form throws wherever it infects, so it infects exactly where the link's own object is absent and no earlier link of the chain short-circuited, and the outer links' helpers are told of an earlier link's short-circuit. An optional element read (\`a?.[k]\`) is not generated: it goes through the same capture helper as \`a?.b\`, so under its mutant an absent object throws before the key expression runs, where the plain read \`a[k]\` evaluates the key first; a key with an observed effect or a throw of its own is judged by that order, which differs from the real mutant's, and no history reaches it. An optional call (\`f?.()\`) is no site; where it feeds a later \`?.\` link, it passes its short-circuit on to that link, so the link's mutant is skipped where the call's method is absent, and runs where the call ran; this is judged for a method that returns an object or nothing, absent itself or behind an absent object (the drawn \`call\` and \`returns\` of \`optionalChains\`), and for a plain read of \`v\` after the call. The generated calls take no arguments; the spread that marks a call as run comes before any argument, so a call's arguments run only where it does, as before. The pass-through keeps, per call site, a stack of the open evaluations' records, so a record pairs with its evaluation only where evaluations of the same expression nest and each one ends. Four cases break the pairing, and no history generates any of them: an evaluation of the same expression nested in the receiver, or in the method lookup, that throws and is caught there after its call ran leaves a run record open, so an outer evaluation whose method is absent reads it as run (a false infection, and a false throw under the next link's mutant, P3); one nested in the call's arguments or in the method's body that throws before its call runs leaves a not-run record open, so an outer evaluation whose call ran reads it as skipped (a false skip: the next link's mutant is judged without a run, the class of issue #109, P5); and two async evaluations of the same expression interleaved at an \`await\` close each other's records (a false skip or a false throw). Each is filed for an owner as issue #162. Open Limits, owned by the in-process runner oracle (L1, state \"torn tail at a cut-off read\"; RED: captureLines without the guard): (a) the batch's cut-off read (runBatch's rowsOf after the cut-off) drops a partial last row, and no witness reaches that drop yet, because a copy held half written across the cut-off did not observe its release in the harness; (b) a short fragment on the strict path, which the no-newline mutant does not reach. The strict read after a finished run (a fragment is an internal error) is witnessed by the no-newline mutant. Windows idle gap (recorded, not witnessed): the state \`a hang cut off for idleness\` is required on every platform, and win32 reaches it (run 43683794816, job 132719872988), so it is not platform-scoped. The sampler (capture-setup.mjs) counts a copy idle only after 500 ms with no late tick, no non-quiet handle, utilization at most 5%, and no timer due, so \`every outcome class\` reaches the state only when the sampler sees that window. On win32 the check missed it once (run 43683794816, job 132719872940); the cause is not confirmed (a late tick on a shared runner, or a stdio handle outside \`quiet\` for this file's console output, are the candidates). Its witness, a test-only hold at the hang until the window is seen, is owed, and that is a timing dependency the determinism-under-load rule forbids; the maintainer decides whether it lands before the Windows job becomes blocking. A run killed before it cleans up may leave its own directory: the CLI killed with SIGKILL (\`kill\`, constructed only), the unsupervised abort, and every abort on win32. The constructed history \`a run after a killed CLI\` kills the CLI and its check's group while the witness spins, and the run after it must remove the directory the killed CLI wrote, through the \`host\` file that CLI wrote. Every other stop run that opens a session also finds a killed run's directory that the driver wrote, under a pid that no process can have (above Linux's pid_max and macOS's 99999, and not a multiple of 4 as every win32 pid is). The abort's killed directory is never followed by a run. Whether a run is killed is read from the stop and the platform, not observed, so a win32 supervisor (#79) must narrow it to the unsupervised abort. A run stopped before its first statement can remove nothing, so a killed run followed by such a stop would keep the killed run's directory whatever the CLI does; no history has that order (a stop before the CLI starts is the last run of its history, and the killed runs are not followed by one). On POSIX a supervised run's directory is removed by its supervisor once the child ends, whatever ended it; an unsupervised run removes its own when its process exits, and that path is judged on win32 alone (its hookStops histories), since POSIX's one unsupervised history is stopped at its note, before a session opens. No history makes a removal fail or reuses a pid, so the catch and the live-pid guard of removeSession are not judged; their witnesses are owed (#168). Platform scopes (R56): 'a run stopped by SIGTERM while a worker spun' is judged on POSIX only, because Node cannot be sent SIGTERM on win32 (C-26, ratified by M-29; the win32 stop is the SIGINT of the test stop file). 'a supervised check with no ps on its PATH' is judged on POSIX only, because ps is a POSIX tool and the win32 watchdog reads liveness with signal 0; the other supervision states, including the supervisor-death witness, are judged on every platform.`,
  },
  histories: {
    // A failing history shrinks through at most six smaller ones. Each runs
    // the real CLI, through the daemon too, about thirty times (some 20 s,
    // a minute with hangs), so unbounded shrinking outlasts the 900 s test
    // limit, and the campaign would end in a timeout, not in the law
    // verdict its first failure holds. The counterexample is the smallest
    // of those seven histories, its law the first failure's. CI's random
    // units shrink at most GAP_E2E_SHRINKS steps, which the random job sets
    // to 0 (the maintainer's decision "Shrink briefly in CI", 2026-11-17): a
    // failing seed's job then takes about its passing time, inside P12. The
    // failing history is filed whole ("Replay by history") and shrunk
    // locally by whoever investigates it.
    arbitrary: fc.limitShrink(
      histories,
      Number(process.env.GAP_E2E_SHRINKS ?? 6),
    ),
    states: [...required, ...posixStops, ...everyStops],
    measured: [
      ...staticStates,
      `extra work in a generated function`,
      `killed by a work bound in a generated function`,
      // A check whose runs have more than one batch: the retention law's multi-batch reach.
      `a check that ran more than one batch`,
    ],
    runs: 2,
    // One fixed base per constructed history and none drawn: the per-run
    // randomness comes from the random-seed jobs that every pull request runs
    // (#90), which build each constructed history from a fresh sample (register
    // M, 2026-11-18, "Gap e2e: 1 fixed base plus random-seed jobs"). Each
    // history runs the CLI end to end, often for minutes: five fixed bases
    // took a fixed-seed shard to 18 to 30 minutes on an Arclet (#122).
    bases: 1,
    fixedSeeds: [20261105],
    // A filed counterexample, replayed by its history (register M, "Replay by
    // history"): the fourth base of `a stale authored mutant and a
    // reformat` that #122 drew, where an owner test reaches a `?.` with no
    // object and the CLI judged its mutant without a run (issue #134). The
    // fields that the grammar gained after it was filed hold their neutral
    // values; `stopRuns` and `laterSteps` are the drawn constants.
    fixed: [
      {
        name: `a filed base whose owner reads an absent object through ?.`,
        history: {
          ...{
            functions: [
              [{ kind: 'optional' }],
              [{ kind: 'probeBlock', op: '<=', k: 6 }],
            ],
            containers: ['C0', 'free'],
            overloads: [true, false, false],
            owners: ['a'],
            library: [[{ kind: 'dollar' }, { kind: 'push', quote: "'" }]],
            libraryOwners: ['none', 'a'],
            runes: [
              [
                { kind: 'runeStateRaw' },
                { kind: 'runeDerived' },
                { kind: 'runeStateRaw' },
              ],
              [{ kind: 'runeStateRaw' }],
            ],
            derived: {
              params: 'plain',
              field: false,
              before: [],
              form: 'arrow',
              after: [],
            },
            sourceSpelling: 'redundant',
            dotGen: false,
            ownsSpelling: 'plain',
            wholeFile: 'b',
            template: false,
            tests: [
              {
                file: 'b',
                route: 'fixed seed',
                registered: true,
                name: 'plain',
                fn: 1,
                input: 0,
                judges: false,
                law: 'L',
                channel: 'observe',
                flaky: false,
                judgeBy: 'verdict',
                hangs: false,
                slow: false,
                shrinks: false,
                draws: false,
                ioWait: false,
                stops: false,
                rawImport: true,
                cleanupThrows: false,
                asProp: true,
                then: { route: 'case', input: 4 },
                work: null,
                timed: false,
              },
              {
                file: 'b',
                route: 'calibration',
                registered: false,
                name: 'plain',
                fn: 1,
                input: 7,
                judges: true,
                law: 'L',
                channel: 'observe',
                flaky: false,
                judgeBy: 'soft',
                hangs: false,
                slow: false,
                shrinks: false,
                draws: false,
                ioWait: false,
                stops: false,
                rawImport: false,
                cleanupThrows: false,
                asProp: true,
                then: { route: 'random seed', input: 7 },
                work: null,
                timed: false,
              },
              {
                file: 'b',
                route: 'calibration',
                registered: true,
                name: 'plain',
                fn: 2,
                input: 4,
                judges: false,
                law: 'reach agreement',
                channel: 'observe',
                flaky: false,
                judgeBy: 'verdict',
                hangs: false,
                slow: false,
                shrinks: false,
                draws: false,
                ioWait: false,
                stops: false,
                rawImport: false,
                cleanupThrows: true,
                asProp: true,
                then: { route: 'enumerated', input: 0 },
                work: null,
                timed: false,
              },
            ],
            witness: false,
            authored: { stmt: 0, kind: 'stale' },
            declaration: 'oracleProperty',
            ownerless: false,
            fault: 'none',
            stability: 'reformat',
            ordinary: false,
            lazyGate: false,
            secondAuthored: false,
            consoleOutput: true,
            config: 'object',
            configEnv: false,
            setupGlobal: false,
            native: 'none',
            depSubpath: false,
            unbuiltDep: false,
            boot: false,
            budget: 'two',
            onlyRun: false,
            pragma: false,
            cliPath: 'spaced',
            concurrentStart: false,
            configFile: 'vite.config.ts',
            configPlace: 'parent',
            packageType: 'module',
            configAwait: false,
            configRequire: false,
            contexts: 4,
            steps: null,
            dataOwners: ['b', 'a'],
            exportOwners: ['b', 'b', 'b', 'b', 'a', 'none'],
            importer: 'a',
            midrunBy: 'b',
            midrunTarget: 'data',
            prePlugin: false,
            fsRead: 'callback',
            tornRows: false,
            pauseEngages: true,
            warmReplaced: false,
            testRoot: 'none',
            loadPlugin: false,
            rejectBatch: 0,
          },
          outMode: `explicit`,
          logBlocked: false,
          overlap: false,
          stopWitness: false,
          spawnStop: false,
          spawnSignal: `SIGINT`,
          spawnDelay: 0,
          spawnOnStart: false,
          claimScenario: false,
          logLost: false,
          supervisorDeath: false,
          unsupervised: false,
          psMissing: false,
          holdOverlap: false,
          replyHeld: false,
          spinData: false,
          siblingDir: false,
          hookStops: false,
          spinThrows: false,
          slowStart: false,
          shortWait: false,
          absentObjects: [],
          optionalChains: [],
          stopRuns: NO_STOPS,
          laterSteps: NO_LATER_STEPS,
        },
      },
    ],
    constructed: withDeclaration([
      {
        name: `every outcome class`,
        // The first half (review of #73, P12): the rest of the states, with the stop
        // runs of the first three stops; the second half (below) enters the warm and
        // abort states. The union is `witnessed` (the framework checks each half).
        enters: [...witnessedRest, ...stopsFirst],
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
          // Its stops switch hooks: on win32 the test stop file.
          hookStops: true,
          stopRuns: [
            { signal: `SIGTERM`, pool: `forks`, when: `run` },
            { signal: `SIGINT`, pool: `threads`, when: `run` },
            { signal: `SIGINT`, pool: `threads`, when: `after` },
          ],
          // File a writes to the console, so the run captures it.
          consoleOutput: true,
          // An --out of its own, so its cold run names its stream log to the
          // slow kill's hold, and the run enters "a heartbeat named a busy
          // mutant" on every base (#84).
          outMode: `explicit`,
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
          laterSteps: NO_LATER_STEPS,
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
          laterSteps: NO_LATER_STEPS,
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
          // a path with a space and `#`. Each pair of checks at once is held
          // in the daemon together (`holdOverlap`), so the later request
          // arrives while the earlier check is in flight, by a count.
          concurrentStart: true,
          holdOverlap: true,
          cliPath: `spaced`,
          native: `none`,
          // Its reset step's warm label needs the warm daemon kept: with
          // `warmReplaced` drawn (randomness wins, 2026-11-16), the fixed
          // seed's base drew a replaced one and lost "a warm daemon's
          // connection was reset", which this history gates.
          warmReplaced: false,
          laterSteps: NO_LATER_STEPS,
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
          // Its package lies in the CLI's directory, so it is not placed
          // beside it (`siblingDir`, drawn).
          ...(fault === `badEntry`
            ? { cliPath: `plain`, configPlace: `discovered`, siblingDir: false }
            : {}),
          ...(fault === `brokenVitest`
            ? {
                laterSteps: NO_LATER_STEPS,
                steps: [`restart`, `fixSession`],
                concurrentStart: true,
                // A history with the witness module takes no other steps.
                witness: false,
              }
            : {}),
          ...(daemonConfigFaults.includes(fault)
            ? { steps: [`recheck`], laterSteps: NO_LATER_STEPS, witness: false }
            : {}),
        }),
      })),
      {
        // The first half of the witness module along its edit sequence
        // (witnessEditSequence). It holds the spin, so it enters the reuse of
        // a timed-out run.
        name: `an edit sequence over the witness module, the first half`,
        enters: [`a timed-out run reused after an edit`],
        build: witnessEditSequence(`captureA`),
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
          laterSteps: NO_LATER_STEPS,
          steps: [`helper`],
        }),
      },
      {
        // A check through the daemon during which file b's helper changes
        // (law 9's mid-run edit): one context runs file a, which loads the
        // helper and then rewrites it, before file b's runs read it. The
        // edit turns b's verdict off, so the cold run then reports b's
        // mutant as a survivor; the daemon's next check must not reuse a
        // run that read the old helper.
        name: `an edit during a check through the daemon`,
        enters: [
          `an edit landed during a check through the daemon`,
          `edit midrun changed the cold result`,
        ],
        build: (generated) => ({
          ...generated,
          functions: [
            [{ kind: `push`, quote: `'` }],
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
            { ...judging(`a`, `fixed seed`, 1), fn: 0 },
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
          laterSteps: NO_LATER_STEPS,
          steps: [`midrun`],
        }),
      },
      {
        // A check through the daemon of a state that nothing changed, under
        // a config whose own pre plugin rewrites every module: the runner
        // must store each run under the text it served, which that plugin
        // has not rewritten yet, so the second check reuses every run (third
        // review of #55, F-A).
        name: `an unchanged check through the daemon under a config's pre plugin`,
        enters: [
          `an unchanged check through the daemon computed nothing`,
          `an unchanged check through the daemon computed nothing under a config's pre plugin`,
        ],
        build: (generated) => ({
          ...generated,
          functions: [
            [{ kind: `push`, quote: `'` }],
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
            { ...judging(`a`, `fixed seed`, 1), fn: 0 },
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
          laterSteps: NO_LATER_STEPS,
          steps: [`recheck`],
          prePlugin: true,
          configPlace: `discovered`,
          configFile: `vite.config.mjs`,
          config: `object`,
        }),
      },
      {
        // The same unchanged check, where a test of file a also reads the
        // source under test through fs and as a `?raw` import: the file's
        // text is that test's input, and the instrumented text that the
        // context serves is another (fourth review of #55, F-A2).
        name: `an unchanged check through the daemon while a test reads a source through fs`,
        enters: [
          `an unchanged check through the daemon computed nothing`,
          `an unchanged check through the daemon computed nothing under a config's pre plugin`,
          `an unchanged check through the daemon computed nothing while a test read a source through fs`,
        ],
        build: (generated) => ({
          ...generated,
          functions: [
            [{ kind: `push`, quote: `'` }],
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
            { ...judging(`a`, `fixed seed`, 1), fn: 0 },
            { ...judging(`b`, `fixed seed`, 1), fn: 1 },
            {
              ...judging(`a`, `fixed seed`, 1, {
                judges: false,
                rawImport: true,
              }),
              fn: 0,
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
          laterSteps: NO_LATER_STEPS,
          steps: [`recheck`],
          prePlugin: true,
          configPlace: `discovered`,
          configFile: `vite.config.mjs`,
          config: `object`,
        }),
      },
      {
        // File b's own test edits its helper after b's judged test read it,
        // in the run that judges with the old text: its verdict follows the
        // helper, so a run stored under the helper's text after the edit
        // makes the daemon's next check report the old verdict, which the
        // cold run of the edited state does not (review of #55, F1: a
        // module input changed during the run that first read it).
        name: `a test edits the helper it read, during a check through the daemon`,
        enters: [
          `an edit landed during a check through the daemon`,
          `a run edited the helper it had read, during a check through the daemon`,
          `edit midrun changed the cold result`,
        ],
        build: (generated) => ({
          ...generated,
          functions: [
            [{ kind: `push`, quote: `'` }],
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
            { ...judging(`a`, `fixed seed`, 1), fn: 0 },
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
          laterSteps: NO_LATER_STEPS,
          steps: [`midrun`],
          midrunBy: `b`,
          midrunTarget: `helper`,
          fsRead: `none`,
          lazyGate: false,
        }),
      },
      {
        // File b's own test edits the data file that its judged test read
        // through fs (a sync read), in the run that judges with the old
        // data: a run stored under the data's hash after the edit makes the
        // daemon's next check report the old verdict (review of #55, F1: a
        // file that a test reads, then writes in the same run).
        name: `a test edits the data it read, during a check through the daemon`,
        enters: [
          `an edit landed during a check through the daemon`,
          `a run edited the data it had read, during a check through the daemon`,
          `edit midrun changed the cold result`,
        ],
        build: (generated) => ({
          ...generated,
          functions: [
            [{ kind: `push`, quote: `'` }],
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
            { ...judging(`a`, `fixed seed`, 1), fn: 0 },
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
          laterSteps: NO_LATER_STEPS,
          steps: [`midrun`],
          midrunBy: `b`,
          midrunTarget: `data`,
          fsRead: `sync`,
          lazyGate: false,
        }),
      },
      {
        // File b's verdict also waits on a data file that the test reads
        // through fs (sync read). The edit changes only that file, which
        // closes the gate: the cold run then reports b's mutant as a
        // survivor, and the daemon must not reuse a kill that read the old
        // data (law 9: a file a test reads is an input of its run).
        name: `an edit to data a test reads through fs (sync)`,
        enters: [
          `edit fsData changed the cold result`,
          `an edit to data read through sync changed the cold result`,
        ],
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
          lazyGate: false,
          fsRead: `sync`,
          laterSteps: NO_LATER_STEPS,
          steps: [`fsData`],
        }),
      },
      {
        // File b's verdict also waits on a data file that the test reads
        // through fs (promise read). The edit changes only that file, which
        // closes the gate: the cold run then reports b's mutant as a
        // survivor, and the daemon must not reuse a kill that read the old
        // data (law 9: a file a test reads is an input of its run).
        name: `an edit to data a test reads through fs (promise)`,
        enters: [
          `edit fsData changed the cold result`,
          `an edit to data read through promise changed the cold result`,
        ],
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
          lazyGate: false,
          fsRead: `promise`,
          laterSteps: NO_LATER_STEPS,
          steps: [`fsData`],
        }),
      },
      {
        // File b's verdict also waits on a data file that the test reads
        // through fs (callback read). The edit changes only that file, which
        // closes the gate: the cold run then reports b's mutant as a
        // survivor, and the daemon must not reuse a kill that read the old
        // data (law 9: a file a test reads is an input of its run).
        name: `an edit to data a test reads through fs (callback)`,
        enters: [
          `edit fsData changed the cold result`,
          `an edit to data read through callback changed the cold result`,
        ],
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
          lazyGate: false,
          fsRead: `callback`,
          laterSteps: NO_LATER_STEPS,
          steps: [`fsData`],
        }),
      },
      {
        // File b's verdict also waits on a data file that the test reads
        // after it stats its own directory (review of #55: the directory is
        // recorded too, and it is no file to hash, so no crash is owed). The edit changes only that file, which
        // closes the gate: the cold run then reports b's mutant as a
        // survivor, and the daemon must not reuse a kill that read the old
        // data (law 9: a file a test reads is an input of its run).
        name: `an edit to data a test reads through fs (statDir)`,
        enters: [
          `edit fsData changed the cold result`,
          `an edit to data read through statDir changed the cold result`,
        ],
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
          lazyGate: false,
          fsRead: `statDir`,
          laterSteps: NO_LATER_STEPS,
          steps: [`fsData`],
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
          // Its lazy gate sits in file b's verdict, which a test that spins
          // on open data never reaches: with `spinData` drawn (2026-11-16),
          // the fixed seed's base drew it and lost "edit lazy changed the
          // cold result", which this history gates.
          spinData: false,
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
          laterSteps: NO_LATER_STEPS,
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
          // Its lazy gate sits in file b's verdict, which a test that spins on
          // open data never reaches: a random seed's base drew `spinData`
          // (2026-11-16) and lost "a lazy edit changed the cold result after
          // a batch was cut off", which this history gates (merge gate F6).
          spinData: false,
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
          laterSteps: NO_LATER_STEPS,
          steps: [`lazy`],
        }),
      },
      {
        // A batch's watchdog polls the capture while a worker appends its
        // closing row. The hook holds each closing row half written until
        // the watchdog has polled twice, so a poll reads a partial line by
        // construction; the run must still complete and see every closing
        // row (issue #83: a poll parsed the partial line and the CLI ended
        // in an internal error).
        name: `a capture row read while the worker wrote it`,
        enters: [`a capture row read while the worker wrote it`],
        build: (generated) => ({
          ...generated,
          functions: [
            [{ kind: `push`, quote: `'` }],
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
            { ...judging(`a`, `fixed seed`, 1), fn: 0 },
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
          steps: null,
          tornRows: true,
          prePlugin: false,
          configPlace: `discovered`,
          configFile: `vite.config.mjs`,
          config: `object`,
        }),
      },
      {
        // The same witness with two concurrent batches (two contexts): a shared
        // hold counter would release one batch's hold on the other's polls, so
        // each batch must have its own (issue #83, review of #55).
        name: `two batches each read a capture row while its worker wrote it`,
        enters: [`a capture row read while the worker wrote it`],
        build: (generated) => ({
          ...generated,
          functions: [
            [{ kind: `if`, op: `>`, k: 4, not: false, quote: `'` }],
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
            { ...judging(`a`, `fixed seed`, 1), fn: 0 },
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
          contexts: 4,
          steps: null,
          tornRows: true,
          prePlugin: false,
          configPlace: `discovered`,
          configFile: `vite.config.mjs`,
          config: `object`,
        }),
      },
      {
        // The pauses are disarmed: no daemon is paused, so no pid is observed, and
        // neither daemon label is added. The history declares that it does not engage.
        name: `a daemon pause that cannot engage`,
        enters: [`a daemon pause that did not engage`],
        build: (generated) => ({
          ...generated,
          // Without the witness module, the grammar takes these steps back.
          witness: false,
          // A check that refuses reports nothing, so the variant pins a clean config.
          fault: `none`,
          steps: [`dieMidCheck`, `resetBeforeRead`],
          pauseEngages: false,
          // Its base keeps its drawn tests: a generated test whose input is a
          // multiple of 3 declares a work bound of 1. Probe code counts no work
          // (v21.2 R53, M-23), so the bound sees only production sites.
        }),
      },
      {
        // A warm daemon replaced before the pause (review of #73, B2): the warm
        // check is served by one daemon, which is then stopped, so the paused
        // check's daemon is another. The reset label needs the daemon that
        // served the warm check, so only the state of the replacement holds.
        name: `a reset check after its warm daemon was replaced`,
        enters: [
          `a warm daemon was replaced before the pause`,
          `a check whose connection was reset`,
        ],
        build: (generated) => ({
          ...generated,
          // Without the witness module, the grammar takes these steps back.
          witness: false,
          fault: `none`,
          steps: [`resetBeforeRead`],
          warmReplaced: true,
        }),
      },
      {
        // The config sets `test.root` to the directory that holds the tests
        // (issue #101), as the repository's own oracle-gaps config does. Vite
        // names a module that a plugin resolves inside its root by its path
        // from that root, so a runner that resolved a copy of a test file would
        // import it again by a root-relative name. The owned mutant is judged;
        // a setup error is no verdict (law 4).
        name: `a config whose test root is a subdirectory that holds the tests`,
        enters: [`a config whose test root is a subdirectory ran`],
        build: (generated) => oneOwnerHistory(generated, { testRoot: `tests` }),
      },
      {
        // The config's test root is the directory above the package, which
        // holds only the package (the driver places it in `pkg`): a resolved
        // copy would be named from that root, by a path that starts with the
        // package's own directory name. A runner that resolves copies from the
        // root only when it lies in the package misses it. The setup file is
        // named from the root too.
        name: `a config whose test root is above the package`,
        enters: [
          testRootStates.parent,
          `a setup file that defines a fixed global ran in every copy`,
        ],
        build: (generated) =>
          oneOwnerHistory(generated, { testRoot: `parent`, setupGlobal: true }),
      },
      {
        // The config's test root is a directory of the package that holds no
        // test file (src), and the globs reach the tests from it: the test
        // files and their copies lie outside the root. A runner that takes only
        // the test files under the root runs none of them.
        name: `a config whose test root holds no test file`,
        enters: [
          testRootStates.outside,
          `a setup file that defines a fixed global ran in every copy`,
        ],
        build: (generated) =>
          oneOwnerHistory(generated, {
            testRoot: `outside`,
            setupGlobal: true,
          }),
      },
      {
        // The config's test root is the package's `tests`, a symbolic link to
        // the directory that holds the tests. The root's path is spelled
        // through the link, so a runner that resolves copies from the root's
        // real path misses them. Windows creates the link too (the driver's
        // other links run there), so the state is required on every platform.
        name: `a config whose test root is a symbolic link`,
        enters: [
          testRootStates.link,
          `a setup file that defines a fixed global ran in every copy`,
        ],
        build: (generated) =>
          oneOwnerHistory(generated, { testRoot: `link`, setupGlobal: true }),
      },
      {
        // The config's own plugin loads each test file in its \`load\` hook,
        // with a sync read of the path (review of #103, F1). The runner's copy
        // of a test file exists only in memory, so the runner's \`load\`, which
        // runs first (\`enforce: 'pre'\`), must answer for it: a sync read of
        // the copy's path finds no file, and the copy would not load.
        name: `a config whose plugin loads test files with a sync read`,
        enters: [loadPluginState],
        build: (generated) => oneOwnerHistory(generated, { loadPlugin: true }),
      },
      {
        // A batch whose run rejects (the test-only fault ORACLE_GAPS_TEST_REJECT_BATCH): the CLI ends with an
        // internal error, exit 3 and its done error line (ending.mjs). The batch's copies are retired, and its
        // retention line is written with its state after retirement (the bounded retention law).
        name: `a batch whose run rejects`,
        enters: [
          `a rejected batch retired its copies and logged them`,
          `a run ended in an internal error`,
        ],
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
          ordinary: false,
          steps: null,
          packageType: `module`,
          configFile: `vitest.config.ts`,
          configAwait: false,
          configRequire: false,
          configPlace: `discovered`,
          native: `none`,
          rejectBatch: 1,
        }),
      },
      {
        // Probe code is never work (maintainer decision, 2026-11-16; #102). A
        // generated elseIf, `if (x < 0) report(); else out.push(...)`, whose
        // if-true calls report() where the unmutated run pushes, under a test
        // of input 3, which declares a work bound of 1 and judges nothing.
        // The mutant's only extra work is probe code, so the bound does not
        // kill it: it owes what the other laws give (not-judged, its output
        // changed). Built on the one-owner base, so a random base cannot take
        // the state away. Appended at the end of the list: earlier constructed
        // histories keep their bases, while the campaign's generated half
        // draws again (the framework mixes constructed and generated draws).
        name: `a probe branch under a generated test's work bound`,
        enters: [
          `a probe branch's work under a generated test's bound judged nothing`,
        ],
        build: (generated) =>
          oneOwnerHistory(generated, {
            functions: [[{ kind: `elseIf`, op: `<`, k: 0, quote: `'` }]],
            tests: [
              { ...judging(`a`, `fixed seed`, 3, { judges: false }), fn: 0 },
            ],
          }),
      },
      {
        // Without `--out`, the CLI picks the run's output directory
        // (args.mjs). A run stopped while its config warms must still leave
        // its stream log beside its results, with the done line last on both
        // streams (law 15). The stop witness runs alone (witness `stop`), and a history
        // with the witness module takes no steps.
        name: `a stop with the default output directory`,
        enters: [
          `a run with the default output directory`,
          `a stop with the default output directory`,
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
          witness: false,
          stopWitness: true,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          outMode: `default`,
          budget: `two`,
          // Its stops switch hooks on win32 (the test stop file).
          hookStops: true,
          stopRuns: [{ signal: `SIGINT`, pool: `threads`, when: `warm` }],
        }),
      },
      {
        // Through the daemon, a check that the CLI parses without `--out`
        // would write its results to a directory of its own, apart from the
        // stream log the CLI names (law 15).
        name: `a daemon check with the default output directory`,
        enters: [
          `a run with the default output directory`,
          `a daemon check with the default output directory`,
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: [`test`],
          ordinary: false,
          outMode: `default`,
          concurrentStart: false,
          budget: `two`,
        }),
      },
      {
        // A stop sent as the CLI spawns, before its note's run has started:
        // the note is written first, and the stopped line follows it on both
        // streams, with one done line (P1 of the review of #57).
        name: `a stop as the CLI starts`,
        enters: [`a stop as the CLI starts`],
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
          witness: false,
          stopWitness: true,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          outMode: `explicit`,
          logBlocked: false,
          overlap: false,
          spawnStop: true,
          // The CLI is held after its started marker until it has kept the
          // signal, so the signal lands during the loads, before the
          // supervisor's own handlers, whatever the machine's load. Its signal
          // and the driver's wait before it are drawn.
          spawnOnStart: true,
          budget: `two`,
        }),
      },
      {
        // A stream log that is a directory cannot be written: the CLI refuses
        // before its first line (index.mjs opens the log first), with its
        // block, its fix, and its report in the output directory, and its
        // stdout is its done line alone (law 12, law 15, and F3 of the
        // coordinator's review of #57). No stack trace, and exit 2 or 3.
        name: `a stream log that cannot be written`,
        enters: [`a stream log that cannot be written`],
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          logBlocked: true,
          overlap: false,
        }),
      },
      {
        // A second run on the first's output directory while the first is
        // live refuses (F4, the coordinator's decision of 2026-11-13): the
        // first run's stream log still equals its own stderr, line for line,
        // and the refusal reports no directory it does not own.
        name: `two runs on one output directory`,
        enters: [`two runs on one output directory`],
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          logBlocked: false,
          overlap: true,
        }),
      },
      {
        // Two starts meet a dead pid's claim (the maintainer's decision, "Stale claims refuse; no takeover"): both refuse, each names the claim, and neither writes past its claim attempt.
        name: `two starts race for a stale claim`,
        enters: [`two starts race for a stale claim`],
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          logBlocked: false,
          overlap: false,
          claimScenario: `race`,
        }),
      },
      {
        // One start meets a dead pid's claim: it refuses and names the claim and its fix.
        name: `a start refuses a stale claim`,
        enters: [`a start refuses a stale claim`],
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          logBlocked: false,
          overlap: false,
          claimScenario: `stale`,
        }),
      },
      {
        // One start meets an empty claim: it refuses, and the claim is never taken over.
        name: `a start refuses an empty claim`,
        enters: [`a start refuses an empty claim`],
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          logBlocked: false,
          overlap: false,
          claimScenario: `empty`,
        }),
      },
      {
        // The stream log becomes a directory after the note, then the run is stopped: one done line on each stream, the exit code it owes, and no stack.
        name: `a stream log lost after its note, then stopped`,
        enters: [`a stream log lost after its note, then stopped`],
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          logBlocked: false,
          overlap: false,
          logLost: `stop`,
        }),
      },
      {
        // The stream log becomes a directory after the note, and the run completes: the same law as the stop.
        name: `a stream log lost after its note, then completed`,
        enters: [`a stream log lost after its note, then completed`],
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          logBlocked: false,
          overlap: false,
          logLost: `complete`,
        }),
      },
      {
        // An unreadable claim (a directory where run.pid should be) cannot be read
        // at all: its start refuses, and names the claim as unreadable.
        name: `a start refuses an unreadable claim`,
        enters: [`a start refuses an unreadable claim`],
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          logBlocked: false,
          overlap: false,
          claimScenario: `unreadable`,
        }),
      },
      {
        // A supervised check whose supervisor is killed with SIGKILL: its child exits
        // within the watchdog's tick, so no run's process outlives its CLI (POSIX).
        name: `a supervised child exits when its supervisor is killed`,
        enters: supervision,
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          logBlocked: false,
          overlap: false,
          supervisorDeath: true,
        }),
      },
      {
        // The same check, run unsupervised: the path win32 takes, where no
        // supervisor writes the run's `--out`. The daemon request names no
        // directory, so the CLI and the daemon name two (the fix's RED on POSIX).
        name: `a daemon check with the default output directory, unsupervised`,
        enters: [
          `a run with the default output directory`,
          `a daemon check with the default output directory`,
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: [`test`],
          ordinary: false,
          outMode: `default`,
          concurrentStart: false,
          unsupervised: true,
          budget: `two`,
        }),
      },
      {
        // A stop that lands before the CLI's first statement (outcome a of the
        // spawn-delay law): the driver holds Node's start in a preload of its
        // own and signals once the preload has run. No CLI code has run, so
        // the run writes nothing at all: no line, no log (C 2026-11-13 under
        // P10, flagged for the maintainer). POSIX only (posixStarts): on win32
        // the stop is the test stop file, taken after the note.
        name: `a stop before the CLI starts`,
        enters: posixStarts.filter(
          (state) => state === `a stop before the CLI starts`,
        ),
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
          witness: false,
          stopWitness: true,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          spawnStop: true,
          spawnOnStart: false,
        }),
      },
      {
        // A SIGTERM as the CLI starts, held as "a stop as the CLI starts" is:
        // the stopped line names SIGTERM and follows the note (POSIX only, as
        // win32 cannot deliver SIGTERM; posixStarts).
        name: `a stop by SIGTERM as the CLI starts`,
        enters: posixStarts.filter(
          (state) => state === `a stop by SIGTERM as the CLI starts`,
        ),
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
          witness: false,
          stopWitness: true,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          spawnStop: true,
          spawnOnStart: true,
          spawnSignal: `SIGTERM`,
        }),
      },
      {
        // A run stopped after its note, unsupervised (the test-only hook
        // ORACLE_GAPS_TEST_UNSUPERVISED): the path every win32 run takes, where
        // the run's own process writes its stopped line (stopNow). The run is
        // held at its note (ORACLE_GAPS_TEST_PAUSE_AT), the driver sends the
        // stop, and releases the hold: the note, then one stopped line on each
        // stream. The stop lands before the check starts any process: an
        // unsupervised run has no group to end, so a stop while the witness's
        // test spins would leave that test's own child on POSIX (C 2026-11-13,
        // Windows (e)), where win32 ends it with the run's job object.
        name: `an unsupervised run stopped after its note`,
        enters: [`an unsupervised run stopped after its note`],
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          stopWitness: true,
          unsupervised: true,
          // Its stops switch hooks on win32 (the test stop file).
          hookStops: true,
          stopRuns: [{ signal: `SIGINT`, pool: `threads`, when: `note` }],
        }),
      },
      {
        // A run.pid that is a link to no file: the link exists, so the claim
        // cannot be taken, and no read finds a pid in it, so every start
        // refuses as for an unreadable claim and writes nothing beside it,
        // not even its report (review of #57, A5).
        name: `a start refuses a dangling claim`,
        enters: [`a start refuses a dangling claim`],
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          claimScenario: `dangling`,
        }),
      },
      {
        // A supervised check whose PATH names no command: the supervised run
        // must need no `ps`, which a slim container lacks and whose BusyBox
        // form has no `-p` (review of #57, A7). POSIX only (posixPs).
        name: `a supervised check with no ps on its PATH`,
        enters: posixPs,
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
          witness: false,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          psMissing: true,
        }),
      },
      {
        // The second half of `every outcome class` (review of #73, P12) is split
        // in two, each over the stop witness alone (one owned function), so each
        // costs a run of that witness and a stop, and a failing stop shrinks
        // through cheap histories (P12: each Windows job under 9 minutes). Each
        // enters only its stop's state: the warm stop here, the abort stop below.
        // The heavy base they shared is the first half's, which enters every
        // other state; the union is checked by the framework's reach over every
        // part (stopsSecond). Equal reach, cheaper histories (R7).
        name: `every outcome class, the warm stop`,
        enters: [`a stop signal while the config warms`],
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
          witness: false,
          stopWitness: true,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          // Its stops switch hooks on win32 (the test stop file).
          hookStops: true,
          stopRuns: [{ signal: `SIGINT`, pool: `threads`, when: `warm` }],
        }),
      },
      {
        // The abort stop of the second half of `every outcome class` (see the
        // warm stop above): a test of file a aborts the run's process.
        name: `every outcome class, the abort stop`,
        enters: [`a run whose process aborted`],
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
          witness: false,
          stopWitness: true,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          // Its stops switch hooks on win32 (the test stop file).
          hookStops: true,
          stopRuns: [{ signal: `SIGINT`, pool: `threads`, when: `abort` }],
        }),
      },
      {
        // A daemon that stops answering (R39, the conformance check of #73): the
        // daemon of the step's check holds its reply (`replyHeld`, the
        // test-only `daemon-reply` pause) and nothing ends it while the CLI
        // runs. The CLI owes a completed check, a cold run's, by its own bound
        // on a daemon that sends nothing (`heldPhase`).
        name: `a check whose daemon stops answering`,
        enters: [`a check whose daemon stopped answering ran cold`],
        build: (generated) =>
          oneOwnerHistory(generated, {
            steps: [`dieMidCheck`],
            laterSteps: NO_LATER_STEPS,
            replyHeld: true,
            // The witness poisons the run's --out, so it names one.
            outMode: `explicit`,
          }),
      },
      {
        // F-D of #55's third review, which landed with no RED and no mutant
        // (D50): a spun run is stored under the inputs it read. File b's
        // verdict test reads the data only where its output differs, and,
        // while the data is open, spins there (`spinData`), so each mutated
        // copy that changes the output reads a file that b's unmutated run
        // never reads, and its call budget cuts it. The edit closes the data:
        // the cold run then reports those mutants unjudged, and a daemon that
        // stored the spun runs under b's known inputs only would reuse them.
        name: `an edit to data that only a spun copy reads`,
        enters: [
          `an edit to data that only a spun copy read changed the cold result`,
        ],
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
          lazyGate: false,
          fsRead: `sync`,
          spinData: true,
          // Its spun copies stay in their batch (the batch path's F-D).
          spinThrows: false,
          laterSteps: NO_LATER_STEPS,
          steps: [`fsData`],
        }),
      },
      {
        // #73's fix class 2, which landed with no hostile mutant (D58): the
        // driver tells a package inside the CLI's directory by its path from
        // that directory (`isWithin`), not by a plain prefix of its name.
        // This refused run's package lies in a directory beside the CLI's
        // whose name extends it (`siblingDir`), so a prefix test would
        // attest the inside state for it, which the driver's check of the
        // relative path rejects.
        name: `a refused run beside the CLI's directory, under a name that extends it`,
        enters: [
          `a refused run whose package lies beside the CLI's directory, under a name that extends it`,
        ],
        build: (generated) => ({
          ...generated,
          fault: `badEntry`,
          cliPath: `plain`,
          configPlace: `discovered`,
          witness: false,
          steps: null,
          laterSteps: NO_LATER_STEPS,
          siblingDir: true,
        }),
      },
      {
        // F-D on the alone path (merge gate F4): the history above, where each
        // spun copy also throws outside its test (`spinThrows`), so its batch
        // runs alone and the spun run is stored from a run alone (runUnit's
        // spunRun). The data's edit must make the daemon compute it again.
        name: `an edit to data that only a copy spun alone reads`,
        enters: [
          `an edit to data that only a copy spun alone read changed the cold result`,
        ],
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
          lazyGate: false,
          fsRead: `sync`,
          spinData: true,
          spinThrows: true,
          laterSteps: NO_LATER_STEPS,
          steps: [`fsData`],
        }),
      },
      {
        // A slow but healthy warm-up (merge gate D1, delta 3; delta 4): after
        // a warm check of the seed's state, the next check holds before it
        // warms its contexts until its CLI has fallen back cold (`heldPhase`
        // at `daemon-warm`). It reuses every run, so it starts no copy: the
        // daemon must drop it at its phase's end, before it writes the run's
        // --out, stay, and serve the next check.
        name: `a slow but healthy warm-up`,
        enters: [`a slow warm-up was served by the daemon`],
        build: (generated) =>
          oneOwnerHistory(generated, {
            contexts: 4,
            steps: [`seed`],
            laterSteps: NO_LATER_STEPS,
            slowStart: `warm`,
            // The witness poisons the run's --out, so it names one.
            outMode: `explicit`,
          }),
      },
      {
        // A check through a warm daemon that works past its CLI's bound (3 s,
        // `shortWait`): after the test edit, a slow copy is cut at its first
        // budget, and its confirming run waits 10 s where the output differs. The daemon's beats while the copy runs keep the CLI
        // waiting: it must not fall back (the beat's witness, delta 3).
        name: `a check through the daemon that works past the bound`,
        enters: [`a check through the daemon worked past its CLI's bound`],
        build: (generated) =>
          oneOwnerHistory(generated, {
            tests: [
              {
                ...judging(`a`, `fixed seed`, 7, {
                  slow: true,
                  slowMs: 10_000,
                }),
                fn: 0,
              },
            ],
            // The test edit recomputes file a's runs, the slow one with them;
            // a first budget cuts the slow copy, which then waits 10 s alone.
            steps: [`test`],
            laterSteps: NO_LATER_STEPS,
            budget: `two`,
            outMode: `explicit`,
            shortWait: true,
          }),
      },
      {
        // A daemon start slower than its CLI's bound (merge gate delta 4,
        // F-h): the fresh daemon holds its first check before it runs, by a
        // count (`slowOpen`), as a session slow to open would, while the CLI
        // carries the warm-up pause. The CLI's cold check must not hold, and
        // the daemon must stay, write nothing more into the run's --out, and
        // serve the next check.
        name: `a daemon start slower than the bound`,
        enters: [`a slow daemon start was served by the daemon`],
        build: (generated) =>
          oneOwnerHistory(generated, {
            contexts: 4,
            steps: [`seed`],
            laterSteps: NO_LATER_STEPS,
            slowStart: `open`,
            outMode: `explicit`,
          }),
      },
      {
        // A check abandoned in the middle of a phase (merge gate delta 4,
        // P11): after the test edit, file a's copies hang where the output
        // changed, a cut stops one, and the context that warms in its place
        // holds until its CLI has fallen back cold (`heldPhase` at
        // `daemon-replace`), as a slow config load would. The daemon must
        // drop the check before it writes more into the run's --out (its
        // next copy's state.json, the results it appends), stay, and serve
        // the next check.
        name: `a check abandoned while a context warms in place of a cut one`,
        enters: [
          `a check abandoned while a context warmed in place of a cut one wrote nothing more`,
        ],
        build: (generated) =>
          oneOwnerHistory(generated, {
            tests: [
              {
                ...judging(`a`, `fixed seed`, 7, {
                  judges: false,
                  hangs: true,
                }),
                fn: 0,
              },
            ],
            // The test edit recomputes file a's runs, the hangs with them.
            steps: [`test`],
            laterSteps: NO_LATER_STEPS,
            slowStart: `replace`,
            outMode: `explicit`,
          }),
      },
      {
        // The second half of the witness module along its edit sequence
        // (witnessEditSequence), appended last: a constructed history is
        // built from the fixed seed and its index, so one inserted before
        // others would change theirs.
        name: `an edit sequence over the witness module, the second half`,
        enters: [],
        build: witnessEditSequence(`captureB`),
      },
      {
        // The skip law of law 4: a mutant is judged without a run only where
        // no owner test's unmutated run reached its site with a value that
        // the mutant changes. A passing owner test of input 0 reads two
        // objects through `?.` that only a truthy input makes, one left
        // `undefined` and one `null`: a plain read throws on each, so each
        // `optional-chain` mutant must run, and its test crashes. The same
        // test pushes a module-data method's returned `1 + 2`, whose
        // `return-undefined` mutant its push observes, so it must run and
        // be killed. A capture helper that records no change at such a site
        // makes the CLI judge its mutant from the unmutated runs, as a
        // survivor. Built on the one-owner base, so a random base cannot
        // take the states away, and appended at the end of the list, so the
        // earlier constructed histories keep their bases.
        name: `a value change at a ?. read and at a return`,
        enters: changedValues,
        build: (generated) =>
          oneOwnerHistory(generated, {
            functions: [
              [
                { kind: `optional` },
                { kind: `optional` },
                { kind: `readData`, shape: `methods` },
                { kind: `optional` },
                { kind: `optional` },
              ],
              [
                { kind: `optional` },
                { kind: `optional` },
                { kind: `optional` },
              ],
            ],
            owners: [`a`, `a`],
            // `o4?.a?.b?.v` with `o4` absent, so its second and third links
            // are short-circuited (the third through the second);
            // `o5?.a?.b?.v` with `o5.a` absent, so its second link throws
            // under its mutant and its third is short-circuited. In the
            // second function: `o6?.a?.f?.()?.v` with the method `f` absent,
            // so the call and the `?.v` after it are skipped;
            // `o7?.f?.()?.v` with `o7` absent for input 0, and for input 1 a
            // method that returns nothing, so the `?.v` after the call throws
            // under its mutant; and `o8?.f?.().v` with `f` absent, whose
            // plain read of `v` the skipped call skips too.
            absentObjects: [
              `undefined`,
              `null`,
              `undefined`,
              `null`,
              `undefined`,
              `null`,
              `undefined`,
            ],
            optionalChains: [
              { links: 1, level: 0, call: `none`, returns: `object` },
              { links: 1, level: 0, call: `none`, returns: `object` },
              { links: 3, level: 0, call: `none`, returns: `object` },
              { links: 3, level: 1, call: `none`, returns: `object` },
              { links: 2, level: 2, call: `optional`, returns: `object` },
              { links: 1, level: 0, call: `optional`, returns: `nothing` },
              { links: 1, level: 1, call: `plain`, returns: `object` },
            ],
            tests: [
              { ...judging(`a`, `fixed seed`, 0), fn: 0 },
              { ...judging(`a`, `fixed seed`, 0), fn: 1 },
              { ...judging(`a`, `fixed seed`, 1), fn: 1 },
            ],
          }),
      },
      {
        // A `?.` whose object is absent only while the module loads: the
        // booted first function runs with 0 at load, and its one owner test
        // passes 1, which makes the object. The load's background row must
        // infect the site, so its mutant runs, and under it the module
        // throws as it loads, before any test: a setup error. Appended at the
        // end of the list.
        name: `a ?. read of an object absent only at load`,
        enters: [loadOnlyAbsent],
        build: (generated) =>
          oneOwnerHistory(generated, {
            functions: [[{ kind: `optional` }]],
            boot: true,
            absentObjects: [`undefined`],
            optionalChains: [],
            tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          }),
      },
      {
        // Issue #150, shrunk: a run stopped while the stop witness spins, then
        // a stop that lands before the CLI's first statement (the driver's
        // preload, as in "a stop before the CLI starts"). The second run runs
        // no CLI code, so it can remove nothing: the first run must have
        // removed its own session directory when it ended (law 10). POSIX
        // only (posixStarts): the hold before the first statement ends by a
        // signal's default action, which win32 cannot deliver.
        name: `a stop before the CLI starts, after a stopped check`,
        enters: posixStarts.filter(
          (state) =>
            state === `a stop before the CLI starts, after a stopped check`,
        ),
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
          witness: false,
          stopWitness: true,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          stopRuns: [{ signal: `SIGINT`, pool: `threads`, when: `run` }],
          spawnStop: true,
          spawnOnStart: false,
        }),
      },
      {
        // A CLI killed with SIGKILL while the stop witness spins, its check's
        // process group with it, and then a run stopped while the witness
        // spins (review of #164, F1). The killed CLI leaves its session
        // directory with the `host` file it wrote; the next run, which opens
        // a session, must remove it through that file (law 10, README: "A run
        // that is killed before it cleans up leaves that directory, and the
        // next run removes it"). Its stops switch hooks on win32 (the test
        // stop file), where the kill is TerminateProcess.
        name: `a run after a killed CLI`,
        enters: [`a run after a killed CLI that left its own session`],
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
          witness: false,
          stopWitness: true,
          tests: [{ ...judging(`a`, `fixed seed`, 1), fn: 0 }],
          authored: null,
          fault: `none`,
          stability: `none`,
          steps: null,
          ordinary: false,
          budget: `two`,
          outMode: `explicit`,
          hookStops: true,
          stopRuns: [
            { signal: `SIGINT`, pool: `threads`, when: `kill` },
            { signal: `SIGINT`, pool: `threads`, when: `run` },
          ],
        }),
      },
      {
        // The abort stop of a run whose setup file throws (issues #117 and
        // #137). The CLI's own abort, after its completed check blocked the
        // mutants of the throwing file, ends the stopped run with one error
        // line on each stream. A drawn history draws no abort (v21.2 I16), so
        // only this constructed history names it.
        name: `a declaration fault: setupThrows, then the abort stop`,
        enters: [`blocked by setupThrows`, `a run whose process aborted`],
        build: (generated) => ({
          ...generated,
          fault: `setupThrows`,
          witness: false,
          stopWitness: true,
          steps: null,
          hookStops: true,
          stopRuns: [{ signal: `SIGINT`, pool: `threads`, when: `abort` }],
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
