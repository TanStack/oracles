#!/usr/bin/env bash
# The path sets that gate the heavy jobs of .github/workflows/pr.yml.
#
# The workflow's `changes` job runs this on the base commit of a pull request
# (its base sha) or of a push to main (the push's `before`), and appends the
# output to $GITHUB_OUTPUT. A gated job runs only when its set is true, so a
# change runs the jobs that read its files and skips the rest. The job-to-set
# map is in pr.yml; scripts/classify-changes-check.mjs checks the rules here.
#
#   bash scripts/classify-changes.sh <base> [head]   the files from base to head
#   bash scripts/classify-changes.sh --paths         paths on stdin (for tests)
#
# Output: one `name=true|false` line for each of framework, gaps, and eslint,
# then `all=true|false`. `all` makes every set true.
#
# Fail safe: a path that no arm of `classify` names is `all`, and so is an
# empty change list, and a base that is all zeros (a new branch) or not a commit
# in this clone. When unsure, every job runs.
set -euo pipefail

# Prints the sets a path belongs to, one per line, or `all` when no arm names
# it. A document prints nothing: no job reads it.
classify() {
  case "$1" in
    # Files that can change any job: dependencies, the workflow, the shard
    # partitions, TypeScript configuration, and every other file.
    package.json | */package.json | pnpm-lock.yaml | pnpm-workspace.yaml | tsconfig*.json | */tsconfig*.json | .github/* | packages/oracles/scripts/pr-shards.mjs | packages/oracles/scripts/e2e-shards.mjs)
      echo all ;;
    # The framework files that the gap report's CLI and its end-to-end tests
    # import (oracle-property.ts and the modules it imports) are in both sets.
    packages/oracles/src/oracle-property.ts | packages/oracles/src/oracle-config.ts | packages/oracles/src/oracle-environment.ts | packages/oracles/src/oracle-replay-witness.ts | packages/oracles/src/oracle-route.ts)
      echo framework
      echo gaps ;;
    # The probe-form grammar is the one file of the eslint plugin that the
    # gap report's tests import.
    packages/eslint-plugin-oracles/tests/probe-form-oracle-grammar.js)
      echo eslint
      echo gaps ;;
    packages/eslint-plugin-oracles/*)
      echo eslint ;;
    packages/oracles/oracle-gaps/*)
      echo gaps ;;
    packages/oracles/src/* | packages/oracles/tests/* | packages/oracles/vitest*.config.* | packages/oracles/vite.config.ts | packages/oracles/scripts/windows-witness.mjs)
      echo framework ;;
    # Documents: the READMEs, the docs and skills, and the changesets.
    packages/oracles/docs/* | packages/oracles/skills/* | *.md)
      ;;
    *)
      echo all ;;
  esac
}

# Reads paths on stdin and prints the outputs for them.
outputs() {
  local hits="" path any=0
  while IFS= read -r path; do
    if [ -n "$path" ]; then
      any=1
      hits+="$(classify "$path")"$'\n'
    fi
  done
  if [ "$any" = 0 ]; then hits+=$'all\n'; fi
  local all=false name on
  if grep -qx all <<<"$hits"; then all=true; fi
  for name in framework gaps eslint; do
    on=$all
    if grep -qx "$name" <<<"$hits"; then on=true; fi
    echo "$name=$on"
  done
  echo "all=$all"
}

if [ "${1:-}" = --paths ]; then
  outputs
  exit 0
fi

base="${1:-}"
head="${2:-HEAD}"
if [ -z "$base" ] || [[ "$base" =~ ^0+$ ]] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  # No base to diff against: the classifier sees one unknown path, which runs
  # every set.
  printf '%s\n' '<no base commit>' | outputs
  exit 0
fi
git diff --name-only --no-renames "$base" "$head" | outputs
