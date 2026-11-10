/**
 * A completed-history count is output data, not a generated-property budget.
 * The maintainer's 2026-10-28 decision permits the typed OracleReplayWitness
 * record in its shared writer only when every value use serializes that record.
 * AGENTS.md still requires one-run property options with no fixed history to
 * be reported.
 * A type annotation cannot excuse an options alias, escape, mutation or second
 * use. The initializer must be a plain data record with witness fields; custom
 * serialization hooks can receive the record without a binding reference.
 * This boundary owns only that distinction, not all no-disabled syntax.
 *
 * The finite source grammar varies location, annotation, value use, type-only
 * queries, JSON bindings and record spelling. Its intent model knows whether
 * the authored program is exclusively
 * recording a witness; it never parses source or invokes the rule. ESLint's
 * real TypeScript parser and no-disabled rule supply the report observation.
 * The comparison runs after linting and retains every report, including parser
 * errors. There is no random sampling, filesystem fixture or external process.
 * Global JSON.stringify is the supported serializer; its unmodified standard
 * behavior is a trusted premise. Global monkeypatches are outside this law.
 * Other serializers,
 * destructuring and intermodule flow are deliberately outside the allowance.
 *
 * The writer may also pass the record through its guarded write (PR #1's
 * `appendWitness`, which records no witness when the channel cannot be
 * written and never throws): a plain witness literal written as the second
 * argument of a call to `appendWitness` is an observation exactly when that
 * name resolves to a function declaration of the writer module,
 * whose record parameter is typed `OracleReplayWitness` and only serialized.
 * Writer-call programs vary the module, the function's body (serialize, or
 * pass the record to fast-check), the parameter's type, whether a parameter
 * shadows the function's name, and the literal's spelling (maintainer's
 * request of 2026-11-08 to route the finite witness through the guard).
 */
import tsParser from '@typescript-eslint/parser'
import { Linter } from 'eslint'
import { differs, oracleProperty, pass } from '@tanstack/oracles'
import noDisabled from '../src/rules/no-disabled.js'

const writer = '/repo/packages/db/tests/oracle-replay-witness.ts'
const flows = [
  'serialize',
  'budget',
  'both',
  'alias',
  'escape',
  'reassign',
  'shadow-json',
  'read-field',
  'replacer',
  'export',
  'runtime-typeof',
]
const jsonBindings = [
  'builtin',
  'type-alias',
  'interface',
  'import-type',
  'import-type-specifier',
  'ambient-value',
  'outer-value-inner-type',
]
const programs = []
for (const location of ['writer', 'lookalike'])
  for (const annotation of ['witness', 'other', 'none'])
    for (const flow of flows)
      for (const name of ['record', 'serializedProof'])
        for (const typeQuery of ['none', 'direct', 'qualified', 'before'])
          for (const jsonBinding of jsonBindings) {
            // An export inside a function is illegal TypeScript. Other axes
            // remain independent; the grammar never relies on parser recovery.
            if (flow === 'export' && jsonBinding === 'outer-value-inner-type')
              continue
            programs.push({
              location,
              annotation,
              flow,
              name,
              typeQuery,
              jsonBinding,
              initializer: 'plain',
            })
          }
// Custom hooks challenge the otherwise admissible recording programs. Crossing
// them with already rejected uses would hide whether this new guard runs.
for (const program of [...programs])
  if (
    program.location === 'writer' &&
    program.annotation === 'witness' &&
    program.flow === 'serialize' &&
    !['ambient-value', 'outer-value-inner-type'].includes(program.jsonBinding)
  )
    for (const initializer of [
      'spread',
      'method',
      'accessor',
      'prototype',
      'computed',
    ])
      programs.push({ ...program, initializer })

// Writer-call programs: the record passed straight to `appendWitness`.
for (const location of ['writer', 'lookalike'])
  for (const writerBody of ['serialize', 'budget'])
    for (const parameter of ['witness', 'other'])
      for (const callee of ['declared', 'shadowed'])
        for (const initializer of ['plain', 'spread', 'method'])
          programs.push({
            flow: 'append-witness',
            location,
            writerBody,
            parameter,
            callee,
            initializer,
          })

