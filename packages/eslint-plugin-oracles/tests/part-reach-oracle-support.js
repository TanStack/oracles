/**
 * Shared fixtures for the part-reach oracles: the grammar of programs that
 * the oracle file and its companion modules render, the model that predicts the
 * `oracle/no-unit-test` reports from a program, the drivers that lint each
 * program on each receiving path, and the fixed skeletons and on-disk edits
 * that the laws use.
 *
 * Each oracle file imports this module and owns one family of the grammar's
 * features and its declared reach states. The grammar here is the grammar of
 * the original single file, moved unchanged: its laws are stated in the oracle
 * files that use it, and the header of each oracle file names the law it owns.
 *
 * The file's name contains no `oracle`, so the lint rules do not read it as an
 * oracle; it is support for the oracles that do.
 */
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tsParser from '@typescript-eslint/parser'
import { ESLint, Linter } from 'eslint'
import fc from 'fast-check'
import { afterAll, beforeAll } from 'vitest'
import { differs, pass } from '@tanstack/oracles'
import oraclePlugin from '../src/index.js'

export const RULE = `oracle/no-unit-test`
export const ORACLE = `case-oracle.test.ts`
export const PROPERTY = `lint.part-reach`
export const FIXED_SEED = 2234
export const BASE_RUNS = 30
export const repoRoot = fileURLToPath(new URL(`../../../`, import.meta.url))

// -- 1. Grammar ---------------------------------------------------------------
//
// A skeleton is a tree of fast-check values. Each reference index is taken
// modulo the number of names that exist, so every skeleton builds a legal
// program. A reference that has no target is dropped. Feature gates turn a
// family of forms on, so each campaign studies one dimension at a time.

export const SLOTS = 3
export const REFS = 3

// Local references are the most common, because mutual recursion among the
// oracle's functions is the shape that the reach rule must get right.
export const refSkeleton = fc.record({
  kind: fc.oneof(
    { weight: 4, arbitrary: fc.constant(`local`) },
    { weight: 1, arbitrary: fc.constant(`import`) },
    { weight: 1, arbitrary: fc.constant(`type`) },
  ),
  index: fc.nat({ max: 9 }),
})

export const slotSkeleton = fc.record({
  present: fc.boolean(),
  exported: fc.boolean(),
  part: fc.constantFrom(`none`, `none`, `check`, `model`, `grammar`),
  refs: fc.array(refSkeleton, { maxLength: REFS }),
})

// A named import is the common form. A namespace import reads the same export
// through a member, and a default import reads the target's default export.
export const importForm = fc.oneof(
  { weight: 3, arbitrary: fc.constant(`named`) },
  { weight: 1, arbitrary: fc.constant(`namespace`) },
  { weight: 1, arbitrary: fc.constant(`default`) },
)

export const linkSkeleton = fc.record({
  target: fc.nat({ max: 9 }),
  slot: fc.nat({ max: SLOTS - 1 }),
  form: importForm,
})

// A re-export imports one name and exports it under another, drawn from the
// same pool. That lets two modules re-export each other's names: a cycle.
export const reexportSkeleton = fc.record({
  target: fc.nat({ max: 9 }),
  slot: fc.nat({ max: SLOTS - 1 }),
  exportIndex: fc.nat({ max: 99 }),
})

export const moduleSkeleton = fc.record({
  slots: fc.tuple(slotSkeleton, slotSkeleton, slotSkeleton),
  stars: fc.array(fc.nat({ max: 9 }), { maxLength: 2 }),
  reexports: fc.array(reexportSkeleton, { maxLength: 2 }),
  imports: fc.array(linkSkeleton, { maxLength: 3 }),
  typeAliases: fc.tuple(fc.boolean(), fc.boolean(), fc.boolean()),
  typeNames: fc.array(fc.nat({ max: 3 }), { maxLength: 2 }),
  missingPart: fc.boolean(),
  stringKeys: fc.boolean(),
  // The slot that the module exports as its default, if any.
  defaultSlot: fc.option(fc.nat({ max: SLOTS - 1 }), { nil: undefined }),
  // Whether the declaration takes its first part list from a spread object.
  spread: fc.boolean(),
  // Whether a companion is a JavaScript module, which holds no type syntax.
  js: fc.boolean(),
})

export const FORMS = [
  `plain`,
  `identifier`,
  `call`,
  `member`,
  `options-first`,
  `options-last`,
  `each`,
  `for`,
  `helper-plain`,
  `helper-prop`,
  `property`,
  `prop-named`,
  `let-driver`,
  `for-of`,
  `framework-property`,
]

// How a caller-passed-body helper registers the body: as its argument, with a
// trailing timeout after it, or wrapped in a function of the helper's own,
// which may await the body or use a declared part of a companion.
export const WRAPS = [`direct`, `timed`, `wrap`, `wrap-async`, `wrap-part`]

// The form index is taken modulo the forms that the feature set enables, so
// each enabled form gets an equal share of the registrations.
export const registrationSkeleton = fc.record({
  formIndex: fc.nat({ max: FORMS.length - 1 }),
  constantArb: fc.boolean(),
  refs: fc.array(refSkeleton, { maxLength: REFS }),
  callee: fc.nat({ max: 9 }),
  literalOptions: fc.boolean(),
  wrapped: fc.boolean(),
  rows: fc.array(
    fc.oneof(
      fc.record({ fn: fc.array(refSkeleton, { maxLength: REFS }) }),
      fc.record({ value: fc.constant(1) }),
    ),
    { minLength: 1, maxLength: 3 },
  ),
  // A caller-passed-body helper's layout, and what follows a timed body.
  wrap: fc.nat({ max: WRAPS.length - 1 }),
  trailing: fc.constantFrom(`literal`, `name`),
  // A generated property's arbitrary is written inline or bound to a name;
  // its predicate is inline, a local function, or imported, and reads its
  // input or not.
  arbNamed: fc.boolean(),
  predicate: fc.constantFrom(`inline`, `local`, `imported`),
  readsInput: fc.boolean(),
  // The functions that a `for...of` driver runs, one test each.
  elements: fc.array(fc.nat({ max: 9 }), { minLength: 1, maxLength: 2 }),
  // An oracle property's options: a literal with a check and a model, with a
  // check only, with no check, or a const name that the rule cannot read.
  frameworkOptions: fc.constantFrom(`check-model`, `check`, `model`, `name`),
})

export const programSkeleton = fc.record({
  companions: fc.array(moduleSkeleton, { maxLength: 3 }),
  broken: fc.boolean(),
  // An ordinary module, an oracle-named module that is linted on its own, and
  // an `oracle-` machinery module, which the rule does not lint.
  registrarName: fc.constantFrom(`reg.ts`, `reg-oracle.ts`, `oracle-reg.ts`),
  registrarImport: importForm,
  helperName: fc.constantFrom(
    `reg-helper.ts`,
    `reg-helper-oracle.ts`,
    `oracle-reg-helper.ts`,
  ),
  helperImport: fc.constantFrom(`named`, `namespace`),
  // The framework module, and modules that export a function of the same
  // name: another `oracle-` machinery module, an ordinary module, and an
  // oracle-named module, which is linted on its own.
  frameworkName: fc.constantFrom(
    `oracle-property.ts`,
    `oracle-propertyx.ts`,
    `property.ts`,
    `property-oracle.ts`,
  ),
  frameworkImport: fc.constantFrom(`named`, `namespace`),
  oracle: fc.record({
    module: moduleSkeleton,
    objectRefs: fc.array(refSkeleton, { maxLength: REFS }),
    registrarCall: fc.boolean(),
    tests: fc.array(registrationSkeleton, { maxLength: 6 }),
  }),
})

/** The grammar's feature gates. A campaign turns on one family at a time. */
export const BASE = {
  companions: true,
  forms: [`plain`, `identifier`, `each`],
  stars: false,
  broken: false,
  registrar: false,
  stringKeys: false,
  typeModels: false,
  // Off: every import is named, and every helper is a direct `regPlain` in an
  // ordinary module, imported by name.
  importForms: false,
  helperLayouts: false,
  helperNames: false,
  spreads: false,
  jsCompanions: false,
  // Off: every oracle property comes from the framework module, by name.
  frameworkNames: false,
}
export const ALL = {
  companions: true,
  forms: FORMS,
  stars: true,
  broken: true,
  registrar: true,
  stringKeys: true,
  typeModels: true,
  importForms: true,
  helperLayouts: true,
  helperNames: true,
  spreads: true,
  jsCompanions: true,
  frameworkNames: true,
}

/** A module that the lint selection lints as an oracle file. */
/** The base grammar with `forms` added, and `more` overriding any feature. */
export const withForms = (forms, more = {}) => ({
  ...BASE,
  forms: [...BASE.forms, ...forms],
  ...more,
})

export const lintedOnItsOwn = (file) =>
  file.includes(`oracle`) && !file.startsWith(`oracle-`)

/** The framework module, whose `oracleProperty` calls are oracle properties. */
export const isFrameworkModule = (file) =>
  file !== undefined && file.replace(/\.(ts|js)$/, ``) === `oracle-property`

export function programArbitrary(features) {
  return programSkeleton.map((skeleton) => buildProgram(skeleton, features))
}

// -- Program: the builder ----------------------------------------------------

export const stemOf = (file) => file.replace(/\.(ts|js)$/, ``)
export const specOf = (file) => `./${stemOf(file)}.js`
export const nodeKey = (file, name) => `${file}\0${name}`

