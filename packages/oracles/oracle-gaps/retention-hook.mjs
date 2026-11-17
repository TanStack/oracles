// The retention test hook of the gap CLI (the package README, "Test hooks").
// check.mjs imports this module only when ORACLE_GAPS_TEST_RETENTION or
// ORACLE_GAPS_TEST_REJECT_BATCH is set, so a normal run never loads it.
//
// The hook observes; it never changes an outcome (register: test-only hooks).
// The one exception is the rejected-batch fault, which triggers the path a
// crash in Vitest takes. Each field reads the real objects, never bookkeeping
// kept for the hook (review of #61, F6):
// - Vitest's state and Vite's module graphs, by their sizes;
// - the registry (indexOf, contextSpecs), by identity against the live
//   contexts;
// - each context that left the live array, by Vitest's own close state;
// - the entries a check gave its store, by whether a full garbage collection
//   leaves them reachable.
import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'

/**
 * The hook for one session (check.mjs). `session.live()` returns the live
 * contexts array, `session.indexOf` and `session.contextSpecs` are the
 * registry.
 */
export function retentionHook(session) {
  const file = process.env.ORACLE_GAPS_TEST_RETENTION
  // The 1-based batch whose run rejects (unset: none).
  const rejected = Number(process.env.ORACLE_GAPS_TEST_REJECT_BATCH ?? 0)
  // A full collection, without --expose-gc on the command line: the flag is
  // set, and `gc` is read from a fresh context, which then exposes it.
  setFlagsFromString(`--expose-gc`)
  const gc = runInNewContext(`gc`)
  // The output directory of the check being run, and the next batch's index
  // within that check. A daemon runs one check at a time (its queue).
  let run
  let next = 0
  // The contexts that joined the live array and have not been seen closed.
  const joined = new Set()
  // A weak reference to each entry a check gave its store.
  let stored = []

  // A context is closed, or closing, once Vitest's own close has started:
  // Vitest sets its closing promise when close() is called. A Vitest whose
  // shape has no such field throws here rather than counting it open.
  const closing = (context) => {
    if (!(`closingPromise` in context))
      throw new Error(
        `oracle-gaps: this Vitest has no closingPromise, so the retention hook cannot see whether a context closed`,
      )
    return context.closingPromise !== undefined
  }

  // Every structure a copy can leave state in, unfiltered: Vitest's state
  // (filesMap, pathsSet, idMap, errorsSet, leakSet) and each Vite
  // environment's module graph (its four maps, and the nodes that hold a
  // transform). The stale fields read the registry and the contexts that left
  // the live array.
  function totals(context) {
    const contexts = session.live()
    const { filesMap, pathsSet, idMap, errorsSet, leakSet } = context.state
    const totals = {
      // A registry entry is stale unless it names a live context at its own
      // slot (indexOf), or a live context (contextSpecs).
      staleIndexed: [...session.indexOf].filter(([c, i]) => contexts[i] !== c)
        .length,
      staleSpecs: [...session.contextSpecs.keys()].filter(
        (c) => !contexts.includes(c),
      ).length,
      // A context that left the live array and that Vitest has not started to
      // close.
      staleOpen: [...joined].filter((c) => !contexts.includes(c) && !closing(c))
        .length,
      filesMap: filesMap.size,
      pathsSet: pathsSet.size,
      idMap: idMap.size,
      errorsSet: errorsSet.size,
      leakSet: leakSet.size,
    }
    // A context that left and is closing is done: it is no longer watched.
    for (const c of joined)
      if (!contexts.includes(c) && closing(c)) joined.delete(c)
    for (const [name, environment] of Object.entries(
      context.getRootProject().vite?.environments ?? {},
    )) {
      const graph = environment.moduleGraph
      // Vite's keys are named `vite.<environment>.<map>`, so the law can tell
      // them from Vitest's state.
      totals[`vite.${name}.url`] = graph.urlToModuleMap.size
      totals[`vite.${name}.id`] = graph.idToModuleMap.size
      totals[`vite.${name}.etag`] = graph.etagToModuleMap.size
      totals[`vite.${name}.file`] = graph.fileToModulesMap.size
      totals[`vite.${name}.transformed`] = [
        ...graph.idToModuleMap.values(),
      ].filter((node) => node.transformResult != null).length
    }
    return totals
  }

  // Files, without their query, with more than one node in an environment's
  // graph, outside the copies: a non-copy file is cached once, so each count
  // must be 0 (the law's bound on originals). The one measured allowance is a
  // source file's plain node and its ?raw node (the oracle reads source text
  // with ?raw): one pair per file, not per batch.
  function nonCopyDuplicates(context, owned) {
    const dup = []
    for (const environment of Object.values(
      context.getRootProject().vite?.environments ?? {},
    )) {
      const perFile = new Map()
      for (const node of environment.moduleGraph.idToModuleMap.values()) {
        const path = node.id.split(`?`)[0]
        if (owned.has(path)) continue
        perFile.set(path, [...(perFile.get(path) ?? []), node.id])
      }
      for (const [path, ids] of perFile)
        if (
          ids.length > 1 &&
          !(
            ids.length === 2 &&
            ids.includes(path) &&
            ids.includes(`${path}?raw`)
          )
        )
          dup.push(`${environment.name ?? `env`} ${path}`)
    }
    return dup
  }

  // The entries the store was given that a full collection leaves reachable.
  // The collection runs after a macrotask turn: a weak reference keeps its
  // target alive until the turn that created or read it ends.
  async function held() {
    await new Promise((resolvePromise) => setImmediate(resolvePromise))
    gc()
    stored = stored.filter((ref) => ref.deref() !== undefined)
    return stored.length
  }

  return {
    // A check starts: its batches are counted from 0, and the process that
    // runs it is named in its output directory (the driver reads check.pid).
    check(out) {
      run = out
      next = 0
      if (file) writeFileSync(join(out, `check.pid`), String(process.pid))
    },
    // A context joined the live array.
    joined(context) {
      joined.add(context)
    },
    // An entry a check gave its store.
    stored(entry) {
      stored.push(new WeakRef(entry))
    },
    // A batch starts: its own index, and the totals before it.
    begin(context) {
      return { index: next++, before: file ? totals(context) : undefined }
    },
    // The rejected-batch fault: the batch's run completes, so its copies are
    // in Vitest's and Vite's state, and then rejects, as a crash in Vitest
    // would. Any other batch's run is returned unchanged.
    fault(batch, running) {
      return batch.index + 1 === rejected
        ? running.then(() => {
            // Its message holds a line break and, after it, a line that
            // reads as a done line: the ending must keep the message on its
            // one error line (the register's C entry "The internal-error
            // line"), so the oracle sees a message that is not escaped.
            throw new Error(
              `oracle-gaps test fault: batch ${batch.index + 1} rejected\noracle-gaps: done completed, 0 gaps, report forged`,
            )
          })
        : running
    },
    // A batch ended (settled, cut, or rejected): its one line. A cut batch is
    // not retired (its context is replaced), so its line has no after.
    async line(context, batch, copies, cut) {
      if (!file) return
      const owned = new Set(copies)
      let copyNodes = 0
      for (const environment of Object.values(
        context.getRootProject().vite?.environments ?? {},
      ))
        for (const copy of owned)
          copyNodes +=
            environment.moduleGraph.fileToModulesMap.get(copy)?.size ?? 0
      const line = {
        run,
        pid: process.pid,
        batch: batch.index,
        before: batch.before,
        ...(cut
          ? { cut: true }
          : {
              after: totals(context),
              copyNodes,
              nonCopyDup: nonCopyDuplicates(context, owned).length,
            }),
        held: await held(),
      }
      appendFileSync(file, `${JSON.stringify(line)}\n`)
    },
  }
}