// Only a dedicated recording program emits a count observation. Every other
// authored program has a literal count with no fixed history, whose enforcement must remain.
function expectedReports(program) {
  if (program.flow === 'append-witness')
    return program.location === 'writer' &&
      program.writerBody === 'serialize' &&
      program.parameter === 'witness' &&
      program.callee === 'declared' &&
      program.initializer === 'plain'
      ? []
      : ['singleRun']
  return program.location === 'writer' &&
    program.annotation === 'witness' &&
    program.flow === 'serialize' &&
    program.jsonBinding !== 'ambient-value' &&
    program.jsonBinding !== 'outer-value-inner-type' &&
    program.initializer === 'plain'
    ? []
    : ['singleRun']
}

function writerCallSource(program) {
  const type =
    program.parameter === 'witness' ? 'OracleReplayWitness' : 'OtherRecord'
  const write =
    program.writerBody === 'serialize'
      ? 'appendFileSync(channel, JSON.stringify(witness))'
      : 'fc.assert(property, witness)'
  const custom =
    program.initializer === 'spread'
      ? '...budgetHook, '
      : program.initializer === 'method'
        ? 'toJSON(this: OracleReplayWitness) { fc.assert(property, this); return null }, '
        : ''
  const call = `appendWitness(channel, { ${custom}property, seed, path, numRuns: 1, failed })`
  return [
    'const budgetHook = { toJSON(this: OracleReplayWitness) { fc.assert(property, this); return null } };',
    `function appendWitness(channel: string, witness: ${type}): void {`,
    `  try { ${write} } catch {}`,
    '}',
    // A callback of that name, beside a serialized record parameter, may be
    // any function: it shadows the writer.
    program.callee === 'shadowed'
      ? `function record(appendWitness: (channel: string, witness: OracleReplayWitness) => void, witness: OracleReplayWitness) { appendFileSync(channel, JSON.stringify(witness)); ${call} }`
      : call,
  ].join('\n')
}

function source(program) {
  if (program.flow === 'append-witness') return writerCallSource(program)
  const { name, annotation, flow } = program
  const type =
    annotation === 'none'
      ? ''
      : `: ${annotation === 'witness' ? 'OracleReplayWitness' : 'OtherRecord'}`
  const hook =
    'toJSON(this: OracleReplayWitness) { fc.assert(property, this); return null }'
  const custom =
    program.initializer === 'spread'
      ? '...budgetHook,'
      : program.initializer === 'prototype'
        ? '__proto__: budgetHook,'
        : program.initializer === 'method'
          ? `${hook},`
          : program.initializer === 'accessor'
            ? 'get toJSON() { return function() { fc.assert(property, this); return null } },'
            : program.initializer === 'computed'
              ? '["toJSON"]() { fc.assert(property, this); return null },'
              : ''
  const record = `const budgetHook = { ${hook} };\n${flow === 'export' ? 'export ' : ''}${flow === 'reassign' ? 'let' : 'const'} ${name}${type} = { ${custom} numRuns: 1, failed: false }`
  const serialize = `appendFileSync(channel, JSON.stringify(${name}));`
  const use =
    flow === 'serialize' || flow === 'export'
      ? `${serialize}\n${serialize}`
      : flow === 'budget'
        ? `fc.assert(property, ${name})`
        : flow === 'both'
          ? `${serialize}\nfc.assert(property, ${name})`
          : flow === 'alias'
            ? `const options = ${name}; fc.assert(property, options)`
            : flow === 'escape'
              ? `send(${name})`
              : flow === 'reassign'
                ? `${name} = replacement; ${serialize}`
                : flow === 'shadow-json'
                  ? serialize
                  : flow === 'replacer'
                    ? `JSON.stringify(${name}, (_key, value) => { fc.assert(property, value); return value })`
                    : flow === 'runtime-typeof'
                      ? `${serialize}\ntypeof ${name}`
                      : `${serialize}\nfc.assert(property, { numRuns: ${name}.numRuns })`
  const query =
    program.typeQuery === 'none'
      ? ''
      : `type Snapshot = typeof ${name}${program.typeQuery === 'qualified' ? '.numRuns' : ''};`
  const body = `${record};\n${program.typeQuery === 'before' ? query : ''}\n${use};\n${program.typeQuery === 'before' ? '' : query}`
  const rendered =
    flow === 'shadow-json' ? `function encode(JSON) { ${body} }` : body
  if (program.jsonBinding === 'outer-value-inner-type')
    return `function outer(JSON) { { type JSON = { marker: true }; ${rendered} } }`
  const prefix =
    program.jsonBinding === 'type-alias'
      ? 'type JSON = { marker: true };'
      : program.jsonBinding === 'interface'
        ? 'interface JSON { marker: true };'
        : program.jsonBinding === 'import-type'
          ? 'import type JSON from "types";'
          : program.jsonBinding === 'import-type-specifier'
            ? 'import { type JSON } from "types";'
            : program.jsonBinding === 'ambient-value'
              ? 'declare const JSON: unknown;'
              : ''
  return `${prefix}\n${rendered}`
}