/**
 * A program, as the model and the drivers read it:
 *   modules: Map file -> module (see buildModule)
 *   oracle: the file that the rule lints
 *   tests: the oracle's registrations, in source order
 *   calls: the calls that the oracle makes to imported helpers
 */
export function buildProgram(skeleton, features) {
  // A single-file program has no companion, so its recursion is only the
  // oracle's own functions.
  const companions = features.companions ? skeleton.companions : []
  const companionFiles = companions.map(
    (companion, index) =>
      `c${index}.${features.jsCompanions && companion.js ? `js` : `ts`}`,
  )
  const brokenFile =
    features.broken && skeleton.broken ? `broken.ts` : undefined
  const registrarFile =
    features.registrar && skeleton.oracle.registrarCall
      ? skeleton.registrarName
      : undefined
  const modules = new Map()
  // An acyclic program lets a companion import only from earlier companions, so
  // no export cycle can form.
  const targetsOf = (self) => [
    ...companionFiles.filter((file) =>
      features.acyclic ? file < self : file !== self,
    ),
    ...(brokenFile ? [brokenFile] : []),
  ]
  const oracleTargets = [...companionFiles, ...(brokenFile ? [brokenFile] : [])]
  // The names that a re-export may export under: every companion slot.
  const pool = companionFiles.flatMap((file) =>
    [0, 1, 2].map((index) => slotName(file, index)),
  )

  companions.forEach((companion, index) => {
    const file = companionFiles[index]
    modules.set(
      file,
      buildModule({
        file,
        role: `companion`,
        skeleton: companion,
        targets: targetsOf(file),
        pool,
        features,
        extras: [],
      }),
    )
  })
  if (brokenFile !== undefined) {
    modules.set(brokenFile, {
      file: brokenFile,
      role: `broken`,
      bindings: new Map(),
      exportEntries: [],
      stars: [],
      imports: new Map(),
      types: new Set(),
      typeNames: [],
      parts: new Map(),
      missing: [],
      declares: false,
      stringKeys: false,
    })
  }
  const emptyModule = (file, role, fields = {}) => ({
    file,
    role,
    bindings: new Map(),
    exportEntries: [],
    stars: [],
    imports: new Map(),
    types: new Set(),
    typeNames: [],
    parts: new Map(),
    missing: [],
    declares: false,
    stringKeys: false,
    spread: false,
    ...fields,
  })
  if (registrarFile !== undefined) {
    modules.set(
      registrarFile,
      emptyModule(registrarFile, `registrar`, {
        bindings: new Map([
          [`regAll`, { kind: `fn`, refs: [], exported: true }],
        ]),
        exportEntries: [
          { name: `regAll`, local: `regAll` },
          { name: `default`, local: `regAll` },
        ],
      }),
    )
  }
  const registrarImport = features.importForms
    ? skeleton.registrarImport
    : `named`
  const oracleSkeleton = skeleton.oracle
  const oracle = buildModule({
    file: ORACLE,
    role: `oracle`,
    skeleton: oracleSkeleton.module,
    targets: oracleTargets,
    pool,
    features,
    // The helpers that registrations use: `oobj` holds a method body, `oopt`
    // is a non-function options value, and `owrap` is a callee that reaches
    // nothing. Their references resolve like any other binding's.
    extras: [
      { name: `oobj`, kind: `obj`, refs: oracleSkeleton.objectRefs },
      { name: `oopt`, kind: `opt`, refs: [] },
      { name: `owrap`, kind: `fn`, refs: [] },
    ],
    registrarFile,
    registrarImport,
  })
  modules.set(ORACLE, oracle)
  const helperFile = features.helperNames
    ? skeleton.helperName
    : `reg-helper.ts`
  const context = {
    oracle,
    features,
    companionFiles,
    helperFile,
  }
  const tests = oracleSkeleton.tests.map((test, index) =>
    buildRegistration(test, index, context),
  )
  const isRegistrarAlias = (alias) =>
    registrarFile !== undefined &&
    oracle.imports.get(alias)?.from === registrarFile
  const calls = []
  if (registrarFile !== undefined) {
    calls.push({ alias: `regAll`, file: registrarFile })
  }
  // An imported helper that registers the body its caller passes. The oracle
  // file imports it by name or through a namespace.
  if (tests.some((test) => test.helper !== undefined)) {
    const form = features.importForms ? skeleton.helperImport : `named`
    for (const name of HELPER_EXPORTS) {
      oracle.imports.set(name, { from: helperFile, imported: name, form })
    }
    // `regWrapPart`'s wrapper uses the first companion's first function.
    const helperImports = new Map()
    if (companionFiles.length > 0) {
      helperImports.set(`hpart`, {
        from: companionFiles[0],
        imported: slotName(companionFiles[0], 0),
        form: `named`,
      })
    }
    modules.set(
      helperFile,
      emptyModule(helperFile, `helper`, {
        imports: helperImports,
        bindings: new Map([
          [
            `hpart-wrapper`,
            {
              kind: `fn`,
              refs: helperImports.has(`hpart`)
                ? [{ kind: `import`, alias: `hpart` }]
                : [],
            },
          ],
        ]),
      }),
    )
  }
  // The module that exports `oracleProperty`: the framework, or a lookalike.
  let frameworkFile
  if (tests.some((test) => test.framework !== undefined)) {
    frameworkFile = features.frameworkNames
      ? skeleton.frameworkName
      : `oracle-property.ts`
    const form = features.importForms ? skeleton.frameworkImport : `named`
    oracle.imports.set(`oracleProperty`, {
      from: frameworkFile,
      imported: `oracleProperty`,
      form,
    })
    modules.set(frameworkFile, emptyModule(frameworkFile, `framework`))
  }
  // The module that exports the imported predicates, which read their input
  // or ignore it.
  if (tests.some((test) => test.property?.predicate === `imported`)) {
    oracle.imports.set(`predReads`, {
      from: `pred.ts`,
      imported: `predReads`,
      form: `named`,
    })
    oracle.imports.set(`predIgnores`, {
      from: `pred.ts`,
      imported: `predIgnores`,
      form: `named`,
    })
    modules.set(`pred.ts`, emptyModule(`pred.ts`, `pred`))
  }
  for (const test of tests) {
    const { body } = test
    if (
      body.kind === `call` &&
      body.callee.kind === `import` &&
      isRegistrarAlias(body.callee.alias)
    ) {
      calls.push({
        alias: body.callee.alias,
        file: registrarFile,
        test: test.title,
      })
    }
  }
  return { oracle: ORACLE, modules, tests, calls, helperFile, frameworkFile }
}

// The helper module's exports, in the order HELPER_TEXT defines them.
export const HELPER_EXPORTS = [
  `regPlain`,
  `regTimed`,
  `regWrap`,
  `regWrapAsync`,
  `regWrapPart`,
  `regProp`,
]
export const HELPER_OF_WRAP = {
  direct: `regPlain`,
  timed: `regTimed`,
  wrap: `regWrap`,
  'wrap-async': `regWrapAsync`,
  'wrap-part': `regWrapPart`,
}

/** The prefix of a module's own function names: `ofn` in an oracle, `c0f` in c0. */
export function prefixOf(file, role) {
  return role === `oracle` ? `ofn` : `${stemOf(file)}f`
}

/** The name that slot `index` of `file` exports, or the broken module's name. */
export function slotName(file, index) {
  return file.startsWith(`broken`) ? `brokenFn` : `${stemOf(file)}f${index}`
}

export function buildModule({
  file,
  role,
  skeleton,
  targets,
  pool,
  features,
  extras,
  registrarFile,
  registrarImport = `named`,
}) {
  const prefix = prefixOf(file, role)
  const pick = (index) =>
    targets.length === 0 ? undefined : targets[index % targets.length]
  const bindings = new Map()
  const exportEntries = []
  const imports = new Map()
  skeleton.slots.forEach((slot, index) => {
    if (!slot.present) return
    const name = `${prefix}${index}`
    bindings.set(name, {
      kind: `fn`,
      refs: [],
      exported: slot.exported,
      skeleton: slot.refs,
      part: slot.part,
    })
    if (slot.exported) exportEntries.push({ name, local: name })
  })
  // A default export names one of the module's own functions.
  if (
    features.importForms &&
    skeleton.defaultSlot !== undefined &&
    bindings.has(`${prefix}${skeleton.defaultSlot}`)
  ) {
    exportEntries.push({
      name: `default`,
      local: `${prefix}${skeleton.defaultSlot}`,
    })
  }
  for (const extra of extras) {
    bindings.set(extra.name, {
      kind: extra.kind,
      refs: [],
      exported: false,
      skeleton: extra.refs,
      part: `none`,
    })
  }
  if (registrarFile !== undefined) {
    // A default import reads the registrar's default export, which is regAll.
    imports.set(`regAll`, {
      from: registrarFile,
      imported: registrarImport === `default` ? `default` : `regAll`,
      form: registrarImport,
    })
  }
  const stars = features.stars
    ? skeleton.stars.map(pick).filter((from) => from !== undefined)
    : []
  for (const link of skeleton.reexports) {
    const from =
      targets.length === 0 ? undefined : targets[link.target % targets.length]
    if (from === undefined || pool.length === 0) continue
    const name = pool[link.exportIndex % pool.length]
    // An export name is unique within a module, so a re-export that repeats
    // one is dropped, as a duplicate export is a syntax error.
    if (exportEntries.some((entry) => entry.name === name)) continue
    exportEntries.push({ name, from, imported: slotName(from, link.slot) })
  }
  skeleton.imports.forEach((link, index) => {
    const from =
      targets.length === 0 ? undefined : targets[link.target % targets.length]
    if (from === undefined) return
    const form = features.importForms ? link.form : `named`
    imports.set(`i${index}`, {
      from,
      imported: form === `default` ? `default` : slotName(from, link.slot),
      form,
    })
  })

  // References resolve only after every name exists, so a helper such as
  // `owrap` is a legal target from the oracle's own functions.
  // Local references name the module's functions. Helpers such as `oobj`
  // are reached through registration forms, so they do not dilute recursion.
  const helpers = new Set(extras.map((extra) => extra.name))
  const names = [...bindings.keys()].filter((name) => !helpers.has(name))
  const aliases = [...imports.keys()]
  const resolve = (ref) => resolveRef(ref, names, aliases)
  const javascript = file.endsWith(`.js`)
  for (const binding of bindings.values()) {
    binding.refs = binding.skeleton
      .map(resolve)
      .filter(
        (ref) => ref !== undefined && !(javascript && ref.kind === `type`),
      )
    delete binding.skeleton
  }

  const types = new Set(
    [`T0`, `T1`, `T2`].filter(
      (_, index) => !javascript && skeleton.typeAliases[index],
    ),
  )
  const typeNames =
    !javascript && features.typeModels
      ? [
          ...new Set(
            skeleton.typeNames.map((index) =>
              index === 3 ? `TX` : `T${index}`,
            ),
          ),
        ]
      : []
  const parts = new Map()
  for (const [name, binding] of bindings) {
    if (binding.part !== undefined && binding.part !== `none`) {
      parts.set(name, binding.part)
    }
  }
  const missing = skeleton.missingPart ? [`ghostPart`] : []
  return {
    file,
    role,
    bindings,
    exportEntries,
    stars,
    imports,
    types,
    typeNames,
    parts,
    missing,
    declares: parts.size > 0 || typeNames.length > 0 || missing.length > 0,
    stringKeys: features.stringKeys && skeleton.stringKeys,
    spread: features.spreads && skeleton.spread,
  }
}

