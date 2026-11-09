// Mutant switching: compile every mutant of a source file into one copy.
//
// Each mutation site becomes a call into `globalThis.__oracleGaps`, which the
// test setup defines. The call evaluates the original expression unless its
// mutant is the active one, and it records that the current test reached the
// site. One instrumented copy therefore serves every mutant run: switching
// mutants changes a number, not the source, and nothing is written to disk.
//
// Operators, in the order the sites are numbered:
// - `binary-swap`: `===`↔`!==`, `<`↔`<=`, `>`↔`>=`, `&&`↔`||`, `??`→`&&`.
// - `drop-not`: `!x` → `x`.
// - `bool-flip`: a boolean literal `true` ↔ `false` (not a literal type).
// - `arithmetic-swap`: `+` ↔ `-` where one operand is a numeric literal
//   (so `count + 1`, not string concatenation of two values).
// - `field-drop`: a property of an object literal is left out, and its value
//   is not evaluated. Not a spread, method, or accessor, not `__proto__`,
//   and not a destructuring pattern.
// - `value-undefined`: a call whose value is used → `undefined`, and the
//   call does not run. Not a call statement (`delete-call`), and not a
//   callee or the object of a property or element access, where
//   `undefined` would only throw.
// - `if-true` / `if-false`: force an `if` condition.
// - `loop-false`: force the condition of a `for`, `while`, or `do` loop to
//   `false` (a `for` with no condition, `for...of`, and `for...in` have none).
// - `delete-call`: skip a call statement (`switch || call()`).
//
// In a Svelte module (`.svelte.ts` or `.svelte.js`), a rune call that Svelte
// allows in one place only (`$state`, `$derived`, `$effect`, `$props`,
// `$bindable`, `$inspect`, and their `.raw`, `.by`, `.pre`, `.id`, and
// `.trace` forms) is no site for `value-undefined` or `delete-call`: either
// would move the rune out of its place, and the module would no longer
// compile (`state_invalid_placement`). The code in its arguments is mutated
// as usual. Elsewhere a `$` name is an ordinary name.
//
// Comparisons and `!` go through helpers that evaluate each operand once.
// `&&`, `||`, and `??` must keep short-circuiting, so both variants are
// written out and the switch picks one. Every replacement starts with an
// identifier, so it cannot join the previous line under automatic semicolon
// insertion.
const G = `globalThis.__oracleGaps`

const comparisons = new Map([
  [`===`, `!==`],
  [`!==`, `===`],
  [`<`, `<=`],
  [`<=`, `<`],
  [`>`, `>=`],
  [`>=`, `>`],
])
const logical = new Map([
  [`&&`, `||`],
  [`||`, `&&`],
  [`??`, `&&`],
])

// A mutant's anchor is the innermost statement that holds its site, as its
// tokens joined by single spaces, so formatting does not move it.
function anchorOf(ts, file, node) {
  let statement = node
  while (
    statement.parent &&
    !(
      statement.kind >= ts.SyntaxKind.FirstStatement &&
      statement.kind <= ts.SyntaxKind.LastStatement
    )
  )
    statement = statement.parent
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    statement.getText(file),
  )
  const tokens = []
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    // The scanner splits `>=` and `>>`; the parser rejoins them this way.
    if (token === ts.SyntaxKind.GreaterThanToken) scanner.reScanGreaterToken()
    tokens.push(scanner.getTokenText())
  }
  return tokens.join(` `)
}

// `offset` keeps site numbers unique across every instrumented source file,
// because one switch serves them all. A mutant names no function: the runner
// names it by the function declaration whose lines hold it (owners.mjs), so
// keys and ownership read one source.
const placedRune =
  /^\$(state(\.raw)?|derived(\.by)?|effect(\.pre)?|props(\.id)?|bindable|inspect(\.trace)?)$/