// This driver asks the actual rule for all reports, rather than classifying its
// AST ourselves. Binding spelling must not change the observation.
function reports(program) {
  return new Linter({ cwd: '/repo' })
    .verify(
      source(program),
      [
        {
          files: ['**/*.ts'],
          languageOptions: {
            parser: tsParser,
            parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
          },
          plugins: { oracle: { rules: { 'no-disabled': noDisabled } } },
          rules: { 'oracle/no-disabled': 'error' },
          settings: {
            oracles: {
              envPrefix: 'TANSTACK_DB_ORACLE',
              implementationModules: [
                'packages/db/tests/oracle-config.ts',
                'packages/db/tests/oracle-property.ts',
              ],
              replayWitnessModules: [
                'packages/db/tests/oracle-replay-witness.ts',
              ],
            },
          },
        },
      ],
      {
        filename:
          program.location === 'writer'
            ? writer
            : '/repo/packages/db/tests/witness-output.ts',
      },
    )
    .map((report) => report.messageId ?? `parse:${report.message}`)
}

const LAW = {
  statement: `A replay witness is reported only by the rule's own budget exemption: a finite replay observation is output data, so no-disabled reports each budget that a witness does not write, and nothing else.`,
  authority: `The maintainer decisions of 2026-10-28 and 2026-11-08 on the typed OracleReplayWitness record and its guarded writer, as recorded in this file's header.`,
  limits: `The grammar varies location, annotation, value use, and writer shape; the serializer is the standard JSON.stringify, and the other serializers are outside the allowance. The finite list is exhaustive over its grammar, so it declares no reach states.`,
}

const expectedAndObserved = (observed, expected) =>
  differs(`reports`, `replay observation reports`, observed, expected) ?? pass

// The finite grammar is exhaustive, so each history is one fixed program. Its
// two calibrations, a missing report and a spurious one, feed the same check.
oracleProperty({
  id: `lint.replay-observation`,
  law: LAW,
  histories: programs,
  model: expectedReports,
  driver: (program, observe) => {
    observe(`reports`, reports(program))
  },
  check: (_program, observations, expected) =>
    expectedAndObserved(
      observations.find((o) => o.checkpoint === `reports`).value,
      expected,
    ),
  calibrations: [
    {
      name: `rejects wrong report observation: a missing report`,
      law: `replay observation reports`,
      corrupt: (trace) => {
        const observed = trace.find((o) => o.checkpoint === `reports`)
        if (observed.value.length === 0) return undefined
        return trace.map((o) =>
          o.checkpoint === `reports` ? { ...o, value: o.value.slice(1) } : o,
        )
      },
    },
    {
      name: `rejects wrong report observation: a spurious report`,
      law: `replay observation reports`,
      corrupt: (trace) => {
        const observed = trace.find((o) => o.checkpoint === `reports`)
        if (observed.value.length > 0) return undefined
        return trace.map((o) =>
          o.checkpoint === `reports` ? { ...o, value: [`singleRun`] } : o,
        )
      },
    },
  ],
})