export function resolveRef(ref, names, aliases) {
  if (ref.kind === `local`) {
    return names.length === 0
      ? undefined
      : { kind: `local`, name: names[ref.index % names.length] }
  }
  if (ref.kind === `import`) {
    return aliases.length === 0
      ? undefined
      : { kind: `import`, alias: aliases[ref.index % aliases.length] }
  }
  return { kind: `type`, name: `T${ref.index % 3}` }
}

/**
 * One registration in the oracle file. A form outside the active feature set
 * falls back to a plain registration, so a gated form never appears by
 * accident.
 */
export function buildRegistration(skeleton, index, context) {
  const { oracle, features, companionFiles } = context
  const title = `t${index}`
  const names = [...oracle.bindings.keys()]
  const aliases = [...oracle.imports.keys()]
  const resolve = (ref) => resolveRef(ref, names, aliases)
  const functionNames = names.filter(
    (name) => name.startsWith(`ofn`) && oracle.bindings.get(name).kind === `fn`,
  )
  // A fixed input names its form. A generated skeleton takes the form at its index.
  const requested =
    skeleton.form ?? features.forms[skeleton.formIndex % features.forms.length]
  let form = features.forms.includes(requested) ? requested : `plain`
  if (
    (form === `identifier` || form === `for-of`) &&
    functionNames.length === 0
  ) {
    form = `plain`
  }
  const refs = skeleton.refs.map(resolve).filter((ref) => ref !== undefined)
  const test = { title, form, wrapped: skeleton.wrapped, refs }
  const pickFunction = (value) => functionNames[value % functionNames.length]
  if (form === `helper-plain` || form === `helper-prop`) {
    // A layout that needs a companion falls back to a plain wrapper.
    let wrap = features.helperLayouts
      ? WRAPS[(skeleton.wrap ?? 0) % WRAPS.length]
      : `direct`
    if (wrap === `wrap-part` && companionFiles.length === 0) wrap = `wrap`
    const trailing =
      skeleton.trailing === `name` && functionNames.length > 0
        ? { kind: `name`, name: pickFunction(skeleton.callee) }
        : { kind: `literal` }
    test.helper = {
      prop: form === `helper-prop`,
      constant: skeleton.constantArb,
      arbNamed: form === `helper-prop` && (skeleton.arbNamed ?? false),
      // A property helper registers its body directly, as serializerProp does.
      wrap: form === `helper-prop` ? `direct` : wrap,
      trailing,
      // A plain helper's body ignores its input unless the test is a property.
      readsInput: form === `helper-prop` ? (skeleton.readsInput ?? true) : true,
    }
    test.body = { kind: `arrow`, refs }
  } else if (form === `property` || form === `prop-named`) {
    test.property = {
      constant: skeleton.constantArb,
      arbNamed: skeleton.arbNamed ?? false,
      predicate: skeleton.predicate ?? `inline`,
      readsInput: skeleton.readsInput ?? true,
    }
    test.body = { kind: `arrow`, refs: [] }
  } else if (form === `framework-property`) {
    test.framework = { options: skeleton.frameworkOptions ?? `check-model` }
    test.body = { kind: `arrow`, refs: [] }
  } else if (form === `let-driver`) {
    test.driver = { kind: `let`, refs }
    test.body = { kind: `arrow`, refs: [] }
  } else if (form === `for-of`) {
    test.driver = {
      kind: `for-of`,
      elements: (skeleton.elements ?? [0]).map(pickFunction),
    }
    test.body = { kind: `arrow`, refs: [] }
  } else if (form === `identifier`) {
    test.body = {
      kind: `ident`,
      name: functionNames[skeleton.callee % functionNames.length],
    }
  } else if (form === `call`) {
    const callee =
      aliases.length > 0 && skeleton.callee % 2 === 1
        ? { kind: `import`, alias: aliases[skeleton.callee % aliases.length] }
        : { kind: `local`, name: `owrap` }
    test.body = { kind: `call`, callee, refs }
  } else if (form === `member`) {
    test.body = { kind: `member`, object: `oobj` }
  } else if (form === `options-first` || form === `options-last`) {
    test.body = { kind: `arrow`, refs }
    test.options = {
      at: form === `options-first` ? `first` : `last`,
      literal: skeleton.literalOptions,
    }
  } else if (form === `each` || form === `for`) {
    test.table = {
      kind: form,
      rows: skeleton.rows.map((row) =>
        row.fn === undefined
          ? { value: 1 }
          : { fn: row.fn.map(resolve).filter((ref) => ref !== undefined) },
      ),
    }
    test.body = { kind: `arrow`, refs: [] }
  } else {
    test.body = { kind: `arrow`, refs }
  }
  return test
}

// -- 2. Model -----------------------------------------------------------------
//
// The model predicts the reports from the program's structure, without the
// rule's code. It reads the program as data: each binding's references, each
// module's exports and stars, and each registration's body and table. A
// binding reaches a part when it is declared, or when one of its references
// reaches one; the reach relation is the least fixed point of that equation,
// found by iterating until no binding changes. A name that a module exports
// resolves through its named re-exports and its star exports, and a visited
// set ends a cycle of exports. A type reference reaches a part only when its
// name is a declared type model with an alias in the same file.
//
// A namespace import names an export through a member, so it resolves like a
// named import. A default import resolves the target's own `default` entry:
// `export *` does not carry a default (ECMAScript), so stars are not followed.
//
// A registration's test reaches a part in one of these ways:
// - Its body, or a function in its `.each` or `.for` table, uses one.
// - It registers through a helper that passes on its caller's body. The
//   test is the argument at the body's position, so a trailing timeout or a
//   trailing name says nothing. A wrapper that the helper writes around the
//   body reaches when the wrapper uses a part itself.
// - It runs a generated property: some arbitrary is not `fc.constant`, under
//   any name, and the predicate reads its input, wherever it is defined.
// - It runs a `let` driver, which reaches when the value assigned to it does.
// - It runs inside a `for...of` loop, which registers one test per element,
//   so every element must reach (rubric: every test uses a declared part).
//
// - It is an oracle property: a call to `oracleProperty` from the framework
//   module whose options are a literal with a `check`. The property is its
//   own declaration, so the call reaches by construction.
//
// The predicted report list follows the rule's contract. Each unreached
// registration is a unit test. A file with no declared part and no reaching
// registration gets one `undeclared` report, on its first unreached test. Each
// declared type-model name without an alias is reported. Each call to a helper
// that registers its own tests is reported, unless the helper's module is
// linted on its own: an oracle-named module, but not an `oracle-` machinery
// module, which no lint reads (rubric "Name oracle files consistently"). A
// helper that passes on its caller's body from a module linted on its own is
// judged there, so its calls are not judged in the oracle file.

