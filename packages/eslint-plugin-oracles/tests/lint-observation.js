/**
 * The lint drivers' shared charge rule, for the oracles in this package.
 *
 * A lint run either returns its messages or throws. ESLint tags an error that a
 * rule threw with the rule's id, so only that error is the rule's throw, and a
 * driver records it as the observation `{ threw }`: the law rejects it. Any
 * other error is a harness failure (a renderer bug, a config that fails to
 * load). It propagates and stops the run, and it is never charged to the rule
 * (frozen principle P10).
 *
 * This is a runner utility, not an oracle: it holds no expected answer.
 */

/**
 * Runs `lint`, which returns a lint run's messages. Returns `{ messages }` on a
 * normal run, or `{ threw }` when the rule threw.
 */
export function lintCharged(lint) {
  try {
    return { messages: lint() }
  } catch (error) {
    return charged(error)
  }
}

/** `lintCharged` for a lint run that returns a promise, as `ESLint#lintFiles` does. */
export async function lintChargedAsync(lint) {
  try {
    return { messages: await lint() }
  } catch (error) {
    return charged(error)
  }
}

/** The observation of a rule's throw; any other error propagates. */
function charged(error) {
  if (error?.ruleId === undefined) throw error
  return { threw: String(error) }
}
