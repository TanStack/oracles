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

/** What a mutant changes: its code, or the authored edit. */
export function change(result) {
  if (result.authored) return `${result.intent} (authored by ${result.author})`
  return `${codeSpan(String(result.original).replace(/\s+/g, ` `))} → ${codeSpan(String(result.replacement))}`
}

/**
 * One gap as one line: its kind, line, short id (the rerun's `--only` id),
 * and the change. Printed as each mutant is judged, and again in the summary.
 */
export function gapLine(result) {
  return `${kindOf(result)} L${result.line} ${result.id} ${change(result)}`
}

/** The periodic count while mutants are judged. */
export function progressLine({ judged, total, gaps }) {
  return `judged ${judged} of ${total} mutants: ${gaps} gaps so far, ${judged - gaps} killed or not gaps`
}

/**
 * The baseline before any mutant: each oracle file's result, and for a
 * failing file its first failing law with the command that replays it.
 * `files` names each oracle file, relative to the package, with its failure
 * (undefined when it passed) and the failing test's full name.
 */
export function baselineLines(files) {
  return files.flatMap(({ file, failure, fullName }) =>
    failure === undefined
      ? [`pass ${file}`]
      : [
          `fail ${file}: ${failure}`,
          `  replay: vitest run ${file} -t ${JSON.stringify(fullName)}`,
        ],
  )
}