/** The reports that the rule should give for a program, as sorted keys. */
export function predictReports(program) {
  const oracle = program.modules.get(program.oracle)
  const importNodes = new Map()
  // An explicit export of a name shadows the star exports, as in ES. Star
  // exports are followed only when the module has no explicit export of it.
  const exportNodes = (file, name, seen = new Set()) => {
    if (seen.has(nodeKey(file, name))) return []
    seen.add(nodeKey(file, name))
    const module = program.modules.get(file)
    if (module === undefined) return []
    const entry = module.exportEntries.find(
      (candidate) => candidate.name === name,
    )
    if (entry !== undefined) {
      if (entry.local === undefined) {
        return exportNodes(entry.from, entry.imported, seen)
      }
      return module.bindings.has(entry.local)
        ? [nodeKey(file, entry.local)]
        : []
    }
    if (name === `default`) return []
    return module.stars.flatMap((star) => exportNodes(star, name, seen))
  }
  for (const [file, module] of program.modules) {
    for (const [alias, link] of module.imports) {
      importNodes.set(
        nodeKey(file, alias),
        exportNodes(link.from, link.imported),
      )
    }
  }

  const reached = new Set()
  for (const [file, module] of program.modules) {
    for (const name of module.parts.keys()) reached.add(nodeKey(file, name))
  }
  const isModel = (module, name) =>
    module.typeNames.includes(name) && module.types.has(name)
  const refReaches = (file, module, ref) => {
    if (ref.kind === `local`) return reached.has(nodeKey(file, ref.name))
    if (ref.kind === `import`) {
      return (importNodes.get(nodeKey(file, ref.alias)) ?? []).some((node) =>
        reached.has(node),
      )
    }
    return isModel(module, ref.name)
  }
  for (let changed = true; changed;) {
    changed = false
    for (const [file, module] of program.modules) {
      for (const [name, binding] of module.bindings) {
        const id = nodeKey(file, name)
        if (reached.has(id)) continue
        if (binding.refs.some((ref) => refReaches(file, module, ref))) {
          reached.add(id)
          changed = true
        }
      }
    }
  }

  const refOfOracle = (ref) => refReaches(program.oracle, oracle, ref)
  const functionReaches = (name) => reached.has(nodeKey(program.oracle, name))
  const reachesPart = (test) => {
    const { helper, property, driver } = test
    if (helper !== undefined) {
      // A generated property: a non-constant arbitrary, and a body that reads its value.
      if (helper.prop && !helper.constant && helper.readsInput) return true
      const wrapperReaches =
        helper.wrap === `wrap-part` &&
        reached.has(nodeKey(program.helperFile, `hpart-wrapper`))
      return wrapperReaches || test.body.refs.some(refOfOracle)
    }
    if (property !== undefined) return !property.constant && property.readsInput
    if (driver?.kind === `let`) return driver.refs.some(refOfOracle)
    if (driver?.kind === `for-of`) return driver.elements.every(functionReaches)
    const { body } = test
    const bodyReaches =
      body.kind === `arrow`
        ? body.refs.some(refOfOracle)
        : body.kind === `ident`
          ? reached.has(nodeKey(program.oracle, body.name))
          : body.kind === `call`
            ? refOfOracle(body.callee) || body.refs.some(refOfOracle)
            : reached.has(nodeKey(program.oracle, body.object))
    const tableReaches =
      test.table !== undefined &&
      test.table.rows.some(
        (row) => row.fn !== undefined && row.fn.some(refOfOracle),
      )
    return bodyReaches || tableReaches
  }
  // Oracle-property calls are judged by their own rule, below.
  const judged = program.tests.filter(
    (test) =>
      test.framework === undefined &&
      (test.helper === undefined || !lintedOnItsOwn(program.helperFile)),
  )
  const frameworkTests = program.tests.filter(
    (test) => test.framework !== undefined,
  )
  const fromFramework = isFrameworkModule(program.frameworkFile)
  const hasCheck = (test) =>
    [`check-model`, `check`].includes(test.framework.options)
  const unreached = judged
    .filter((test) => !reachesPart(test))
    .map((test) => test.title)
  const anyReached =
    unreached.length < judged.length ||
    (fromFramework && frameworkTests.some(hasCheck))
  const declaresParts = oracle.parts.size > 0 || oracle.typeNames.length > 0

  const keys = []
  if (!declaresParts && !anyReached) {
    if (unreached.length > 0) keys.push(`undeclared:${unreached[0]}`)
  } else {
    for (const title of unreached) keys.push(`unit:${title}`)
  }
  for (const name of oracle.typeNames) {
    if (!oracle.types.has(name)) keys.push(`typeModel:${name}`)
  }
  for (const call of program.calls) {
    if (!lintedOnItsOwn(call.file)) keys.push(`imported:${call.alias}`)
  }
  for (const test of frameworkTests) {
    if (fromFramework) {
      if (!hasCheck(test)) keys.push(`incomplete:${test.title}`)
    } else if (!lintedOnItsOwn(program.frameworkFile)) {
      // A lookalike registers its own test, as any imported helper does.
      keys.push(`imported:oracleProperty`)
    }
  }
  return keys.sort()
}

// -- 3. Drivers ---------------------------------------------------------------
//
// A driver renders a program to files, lints the oracle file, and turns each
// report into a key. A key names its subject (the test title, the type-model
// name, or the helper), so the comparison does not depend on line numbers.
// The renderer records the line of each subject, and a report's line finds it.

export const REGISTRAR_TEXT = `import { it } from 'vitest'\nexport function regAll() { it('reg inner', () => { void 0 }) }\nexport default regAll\n`
export const BROKEN_TEXT = `export function brokenFn() {\n`
// The framework's and each lookalike's `oracleProperty` registers a test of its
// own, as the real framework does.
export const FRAMEWORK_TEXT = `import { it } from 'vitest'\nexport function oracleProperty(options) {\n  it(options.id, () => {\n    void options\n  })\n}\n`
export const PRED_TEXT = `export function predReads(value) {\n  void value\n}\nexport function predIgnores(value) {\n  void 0\n}\n`

/**
 * Helpers that register the body their caller passes: directly, before a
 * timeout, wrapped in a function, awaited in an async wrapper, beside a use of
 * a companion's function, and as a curried fast-check property, as
 * serializerProp does. Their order is HELPER_EXPORTS.
 */
export function helperText(module) {
  const lines = [
    `import { it } from 'vitest'`,
    `import { test as fcTest } from '@fast-check/vitest'`,
  ]
  for (const [alias, link] of module.imports) {
    lines.push(
      `import { ${link.imported} as ${alias} } from '${specOf(link.from)}'`,
    )
  }
  lines.push(
    `export function regPlain(name, body) { it(name, body) }`,
    `export function regTimed(name, body, timeout) { it(name, body, timeout) }`,
    `export function regWrap(name, body) { it(name, () => { body() }) }`,
    `export function regWrapAsync(name, body) { it(name, async () => { await body() }) }`,
    `export function regWrapPart(name, body) { it(name, () => { void hpart; body() }) }`,
    `export function regProp(arbitraries) {`,
    `  return (name, check) => { fcTest.prop(arbitraries)(name, check) }`,
    `}`,
  )
  return `${lines.join(`\n`)}\n`
}

/** The text that uses an imported alias: a namespace import reads a member. */
export function useText(module, alias) {
  const link = module.imports.get(alias)
  return link?.form === `namespace` ? `${alias}.${link.imported}` : alias
}

export function importText(alias, link) {
  const from = specOf(link.from)
  if (link.form === `namespace`) return `import * as ${alias} from '${from}'`
  if (link.form === `default`) return `import ${alias} from '${from}'`
  return `import { ${link.imported} as ${alias} } from '${from}'`
}

/** The files for a program, and the subject that each line of the oracle names. */
export function renderProgram(program) {
  const files = new Map()
  let subjects = new Map()
  for (const [file, module] of program.modules) {
    if (module.role === `broken`) {
      files.set(file, BROKEN_TEXT)
    } else if (module.role === `registrar`) {
      files.set(file, REGISTRAR_TEXT)
    } else if (module.role === `helper`) {
      files.set(file, helperText(module))
    } else if (module.role === `pred`) {
      files.set(file, PRED_TEXT)
    } else if (module.role === `framework`) {
      files.set(file, FRAMEWORK_TEXT)
    } else {
      const rendered = renderModule(module, program)
      files.set(file, rendered.text)
      if (file === program.oracle) subjects = rendered.subjects
    }
  }
  return { files, subjects }
}

export function renderModule(module, program) {
  const lines = []
  const subjects = new Map()
  // A text may span several lines, so a subject names the line where its text starts.
  const push = (text, subject) => {
    const start = lines.length + 1
    lines.push(...text.split(`\n`))
    if (subject !== undefined) subjects.set(start, subject)
  }
  const use = (alias) => useText(module, alias)
  if (module.declares) {
    push(`import { declareOracle } from './oracle-declaration.js'`)
  }
  if (module.role === `oracle`) {
    if (
      program.tests.some(
        (test) => test.property !== undefined || test.helper?.prop,
      )
    ) {
      push(`import fc from 'fast-check'`)
    }
    if (program.tests.some((test) => test.form === `prop-named`)) {
      push(`import { test as fcTest } from '@fast-check/vitest'`)
    }
  }
  for (const [alias, link] of module.imports) push(importText(alias, link))
  for (const name of module.types) push(`type ${name}<X> = X`)
  for (const [name, binding] of module.bindings) {
    if (binding.kind === `obj`) {
      push(`const ${name} = {`)
      push(`  m: () => {`)
      for (const statement of statementsOf(binding.refs, use))
        push(`    ${statement}`)
      push(`  },`)
      push(`}`)
    } else if (binding.kind === `opt`) {
      push(`const ${name} = { timeout: 1000 }`)
    } else {
      const exported = module.exportEntries.some(
        (entry) => entry.local === name && entry.name !== `default`,
      )
      push(`${exported ? `export ` : ``}function ${name}() {`)
      for (const statement of statementsOf(binding.refs, use))
        push(`  ${statement}`)
      push(`}`)
    }
  }
  for (const entry of module.exportEntries) {
    if (entry.from !== undefined) {
      push(
        `export { ${entry.imported} as ${entry.name} } from '${specOf(entry.from)}'`,
      )
    } else if (entry.name === `default`) {
      push(`export default ${entry.local}`)
    }
  }
  for (const star of module.stars) push(`export * from '${specOf(star)}'`)
  if (module.role === `oracle`) {
    if (module.declares) renderDeclaration(module, push)
    // A call inside a registration is rendered with that registration.
    for (const call of program.calls.filter(
      (entry) => entry.test === undefined,
    )) {
      push(`${use(call.alias)}()`, { id: call.alias })
    }
    for (const test of program.tests) {
      renderTest(test, push, use)
    }
  } else if (module.declares) {
    renderDeclaration(module, push)
  }
  return { text: `${lines.join(`\n`)}\n`, subjects }
}

