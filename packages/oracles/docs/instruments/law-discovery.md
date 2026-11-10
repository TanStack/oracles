# Law discovery

**Use when:** a bug, example, or implementation exists but the promised behavior
is unclear; several supplied reports may share a law; or an existing law might
conflate distinct obligations.

**Inputs:** the question, contract sources, known examples, the existing oracle
and its limits, and the public observation that matters. A missing authority is an
input gap, not permission to infer a promise from production.

With several reports or examples, ask whether one caller-visible obligation
predicts their different symptoms. Name its common preconditions. Check an
apparent outlier and a nearby case that the obligation should permit. If those
cases need different promises, split the proposal. A descriptive cluster is a
lead, not evidence.

## Operation

1. State the obligation in domain terms before describing machinery: for which
   legal inputs or histories, under which preconditions, what must be observable
   at which checkpoint? Include what can still be pending or unspecified.
2. Trace its authority. Separate accepted contract, observed current behavior,
   mathematical consequence, and proposed design. Explain why the obligation
   matters to a caller. A mathematical rule still needs an argument that it is
   the right rule for this API.
3. Form a plausible rival interpretation. Derive both predictions for the
   smallest legal case that separates them, without consulting production for
   the expected answer. If authority does not select a prediction, retain the
   design question instead of turning one guess into an assertion.
4. Compare an ordinary case with a nearby boundary case. Vary a relevant
   condition such as cardinality, ordering, identity, authority, or observation
   time. Keep other conditions fixed where possible. Check the boundary is
   within the claimed domain.
5. Identify the checkpoint where the contract requires the proposed result; a
   permitted pending state does not establish a gap. Check whether the result
   is determined by the information available to the responsible production
   path there. Seek two legal underlying histories that give the path the same
   initial state and inputs through that checkpoint but require incompatible
   public observations. If they exist, name the missing information or provider
   obligation. A candidate law may be scoped explicitly; do not silently narrow
   an accepted promise, which requires authority to revise.
6. Describe the smallest independent model that enacts the obligation and limits
   from step 1 and makes the rival and boundary predictions from steps 3–4.
   Retain the source facts needed to examine any information gap from step 5,
   even when the production path has not received them.
   For any proposed merge of model states, ask whether a legal continuation can
   distinguish them. Map model abstractions to the project vocabulary.

The information check asks what production can receive. The model-state test
asks what the reference must remember. Example: a path must publish a full top
ten after a deletion, but it receives only the old top ten and the deletion.
Two datasets can then need different results while the path sees the same
inputs. If the path can request the replacement rows, and the provider
supplies them before publication, the path has the information. Judge it at
its own checkpoint.

**Return:** the candidate law and status, its source, rival predictions, a
concrete distinguishing witness, and the next experiment or unresolved decision.
For an information gap, include the indistinguishable histories and the
unresolved source, protocol, or scope decision.
For a simple law, a short paragraph and a worked example suffice.

**Control:** try a legal alternative implementation. Does the proposed law
reject it only because its scheduling or representation differs? Also try a
plausible wrong result: could the proposed observation distinguish it? If an
information gap is claimed, try a nearby path that supplies the missing input,
such as a provider backfill. Check whether that input distinguishes the
histories before the checkpoint; if it does, the original impossibility
argument no longer applies to that path.

**Distortion:** freezing an implementation accident into a law; treating a vivid
edge case as representative; or overstating what is owed at an intermediate cut.

**Stop when:** the law is precise enough to enact independently, or a named
missing authority or fact prevents choosing between predictions. Continue other
authorized work while keeping that choice unresolved.
