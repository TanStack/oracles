# What an oracle is

This page is for a developer who asks what an oracle is. An agent running a
first session does not recite it: it shows oracles working on the
developer's own code, and uses this page to answer questions.

Types check that a value has the right shape. An oracle checks that the code
does what it promises, for every input and sequence of calls the promise
covers. It is engineering assurance for software: the way a bridge is
checked against its load rating, not against one truck.

## From a test to an oracle

A unit test records one answer. Give a sort function `[3, 1, 2]`, and check
that it returns `[1, 2, 3]`. You chose the input, and you supplied the
answer.

A property test generalizes the input. A generator makes thousands of
lists, including empty ones, repeated values, and negative numbers. The test
checks one rule for each: the result holds exactly the original elements, in
ascending order. You still write the rule by hand.

An oracle supplies the answer for any input. It is a small, independent
model that computes the expected result the simple way, even when production
uses complicated machinery to compute it fast. For a live query that keeps
the ten highest-priority open tasks up to date, the model keeps the tasks in
a plain `Map`, filters, sorts, and takes ten. The oracle gives the same
generated changes to the model and to the real code, and compares what a
user would see after each one.

An isolated test preserves an answer. An oracle preserves the understanding
that produces the answers.

## What oracles find

Oracles find bugs that example tests miss, because the generator tries the
combinations nobody wrote down. They also find design questions: places
where the docs, the code, and the tests disagree, or behavior that nobody
decided. Writing the oracle forces each decision, and the oracle then holds
it.

With an oracle in place, an agent can replace the machinery behind a promise
(a faster algorithm, less code, a different data structure) while the oracle
checks that the promise still holds.

The gap check then shows what is left: production behavior that no law
judges yet.

## If you know fuzzing or formal models

Like a fuzzer, an oracle generates many inputs. Unlike a fuzzer, it does
not only wait for a crash: it compares every result with what the code
promises. Like a formal model, it states the rules the code must follow.
Unlike a proof, it checks the real code by running it, across the histories
it generates.

For the story of how TanStack DB uses oracles, read
[TanStack DB 1.0 RC1: Going All In on Oracles](https://tanstack.com/blog/tanstack-db-1.0-rc1-going-all-in-on-oracles).
