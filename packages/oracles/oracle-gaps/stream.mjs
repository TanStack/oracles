// The gap report's streaming printer: the lines the CLI prints as each
// mutant is judged, and the gap lines that the stdout summary repeats
// (report.mjs). A gap line has one form wherever it is printed, so that the
// streamed lines and the summary's lines are the same text.
//
// The change a mutant makes is shown as its code, fenced so that a backtick
// in the code cannot close the fence.

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
  return `${kindOf(result)} L${result.line ?? `?`} ${result.id} ${change(result)}`
}

/** The periodic count while mutants are judged. */
export function progressLine({ judged, total, gaps }) {
  return `judged ${judged} of ${total} mutants: ${gaps} gaps so far, ${judged - gaps} not gaps`
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
const replayPattern = (names) =>
  `^${names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)).join(`(?: | > )`)}$`

/**
 * The baseline before any mutant: each oracle file's result, and for a
 * failing file its first failure with the command that replays it, which
 * pastes into a POSIX shell. `files` names each oracle file, relative to
 * the package, with its first failure (undefined when it passed) and its
 * tests, each with its state and names (`testNamesOf`). A file with no
 * failing test (one that did not load) replays whole. A control character
 * in a name or a failure prints as its escape, so each line stays one line.
 */
export function baselineLines(files) {
  return files.flatMap(({ file, failure, tests }) => {
    if (failure === undefined) return [`pass ${file}`]
    const names = tests.find((t) => t.state === `failed`)?.names
    const only =
      names === undefined
        ? ``
        : ` -t ${shellWord(escapeControls(replayPattern(names)))}`
    return [
      `fail ${file}: ${escapeControls(failure)}`,
      `  replay: vitest run ${shellWord(file)}${only}`,
    ]
  })
}
