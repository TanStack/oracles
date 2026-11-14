// Windows witnesses for the gap CLI and the framework's replay lines. Each
// subcommand is one check that CI runs on windows-latest, and each exits
// non-zero when the check fails. Node runs them on every platform.
//
//   node scripts/windows-witness.mjs done <stdout> <stderr> <exit-code>
//     The done line (P10): each stream has exactly one `oracle-gaps: done`
//     line, and it is the stream's last line; its status matches the exit
//     code (completed 0, refused 2, error 3, a stop 130 or 143).
//
//   node scripts/windows-witness.mjs replay <vitest-output> <dir>
//     Every printed command in a failing property's output: each `Replay` and
//     `Rerun` line for PowerShell and for cmd. Each PowerShell line runs in
//     pwsh and in Windows PowerShell 5.1 (powershell.exe), each cmd line in
//     cmd. A line must reproduce the failure, except a cmd line that says cmd
//     has no form for its name (a name with a double quote, `%`, or `!`). A
//     Rerun line is run as `vitest run` plus its arguments, since it names the
//     test only. A run whose output has no per-shell line for a failure fails.
//
//   node scripts/windows-witness.mjs stop <dir> <cli-args...>
//     One stop: the CLI runs with the test-only hook ORACLE_GAPS_TEST_STOP, and
//     the witness writes that file on the CLI's first stderr line (its progress
//     streams there; stdout gets the summary only at the end). The run must end
//     with its stopped line on both streams and exit 130 (SIGINT). A run that
//     completes first, or ends with another line or code, fails.
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { delimiter, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL(`.`, import.meta.url))
const cli = resolve(here, `../oracle-gaps/index.mjs`)
const [command, ...args] = process.argv.slice(2)

const fail = (message) => {
  console.error(`windows-witness ${command}: ${message}`)
  process.exitCode = 1
}

// The done status each exit code names (P10).
const statusOf = { completed: 0, refused: 2, error: 3 }
const exitCodeOf = (status) => {
  if (status in statusOf) return statusOf[status]
  return undefined
}

function doneLinesOf(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith(`oracle-gaps: done `))
}

function checkDone(stream, text, exitCode) {
  const lines = text.split(/\r?\n/).filter((line) => line !== ``)
  const done = doneLinesOf(text)
  if (done.length !== 1)
    return `${stream}: ${done.length} done lines, want exactly 1`
  if (!lines.at(-1).startsWith(`oracle-gaps: done `))
    return `${stream}: the done line is not the last line`
  const status = done[0].slice(`oracle-gaps: done `.length).split(/[ ,]/)[0]
  // A stop names no exit status of its own: it ends with 130 or 143.
  const want = exitCodeOf(status)
  const ok =
    want === undefined ? [130, 143].includes(exitCode) : want === exitCode
  return ok ? undefined : `${stream}: done ${status} but exit code ${exitCode}`
}

// The stop's own line (law #57): one done line, last, `done stopped (SIGINT)`,
// and exit 130.
function checkStop(stream, text, exitCode) {
  const lines = text.split(/\r?\n/).filter((line) => line !== ``)
  const done = doneLinesOf(text)
  if (done.length !== 1)
    return `${stream}: ${done.length} done lines, want exactly 1`
  if (done[0] !== `oracle-gaps: done stopped (SIGINT)`)
    return `${stream}: the done line is ${JSON.stringify(done[0])}, not a SIGINT stop`
  if (lines.at(-1) !== done[0])
    return `${stream}: the done line is not the last line`
  return exitCode === 130 ? undefined : `${stream}: exit ${exitCode}, want 130`
}

