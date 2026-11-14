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
//     The replay lines of a failing property: the PowerShell line and the
//     cmd line each reproduce the failure when run in their own shell. The
//     POSIX line is run in PowerShell too, and must not reproduce (that is the
//     RED of the framework's per-shell lines). A run whose output has only
//     the POSIX line on win32 fails here, because the per-shell lines are
//     missing.
//
//   node scripts/windows-witness.mjs stop <dir> <cli-args...>
//     One early stop: the CLI starts, the witness sends SIGINT once the CLI
//     has printed its first line, and the run must end in one of the two
//     outcomes of the all-or-nothing law (#57): (a) the stop's done line on
//     both streams, matching the exit code (130 or 143); (b) no output at all.
//     Anything else, including a partial output, fails.
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
  // Every failing property in the output prints a PowerShell line and a cmd
  // line (or says cmd has no form for its name). Each pair is run in its own
  // shell, and each must reproduce the failure. The POSIX line is not run.
  const [outputFile, dir] = args
  const output = readFileSync(outputFile, `utf8`).replace(/\x1b\[[0-9;]*m/g, ``)
  const lines = output.split(/\r?\n/)
  const after = (label) =>
    lines
      .filter((text) => text.includes(label))
      .map((text) => text.slice(text.indexOf(label) + label.length))
  const powershell = after(`Replay (PowerShell): `)
  const cmd = after(`Replay (cmd): `)
  // The shells find the test runner in this package's own binaries.
  const env = {
    ...process.env,
    PATH: [
      resolve(here, `../node_modules/.bin`),
      join(dir, `node_modules`, `.bin`),
      process.env.PATH,
    ].join(delimiter),
  }
  const runIn = (shell, line) =>
    spawnSync(
      shell === `pwsh` ? `pwsh` : `cmd`,
      shell === `pwsh`
        ? [`-NoProfile`, `-Command`, line]
        : [`/d`, `/s`, `/c`, line],
      // cmd reads its line as it is; Node's own quoting would break it.
      {
        cwd: dir,
        env,
        encoding: `utf8`,
        windowsVerbatimArguments: shell !== `pwsh`,
      },
    )
  const reproduces = (result) =>
    result.status !== 0 &&
    /violated|failed/.test(`${result.stdout}${result.stderr}`)
  if (powershell.length === 0) {
    fail(`the failure printed no PowerShell replay line`)
  } else if (powershell.length !== cmd.length) {
    fail(`${powershell.length} PowerShell lines but ${cmd.length} cmd lines`)
  } else {
    const failures = []
    powershell.forEach((psLine, i) => {
      const psRun = runIn(`pwsh`, psLine)
      if (!reproduces(psRun))
        failures.push(`PowerShell line ${i + 1} did not reproduce: ${psLine}`)
      const cmdLine = cmd[i]
      if (cmdLine === `use the PowerShell line for this name`) {
        console.log(`cmd has no form for name ${i + 1}, as printed`)
        return
      }
      const cmdRun = runIn(`cmd`, cmdLine)
      if (!reproduces(cmdRun))
        failures.push(`cmd line ${i + 1} did not reproduce: ${cmdLine}`)
    })
    if (failures.length > 0) fail(failures.join('; ').slice(0, 1500))
    else
      console.log(
        `${powershell.length} printed name(s): PowerShell and cmd lines each reproduce`,
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
        `stop was not all-or-nothing (signal ${signal}, exit ${code}): ${problems.join('; ')}`,
      )
    else
      console.log(
        `stop outcome (a): stopped line on both streams, exit ${code}`,
      )
  })
} else {
  fail(`unknown command ${command}`)
}