export function instrument(ts, path, text, source, offset = 0) {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const svelte = /\.svelte\.[cm]?[jt]s$/.test(path)
  const isRune = (call) =>
    svelte && placedRune.test(call.expression.getText(file))
  const lineOf = (pos) => file.getLineAndCharacterOfPosition(pos).line + 1
  const arithmetic = new Set([
    ts.SyntaxKind.PlusToken,
    ts.SyntaxKind.MinusToken,
  ])
  // Whether an object literal is (part of) a destructuring pattern: the left
  // of an `=`, or a `for...of` or `for...in` target, possibly nested.
  const inPattern = (literal) => {
    let node = literal
    while (
      ts.isObjectLiteralExpression(node.parent) ||
      ts.isArrayLiteralExpression(node.parent) ||
      ts.isPropertyAssignment(node.parent) ||
      ts.isShorthandPropertyAssignment(node.parent) ||
      ts.isSpreadAssignment(node.parent) ||
      ts.isSpreadElement(node.parent) ||
      ts.isParenthesizedExpression(node.parent)
    )
      node = node.parent
    const parent = node.parent
    return (
      (ts.isBinaryExpression(parent) &&
        parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        parent.left === node) ||
      ((ts.isForOfStatement(parent) || ts.isForInStatement(parent)) &&
        parent.initializer === node)
    )
  }
  const mutants = []
  // `at` is the node whose line the mutant reports: the operator token for a
  // swap and the condition for an `if`, as the earlier runner reported them.
  const add = (at, operator, original, replacement) => {
    const probeGuard = guarded
    const local = mutants.length + 1
    const id = offset + local
    mutants.push({
      // The path below src/ keeps labels unique across files with one name.
      id: `${source.replace(/^src\//, ``)}:M${local}`,
      number: id,
      source,
      line: lineOf(at.getStart(file)),
      // Where the site starts, which names its function (owners.mjs).
      position: at.getStart(file),
      operator,
      original,
      replacement,
      anchor: anchorOf(ts, file, at),
      ...(probeGuard ? { probeGuard: true } : {}),
    })
    return id
  }

  // Probe-only code is reported apart from the gaps: a probe compiles to
  // nothing in production builds (the bundle check owns it), and a deleted or
  // misplaced probe is reach agreement's to catch. Probe-only code is, by the
  // syntax tree:
  // - the probe guard, a declaration
  //   `const probing = typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production'`
  //   in a function (maintainer decision, 2026-11-08: a build folds a
  //   function-local guard to `false`, and the guard does not throw where
  //   there is no `process`);
  // - a probe statement in the decided form,
  //   `probing && globalThis.__oracleProbe?.(name, condition)`, whose
  //   `probing` resolves to that guard in the nearest enclosing function and
  //   whose receiver may be cast with `as`, including its condition;
  // - a call statement to a probe helper, a function declaration whose every
  //   statement is probe-only (found by repeating until no helper is added);
  // - an `if` with no `else` whose branch is probe-only, or a block whose
  //   statements all are.
  // Code beside a probe, and any other probe shape, is production code.
  const helpers = new Set()
  // The probe form is the lint rule's (packages/eslint-plugin-oracles,
  // rules/probe-form.js), clause by clause, read over TypeScript's tree, in
  // which parentheses are nodes of their own: `bare` removes them where the
  // rule's tree has none.
  const bare = (node) => {
    let inner = node
    while (inner && ts.isParenthesizedExpression(inner))
      inner = inner.expression
    return inner
  }
  const staticText = (node) =>
    node && ts.isStringLiteralLike(node) ? node.text : undefined
  // `process.env.NODE_ENV !== 'production'`, the comparison on the left.
  const isGuard = (node) => {
    const test = bare(node)
    if (
      !ts.isBinaryExpression(test) ||
      test.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken
    )
      return false
    const env = bare(test.left)
    const object =
      env && ts.isPropertyAccessExpression(env) && bare(env.expression)
    return (
      ts.isPropertyAccessExpression(env) &&
      env.name.text === `NODE_ENV` &&
      object !== undefined &&
      ts.isPropertyAccessExpression(object) &&
      object.name.text === `env` &&
      ts.isIdentifier(bare(object.expression)) &&
      bare(object.expression).text === `process` &&
      staticText(bare(test.right)) === `production`
    )
  }
  // A probe's name: `package#name`.
  const NAME = /^[a-z][a-z0-9-]*#[a-zA-Z][a-zA-Z0-9.-]*$/
  // What a condition may not hold: an assignment, an update, `new`,
  // `delete`, `await`, `yield`, a function or class expression, or an arrow
  // with a block body.
  const forbidden = (node) =>
    (ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
    ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken)) ||
    ts.isNewExpression(node) ||
    ts.isDeleteExpression(node) ||
    ts.isAwaitExpression(node) ||
    ts.isYieldExpression(node) ||
    ts.isFunctionExpression(node) ||
    ts.isClassExpression(node) ||
    (ts.isArrowFunction(node) && ts.isBlock(node.body)) ||
    (ts.forEachChild(node, (child) => (forbidden(child) ? true : undefined)) ??
      false)
  // `globalThis.__oracleProbe?.(name, condition)`, its receiver `globalThis`
  // or one `as` cast of it.
  const isHook = (node) => {
    const call = bare(node)
    if (
      !ts.isCallExpression(call) ||
      call.questionDotToken === undefined ||
      call.arguments.length !== 2 ||
      call.arguments.some(ts.isSpreadElement)
    )
      return false
    const callee = call.expression
    if (
      !ts.isPropertyAccessExpression(callee) ||
      callee.questionDotToken !== undefined ||
      callee.name.text !== `__oracleProbe`
    )
      return false
    const receiver = bare(callee.expression)
    const cast = ts.isAsExpression(receiver)
      ? bare(receiver.expression)
      : receiver
    const [name, condition] = call.arguments
    return (
      ts.isIdentifier(cast) &&
      cast.text === `globalThis` &&
      NAME.test(staticText(name) ?? ``) &&
      !forbidden(condition)
    )
  }
  // `const probing = typeof process === 'undefined' ? false : <guard>`, in a
  // function: a module-level guard is not folded in a module with imports,
  // so its probes would ship.
  const isGuardDeclaration = (node) => {
    if (
      node === undefined ||
      !ts.isVariableStatement(node) ||
      !(node.declarationList.flags & ts.NodeFlags.Const) ||
      node.declarationList.declarations.length !== 1
    )
      return false
    const [{ name, initializer }] = node.declarationList.declarations
    let scope = node.parent
    while (scope && !ts.isFunctionLike(scope) && !ts.isSourceFile(scope))
      scope = scope.parent
    const init = bare(initializer)
    const test =
      init && ts.isConditionalExpression(init) && bare(init.condition)
    const typeOf = test && ts.isBinaryExpression(test) && bare(test.left)
    return (
      scope !== undefined &&
      ts.isFunctionLike(scope) &&
      ts.isIdentifier(name) &&
      name.text === `probing` &&
      ts.isConditionalExpression(init) &&
      ts.isBinaryExpression(test) &&
      test.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      ts.isTypeOfExpression(typeOf) &&
      ts.isIdentifier(bare(typeOf.expression)) &&
      bare(typeOf.expression).text === `process` &&
      staticText(bare(test.right)) === `undefined` &&
      bare(init.whenTrue).kind === ts.SyntaxKind.FalseKeyword &&
      isGuard(init.whenFalse)
    )
  }
  // `probing && hook`, whose `probing` resolves, within its nearest
  // function, to the guard's declaration.
  const isProbeStatement = (node) => {
    const expression = ts.isExpressionStatement(node) && bare(node.expression)
    if (
      !expression ||
      !ts.isBinaryExpression(expression) ||
      expression.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken
    )
      return false
    const guard = bare(expression.left)
    return (
      ts.isIdentifier(guard) &&
      guard.text === `probing` &&
      isGuardDeclaration(declarationOf(guard, true)) &&
      isHook(expression.right)
    )
  }
  // A call statement to a probe helper: the callee resolves, lexically, to
  // a function declaration that is a helper, not to any function that
  // shares its name.
  const callsHelper = (node) => {
    const target =
      ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
        ? node.expression.expression
        : undefined
    return (
      target !== undefined &&
      ts.isIdentifier(target) &&
      helpers.has(declarationOf(target))
    )
  }
  const isProbeOnly = (node) =>
    isGuardDeclaration(node) ||
    isProbeStatement(node) ||
    callsHelper(node) ||
    (ts.isIfStatement(node) &&
      node.elseStatement === undefined &&
      isProbeOnly(node.thenStatement)) ||
    (ts.isBlock(node) &&
      node.statements.length > 0 &&
      node.statements.every(isProbeOnly))
  // The statement or parameter that declares `identifier`'s name, found
  // from the innermost scope outward as JavaScript resolves it (function
  // declarations and block bindings, case clauses sharing their switch's
  // scope), or undefined when no file-level or enclosing declaration names
  // it. `withinFunction` stops at the nearest function.
  const declaresName = (statement, name) =>
    (ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (d) => ts.isIdentifier(d.name) && d.name.text === name,
      )) ||
    ((ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement)) &&
      statement.name?.text === name)
  function declarationOf(identifier, withinFunction = false) {
    const name = identifier.text
    for (let node = identifier.parent; node; node = node.parent) {
      const statements = ts.isCaseBlock(node)
        ? node.clauses.flatMap((clause) => clause.statements)
        : ts.isBlock(node) || ts.isSourceFile(node) || ts.isModuleBlock(node)
          ? node.statements
          : []
      const found = statements.find((statement) =>
        declaresName(statement, name),
      )
      if (found) return found
      if (ts.isFunctionLike(node)) {
        const parameter = node.parameters?.find(
          (p) => ts.isIdentifier(p.name) && p.name.text === name,
        )
        if (parameter || withinFunction) return parameter
      }
    }
    return undefined
  }
  const declarations = []
  const collect = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body)
      declarations.push(node)
    ts.forEachChild(node, collect)
  }
  collect(file)
  for (let grew = true; grew;) {
    grew = false
    for (const node of declarations) {
      if (helpers.has(node)) continue
      if (
        node.body.statements.length > 0 &&
        node.body.statements.every(isProbeOnly)
      ) {
        helpers.add(node)
        grew = true
      }
    }
  }
  const isProbeGuard = (node) => isProbeOnly(node) || helpers.has(node)
  let guarded = false

  // Emit `node` with its children's instrumented text spliced in, then wrap
  // the node itself if it is a mutation site. Sites are numbered before their
  // children, matching the order of the earlier per-file runner.
  function emit(node) {
    const outer = guarded
    guarded ||= isProbeGuard(node)
    try {
      return emitNode(node)
    } finally {
      guarded = outer
    }
  }
  function emitNode(node) {
    const ids = {}
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.getText(file)
      const swap = comparisons.get(op) ?? logical.get(op)
      if (swap) ids.binary = add(node.operatorToken, `binary-swap`, op, swap)
    }
    if (
      ts.isBinaryExpression(node) &&
      arithmetic.has(node.operatorToken.kind) &&
      (ts.isNumericLiteral(node.left) || ts.isNumericLiteral(node.right))
    ) {
      const op = node.operatorToken.getText(file)
      ids.arith = add(
        node.operatorToken,
        `arithmetic-swap`,
        op,
        op === `+` ? `-` : `+`,
      )
    }
    if (
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.ExclamationToken
    )
      ids.not = add(node, `drop-not`, `!`, ``)
    if (
      (ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node)) &&
      ts.isObjectLiteralExpression(node.parent) &&
      !inPattern(node.parent) &&
      node.name.getText(file).replace(/^['"`]|['"`]$/g, ``) !== `__proto__`
    )
      ids.drop = add(node, `field-drop`, node.getText(file), ``)
    if (
      (node.kind === ts.SyntaxKind.TrueKeyword ||
        node.kind === ts.SyntaxKind.FalseKeyword) &&
      !ts.isLiteralTypeNode(node.parent)
    ) {
      const literal = node.getText(file)
      ids.bool = add(
        node,
        `bool-flip`,
        literal,
        literal === `true` ? `false` : `true`,
      )
    }
    if (
      ts.isCallExpression(node) &&
      !ts.isExpressionStatement(node.parent) &&
      !(
        (ts.isCallExpression(node.parent) ||
          ts.isPropertyAccessExpression(node.parent) ||
          ts.isElementAccessExpression(node.parent)) &&
        node.parent.expression === node
      ) &&
      node.expression.kind !== ts.SyntaxKind.SuperKeyword &&
      node.expression.kind !== ts.SyntaxKind.ImportKeyword &&
      !isRune(node)
    )
      ids.value = add(node, `value-undefined`, node.getText(file), `undefined`)
    // The loop's condition: a `for`'s may be absent.
    const loopCondition = ts.isForStatement(node)
      ? node.condition
      : ts.isWhileStatement(node) || ts.isDoStatement(node)
        ? node.expression
        : undefined
    if (loopCondition)
      ids.loop = add(
        loopCondition,
        `loop-false`,
        loopCondition.getText(file),
        `false`,
      )
    if (ts.isIfStatement(node)) {
      const condition = node.expression.getText(file)
      ids.ifTrue = add(node.expression, `if-true`, condition, `true`)
      ids.ifFalse = add(node.expression, `if-false`, condition, `false`)
    }
    if (
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      !isRune(node.expression)
    )
      ids.call = add(node, `delete-call`, node.getText(file), `;`)

    const children = []
    ts.forEachChild(node, (child) => {
      children.push(child)
    })
    // `emitted` maps each child to its instrumented text and to where that
    // text starts in `out`, so a wrapper can replace exactly one child.
    const emitted = new Map()
    const start = node === file ? 0 : node.getStart(file)
    let out = ``
    let position = start
    for (const child of children) {
      const childStart = child.getStart(file)
      const childText = emit(child)
      out += text.slice(position, childStart)
      emitted.set(child, { text: childText, at: out.length })
      out += childText
      position = child.end
    }
    out += text.slice(position, node.end)

    if (ids.binary !== undefined) {
      const op = node.operatorToken.getText(file)
      const left = emitted.get(node.left).text
      const right = emitted.get(node.right).text
      if (comparisons.has(op))
        return `${G}.cmp(${ids.binary}, ${left}, ${right}, '${op}')`
      return `${G}.v(${G}.m(${ids.binary}) ? (${left} ${logical.get(op)} ${right}) : (${left} ${op} ${right}))`
    }
    if (ids.arith !== undefined) {
      const op = node.operatorToken.getText(file)
      const left = emitted.get(node.left).text
      const right = emitted.get(node.right).text
      return `${G}.v(${G}.m(${ids.arith}) ? (${left} ${op === `+` ? `-` : `+`} ${right}) : (${left} ${op} ${right}))`
    }
    if (ids.not !== undefined)
      return `${G}.not(${ids.not}, ${emitted.get(node.operand).text})`
    // The property stays in place as a spread of either nothing or itself.
    if (ids.drop !== undefined)
      return `...(${G}.m(${ids.drop}) ? {} : { ${out} })`
    if (ids.bool !== undefined)
      return `${G}.b(${ids.bool}, ${node.getText(file)})`
    if (ids.value !== undefined)
      return `${G}.v(${G}.m(${ids.value}) ? void 0 : ${out})`
    if (ids.loop !== undefined) {
      const { text: condition, at } = emitted.get(loopCondition)
      return `${out.slice(0, at)}${G}.v(${G}.m(${ids.loop}) ? false : ${condition})${out.slice(at + condition.length)}`
    }
    if (ids.ifTrue !== undefined) {
      // Replace only the condition; the rest of the `if` stays as emitted.
      const { text: condition, at } = emitted.get(node.expression)
      return `${out.slice(0, at)}${G}.cond(${ids.ifTrue}, ${ids.ifFalse}, ${condition})${out.slice(at + condition.length)}`
    }
    if (ids.call !== undefined) {
      // `skip || call()` keeps the statement a single expression statement.
      // Wrapping it in an `if` would capture a following `else` (as in
      // `if (x) call() else other()`).
      const { text: call, at } = emitted.get(node.expression)
      return `${out.slice(0, at)}${G}.m(${ids.call}) || ${call}${out.slice(at + call.length)}`
    }
    return out
  }

  const code = emit(file)
  return { code, mutants }
}
