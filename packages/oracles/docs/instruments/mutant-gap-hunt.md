# Mutant gap hunt

**Use when:** a recent refactor, a suspicious green oracle, a survivor whose
missing history is not obvious, or an open review question leaves doubt that
the oracle would reject a plausible wrong behavior. One carefully chosen
mutant can answer a useful question. A campaign is optional.

**Inputs:**

- the changed code and the commits that shaped it
- the claimed law and its authority
- the oracle's prose and its `limits`
- the gap check's report, and any open review questions
- the public observation that could distinguish a mistake

Keep test bodies and assertions out of the design brief.

## Operation

1. **Design plausible mistakes before you read the tests.**
   - Start with semantic, type-plausible edits near the changed boundaries: a
     lost operand, a wrong prior value, a premature clear, a duplicated event,
     a changed order, or a skipped callback.
   - Turn each open review question into a candidate.
   - If code is called dead, try removing it.
   - Spread candidates across the affected files and boundaries. Do not
     cluster them where edits are easy.
   - Hand-write candidates at boundaries a designer may miss, such as wrappers,
     lazy getters, and caches.
   - If you inspect the assertions before drafting, label the design as
     self-generated.
2. **Make each edit replayable.**
   - Record each mutant in the gap check's authored form:
     `{ id, source, find, replace, intent, author }`. `find` must occur
     exactly once in `source` at the pinned revision, and the result must
     parse.
   - Change one decision per mutant. A compound kill does not say which part
     the comparison rejected.
   - Run each candidate against an unchanged, pinned baseline, and restore
     the code exactly.
   - A crash outside the comparison, a timeout, a setup failure, or an
     unreached edit is not a kill. Record which one it was, not a score.
3. **Interrogate every survivor.** A survivor is a gap. Find which one of
   these it shows:
   - **A missing history:** no legal history reaches the mutated decision,
     or none reaches it under the condition where it matters. Name the history
     and add the generator dimension or constructed history for it.
   - **A missing observation:** the mutant changes something the driver does
     not record. Record it at the checkpoint the contract owes it.
   - **A missing or loose law:** the change is observed, but no law rejects
     it. State the law and find its authority (use
     [law discovery](law-discovery.md)).
   - **Dead code:** no legal history can observe the decision. Remove the code.
   - **An allowed alternative:** the observations differ, and the adopted law
     already allows both, as an allowed set with its clause. The mutant is a
     valid implementation, so do not strengthen the law or change production
     to kill it. Report it with the mutant's key, the clause, and the history,
     separately from the kills. Until the gap check recognizes allowed sets,
     it stays open in the report. Only the framework closes it.
   - **A law question:** the observations differ, and the contract only seems
     to allow both. Do not record that as acceptable. Give the developer the two
     observations and the history that shows them, and ask whether the law
     should decide the choice.
   - **A framework bug:** none of the above fits, such as a mutant that no
     oracle could detect. Stop work on that gap, and report its key and
     evidence. Calling a mutant invalid does not close the gap.

   There is no "equivalent" class, and no class where the agent accepts a
   survivor. Probe the nearest unusual legal history before you call a path
   unreachable.

   To confirm a missing history or observation, run one focused probe on both
   revisions. Expect a pass on the baseline and a failure on the mutant at the
   intended assertion. If the contract predicts the mutant's result instead,
   the baseline is RED: investigate a product bug. Then remove the temporary
   probe, and check that `git status` is clean.

4. **Repair the oracle, when authorized.**
   - Extend the oracle with the missing history, observation, or law.
   - Show that the extension rejects the motivating mutant and a nearby
     plausible wrong design, and still accepts every allowed alternative.
   - For a bug on the baseline, show RED on production before its repair.
   - Then run the gap check again.

**Return:** for each chosen mutant:

- its pinned revision and exact edit
- the observed run outcome, using ORC-006's categories in the
  [checklist](../oracle-checklist.md)
- which step 3 class it showed, with the distinguishing
  history

Keep raw logs task-local unless the task asks to publish them.

**Control:** public observations decide product claims. Check that each probe
reaches the path and the premise it names. A green suite does not prove that
no gap exists. Use a positive control when instrumentation reports that a
branch was never reached. Recheck types after a tool rewrites code.

**Distortion:**

- mutants chosen to satisfy the existing tests
- syntax failures counted as semantic kills
- private-state differences treated as product bugs
- an oracle extension that still accepts the motivating mutant
- a negative witness that accepts any failure
- a decision checked in one build mode while another mode can observe it

**Stop when:** each selected mutant has an executed distinction, a removed
piece of dead code, a law question with the developer, or a framework bug
reported. Do not infer broad coverage from a kill count.
