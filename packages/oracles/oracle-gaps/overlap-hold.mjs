// The overlap test hold of the gap CLI's daemon (the package README, "Test
// hooks"). daemon.mjs imports this module only when
// ORACLE_GAPS_TEST_HOLD_OVERLAP is set, so a normal daemon never loads it.
//
// The hold pauses at one named point and changes no outcome (register:
// test-only hooks, v21.2 G43 and R57). The first check a daemon runs waits,
// before it starts, until the daemon has accepted a second check request.
// The second request waits in the queue, as it always does while a check
// runs, so the two checks overlap by a count, never by a reading of two
// processes' timing. Then the hold writes that count to the path the
// variable names. It holds once per daemon.
//
// Its backstop fails loudly: when no second request comes within
// BACKSTOP_MS, the held check fails with a named error, and the daemon
// closes, so it releases its socket and lock (daemon.mjs).
import { renameSync, writeFileSync } from 'node:fs'

const BACKSTOP_MS = 120_000

/** The hold for one daemon; `mark` is the path the release writes. */
export function overlapHold(mark) {
  let accepted = 0
  let held = false
  let release
  const second = new Promise((resolvePromise) => {
    release = resolvePromise
  })
  return {
    /** Counts a check request the daemon accepted. */
    accepted() {
      accepted += 1
      if (accepted === 2) release()
    },
    /** Holds the daemon's first check until a second request is accepted. */
    async hold() {
      if (held) return
      held = true
      let timer
      const backstop = new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `ORACLE_GAPS_TEST_HOLD_OVERLAP: the daemon held its first check for ${BACKSTOP_MS / 1000} s and accepted no second check request, so the two checks did not overlap; the test-only hold's backstop fails the check and closes the daemon`,
              ),
            ),
          BACKSTOP_MS,
        )
      })
      try {
        await Promise.race([second, backstop])
      } finally {
        clearTimeout(timer)
      }
      const temp = `${mark}.${process.pid}.tmp`
      writeFileSync(temp, `${accepted}`)
      renameSync(temp, mark)
    },
  }
}