/**
 * Each declared part is a list; each type-model name gets its own line. A
 * module with `spread` writes its first part list in a const object that the
 * declaration spreads.
 */
export function renderDeclaration(module, push) {
  const partKey = (part) => (module.stringKeys ? `'${part}'` : part)
  const lists = []
  for (const part of [`check`, `model`, `grammar`]) {
    const names = [...module.parts]
      .filter(([, kind]) => kind === part)
      .map(([name]) => name)
    if (part === `check`) names.push(...module.missing)
    if (names.length > 0) lists.push(`${partKey(part)}: [${names.join(`, `)}]`)
  }
  const spread = module.spread && lists.length > 0 ? lists.shift() : undefined
  if (spread !== undefined) push(`const sharedParts = { ${spread} }`)
  push(`declareOracle({`)
  if (spread !== undefined) push(`  ...sharedParts,`)
  for (const list of lists) push(`  ${list},`)
  if (module.typeNames.length > 0) {
    push(`  ${partKey(`typeModel`)}: [`)
    for (const name of module.typeNames) {
      push(`    '${name}',`, { id: name })
    }
    push(`  ],`)
  }
  push(`})`)
}

export function statementsOf(refs, use = (alias) => alias) {
  return refs.map((ref, index) => {
    if (ref.kind === `type`) return `type _t${index} = ${ref.name}<number>`
    return `void ${ref.kind === `local` ? ref.name : use(ref.alias)}`
  })
}

export function arrowText(refs, use) {
  return `() => {\n    expect(1).toBe(1)\n    ${statementsOf(refs, use).join(`\n    `)}\n  }`
}

/** Renders one registration. The first line carries its subject. */
// The helper that a registration calls, which names an importedRegistration report.
export function callHelper(test) {
  return test.body.kind === `call` && test.body.callee.kind === `import`
    ? test.body.callee.alias
    : undefined
}

export function renderTest(test, push, use) {
  // The bindings that one registration uses are written just before it.
  const arbitrary = (constant) => (constant ? `fc.constant(1)` : `fc.integer()`)
  const named = test.property ?? (test.helper?.prop ? test.helper : undefined)
  if (named?.arbNamed) {
    push(`const arb${test.title} = ${arbitrary(named.constant)}`)
  }
  if (test.property?.predicate === `local`) {
    push(`function pred${test.title}(value) {`)
    push(`  expect(1).toBe(1)`)
    push(test.property.readsInput ? `  void value` : `  void 0`)
    push(`}`)
  }
  if (test.framework?.options === `name`) {
    push(
      `const opts${test.title} = { id: '${test.title}', check: () => {\n  void 0\n} }`,
    )
  }
  if (test.driver?.kind === `let`) {
    push(`let drv${test.title}`)
    push(`beforeAll(() => {`)
    push(`  drv${test.title} = {`)
    push(`    run: () => {`)
    for (const statement of statementsOf(test.driver.refs, use))
      push(`      ${statement}`)
    push(`    },`)
    push(`  }`)
    push(`})`)
  }
  if (test.wrapped) push(`describe('d${test.title}', () => {`)
  const text = registrationText(test, use)
  text.forEach((line, offset) => {
    push(
      line,
      offset === 0
        ? {
            id: test.title,
            helper:
              test.framework !== undefined
                ? `oracleProperty`
                : callHelper(test),
          }
        : undefined,
    )
  })
  if (test.wrapped) push(`})`)
}

export function registrationText(test, use) {
  const { body, title } = test
  if (test.helper !== undefined) {
    const { helper } = test
    const arbitrary = helper.arbNamed
      ? `arb${title}`
      : helper.constant
        ? `fc.constant(1)`
        : `fc.integer()`
    const head = helper.prop
      ? `${use(`regProp`)}([${arbitrary}])`
      : use(HELPER_OF_WRAP[helper.wrap])
    const trailing =
      helper.wrap !== `timed`
        ? ``
        : helper.trailing.kind === `name`
          ? `, ${helper.trailing.name}`
          : `, 1000`
    return [
      `${head}('${title}', (value) => {`,
      `    expect(1).toBe(1)`,
      helper.readsInput ? `    void value` : `    void 0`,
      `    ${statementsOf(body.refs, use).join(`\n    `)}`,
      `  }${trailing})`,
    ]
  }
  if (test.property !== undefined) {
    const { property } = test
    const arbitrary = property.arbNamed
      ? `arb${title}`
      : property.constant
        ? `fc.constant(1)`
        : `fc.integer()`
    const predicate =
      property.predicate === `local`
        ? `pred${title}`
        : property.predicate === `imported`
          ? property.readsInput
            ? `predReads`
            : `predIgnores`
          : `(value) => {\n    expect(1).toBe(1)\n    ${property.readsInput ? `void value` : `void 0`}\n  }`
    if (test.form === `prop-named`) {
      return [`fcTest.prop([${arbitrary}])('${title}', ${predicate})`]
    }
    return [
      `it('${title}', () => {`,
      `    fc.assert(fc.property(${arbitrary}, ${predicate}))`,
      `  })`,
    ]
  }
  if (test.framework !== undefined) {
    const call = use(`oracleProperty`)
    if (test.framework.options === `name`) return [`${call}(opts${title})`]
    const fields = [`id: '${title}'`]
    if (test.framework.options !== `model`)
      fields.push(`check: () => {\n    void 0\n  }`)
    if (test.framework.options !== `check`)
      fields.push(`model: () => {\n    void 0\n  }`)
    return [`${call}({ ${fields.join(`, `)} })`]
  }
  if (test.driver?.kind === `let`) {
    return [`it('${title}', () => {`, `    drv${title}.run()`, `  })`]
  }
  if (test.driver?.kind === `for-of`) {
    // The loop and its registration share a line, so the report's line
    // names this test.
    return [
      `for (const drive${title} of [${test.driver.elements.join(`, `)}]) it('${title}', () => {`,
      `    drive${title}()`,
      `  })`,
    ]
  }
  if (test.table !== undefined) {
    const rows = test.table.rows.map((row) =>
      row.fn === undefined
        ? `[1]`
        : `[() => {\n    ${statementsOf(row.fn, use).join(`\n    `)}\n  }]`,
    )
    const runner = test.table.kind === `each` ? `it.each` : `it.for`
    return [
      `${runner}([${rows.join(`, `)}])('${title} %s', () => {`,
      `    expect(1).toBe(1)`,
      `  })`,
    ]
  }
  if (body.kind === `ident`) return [`it('${title}', ${body.name})`]
  if (body.kind === `member`) return [`it('${title}', ${body.object}.m)`]
  if (body.kind === `call`) {
    const callee =
      body.callee.kind === `local` ? body.callee.name : use(body.callee.alias)
    return [`it('${title}', ${callee}(${arrowText(body.refs, use)}))`]
  }
  if (test.options !== undefined) {
    const options = test.options.literal ? `{ timeout: 5000 }` : `oopt`
    return test.options.at === `first`
      ? [`it('${title}', ${options}, ${arrowText(body.refs, use)})`]
      : [`it('${title}', ${arrowText(body.refs, use)}, ${options})`]
  }
  return [`it('${title}', ${arrowText(body.refs, use)})`]
}
/**
 * The keys of a message list. Every message that is not a report of this rule
 * is a key too, so a configuration or parse failure cannot pass as no reports.
 */
export function keysOf(messages, subjects) {
  // The fixtures are deliberately raw campaigns in oracle-named files, so
  // oracle/oracle-property-only reports them. That rule has its own oracle
  // (oracle-property-only-oracle.property.test.js); this law judges no-unit-test.
  return messages
    .filter((message) => message.ruleId !== `oracle/oracle-property-only`)
    .map((message) => keyOf(message, subjects))
    .sort()
}

export function keyOf(message, subjects) {
  if (message.ruleId !== RULE) {
    return `other:${message.ruleId ?? `fatal`}@${message.line}:${message.message}`
  }
  const subject = subjects.get(message.line)
  const id = message.messageId
  if (subject === undefined) return `unmatched:${id}@${message.line}`
  if (id === `unitTest`) return `unit:${subject.id}`
  if (id === `undeclared`) return `undeclared:${subject.id}`
  if (id === `unknownTypeModel`) return `typeModel:${subject.id}`
  if (id === `importedRegistration`)
    return `imported:${subject.helper ?? subject.id}`
  if (id === `incompleteProperty`) return `incomplete:${subject.id}`
  return `other:${id}@${message.line}`
}

// Without `files`, flat config applies only to the default .js patterns.
export const linterConfig = [
  {
    files: [`**/*.ts`],
    languageOptions: { parser: tsParser, sourceType: `module` },
    plugins: { oracle: oraclePlugin },
    rules: { [RULE]: `error` },
  },
]
// -- Receiving paths ------------------------------------------------------------

export let root
export let eslint
export let linter
export let scratch
export let historySeq = 0

