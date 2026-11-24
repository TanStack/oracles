// The gap report's streaming printer: the lines the CLI prints as each
// mutant is judged, and the gap lines that the stdout summary repeats
// (report.mjs). A gap line has one form wherever it is printed, so that the
// streamed lines and the summary's lines are the same text.
//
// The change a mutant makes is shown as its code, fenced so that a backtick
// in the code cannot close the fence.
//
// Every line the CLI writes for a check starts with `oracle-gaps: ` and
// then its kind: `config`, `note`, `baseline`, `blocked`, `progress`, `gap`,
// `busy`, `error` (an internal error, ending.mjs), or `done` (the
// maintainer's request of 2026-11-12: an agent acts on the results as they
// stream, and one `grep '^oracle-gaps: '` finds them, on stdout and stderr
// alike). Only the indented lines under a baseline failure, a refusal's
// `refused:` and `fix:` block, `--help`'s usage text, and what Node, V8,
// esbuild, or Vite print are not.

/** A line of the stream: its kind after the prefix, then its text. */
export const streamLine = (kind, text) => `oracle-gaps: ${kind} ${text}`

/** The gap's kind: its survivor class, or its outcome. */
export const kindOf = (result) => result.class ?? result.outcome

/** A key as a Markdown code span whose fence outruns any backticks in it. */
export function codeSpan(text) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((r) => r.length))
  const fence = `\``.repeat(longest + 1)
  return `${fence} ${text} ${fence}`
}

// A text as one short line: whitespace (newlines included) collapsed, and
// past 60 characters cut to its first 57 and `...`, so one gap stays one
// line however long its code or intent is. Characters are code points, so a
// cut never splits an astral-plane character. results.json keeps the full
// text.
const oneLine = (text) => {
  const flat = [...String(text).replace(/\s+/g, ` `)]
  return flat.length > 60 ? `${flat.slice(0, 57).join(``)}...` : flat.join(``)
}

/** What a mutant changes: its code, or the authored edit, each on one line. */
export function change(result) {
  // An intent is the author's own text, so it prints as code, never as the
  // report's words.
  if (result.authored)
    return `${codeSpan(oneLine(result.intent))} (authored by ${result.author})`
  return `${codeSpan(oneLine(result.original))} → ${codeSpan(oneLine(result.replacement))}`
}

/**
 * One gap as one line: its kind, line, short id (the rerun's `--only` id),
 * and the change. A mutant that never applied (an authored `find` that no
 * longer matches) has no line, and says so. Printed as each mutant is judged,
 * and again in the summary.
 */
export function gapLine(result) {
  return streamLine(
    `gap`,
    `${kindOf(result)} L${result.line ?? `?`} ${result.id} ${change(result)}`,
  )
}

/** The periodic count while mutants are judged. */
export function progressLine({ judged, total, gaps }) {
  return streamLine(
    `progress`,
    `judged ${judged} of ${total} mutants: ${gaps} gaps so far, ${judged - gaps} not gaps`,
  )
}

/** A test's names, from Vitest's TestCase: its suites', then its own. */
export function testNamesOf(testCase) {
  const names = [testCase.name]
  for (let at = testCase.parent; at.type !== `module`; at = at.parent)
    names.unshift(at.name)
  return names
}

// A word that a POSIX shell reads back as it is: plain, or in single quotes.
const shellWord = (word) =>
  /^[\w./-]+$/.test(word) ? word : `'${word.replaceAll(`'`, `'\\''`)}'`
