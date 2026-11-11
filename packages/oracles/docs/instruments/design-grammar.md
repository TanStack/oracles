# Design grammar

**Use when:** the law has many interacting rules, the model keeps growing, a
simplification is proposed, or the law makes claims about state, concurrency,
retries, or ownership. For an ordinary oracle, design step 2 is enough.

**Inputs:**

- the law sheet and the frozen list from design step 2
- the owned production code
- the known examples: docs, issues, and existing tests
- one nearby invalid history that the oracle must reject

Keep the invalid history and the examples fixed before you simplify anything.
A case that shaped the design is a regression case afterwards, not evidence
of range.

## Operation

1. **State the preservation relation.** Say which one the work keeps:
   - **Reconstruction:** the model accounts for the documented behavior.
   - **Named laws:** the model keeps each adopted law. Behavior that no law
     names may change.
   - **Same observations:** under fixed assumptions, the old and new models
     allow the same observations at the same checkpoints.

   Name the checkpoints, the assumptions, and the freedoms the contract leaves
   open. The user's review of the law sheet fixes the intended contract. It is
   not evidence that a model meets it.

2. **Separate what you found from what you added.** Each rule cites its
   authority, or you mark it as added. Production output is evidence, never
   authority. A rule that only reproduces production's current behavior can
   freeze a defect into the law.

3. **Admit a part only for a job.** A part is an action, a state field, or an
   observation. Admit it only when it rebuilds a sourced behavior, decides
   legality, or keeps a named law. A renamed production component is not a
   part.

4. **Record rules and conflicts.** Write each rule as one sentence of the law.
   When two rules conflict, keep both and mark the conflict as an open question
   for the user. Record a priority only when the authority gives one.

5. **Check overlaps.** Where two parts share state or timing, ask whether the
   interaction itself carries a law, such as a cleanup that races a late
   completion. Keep the function of that interaction. Its original shape can
   change.

6. **Reconstruct, then simplify.**
   - Rebuild every known example with the histories and the model. Revise the
     model if it cannot.
   - Remove each part and each rule in turn. If nothing breaks (no example, no
     law, no rejected invalid history), remove it or demote it to a comment.
   - Then try a different representation. Removing one part at a time does not
     find a joint replacement. Examples:
     - Three disjoint sets of ids become one map from id to status.
     - A stored value becomes a derived one.
     - Two states with the same futures merge.
     - A case table becomes one general rule.
   - Count the complexity that moves into helpers, adapters, or mappings.
     Moving it does not remove it.

   Call the result a reduced model, not a minimal one. Local removal shows only
   that no tried simplification succeeded.

7. **Compare every simplification in both directions.** Under the same
   assumptions and checkpoints, find:
   - histories the new model allows and the old one rejects (a weakening)
   - histories the new model rejects and the old one allows (a strengthening)

   Report one of: weakening, strengthening, both, or no difference found within
   the stated scope. Name the scope, such as "sampled, 2,000 histories" or
   "every history up to 6 steps". No difference found in a sample is not
   equivalence. A mapping between the two models is part of what a reviewer
   checks: it must not hide an observation to make the models agree.

   Keep three kinds of change apart:
   - **Refactor:** the allowed behavior stays the same.
   - **Refine:** the model adds a guarantee or narrows what it allows.
   - **Revise:** the contract itself changes. That is a law question for the
     user.

   Do not change the law, a history filter, and an observation in one step.
   Each needs its own comparison.

8. **Offer adjacent forms.** Keep design diversity. From the parts and rules,
   sketch two to four forms that keep every adopted law but differ in a real
   way: another representation, another allowed-set choice, another split of
   laws across oracles, or another production structure that the same oracle
   accepts. Give each form's route, what it keeps, what it changes, and its
   cost. Merge forms that differ only in naming or detail. Do not rank them
   unless asked. When the choice is the user's, present the forms and let the
   user pick.

9. **Optionally check a formal model.** For a consequential claim about state,
   concurrency, retries, or ownership, translate the reduced model into TLA+
   or a similar model checker.
   - Add state only where it changes allowed future behavior. Write derived
     values as definitions.
   - Classify each obligation: a state invariant, a property of transitions or
     histories, or a progress property. Progress needs a stated fairness
     assumption. Do not add fairness only to make a check pass.
   - Mark a property that the transition relation enforces by construction. It
     shows a choice in the model, not a fact about production.
   - Run a passing configuration and a deliberately weakened one that must
     produce the expected counterexample. Without the second run, the check
     has not shown that it can find the failure.
   - Report the exact mode: an exhaustive finite model, a depth-limited run,
     simulation, or an incomplete run. Record the constraints and overrides.

   A passing model check does not show that the model matches production. The
   oracle's histories and checks do that.

**Return:**

- the preservation relation, with its checkpoints, assumptions, and freedoms
- the parts, each with its job and a witness
- the rules with their sources, and the open conflicts
- the reduced model, and the comparison for each simplification
- the adjacent forms, each with what it keeps, changes, and costs
- formal-check results with their mode, when run
- the limits: what the work does not establish

**Control:** keep the known examples and the invalid history fixed while you
simplify. A simplification that rejects an allowed outcome narrows the contract.

**Distortion:**

- forcing elegance: an awkward rule may be earned, so keep it with its witness
- calling a reduced model minimal
- calling two models equivalent because a sample found no difference
- writing production's current behavior into the law
- a mapping that hides an observation

**Stop when:** every part has a job and a witness, every simplification has
its comparison, and each open conflict is with the user.

Adapted from Field Lab's design grammar instrument.