/** Creates the long-lived ESLint instance and the scratch directories. Call from beforeAll. */
export function setupReceivingPaths() {
  root = mkdtempSync(join(tmpdir(), `part-reach-oracle-`))
  writeFileSync(join(root, `package.json`), JSON.stringify({ name: `scratch` }))
  // The long-lived path: one ESLint instance, configured as the CLI configures it.
  eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      { ignores: [`**/dist/**`] },
      { files: [`**/*.ts`, `**/*.tsx`], languageOptions: { parser: tsParser } },
      { linterOptions: { noInlineConfig: true } },
      oraclePlugin.configs.recommended,
    ],
  })
  linter = new Linter({ configType: `flat`, cwd: repoRoot })
  // The CLI reads only files inside its repository.
  scratch = mkdtempSync(join(repoRoot, `part-reach-scratch-`))
}

/** Removes the scratch directories. Call from afterAll. */
export function teardownReceivingPaths() {
  rmSync(root, { recursive: true, force: true })
  rmSync(scratch, { recursive: true, force: true })
}

/** Registers the receiving paths' setup and teardown for this test file. */
export function usePartReachPaths() {
  beforeAll(setupReceivingPaths)
  afterAll(teardownReceivingPaths)
}

/** A fresh sequence number for a history's directory. */
export function nextSeq() {
  return historySeq++
}

/** A scratch directory that one edit history writes into. */
export function editDirectory(seq) {
  return join(root, `edit${seq}`)
}

/** A chain directory under the scratch root for a fixed history. */
export function chainDirectory(seq) {
  return join(root, `chain${seq}`)
}

/** The root directory of the receiving paths, which tests write under. */
export function workspaceRoot() {
  return root
}

/** Writes a program's files into `directory`; returns the oracle's path, text, and subjects. */
export function writeProgram(directory, program) {
  mkdirSync(directory, { recursive: true })
  const { files, subjects } = renderProgram(program)
  for (const [file, text] of files) writeFileSync(join(directory, file), text)
  return {
    oracle: join(directory, program.oracle),
    text: files.get(program.oracle),
    subjects,
  }
}

/** Path 1: a long-lived ESLint instance, linting a new directory each time. */
export async function lintWithEslint(program) {
  const { oracle, subjects } = writeProgram(
    join(root, `h${historySeq++}`),
    program,
  )
  const results = await eslint.lintFiles([oracle])
  return keysOf(
    results.flatMap((result) => result.messages),
    subjects,
  )
}

/**
 * Path 2: one single-file Linter call, as a RuleTester caller makes it. Flat
 * config matches a file only inside the working directory, so the program is
 * written inside the worktree.
 */
export function lintWithLinter(program) {
  const { oracle, text, subjects } = writeProgram(
    join(scratch, `l${historySeq++}`),
    program,
  )
  return keysOf(
    linter.verify(text, linterConfig, { filename: oracle }),
    subjects,
  )
}

/**
 * The declared states that a program enters, read from its structure. A
 * state is the grammar's own witness, not the model's prediction.
 */
export function statesOf(program) {
  const states = new Set()
  const starCycle = (file, edges) => {
    const stack = [...edges(file)]
    const seen = new Set()
    while (stack.length > 0) {
      const next = stack.pop()
      if (next === file) return true
      if (seen.has(next)) continue
      seen.add(next)
      stack.push(...edges(next))
    }
    return false
  }
  const starEdges = (file) => program.modules.get(file)?.stars ?? []
  const namedEdges = (file) =>
    (program.modules.get(file)?.exportEntries ?? [])
      .filter((entry) => entry.from !== undefined)
      .map((entry) => entry.from)
  for (const [file, module] of program.modules) {
    if (module.role === `companion` || module.role === `oracle`) {
      if (starCycle(file, starEdges)) states.add(`export-star-cycle`)
      if (starCycle(file, namedEdges)) states.add(`named-reexport-cycle`)
    }
    if (module.role === `broken`) states.add(`unparseable-companion`)
    if (module.declares && module.stringKeys)
      states.add(`string-keyed-declaration`)
    if (module.typeNames.some((name) => module.types.has(name))) {
      states.add(`type-model-declaration`)
    }
    for (const [name, binding] of module.bindings) {
      if (binding.kind !== `fn`) continue
      const cyclic = localCycle(module, name)
      if (cyclic) {
        states.add(
          localReachesPart(module, name)
            ? `mutual-recursion-reaches-part`
            : `mutual-recursion-reaches-no-part`,
        )
      }
    }
  }
  for (const test of program.tests) {
    if (test.table?.kind === `each`) states.add(`form-each`)
    if (test.table?.kind === `for`) states.add(`form-for`)
    if (test.body.kind === `call`) states.add(`form-call-body`)
    if (test.body.kind === `member`) states.add(`form-member-body`)
    if (test.options !== undefined) states.add(`form-options`)
  }
  if (program.calls.some((call) => !lintedOnItsOwn(call.file))) {
    states.add(`imported-registration`)
  }
  if (program.tests.some((test) => test.helper !== undefined)) {
    states.add(`caller-passed-body-helper`)
  }
  const oracle = program.modules.get(program.oracle)
  for (const [, module] of program.modules) {
    for (const [, link] of module.imports) {
      if (link.form === `namespace`) states.add(`namespace-import`)
      if (link.form !== `default`) continue
      states.add(`default-import`)
      const target = program.modules.get(link.from)
      if (
        target !== undefined &&
        target.stars.length > 0 &&
        !target.exportEntries.some((entry) => entry.name === `default`)
      ) {
        states.add(`default-import-through-star`)
        const starDefaultIsPart = target.stars.some((star) => {
          const starModule = program.modules.get(star)
          const entry = starModule?.exportEntries.find(
            (candidate) => candidate.name === `default`,
          )
          return entry !== undefined && starModule.parts.has(entry.local)
        })
        if (starDefaultIsPart) states.add(`default-import-star-target-has-part`)
      }
    }
    if (module.spread && module.declares) states.add(`declaration-spread`)
    if (module.role === `oracle`) {
      for (const test of program.tests) {
        for (const ref of test.refs) {
          const link = ref.kind === `import` && module.imports.get(ref.alias)
          if (
            link &&
            link.from.endsWith(`.js`) &&
            program.modules.get(link.from)?.parts.has(link.imported)
          ) {
            states.add(`javascript-companion-import-reaches-part`)
          }
        }
      }
    }
  }
  for (const call of program.calls) {
    const link = oracle.imports.get(call.alias)
    if (link?.form === `namespace`) states.add(`member-callee-registration`)
    if (link?.form === `default`) states.add(`default-import-registration`)
    if (call.file.startsWith(`oracle-`)) states.add(`prefixed-oracle-registrar`)
  }
  const companion = program.modules.get(`c0.ts`)
  for (const test of program.tests) {
    const { helper, property, driver } = test
    if (helper !== undefined) {
      if (program.helperFile.startsWith(`oracle-`))
        states.add(`prefixed-oracle-helper`)
      else if (lintedOnItsOwn(program.helperFile))
        states.add(`oracle-named-helper`)
      if (helper.wrap === `timed` && helper.trailing.kind === `name`)
        states.add(`caller-body-trailing-name`)
      if ([`wrap`, `wrap-async`, `wrap-part`].includes(helper.wrap))
        states.add(`caller-body-wrapper`)
      if (helper.wrap === `wrap-part` && companion?.parts.has(`c0f0`))
        states.add(`caller-body-wrapper-reaches-part`)
    }
    const arbitrary = property ?? (helper?.prop ? helper : undefined)
    if (arbitrary?.arbNamed && arbitrary.constant)
      states.add(`named-constant-arbitrary`)
    if (property?.predicate === `imported`) states.add(`imported-predicate`)
    if (arbitrary !== undefined && !arbitrary.constant && !arbitrary.readsInput)
      states.add(`predicate-ignores-input`)
    if (driver?.kind === `let`) states.add(`let-assigned-driver`)
    if (driver?.kind === `for-of`) {
      states.add(`for-of-driver`)
      const reaching = driver.elements.map((name) =>
        localReachesPart(oracle, name),
      )
      if (reaching.includes(true) && reaching.includes(false))
        states.add(`for-of-mixed-elements`)
    }
  }
  const frameworkTests = program.tests.filter(
    (test) => test.framework !== undefined,
  )
  if (frameworkTests.length > 0) {
    const file = program.frameworkFile
    if (isFrameworkModule(file)) {
      for (const test of frameworkTests) {
        const { options } = test.framework
        if (options === `name`) states.add(`oracle-property-named-options`)
        else if (options === `model`)
          states.add(`oracle-property-without-check`)
        else states.add(`oracle-property-complete`)
      }
    } else if (file.startsWith(`oracle-`)) {
      states.add(`oracle-property-machinery-lookalike`)
    } else if (lintedOnItsOwn(file)) {
      states.add(`oracle-property-oracle-named-lookalike`)
    } else states.add(`oracle-property-ordinary-lookalike`)
    if (oracle.imports.get(`oracleProperty`)?.form === `namespace`)
      states.add(`oracle-property-namespace-import`)
  }
  if (dependencyOfReached(program) !== undefined)
    states.add(`companion-edited-between-lints`)
  return states
}

/** Whether a binding reaches itself through at least one other binding. */
export function localCycle(module, name) {
  const stack = module.bindings
    .get(name)
    .refs.filter((ref) => ref.kind === `local`)
    .map((ref) => ref.name)
  const seen = new Set()
  while (stack.length > 0) {
    const next = stack.pop()
    if (next === name) return true
    if (seen.has(next)) continue
    seen.add(next)
    const binding = module.bindings.get(next)
    if (binding === undefined) continue
    for (const ref of binding.refs)
      if (ref.kind === `local`) stack.push(ref.name)
  }
  return false
}