// PowerShell reads these as single quotes: the ASCII one and the typographic
// ones (U+2018 to U+201B). Inside a single-quoted word each is doubled.
const PS_SINGLE_QUOTES = /['\u2018\u2019\u201A\u201B]/g
const powerShellWord = (word) =>
  /^[\w./-]+$/.test(word)
    ? word
    : `'${word.replace(PS_SINGLE_QUOTES, (quote) => quote + quote)}'`
// cmd toggles its quoting on every double quote, expands `%`, and under
// DelayedExpansion expands `!` (a conservative no-form set, a coordinator ruling), even inside
// quotes; a name with either has no cmd form (undefined), so the line says so.
// Inside double quotes cmd reads the other metacharacters literally.
const cmdWord = (word) =>
  /["%!]/.test(word) ? undefined : /^[\w./-]+$/.test(word) ? word : `"${word}"`
// The replay line of a command. A POSIX shell reads one line; on Windows
// there are two, one for PowerShell and one for cmd, since the words differ.
// A cmd line with a word that has no cmd form says so instead of printing a
// line that would not replay (the PowerShell line still does).
export const replayLines = (words, platform = process.platform) => {
  if (platform !== `win32`)
    return [`  replay: ${words.map(shellWord).join(` `)}`]
  const cmd = words.map(cmdWord)
  return [
    `  replay (PowerShell): ${words.map(powerShellWord).join(` `)}`,
    cmd.every((word) => word !== undefined)
      ? `  replay (cmd): ${cmd.join(` `)}`
      : `  replay (cmd): use the PowerShell line for this name`,
  ]
}

// A control character, or a line or paragraph separator, as its `\uXXXX`
// escape: the line stays one line, and the escape is regular-expression
// syntax for the same character.
export const escapeControls = (text) =>
  text.replace(
    /[\u0000-\u001f\u007f\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, `0`)}`,
  )

// The `-t` pattern that runs exactly one test of a file: its names, with
// regular-expression syntax escaped, joined by what either Vitest puts
// between them (a space in Vitest 4, ` > ` in Vitest 5), anchored at both
// ends. The framework's own rerun command (oracle-property.ts) is built so.
// The characters no shell reads safely inside a `-t` argument: a double quote,
// `%` and `!` (cmd), and the curly quotes (PowerShell). Each becomes the regular
// expression's `.`: the pattern stays anchored and only slightly broader, and
// the exact test is carried by ORACLE_UNIT where a line sets it (review option
// c, a coordinator ruling).
const SHELL_HOSTILE = /["%!\u2018\u2019\u201A\u201B]/g
const replayPattern = (names) =>
  `^${names
    .map((name) =>
      name.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`).replace(SHELL_HOSTILE, `.`),
    )
    .join(`(?: | > )`)}$`

// A count of things.
const counted = (n, thing) => `${n} ${thing}${n === 1 ? `` : `s`}`
// A text cut to `most` code points, with `...` after a cut.
const cut = (text, most) => {
  const points = [...text]
  return points.length > most
    ? `${points.slice(0, most - 3).join(``)}...`
    : text
}

// The law, checkpoint, difference, observed and owed values, and
// counterexample of a test that failed by a law violation, read from the
// framework's message (oracle-property.ts `violationError`): its first line
// names the checkpoint and the law, and its `Difference:`, `Observed:`,
// `Owed:`, and `History:` lines the difference, the two values a comparison
// found apart (only a violation that carries values has them), and the
// history that failed. A field is read up to the message's next line break:
// a value's data encoding may hold a line or paragraph separator. Any other
// failure gives none. A field the message lacks is left out.
function violationOf(message) {
  const lines = message.split(`\n`)
  const head = lines[0].match(
    /violated at checkpoint "([^"]*)"(?: \(law: (.*)\))?\.$/,
  )
  if (!head) return {}
  // The fields come in this order after the law's statement, which is the
  // author's text, so each is read after the one before it.
  let from = 0
  const field = (label) => {
    const at = lines.findIndex(
      (line, index) => index >= from && line.startsWith(`${label}: `),
    )
    if (at < 0) return undefined
    from = at + 1
    return lines[at].slice(label.length + 2)
  }
  const difference = field(`Difference`)
  const observed = field(`Observed`)
  const owed = observed === undefined ? undefined : field(`Owed`)
  return {
    law: head[2],
    checkpoint: head[1],
    difference,
    ...(owed === undefined ? {} : { observed, owed }),
    counterexample: field(`History`),
  }
}

/**
 * Each failing test of a baseline file (one of `baselineLines`' `files`), in
 * its file's order, as results.json keeps it: its names, its error's first
 * line, the law, checkpoint, difference, observed and owed values, and
 * counterexample of a law violation, each the framework's text as it is,
 * and the words of the command that replays that test alone (`config` as
 * for `baselineLines`). A test whose names the runner did not record
 * replays its whole file.
 */
export function failingTests({ file, tests }, config) {
  return tests
    .filter((t) => t.state === `failed`)
    .map((test) => {
      const message = test.message ?? ``
      return {
        test: test.names ?? [test.fullName],
        error: message.split(`\n`)[0],
        ...violationOf(message),
        replay: [
          ...vitestRun(config),
          file,
          ...(test.names === undefined
            ? []
            : [`-t`, replayPattern(test.names)]),
        ],
      }
    })
}

// The command that runs Vitest under the config the run loaded.
const vitestRun = (config) =>
  config === undefined
    ? [`vitest`, `run`]
    : [`vitest`, `run`, `--config`, config]

// A failing test's lines: the test and its error, the law, difference,
// observed and owed values, and counterexample of a law violation, each on
// one line, past 400 code points cut, and its replay.
function failingLines(failing, platform) {
  const shown = (text) => codeSpan(escapeControls(cut(text ?? ``, 400)))
  return [
    `  failing: ${codeSpan(escapeControls(failing.test.join(` > `)))}: ${codeSpan(escapeControls(failing.error))}`,
    ...(failing.checkpoint === undefined
      ? []
      : [
          `  law: ${codeSpan(escapeControls(failing.law ?? `(unnamed)`))} at ${codeSpan(escapeControls(failing.checkpoint))}: ${shown(failing.difference)}`,
          ...(failing.owed === undefined
            ? []
            : [
                `  observed: ${shown(failing.observed)}`,
                `  owed: ${shown(failing.owed)}`,
              ]),
          `  counterexample: ${shown(failing.counterexample)}`,
        ]),
    ...replayLines(failing.replay.map(escapeControls), platform),
  ]
}

/**
 * The baseline before any mutant: each test file's result with its test
 * counts, an ordinary file marked as such, and for a failing file each of
 * its failing tests, in its file's order: the test and its error, the law,
 * difference, observed and owed values, and counterexample of a law
 * violation, and the command that replays that test alone, which pastes
 * into a POSIX shell. `files` names each test file, relative to the
 * package, with whether it is ordinary, its first failure (undefined when
 * it passed), and its tests, each with its state, its error, and its names
 * (`testNamesOf`). A file with no failing test (one that did not load)
 * replays whole. A control character in a name or a failure prints as its
 * escape, so each line stays one line. `config` is the config `--config`
 * named, relative to the package: Vitest would discover another config or
 * none, so the replay names it too.
 */
export function baselineLines(files, config, platform = process.platform) {
  return files.flatMap((baseline) => {
    const { file, ordinary, failure, tests } = baseline
    const name = `${file}${ordinary ? ` (ordinary)` : ``}`
    const ran = tests.filter(
      (t) => t.state === `passed` || t.state === `failed`,
    )
    const skipped = tests.length - ran.length
    if (failure === undefined)
      return [
        streamLine(
          `baseline`,
          `pass ${name}: ${counted(ran.length, `test`)}${skipped > 0 ? `, ${skipped} skipped` : ``}`,
        ),
      ]
    const failed = failingTests(baseline, config)
    if (failed.length === 0)
      return [
        streamLine(
          `baseline`,
          `fail ${name}: ${tests.length === 0 ? `did not load` : `failed outside its tests`}: ${codeSpan(escapeControls(failure.split(`\n`)[0]))}`,
        ),
        ...replayLines([...vitestRun(config), file], platform),
      ]
    return [
      streamLine(
        `baseline`,
        `fail ${name}: ${failed.length} of ${counted(ran.length, `test`)} failed`,
      ),
      ...failed.flatMap((failing) => failingLines(failing, platform)),
    ]
  })
}

/**
 * The one decisive baseline line, before any mutant runs: every oracle file
 * passed, or how many of them failed, so the report is provisional.
 */
export function verdictLine(files) {
  const oracle = files.filter((f) => !f.ordinary)
  const failed = oracle.filter((f) => f.failure !== undefined).length
  const all = counted(oracle.length, `oracle file`)
  return streamLine(
    `baseline`,
    failed === 0
      ? `all ${all} pass`
      : `${failed} of ${all} failed (provisional)`,
  )
}

/**
 * One line per failing law of an oracle file (G13): the law, by its file
 * and test names, that it judges nothing, and the step that unblocks it.
 * A failing law is left out per test, so its file's passing tests judge the
 * mutants the file owns, and a mutant that no passing owner test reached
 * waits for it (maintainer decision "Block per law", 2026-11-18). A broken
 * file, one that failed outside its tests, has no law to name, so its line
 * names the file ("A broken owner file judges nothing", 2026-11-19). `laws`
 * names the failing laws, as the runner gives them; without it, the failing
 * tests are.
 */
export function blockedLines(files) {
  return files.flatMap(({ file, ordinary, failure, laws }) => {
    if (ordinary || failure === undefined) return []
    const line = (name, what) =>
      streamLine(
        `blocked`,
        `${codeSpan(escapeControls(name))} fails with no mutant active, so ${what}: a mutant that no passing owner test reached waits for it. Make it pass, then check again.`,
      )
    return laws.length === 0
      ? [line(file, `none of its tests judges`)]
      : laws.map((name) => line(name, `it judges nothing`))
  })
}
