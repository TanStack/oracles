import { appendFileSync } from 'node:fs'
import { asyncDefaultReportMessage, defaultReportMessage } from 'fast-check'
import { oracleEnvName } from './oracle-environment.js'
import type { RunDetails } from 'fast-check'

export type OracleReplayWitness = {
  property: string
  seed: number
  path: string | undefined
  numRuns: number
  failed: boolean
}

function witnessChannel(
  property: string,
  seed: number,
  path: string | undefined,
): string | undefined {
  const channel = process.env[oracleEnvName(`REPLAY_WITNESS`)]
  return channel !== undefined &&
    property === process.env[oracleEnvName(`PROPERTY`)] &&
    seed === Number(process.env[oracleEnvName(`SEED`)]) &&
    path === process.env[oracleEnvName(`PATH`)]
    ? channel
    : undefined
}

function appendWitness(channel: string, witness: OracleReplayWitness): void {
  appendFileSync(channel, `${JSON.stringify(witness)}\n`)
}

function runWitness<T>(
  property: string,
  details: RunDetails<T>,
): OracleReplayWitness {
  return {
    property,
    seed: details.seed,
    path: details.runConfiguration.path,
    numRuns: details.numRuns,
    failed: details.failed,
  }
}

/**
 * Record a guarded replay witness for an owner that runs its property with
 * `fc.check`. fast-check calls reporters only from `fc.assert`, so such an
 * owner records its run details itself. It never throws: the owner keeps its
 * own failure analysis.
 */
export function recordOracleReplay<T>(
  property: string,
  details: RunDetails<T>,
): void {
  const channel = witnessChannel(
    property,
    details.seed,
    details.runConfiguration.path,
  )
  if (channel !== undefined)
    appendWitness(channel, runWitness(property, details))
}

/** A completed finite-history comparison has no fast-check RunDetails. */
export function recordOracleFiniteReplay(
  property: string,
  { seed, path, failed }: { seed: number; path: string; failed: boolean },
): void {
  const channel = witnessChannel(property, seed, path)
  if (channel === undefined) return
  // A plain record serialized in place, which the lint rule accepts as a
  // witness rather than as fast-check options with one run.
  const witness: OracleReplayWitness = {
    property,
    seed,
    path,
    numRuns: 1,
    failed,
  }
  appendFileSync(channel, `${JSON.stringify(witness)}\n`)
}

/**
 * Attach a witness only when the guarded runner's property, seed, and path all
 * match. Constructing fast-check options is not evidence that a property ran.
 * The reporter records fast-check's completed run details, then preserves its
 * native failure formatting and cause policy instead of turning instrumentation
 * into a second assertion engine.
 */
export function oracleReplayReporter(
  property: string,
  seed: number,
  path: string,
): {
  asyncReporter?: <T>(details: RunDetails<T>) => Promise<void>
  reporter?: <T>(details: RunDetails<T>) => void
} {
  const channel = witnessChannel(property, seed, path)
  if (channel === undefined) return {}
  const record = <T>(details: RunDetails<T>) =>
    appendWitness(channel, runWitness(property, details))
  const rethrow = <T>(details: RunDetails<T>, message: string | undefined) => {
    // A custom reporter replaces fast-check's throw. Preserve its public
    // formatter and its cause, which fast-check 4 always attaches, including
    // for precondition failures.
    if (message === undefined) return
    const error = new Error(message)
    Object.defineProperty(error, `cause`, {
      value: details.errorInstance,
      configurable: true,
      writable: true,
    })
    throw error
  }
  // fast-check accepts an async reporter only for an async property. When a
  // synchronous property rejects it, the guarded runner retries in the
  // synchronous mode, which uses fast-check's synchronous formatter.
  if (process.env[oracleEnvName(`REPLAY_WITNESS_MODE`)] === `sync`) {
    return {
      reporter: (details) => {
        record(details)
        rethrow(details, defaultReportMessage(details))
      },
    }
  }
  return {
    asyncReporter: async (details) => {
      // Statistics sampling has no assertion reporter and cannot earn reach.
      record(details)
      rethrow(details, await asyncDefaultReportMessage(details))
    },
  }
}