/** Whether a binding's local references lead to a declared part. */
export function localReachesPart(module, name) {
  const stack = [name]
  const seen = new Set()
  while (stack.length > 0) {
    const next = stack.pop()
    if (module.parts.has(next)) return true
    if (seen.has(next)) continue
    seen.add(next)
    const binding = module.bindings.get(next)
    if (binding === undefined) continue
    for (const ref of binding.refs)
      if (ref.kind === `local`) stack.push(ref.name)
  }
  return false
}

/**
 * A companion that a binding reached by the oracle depends on through an import
 * in its body. The rule caches a binding's reach in the module that declares
 * it, so editing the companion leaves that cache stale unless the rule
 * recomputes it. Re-exports are not cached and so cannot show this.
 */
export function dependencyOfReached(program) {
  const oracle = program.modules.get(program.oracle)
  for (const test of program.tests) {
    for (const ref of test.refs ?? []) {
      if (ref.kind !== `import`) continue
      const link = oracle.imports.get(ref.alias)
      const middle = program.modules.get(link?.from)
      const binding = middle?.bindings.get(link.imported)
      for (const inner of binding?.refs ?? []) {
        if (inner.kind !== `import`) continue
        const module = program.modules.get(
          middle.imports.get(inner.alias)?.from,
        )
        if (module?.role === `companion` && module.bindings.size > 0)
          return module
      }
    }
  }
  return undefined
}

/** Adds or removes a declared check in one companion, as an edit would. */
export function toggleDeclaration(program, file) {
  const module = program.modules.get(file)
  const parts = new Map(module.parts)
  if (parts.size > 0) {
    parts.clear()
  } else {
    parts.set([...module.bindings.keys()][0], `check`)
  }
  const edited = {
    ...module,
    parts,
    declares:
      parts.size > 0 ||
      module.typeNames.length > 0 ||
      module.missing.length > 0,
  }
  return { ...program, modules: new Map(program.modules).set(file, edited) }
}

/** Rewrites one companion in place, with an mtime after the last write. */
export function rewriteCompanion(directory, program, file) {
  const { files } = renderProgram(program)
  const path = join(directory, file)
  writeFileSync(path, files.get(file))
  const later = new Date(Date.now() + 5000)
  utimesSync(path, later, later)
}

// -- Fixed inputs --------------------------------------------------------------
//
// These skeletons are fixed inputs for the reviewer's repros. They go through
// the same builder, model, and paths as the generated programs, with the full
// feature set, and carry no expected answers of their own.

export const slot = (
  present,
  refs = [],
  { exported = false, part = `none` } = {},
) => ({
  present,
  exported,
  part,
  refs,
})
export const moduleOf = (fields = {}) => ({
  slots: [slot(false), slot(false), slot(false)],
  stars: [],
  reexports: [],
  imports: [],
  typeAliases: [false, false, false],
  typeNames: [],
  missingPart: false,
  stringKeys: false,
  defaultSlot: undefined,
  spread: false,
  js: false,
  ...fields,
})
export const reg = (fields) => ({
  form: `plain`,
  refs: [],
  callee: 0,
  literalOptions: false,
  wrapped: false,
  rows: [{ value: 1 }],
  wrap: 0,
  trailing: `literal`,
  constantArb: false,
  arbNamed: false,
  predicate: `inline`,
  readsInput: true,
  elements: [0],
  ...fields,
})
export const local = (index) => ({ kind: `local`, index })
export const imported = (index) => ({ kind: `import`, index })
export const typeRef = (index) => ({ kind: `type`, index })
export const fixed = (fields) => ({
  companions: [],
  broken: false,
  registrarName: `reg.ts`,
  registrarImport: `named`,
  helperName: `reg-helper.ts`,
  helperImport: `named`,
  oracle: {
    module: moduleOf({
      slots: [slot(false), slot(false), slot(true, [], { part: `check` })],
    }),
    objectRefs: [],
    registrarCall: false,
    tests: [],
  },
  ...fields,
})

// Two companions that star-export each other, and that re-export the same
// name from each other: a star cycle and a named re-export cycle. The oracle
// imports a name that neither exports, so its registration reaches nothing.
export const exportCycle = fixed({
  companions: [
    moduleOf({
      stars: [0],
      reexports: [{ target: 0, slot: 0, exportIndex: 3 }],
    }),
    moduleOf({
      stars: [0],
      reexports: [{ target: 0, slot: 0, exportIndex: 3 }],
    }),
  ],
  oracle: {
    module: moduleOf({
      slots: [slot(false), slot(false), slot(true, [], { part: `check` })],
      imports: [{ target: 0, slot: 0 }],
    }),
    objectRefs: [],
    registrarCall: false,
    tests: [reg({ refs: [imported(0)] })],
  },
})

// Two companions that re-export each other's names, and no star export: a
// named re-export cycle. c0 exports c0f0 from c1, and c1 exports c1f0 from c0.
export const namedCycle = fixed({
  companions: [
    moduleOf({ reexports: [{ target: 0, slot: 0, exportIndex: 0 }] }),
    moduleOf({ reexports: [{ target: 0, slot: 0, exportIndex: 3 }] }),
  ],
  oracle: {
    module: moduleOf({
      slots: [slot(false), slot(false), slot(true, [], { part: `check` })],
      imports: [{ target: 0, slot: 0 }],
    }),
    objectRefs: [],
    registrarCall: false,
    tests: [reg({ refs: [imported(0)] })],
  },
})

// Two functions that call each other, and reach the check through only one
// of them. Each registration names one function. Both orders must agree.
export const mutualRecursion = fixed({
  oracle: {
    module: moduleOf({
      slots: [
        slot(true, [local(1), local(2)]),
        slot(true, [local(0)]),
        slot(true, [], { part: `check` }),
      ],
    }),
    objectRefs: [],
    registrarCall: false,
    tests: [
      reg({ form: `identifier`, callee: 0 }),
      reg({ form: `identifier`, callee: 1 }),
    ],
  },
})

// Each registration form, with one that reaches the check and one that does not.
export const forms = fixed({
  oracle: {
    module: moduleOf({
      slots: [slot(false), slot(false), slot(true, [], { part: `check` })],
    }),
    objectRefs: [],
    registrarCall: false,
    tests: [
      reg({ form: `call`, refs: [local(0)] }),
      reg({ form: `member` }),
      reg({ form: `for`, rows: [{ value: 1 }] }),
      reg({ form: `options-first`, refs: [local(0)], literalOptions: true }),
      reg({ form: `options-last`, literalOptions: false }),
      reg({ form: `for`, rows: [{ fn: [local(0)] }] }),
    ],
  },
})

// An unparseable companion, a string-keyed type model, and a registration
// helper from an ordinary module.
export const helpers = fixed({
  broken: true,
  companions: [moduleOf({})],
  registrarName: `reg.ts`,
  oracle: {
    module: moduleOf({
      slots: [slot(false), slot(false), slot(true, [], { part: `check` })],
      imports: [{ target: 1, slot: 0 }],
      typeAliases: [true, false, false],
      typeNames: [0],
      stringKeys: true,
    }),
    objectRefs: [],
    registrarCall: true,
    tests: [reg({ refs: [imported(0)] }), reg({ refs: [typeRef(0)] })],
  },
})

// The second review's repros. The oracle's only function is the check `ofn2`.
export const checkOnly = moduleOf({
  slots: [slot(false), slot(false), slot(true, [], { part: `check` })],
})
export const WRAP = Object.fromEntries(
  WRAPS.map((wrap, index) => [wrap, index]),
)

// A body before a trailing timeout: the body reaches through `ofn2`, and the
// trailing argument is a literal. A unit body before a trailing `ofn2`.
export const trailingArguments = fixed({
  oracle: {
    module: checkOnly,
    objectRefs: [],
    registrarCall: false,
    tests: [
      reg({ form: `helper-plain`, wrap: WRAP.timed, refs: [local(0)] }),
      reg({ form: `helper-plain`, wrap: WRAP.timed, trailing: `name` }),
    ],
  },
})

// A helper that awaits its caller's body inside its own async wrapper, a
// wrapper around a unit body, and a wrapper that uses the companion's check.
export const wrappedBody = fixed({
  companions: [
    moduleOf({
      slots: [
        slot(true, [], { exported: true, part: `check` }),
        slot(false),
        slot(false),
      ],
    }),
  ],
  oracle: {
    module: checkOnly,
    objectRefs: [],
    registrarCall: false,
    tests: [
      reg({ form: `helper-plain`, wrap: WRAP[`wrap-async`], refs: [local(0)] }),
      reg({ form: `helper-plain`, wrap: WRAP.wrap }),
      reg({ form: `helper-plain`, wrap: WRAP[`wrap-part`] }),
    ],
  },
})

// A registrar in an `oracle-` module through a namespace member call, and a
// caller-passed-body helper in an `oracle-` module with a unit body.
export const machineryHelpers = fixed({
  registrarName: `oracle-reg.ts`,
  registrarImport: `namespace`,
  helperName: `oracle-reg-helper.ts`,
  oracle: {
    module: checkOnly,
    objectRefs: [],
    registrarCall: true,
    tests: [reg({ form: `helper-plain` })],
  },
})

// A registrar through a default import.
export const defaultRegistrar = fixed({
  registrarImport: `default`,
  oracle: {
    module: checkOnly,
    objectRefs: [],
    registrarCall: true,
    tests: [reg({ refs: [local(0)] })],
  },
})

