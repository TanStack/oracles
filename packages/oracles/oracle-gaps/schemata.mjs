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
//   Every site is emitted. Evidence (`evidenceOf`) marks two cases: `dead code`
//   when no input distinguishes the mutant (a logical operator on one local
//   name, or a site in a pure condition whose ternary or `if` has identical
//   branches), and the hint `boundary: -0` on an ordering swap whose branches
//   are its two operands and whose tie can be zero (never a skip).
// - `drop-not`: `!x` → `x`, with the same evidence as a binary swap.
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
// No site lies in a derived constructor's super region (see `superGuarded`).
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
const ordering = new Set([`<`, `<=`, `>`, `>=`])
// Evidence a mutant may carry for the report (never a reason to skip it).
const DEAD_CODE = `dead code`
const BOUNDARY_HINT = `boundary: -0`

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
  // Without the word `super` no site can be in a super region: skip the walk.
  const mentionsSuper = /\bsuper\b/.test(text)
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
  // Whether a node is a `super(...)` call.
  const isSuperCall = (node) =>
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.SuperKeyword
  // Whether a node holds a `super(...)` call. An arrow inherits `super`, so
  // its body counts; a function, method, accessor, constructor, or class does
  // not, since `super` in it means something else.
  const holdsSuper = (node) =>
    isSuperCall(node) ||
    ((!(
      ts.isFunctionLike(node) ||
      ts.isClassLike(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) ||
      ts.isArrowFunction(node)) &&
      (ts.forEachChild(node, (child) =>
        holdsSuper(child) ? true : undefined,
      ) ??
        false))
  // A derived constructor's super region: its parameters and the statements
  // before its first statement that holds a `super(...)` call, and that
  // statement. No mutant site lies in it, so no mutant, when active, can
  // prevent or delay the call: a statement before it may return early or
  // skip it, and the call's own statement may skip it. Statements after it
  // keep their sites. Maintainer decision, 2026-11-09: one rule for every
  // shape of `super`, including an early return before it.
  const superGuarded = (node) => {
    for (let owner = node; owner; owner = owner.parent)
      if (ts.isConstructorDeclaration(owner) && owner.body) {
        const first = owner.body.statements.find(holdsSuper)
        if (first && node.getStart(file) < first.end) return true
      }
    return false
  }
  // `at` is the node whose line the mutant reports: the operator token for a
  // swap and the condition for an `if`, as the earlier runner reported them.
  // `evidence` is a hint for the report, and never changes whether a site is
  // emitted: see `evidenceOf`.
  const add = (at, operator, original, replacement, evidence) => {
    if (mentionsSuper && superGuarded(at)) return undefined
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
      ...(evidence ? { evidence } : {}),
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
  // The probe form is the one that @tanstack/eslint-plugin-oracles's
  // `oracle/probe-form` rule defines, clause by clause, read over TypeScript's tree, in
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
      env.questionDotToken === undefined &&
      ts.isPropertyAccessExpression(object) &&
      object.questionDotToken === undefined &&
      env.name.text === `NODE_ENV` &&
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
  // The guard: a declarator `probing = typeof process === 'undefined' ?
  // false : <guard>` of a `const`, in a function: a module-level guard is not
  // folded in a module with imports, so its probes would ship.
  const isGuardDeclarator = (node) => {
    if (
      node === undefined ||
      !ts.isVariableDeclaration(node) ||
      // A `const`: `await using` sets the Const flag too, with Using.
      (node.parent.flags & ts.NodeFlags.BlockScoped) !== ts.NodeFlags.Const ||
      !ts.isIdentifier(node.name) ||
      node.name.text !== `probing`
    )
      return false
    let scope = node.parent
    while (scope && !ts.isFunctionLike(scope) && !ts.isSourceFile(scope))
      scope = scope.parent
    const init = bare(node.initializer)
    const test =
      init && ts.isConditionalExpression(init) && bare(init.condition)
    const typeOf = test && ts.isBinaryExpression(test) && bare(test.left)
    return (
      scope !== undefined &&
      ts.isFunctionLike(scope) &&
      init !== undefined &&
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
  // A statement that is only the guard.
  const isGuardDeclaration = (node) =>
    node !== undefined &&
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.length === 1 &&
    isGuardDeclarator(node.declarationList.declarations[0])
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
    const found = ts.isIdentifier(guard) && declarationOf(guard, true)
    return (
      guard.text === `probing` &&
      found !== undefined &&
      ts.isVariableStatement(found) &&
      isGuardDeclarator(
        found.declarationList.declarations.find((d) =>
          bindsName(d.name, `probing`),
        ),
      ) &&
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
  // Whether a binding name (an identifier, or a destructuring pattern)
  // binds `name`.
  const bindsName = (binding, name) =>
    ts.isIdentifier(binding)
      ? binding.text === name
      : (ts.isObjectBindingPattern(binding) ||
          ts.isArrayBindingPattern(binding)) &&
        binding.elements.some(
          (element) =>
            !ts.isOmittedExpression(element) && bindsName(element.name, name),
        )
  const declaresName = (statement, name) =>
    (ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some((d) =>
        bindsName(d.name, name),
      )) ||
    // An overload signature names the function its implementation declares.
    (((ts.isFunctionDeclaration(statement) && statement.body !== undefined) ||
      ts.isClassDeclaration(statement)) &&
      statement.name?.text === name)
  // What declares `identifier`'s name, found from the innermost scope
  // outward as JavaScript resolves it: a statement (a variable, function, or
  // class declaration; case clauses share their switch's scope), the loop
  // statement or catch clause that binds it, or a parameter; undefined when
  // nothing in the file declares it. `withinFunction` stops at the nearest
  // function, returning its parameter of that name or undefined.
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
      // A loop's own variables, and a caught error.
      const own =
        (ts.isForStatement(node) ||
          ts.isForOfStatement(node) ||
          ts.isForInStatement(node)) &&
        node.initializer !== undefined &&
        ts.isVariableDeclarationList(node.initializer)
          ? node.initializer.declarations.some((d) => bindsName(d.name, name))
          : ts.isCatchClause(node) &&
            node.variableDeclaration !== undefined &&
            bindsName(node.variableDeclaration.name, name)
      if (own) return node
      if (ts.isFunctionLike(node)) {
        const parameter = node.parameters?.find((p) => bindsName(p.name, name))
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
  const isProbeGuard = (node) =>
    isProbeOnly(node) || helpers.has(node) || isGuardDeclarator(node)
  let guarded = false

  // An operand is an identifier or a numeric literal: its text reads the same
  // value wherever it appears. Anything else has no text here.
  const operandText = (expression) => {
    const inner = expression && bare(expression)
    return inner &&
      (ts.isIdentifier(inner) ||
        ts.isNumericLiteral(inner) ||
        ts.isBigIntLiteral(inner))
      ? inner.getText(file)
      : undefined
  }
  // The type an operand admits, read from its declaration: `number` for a number
  // literal or a parameter annotated `number`, `bigint` likewise, and `other` for
  // anything else (a union with a string, `any`, `unknown`, or no annotation).
  // The annotation is the parameter's own syntax: `instrument` takes the text
  // alone, so no checker program is available here.
  const typeOf = (expression) => {
    const inner = bare(expression)
    if (ts.isNumericLiteral(inner)) return `number`
    if (ts.isBigIntLiteral(inner)) return `bigint`
    if (!ts.isIdentifier(inner)) return `other`
    const found = declarationOf(inner)
    if (!found || !ts.isParameter(found) || !found.type) return `other`
    if (found.type.kind === ts.SyntaxKind.NumberKeyword) return `number`
    if (found.type.kind === ts.SyntaxKind.BigIntKeyword) return `bigint`
    return `other`
  }
  // The operand text a branch returns: the value of a `return` statement, or
  // of a block of one such statement. An empty `return` reads `void`, which no
  // operand text equals.
  const returnedText = (statement) => {
    const only =
      statement && ts.isBlock(statement) && statement.statements.length === 1
        ? statement.statements[0]
        : statement
    if (!only || !ts.isReturnStatement(only)) return undefined
    return only.expression ? operandText(only.expression) : `void`
  }
  // The two values of a ternary, or of an `if` (its else, or the statement
  // after an `if` with no `else`, which must return), as operand texts. Any
  // other node has none.
  const valuesOf = (holder) => {
    if (ts.isConditionalExpression(holder))
      return [operandText(holder.whenTrue), operandText(holder.whenFalse)]
    if (ts.isIfStatement(holder)) {
      const siblings = holder.parent.statements
      return [
        returnedText(holder.thenStatement),
        holder.elseStatement
          ? returnedText(holder.elseStatement)
          : returnedText(siblings?.[siblings.indexOf(holder) + 1]),
      ]
    }
    return []
  }
  // The ternary or `if` whose condition is `node`, through parentheses.
  const holderOf = (node) => {
    let test = node
    // Through parentheses and negations: a negated test selects the same
    // branches, with the sense of the test flipped.
    while (
      ts.isParenthesizedExpression(test.parent) ||
      (ts.isPrefixUnaryExpression(test.parent) &&
        test.parent.operator === ts.SyntaxKind.ExclamationToken)
    )
      test = test.parent
    const holder = test.parent
    return (ts.isConditionalExpression(holder) && holder.condition === test) ||
      (ts.isIfStatement(holder) && holder.expression === test)
      ? holder
      : undefined
  }
  // A local binding: a parameter, or a `let`, `const`, `var`, or loop or catch
  // variable of an enclosing function, with no `with` statement between the
  // name and its binding. A global, a module-level name, or a name in a `with`
  // body can read an accessor, so reading it twice is not reading it once.
  const enclosedByFunction = (node) => {
    for (let n = node.parent; n; n = n.parent)
      if (ts.isFunctionLike(n)) return true
    return false
  }
  const localBinding = (identifier) => {
    for (let n = identifier.parent; n; n = n.parent)
      if (ts.isWithStatement(n)) return false
    const found = declarationOf(identifier)
    if (found === undefined) return false
    return (
      ts.isParameter(found) ||
      (enclosedByFunction(found) &&
        (ts.isVariableStatement(found) ||
          ts.isForStatement(found) ||
          ts.isForOfStatement(found) ||
          ts.isForInStatement(found) ||
          ts.isCatchClause(found)))
    )
  }
  // A pure condition reads local names and numbers, and applies comparisons,
  // logical operators, or `!`. Its mutants change which operands are read, but
  // reading a local calls nothing, so the change is invisible.
  const pureOperators = new Set([...comparisons.keys(), ...logical.keys()])
  const pureCondition = (expression) => {
    const inner = bare(expression)
    if (ts.isIdentifier(inner)) return localBinding(inner)
    if (ts.isNumericLiteral(inner) || ts.isBigIntLiteral(inner)) return true
    if (ts.isPrefixUnaryExpression(inner))
      return (
        inner.operator === ts.SyntaxKind.ExclamationToken &&
        pureCondition(inner.operand)
      )
    if (ts.isBinaryExpression(inner))
      return (
        pureOperators.has(inner.operatorToken.getText(file)) &&
        pureCondition(inner.left) &&
        pureCondition(inner.right)
      )
    return false
  }
  // Whether `node` sits in the pure condition of a ternary or `if` whose two
  // values are identical. Both branches then yield the same value, so no change
  // to the condition can show.
  const deadUnderHolder = (node) => {
    let child = node
    for (let parent = node.parent; parent; parent = parent.parent) {
      const condition = ts.isConditionalExpression(parent)
        ? parent.condition
        : ts.isIfStatement(parent)
          ? parent.expression
          : undefined
      if (condition === child && pureCondition(condition)) {
        const [yes, no] = valuesOf(parent)
        if (yes !== undefined && yes === no) return true
      }
      child = parent
    }
    return false
  }
  // An operand that can hold a signed zero: a variable (of a type that admits
  // numbers) or the literal 0. A bigint has no signed zero. 0 and -0 are equal
  // and differ, so two such operands can tie on a signed zero.
  const zeroable = (expression) => {
    if (typeOf(expression) === `bigint`) return false
    const inner = bare(expression)
    return (
      ts.isIdentifier(inner) ||
      (ts.isNumericLiteral(inner) && Number(inner.text) === 0)
    )
  }
  // Whether `node` sits inside a branch of another ternary or `if`. An outer
  // test then decides whether `node` is reached, so a tie may never occur.
  const inBranch = (node) => {
    let child = node
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (
        ts.isConditionalExpression(parent) &&
        (parent.whenTrue === child || parent.whenFalse === child)
      )
        return true
      if (
        ts.isIfStatement(parent) &&
        (parent.thenStatement === child || parent.elseStatement === child)
      )
        return true
      child = parent
    }
    return false
  }
  // Whether a ternary or `if` holder's two values are the two operands of the
  // comparison that is its test, one each, in either order.
  const yieldsOperands = (node, holder) => {
    const [left, right] = [operandText(node.left), operandText(node.right)]
    const [yes, no] = valuesOf(holder)
    return (
      left !== undefined &&
      right !== undefined &&
      ((yes === left && no === right) || (yes === right && no === left))
    )
  }
  // The boundary hint: an ordering swap at a top-level test, whose two branches
  // are its two compared operands, both `number`, where a tie can be zero. Then a
  // signed zero distinguishes the swap from the original on a history of 0 and
  // -0 alone. An operand that admits strings or has no annotation gets no hint:
  // the mutant is valid, and strings distinguish it.
  const boundaryHint = (node) => {
    const holder = holderOf(node)
    if (holder === undefined || inBranch(holder)) return undefined
    if (!yieldsOperands(node, holder)) return undefined
    const numbers =
      typeOf(node.left) === `number` && typeOf(node.right) === `number`
    return numbers && zeroable(node.left) && zeroable(node.right)
      ? BOUNDARY_HINT
      : undefined
  }
  // The ternary or `if` whose condition holds `node` through parentheses, negations,
  // and logical operators. The comparison's value then decides the branch alone
  // (the rest of the condition is not changed by the swap), so at a tie both
  // branches yield the same value: this is the skip's reach, not the hint's.
  const conditionHolderOf = (node) => {
    let test = node
    while (
      ts.isParenthesizedExpression(test.parent) ||
      (ts.isPrefixUnaryExpression(test.parent) &&
        test.parent.operator === ts.SyntaxKind.ExclamationToken) ||
      (ts.isBinaryExpression(test.parent) &&
        logical.has(test.parent.operatorToken.getText(file)))
    )
      test = test.parent
    const holder = test.parent
    return (ts.isConditionalExpression(holder) && holder.condition === test) ||
      (ts.isIfStatement(holder) && holder.expression === test)
      ? holder
      : undefined
  }
  // An ordering swap whose two branches are its two operands is undetectable over
  // the admitted domain, and is skipped, when no admitted input can tell the
  // swapped tie from the original: both operands `bigint` (a tie yields equal
  // values), or both `number` with a nonzero literal tie (no signed zero there).
  // Operands that admit a string keep the mutant: a string distinguishes it.
  const undetectableSwap = (node) => {
    if (!ordering.has(node.operatorToken.getText(file))) return false
    const holder = conditionHolderOf(node)
    if (holder === undefined || !yieldsOperands(node, holder)) return false
    const [left, right] = [node.left, node.right]
    if (typeOf(left) === `bigint` && typeOf(right) === `bigint`) return true
    return (
      typeOf(left) === `number` &&
      typeOf(right) === `number` &&
      !(zeroable(left) && zeroable(right))
    )
  }
  // A literal operand that is not zero: its tie can never be a signed zero, at
  // any declared type.
  const nonzeroLiteral = (expression) => {
    const inner = bare(expression)
    return (
      (ts.isNumericLiteral(inner) || ts.isBigIntLiteral(inner)) &&
      !/^0n?$/.test(inner.getText(file))
    )
  }
  // The equality test whose operands must be equal for the condition to have the
  // given truth: `a === b` for a true condition, `a !== b` for a false one. It
  // looks through parentheses and negations, a `&&` (either side when true, both
  // when false) and a `||` (the reverse). Returns that comparison, or undefined.
  const impliedEquality = (expression, truth) => {
    const inner = bare(expression)
    if (
      ts.isPrefixUnaryExpression(inner) &&
      inner.operator === ts.SyntaxKind.ExclamationToken
    )
      return impliedEquality(inner.operand, !truth)
    if (!ts.isBinaryExpression(inner)) return undefined
    const op = inner.operatorToken.getText(file)
    if (op === `===` || op === `!==`)
      return (op === `===`) === truth ? inner : undefined
    if (op !== `&&` && op !== `||`) return undefined
    const left = impliedEquality(inner.left, truth)
    const right = impliedEquality(inner.right, truth)
    // Both sides must imply the tie when the condition's truth needs both.
    return (op === `&&`) !== truth
      ? left && right
        ? left
        : undefined
      : (left ?? right)
  }
  // Forcing a guard's condition to `side` is undetectable when the condition's
  // other truth implies a tie, and the branches yield the tied operands: then the
  // forced branch is the one reached off the tie, and the tie yields the same
  // value on both branches. The forced side is dead code when a nonzero literal
  // makes the tie (no declared type has a signed zero there), and skipped when
  // both operands are bigints (no signed zero at their type). Otherwise undefined.
  const forcedOutcome = (node, side) => {
    const eq = impliedEquality(node.expression, side === `false`)
    if (!eq || !yieldsOperands(eq, node)) return undefined
    if (nonzeroLiteral(eq.left) || nonzeroLiteral(eq.right)) return `dead`
    if (typeOf(eq.left) === `bigint` && typeOf(eq.right) === `bigint`)
      return `skip`
    return undefined
  }
  // The evidence a mutation site carries for the report, never a reason to skip
  // it. Dead code: no input distinguishes the mutant. That holds for a logical
  // operator on one local name, and for a site in a pure condition whose
  // ternary or `if` has identical branches. Otherwise an ordering swap may carry
  // the boundary hint.
  const evidenceOf = (node) => {
    const op = ts.isBinaryExpression(node)
      ? node.operatorToken.getText(file)
      : undefined
    if (op !== undefined && logical.has(op)) {
      const [left, right] = [operandText(node.left), operandText(node.right)]
      if (
        left !== undefined &&
        left === right &&
        ts.isIdentifier(bare(node.left)) &&
        localBinding(bare(node.left))
      )
        return DEAD_CODE
    }
    if (deadUnderHolder(node)) return DEAD_CODE
    if (op !== undefined && ordering.has(op)) return boundaryHint(node)
    return undefined
  }

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
      if (swap && !undetectableSwap(node))
        ids.binary = add(
          node.operatorToken,
          `binary-swap`,
          op,
          swap,
          evidenceOf(node),
        )
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
      ids.not = add(node, `drop-not`, `!`, ``, evidenceOf(node))
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
      !isSuperCall(node) &&
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
      const [yes, no] = valuesOf(node)
      const identical = yes !== undefined && yes === no
      const outcomeTrue = forcedOutcome(node, `true`)
      const outcomeFalse = forcedOutcome(node, `false`)
      const evidenceFor = (side, outcome) =>
        identical || outcome === `dead` ? DEAD_CODE : undefined
      if (outcomeTrue !== `skip`)
        ids.ifTrue = add(
          node.expression,
          `if-true`,
          condition,
          `true`,
          evidenceFor(`true`, outcomeTrue),
        )
      if (outcomeFalse !== `skip`)
        ids.ifFalse = add(
          node.expression,
          `if-false`,
          condition,
          `false`,
          evidenceFor(`false`, outcomeFalse),
        )
    }
    if (
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      !isSuperCall(node.expression) &&
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
    if (ids.ifTrue !== undefined || ids.ifFalse !== undefined) {
      // Replace only the condition; the rest of the `if` stays as emitted.
      const { text: condition, at } = emitted.get(node.expression)
      return `${out.slice(0, at)}${G}.cond(${ids.ifTrue ?? `undefined`}, ${ids.ifFalse ?? `undefined`}, ${condition})${out.slice(at + condition.length)}`
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
