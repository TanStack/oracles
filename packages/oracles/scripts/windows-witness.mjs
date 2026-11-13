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
import { readFileSync } from 'node:fs'
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
  const [outputFile, dir] = args
  const output = readFileSync(outputFile, `utf8`).replace(/\x1b\[[0-9;]*m/g, ``)
  // The text after a label on the first line that carries it, wherever the
  // error text indents it.
  const lineOf = (label) => {
    const line = output.split(/\r?\n/).find((text) => text.includes(label))
    return line === undefined
      ? undefined
      : line.slice(line.indexOf(label) + label.length)
  }
  const powershell = lineOf(`Replay (PowerShell): `)
  const cmd = lineOf(`Replay (cmd): `)
  const posix = lineOf(`Replay: `)
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
  if (powershell === undefined || cmd === undefined) {
    fail(
      `the failure printed no per-shell replay lines (PowerShell: ${powershell === undefined ? `missing` : `ok`}, cmd: ${cmd === undefined ? `missing` : `ok`})`,
    )
  } else {
    const psRun = runIn(`pwsh`, powershell)
    const cmdRun = runIn(`cmd`, cmd)
    if (!reproduces(psRun))
      fail(
        `the PowerShell line did not reproduce the failure: ${psRun.stderr || psRun.stdout}`.slice(
          0,
          800,
        ),
      )
    else if (!reproduces(cmdRun))
      fail(
        `the cmd line did not reproduce the failure: ${cmdRun.stderr || cmdRun.stdout}`.slice(
          0,
          800,
        ),
      )
    else console.log(`PowerShell and cmd lines each reproduce the failure`)
  }
  if (posix !== undefined) {
    const posixRun = runIn(`pwsh`, posix)
    if (reproduces(posixRun))
      console.log(`note: the POSIX line also reproduces in PowerShell`)
    else
      console.log(
        `RED: the POSIX line does not reproduce in PowerShell (exit ${posixRun.status})`,
      )
  }
} else if (command === `stop`) {
  const [dir, ...cliArgs] = args
  const child = spawn(process.execPath, [cli, ...cliArgs], {
    cwd: dir,
    stdio: [`ignore`, `pipe`, `pipe`],
  })
  let stdout = ``
  let stderr = ``
  let sent = false
  child.stdout.on(`data`, (chunk) => {
    stdout += chunk
    if (!sent && stdout.length > 0) {
      sent = true
      child.kill(`SIGINT`)
    }
  })
  child.stderr.on(`data`, (chunk) => {
    stderr += chunk
  })
  child.on(`close`, (code, signal) => {
    if (!sent) {
      // The run ended before it printed anything: outcome (b) if it printed
      // nothing at all, which is the only way to end before a first line.
      if (stdout === `` && stderr === ``)
        console.log(`stop outcome (b): no output`)
      else
        fail(
          `the run ended before any stop was sent, with ${JSON.stringify(stdout.slice(0, 200))}`,
        )
      return
    }
    if (stdout === `` && stderr === ``) {
      console.log(`stop outcome (b): no output`)
      return
    }
    const problems = [
      checkDone(`stdout`, stdout, code ?? -1),
      checkDone(`stderr`, stderr, code ?? -1),
    ].filter(Boolean)
    if (problems.length > 0)
      fail(
        `stop was not all-or-nothing (signal ${signal}, exit ${code}): ${problems.join('; ')}`,
      )
    else
      console.log(`stop outcome (a): done line on both streams, exit ${code}`)
  })
} else {
  fail(`unknown command ${command}`)
}