// Drivers: a `let` that a hook assigns, a `for...of` over the check, and a
// namespace import of a companion's exported check.
export const drivers = fixed({
  companions: [
    moduleOf({
      slots: [
        slot(true, [], { exported: true, part: `check` }),
        slot(false),
        slot(false),
      ],
    }),
  ],
  oracle: {
    module: moduleOf({
      slots: [slot(false), slot(false), slot(true, [], { part: `check` })],
      imports: [{ target: 0, slot: 0, form: `namespace` }],
    }),
    objectRefs: [],
    registrarCall: false,
    tests: [
      reg({ form: `let-driver`, refs: [local(0)] }),
      reg({ form: `for-of`, elements: [0] }),
      reg({ refs: [imported(0)] }),
    ],
  },
})

// A declaration that spreads its first part list, and generated properties:
// a named constant arbitrary, and an imported predicate that reads or
// ignores its input, through `fc.property` and through `.prop`.
export const declarationsAndProperties = fixed({
  oracle: {
    module: moduleOf({
      slots: [
        slot(true, [], { part: `model` }),
        slot(false),
        slot(true, [], { part: `check` }),
      ],
      spread: true,
    }),
    objectRefs: [],
    registrarCall: false,
    tests: [
      reg({ refs: [local(0)] }),
      reg({ form: `property`, constantArb: true, arbNamed: true }),
      reg({ form: `prop-named`, predicate: `imported` }),
      reg({ form: `property`, predicate: `imported`, readsInput: false }),
    ],
  },
})

// A default import of c0, which has no default of its own and star-exports
// c1, whose default is a check. `export *` carries no default, so the test
// reaches nothing.
export const defaultThroughStar = fixed({
  companions: [
    moduleOf({ stars: [0] }),
    moduleOf({
      slots: [slot(true, [], { part: `check` }), slot(false), slot(false)],
      defaultSlot: 0,
    }),
  ],
  oracle: {
    module: moduleOf({ imports: [{ target: 0, slot: 0, form: `default` }] }),
    objectRefs: [],
    registrarCall: false,
    tests: [reg({ refs: [imported(0)] })],
  },
})

// An oracle file whose only test imports the check from a JavaScript companion.
export const javascriptCompanion = fixed({
  companions: [
    moduleOf({
      slots: [
        slot(true, [], { exported: true, part: `check` }),
        slot(false),
        slot(false),
      ],
      js: true,
    }),
  ],
  oracle: {
    module: moduleOf({ imports: [{ target: 0, slot: 0, form: `named` }] }),
    objectRefs: [],
    registrarCall: false,
    tests: [reg({ refs: [imported(0)] })],
  },
})

// A dependency chain. The oracle imports `c1f0`, which imports the check
// `c0f0`. Editing `c0` between two lints must change the oracle's reports,
// although `c1` is unchanged: its reach was computed by the earlier lint.
export const chain = fixed({
  companions: [
    moduleOf({
      slots: [
        slot(true, [], { exported: true, part: `check` }),
        slot(false),
        slot(false),
      ],
    }),
    moduleOf({
      slots: [
        slot(true, [imported(0)], { exported: true }),
        slot(false),
        slot(false),
      ],
      imports: [{ target: 0, slot: 0 }],
    }),
  ],
  oracle: {
    module: moduleOf({ imports: [{ target: 1, slot: 0 }] }),
    objectRefs: [],
    registrarCall: false,
    tests: [reg({ refs: [imported(0)] })],
  },
})

/** Lints one file on the long-lived instance; returns its keys. */
export async function lintInstance(file, subjects) {
  const results = await eslint.lintFiles([file])
  return keysOf(
    results.flatMap((result) => result.messages),
    subjects,
  )
}

// -- Oracle properties: the shared parts -------------------------------------
//
// Each oracle file declares its properties from these parts. The history is a
// skeleton (the fast-check value that `programSkeleton` generates), so it
// shrinks like any generated value. Its plan is the program that its features
// build from it, which the model and the drivers read.

/** The law that every receiving path's reports must satisfy. */
export const REPORTS_LAW = `part-reach reports`

/** The authority and limits that every part-reach oracle file states. */
export const PART_REACH_AUTHORITY = `The header contract of rules/no-unit-test.js (reach and report rules, laws L1, L2, L3, L6, and the oracle-property paragraph of maintainer decision 2026-11-02); docs/contributing/oracle-rubric.md, "Name oracle files consistently"; AGENTS.md, "Name Oracle Files for Discovery".`

/** A stable 32-bit hash of a value's JSON text, which seeds a construction. */
function seedOf(value) {
  const text = String(JSON.stringify(value))
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * A constructed history for `state` under `features`. It is rejection sampling
 * from the grammar: fast-check draws skeletons from a seed derived from the
 * generated history, and the first one whose program enters `state` is the
 * construction. The generated history supplies the seed, so the randomness
 * before and after the state stays the generated history's. If the features
 * cannot enter the state within the budget, the construction throws, and the
 * property fails rather than claim a reach it did not reach.
 */
export function constructedFor(features, state, budget = 3000) {
  return (generated) => {
    const seed = seedOf(generated)
    for (const skeleton of fc.sample(programSkeleton, {
      seed,
      numRuns: budget,
    })) {
      if (statesOf(buildProgram(skeleton, features)).has(state)) return skeleton
    }
    throw new Error(
      `no skeleton under these features enters "${state}" within ${budget} samples`,
    )
  }
}

/** The check: every receiving path's keys equal the model's, exactly. */
export function checkPaths(_plan, observations, expected) {
  const verdicts = observations.map((observation) =>
    differs(observation.checkpoint, REPORTS_LAW, observation.value, expected),
  )
  return verdicts.find((verdict) => verdict !== undefined) ?? pass
}

/** The two receiving paths of the oracle file, each observed as its keys. */
export async function lintDriver(plan, observe) {
  observe(`eslint`, await lintWithEslint(plan))
  observe(`linter`, lintWithLinter(plan))
}

/** Applies a change to the first observation it affects, or none applies. */
function corruptFirst(trace, change) {
  const index = trace.findIndex(
    (observation) => change(observation.value) !== undefined,
  )
  if (index < 0) return undefined
  return trace.map((observation, at) =>
    at === index
      ? { ...observation, value: change(observation.value) }
      : observation,
  )
}

/** Wrong answers that the check must reject (ORC-006). */
export const reportCalibrations = [
  {
    name: `a report dropped from a receiving path`,
    law: REPORTS_LAW,
    corrupt: (trace) =>
      corruptFirst(trace, (keys) =>
        keys.length > 0 ? keys.slice(1) : undefined,
      ),
  },
  {
    name: `a spurious report on a receiving path`,
    law: REPORTS_LAW,
    corrupt: (trace) =>
      corruptFirst(trace, (keys) => [...keys, `other:spurious@0:wrong`]),
  },
]

/**
 * The options of one feature family's oracle property: the generated skeletons,
 * the states this property gates (each with a constructed history under its
 * features), and every other state as measured. A state outside both would
 * fail, so the declared lists are the whole grammar's states.
 */
export function familyOptions({
  id,
  statement,
  features,
  gated = [],
  runs = BASE_RUNS,
  fixedSeeds = [FIXED_SEED],
}) {
  return {
    id,
    law: {
      statement,
      authority: PART_REACH_AUTHORITY,
      limits: `The grammar generates the features that \`features\` enables; the reach of each gated state is a constructed history under those features.`,
      owner: `eslint-plugin-oracles lint rules`,
    },
    histories: {
      arbitrary: programSkeleton,
      runs,
      fixedSeeds,
      states: gated,
      measured: STATE_NAMES.filter((state) => !gated.includes(state)),
      constructed: gated.map((state) => ({
        name: state,
        enters: [state],
        build: constructedFor(features, state),
      })),
    },
    resolve: (skeleton) => buildProgram(skeleton, features),
    reached: (program) => [...statesOf(program)],
    model: predictReports,
    driver: lintDriver,
    check: checkPaths,
    calibrations: reportCalibrations,
  }
}

/** The 42 declared states of the grammar, in the order of the original file. */
export const STATE_NAMES = [
  `export-star-cycle`,
  `named-reexport-cycle`,
  `mutual-recursion-reaches-part`,
  `mutual-recursion-reaches-no-part`,
  `form-each`,
  `form-for`,
  `form-call-body`,
  `form-member-body`,
  `form-options`,
  `string-keyed-declaration`,
  `type-model-declaration`,
  `unparseable-companion`,
  `imported-registration`,
  `caller-passed-body-helper`,
  `companion-edited-between-lints`,
  `namespace-import`,
  `default-import`,
  `default-import-through-star`,
  `default-import-star-target-has-part`,
  `oracle-property-ordinary-lookalike`,
  `oracle-property-oracle-named-lookalike`,
  `default-import-registration`,
  `member-callee-registration`,
  `prefixed-oracle-registrar`,
  `prefixed-oracle-helper`,
  `oracle-named-helper`,
  `caller-body-trailing-name`,
  `caller-body-wrapper`,
  `caller-body-wrapper-reaches-part`,
  `let-assigned-driver`,
  `for-of-driver`,
  `for-of-mixed-elements`,
  `declaration-spread`,
  `javascript-companion-import-reaches-part`,
  `named-constant-arbitrary`,
  `imported-predicate`,
  `predicate-ignores-input`,
  `oracle-property-complete`,
  `oracle-property-without-check`,
  `oracle-property-named-options`,
  `oracle-property-namespace-import`,
  `oracle-property-machinery-lookalike`,
]
