---
'@tanstack/oracles': patch
---

`oracle-gaps`: when the run's own process ends on a native crash's signal (SIGABRT, SIGBUS, SIGFPE, SIGILL, SIGSEGV, SIGTRAP, as V8's `Check failed` ends a worker thread), the `done error, the run's process exited with <signal>` line now says it was a native crash, a fault in Node, V8 or a native addon, and names the step that avoids it: under `--pool threads`, where one worker thread's crash ends the whole run, rerun with `--pool forks`, where a crash ends only its worker, or with another Node version; under `--pool forks`, another Node version. A heap out of memory keeps its own step, more memory or fewer `--contexts`. The explore skill's problems list names the crash and its step.