if (command === `done`) {
  const [stdoutFile, stderrFile, code] = args
  const exitCode = Number(code)
  const problems = [
    checkDone(`stdout`, readFileSync(stdoutFile, `utf8`), exitCode),
    checkDone(`stderr`, readFileSync(stderrFile, `utf8`), exitCode),
  ].filter(Boolean)
  if (problems.length > 0) fail(problems.join('; '))
  else console.log(`done line ok on both streams, exit ${exitCode}`)
} else if (command === `replay`) {
  // Every printed command of a failing property: the Replay and Rerun lines,
  // for PowerShell and for cmd. Each PowerShell line runs in pwsh and in
  // Windows PowerShell 5.1; each cmd line runs in cmd. A cmd line that says it
  // has no form (a name with `"`, `%`, or `!`) is the only line that may not run.
  const [outputFile, dir] = args
  const output = readFileSync(outputFile, `utf8`).replace(/\x1b\[[0-9;]*m/g, ``)
  const lines = output.split(/\r?\n/)
  const after = (label) =>
    lines
      .filter((text) => text.includes(label))
      .map((text) => text.slice(text.indexOf(label) + label.length))
  const replayPs = after(`Replay (PowerShell): `)
  const replayCmd = after(`Replay (cmd): `)
  const rerunPs = after(`Rerun (PowerShell): `)
  const rerunCmd = after(`Rerun (cmd): `)
  const noForm = `use the PowerShell line for this name`
  // The shells find the test runner in this package's own binaries.
  const env = {
    ...process.env,
    PATH: [
      resolve(here, `../node_modules/.bin`),
      join(dir, `node_modules`, `.bin`),
      process.env.PATH,
    ].join(delimiter),
  }
  const runIn = (shell, line) => {
    // PowerShell reads the line from stdin (`-Command -`), as a user's typed
    // line arrives: an argument would pass through Node's quoting, which turns
    // a double quote into `\"`, and Windows PowerShell 5.1 does not read that as
    // an escape. cmd reads its line as it is (verbatim arguments).
    if (shell === `cmd`)
      return spawnSync(`cmd`, [`/d`, `/s`, `/c`, line], {
        cwd: dir,
        env,
        encoding: `utf8`,
        windowsVerbatimArguments: true,
      })
    return spawnSync(
      shell === `pwsh` ? `pwsh` : `powershell.exe`,
      [`-NoProfile`, `-Command`, `-`],
      {
        cwd: dir,
        env,
        encoding: `utf8`,
        input: line,
      },
    )
  }
  const reproduces = (result) =>
    result.status !== 0 &&
    /violated|failed/.test(`${result.stdout}${result.stderr}`)
  // A Rerun line names the test only: it runs as `vitest run <line>`.
  const asRerun = (line, prefix) => `vitest run ${line}`
  const failures = []
  let checked = 0
  const check = (name, lines, shells, cmdLines, runOf) => {
    lines.forEach((line, i) => {
      for (const shell of shells) {
        checked += 1
        const result = runIn(shell, runOf(line))
        if (!reproduces(result))
          failures.push(
            `${name} ${i + 1} did not reproduce in ${shell} (exit ${result.status}: ${`${result.stderr}${result.stdout}`.trim().slice(0, 400)}): ${line}`,
          )
      }
      if (cmdLines === undefined) return
      const cmdLine = cmdLines[i]
      if (cmdLine === noForm) return
      checked += 1
      const result = runIn(`cmd`, runOf(cmdLine))
      if (!reproduces(result))
        failures.push(`${name} ${i + 1} did not reproduce in cmd: ${cmdLine}`)
    })
  }
  // ORACLE_UNIT and ORACLE_PROPERTY carry the exact test (review option c): each
  // must decode to the text the failure printed, and must not be lost to the
  // `-t` pattern's wildcards. A PowerShell single-quoted value doubles its quotes.
  const decodeEnv = (line, name) => {
    const at = line.indexOf(`$env:${name}='`)
    if (at < 0) return undefined
    let value = ``
    for (let i = at + name.length + 8; i < line.length; i += 1) {
      const c = line[i]
      if (/['\u2018\u2019\u201A\u201B]/.test(c)) {
        if (line[i + 1] === c) {
          value += c
          i += 1
          continue
        }
        return value
      }
      value += c
    }
    return undefined
  }
  for (const line of replayPs) {
    for (const name of [`ORACLE_UNIT`, `ORACLE_PROPERTY`]) {
      const value = decodeEnv(line, name)
      if (value === undefined || !output.includes(value))
        failures.push(
          `${name} does not round-trip to the printed failure: ${JSON.stringify(value)}`,
        )
    }
  }
  check(`Replay`, replayPs, [`pwsh`, `powershell`], replayCmd, (line) => line)
  check(`Rerun`, rerunPs, [`pwsh`, `powershell`], rerunCmd, (line) =>
    asRerun(line),
  )
  if (replayPs.length + rerunPs.length === 0) {
    fail(`the failure printed no PowerShell replay or rerun line`)
  } else if (
    replayPs.length !== replayCmd.length ||
    rerunPs.length !== rerunCmd.length
  ) {
    fail(`PowerShell and cmd lines differ in number`)
  } else if (failures.length > 0) {
    fail(failures.join(`; `).slice(0, 1500))
  } else {
    console.log(
      `${checked} printed commands reproduce the failure (PowerShell 7, Windows PowerShell 5.1, cmd)`,
    )
  }
} else if (command === `stop`) {
  // The stop is the CLI's test-only hook (ORACLE_GAPS_TEST_STOP): a file that
  // appears takes the same stop as a SIGINT. Node on Windows cannot deliver a
  // Ctrl+C from a non-console parent, and child.kill('SIGINT') there is
  // TerminateProcess, a limit like SIGKILL, so no line is owed for it.
  const [dir, ...cliArgs] = args
  // Absolute: the CLI runs with `dir` as its cwd, so a relative name is read
  // from `dir/dir/...` and the stop never lands (review F1).
  const stopFile = resolve(dir, `.stop-requested`)
  rmSync(stopFile, { force: true })
  const child = spawn(process.execPath, [cli, ...cliArgs], {
    cwd: dir,
    env: { ...process.env, ORACLE_GAPS_TEST_STOP: stopFile },
    stdio: [`ignore`, `pipe`, `pipe`],
  })
  let stdout = ``
  let stderr = ``
  // The stop lands on an event, not a clock: the CLI's first live line. Its
  // progress lines stream on stderr as the run goes; stdout gets the done
  // summary only at the end (measured, 2026-11-14), so stdout is no start
  // marker. A run that ends before its first line is a failure.
  let requested = false
  child.stdout.on(`data`, (chunk) => {
    stdout += chunk
  })
  child.stderr.on(`data`, (chunk) => {
    stderr += chunk
    if (!requested) {
      requested = true
      writeFileSync(stopFile, ``)
    }
  })
  child.on(`close`, (code, signal) => {
    if (!requested) {
      fail(
        `the run ended before the stop landed (exit ${code}, signal ${signal})`,
      )
      return
    }
    // A stop must end with its stopped line on both streams, and exit 130
    // (SIGINT). A completed run is no stop, however its done line reads.
    const problems = [
      checkStop(`stdout`, stdout, code),
      checkStop(`stderr`, stderr, code),
    ].filter(Boolean)
    if (problems.length > 0)
      fail(
        `the stop did not end with its stopped line on both streams and exit 130 (signal ${signal}, exit ${code}): ${problems.join('; ')}`,
      )
    else
      console.log(
        `stop outcome (a): stopped line on both streams, exit ${code}`,
      )
  })
} else {
  fail(`unknown command ${command}`)
}
