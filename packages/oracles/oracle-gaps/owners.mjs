// Ownership: which oracle files judge a function.
//
// An oracle file names what it owns in an `owns` list: on its
// `oracleProperty({ owns: [...] })` call, or on the call of a wrapper that
// forwards it to `oracleProperty`, such as `registerX('id', { owns: [...] })`.
// The CLI reads every object-literal argument of every call in the test
// file, so it needs no knowledge of a project's wrappers (maintainer
// decision, 2026-11-11). An `owns` key inside an expectation's arguments,
// as in `expect(x).toEqual({ owns: [...] })`, is data that the test
// compares, so it is not read. Limits: the CLI cannot see whether a wrapper
// forwards the list, so one that drops it still makes the file an owner. An
// `owns` key in an object literal passed to any other call, such as a
// domain object passed to a factory, also makes the file an oracle file,
// and it refuses the run when its value is not a literal list. Each
// entry is a source path relative to the package, in any spelling that
// names the package's file (args.mjs, packagePath), either alone (the whole
// file) or with an entry function after the first `#` (`src/x.ts#run`,
// `src/x.ts#Class.method`, `src/x.ts#Class.#private`).
// Owning an entry function owns its text, every function defined inside it
// whether or not anything refers to it, and its static reference tree within
// the package, as the TypeScript type checker resolves it: every function, method, or
// class that its body refers to, whether it calls it by name, through an
// import or its alias, through `this` or a typed field, through `.bind`, or
// passes it as a value. A class passed as a value brings all its methods;
// `new C()` brings only C's constructor (maintainer decision). The tree
// is read from the source, not from what any test ran, so code an oracle
// never reaches stays owned and shows up as a gap rather than dropping out of
// the oracle's scope. It stops at the package's boundary: a declaration
// outside the package, such as another package or the standard library, is
// not followed (maintainer decisions of 2026-11-05).
//
// A function is a function declaration, a method, accessor, or field
// function of a class (named `Class.member`), a constructor (named
// `Class.constructor`), or any other function with a name: a function
// assigned to a variable, or a method, accessor, or function property of an
// object literal (named by its property). A function exported with no name
// of its own takes the name an import gives it: `default` for `export default
// function () {}`, `export default <function>`, and CommonJS's
// `module.exports = <function>`, and its export's name for CommonJS's
// `exports.name = <function>` (so `exports.default` is `default`; F24),
// through parentheses and chained assignments. An import of it reaches it
// through its export.
// Module-level data is a unit of its
// own, as a function is: a variable declared at the top of a module whose
// initializer is not a function, named by its variable (`src/x.ts#TABLE`), in a
// top-level variable statement. A function that reads it brings it into its
// tree, with what its initializer refers to outside the functions it holds,
// and an owns entry may name it. A function its initializer holds, such as an
// object literal's method, is a unit of its own, owned where something
// refers to it, not because the declaration's text holds it. A mutant belongs to
// the innermost unit whose lines hold it. Two functions may share a name, as a getter and
// its setter do, or two nested helpers; each is still its own function, and
// owns entry that names them owns them all. A function's owners are the
// oracle files whose trees contain it. A gap is judged across all of them: a
// mutant is killed when any owner kills it, and a function with no owner is
// reported as `unowned`, a warning rather than a gap.
import { relative, resolve } from 'node:path'
import { isOutside } from './args.mjs'

/**
 * An owns entry's file and function. The file ends at the first `#`, so a
 * private member is named `src/x.ts#Class.#member`.
 */
export function splitEntry(entry) {
  const at = entry.indexOf(`#`)
  return at < 0 ? [entry, undefined] : [entry.slice(0, at), entry.slice(at + 1)]
}

/**
 * Whether a call is an expectation: `expect(x)`, or a call through it, such
 * as `expect(x).toEqual(y)` or `expect(x).not.toEqual(y)`.
 */
function isExpectation(ts, call) {
  let callee = call.expression
  while (ts.isPropertyAccessExpression(callee) || ts.isCallExpression(callee))
    callee = callee.expression
  return ts.isIdentifier(callee) && callee.text === `expect`
}

/**
 * Whether a test file is an oracle file, the `owns` entries it names, and a
 * problem when a list cannot be read statically. A test file is an oracle
 * file when it calls `oracleProperty`, or passes an `owns` property in an
 * object-literal argument of any call that is not inside an expectation's
 * arguments. Its entries are the union of those lists. Each must be a
 * literal list of strings or plain template literals, because an entry the
 * CLI cannot read would hide gaps.
 */
export function readOwns(ts, path, text) {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const result = { declares: false, entries: [], problem: undefined }
  // `compared` is true inside an expectation's arguments.
  const visit = (node, compared) => {
    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === `oracleProperty`
      )
        result.declares = true
      compared ||= isExpectation(ts, node)
      for (const property of compared
        ? []
        : node.arguments.flatMap((argument) =>
            ts.isObjectLiteralExpression(argument) ? argument.properties : [],
          ))
        if (property.name?.getText(file) === `owns`) {
          result.declares = true
          const list = ts.isPropertyAssignment(property)
            ? property.initializer
            : undefined
          if (!list || !ts.isArrayLiteralExpression(list)) {
            result.problem = `its owns list is not a literal list, so the gap report cannot read what it owns`
            continue
          }
          for (const element of list.elements)
            if (ts.isStringLiteralLike(element))
              result.entries.push(element.text)
            else
              result.problem = `its owns entry ${element.getText(file)} is not a literal string`
        }
    }
    ts.forEachChild(node, (child) => visit(child, compared))
  }
  visit(file, false)
  return result
}

/**
 * The value an export or an assignment gives: an export assignment's
 * expression, or an assignment's right-hand side, through parentheses and
 * chained assignments (`module.exports = exports = fn`).
 */
function assignedValue(ts, node) {
  const assigns = (n) =>
    ts.isBinaryExpression(n) &&
    n.operatorToken.kind === ts.SyntaxKind.EqualsToken
  let value = ts.isExportAssignment(node)
    ? node.expression
    : assigns(node)
      ? node.right
      : undefined
  while (value && (ts.isParenthesizedExpression(value) || assigns(value)))
    value = ts.isParenthesizedExpression(value) ? value.expression : value.right
  return value
}

/**
 * The functions of one source file, in document order, each with its name,
 * its node, the class it is a member of (if any), and its line span.
 */
export function functionsIn(ts, file) {
  const functions = []
  const isFunction = (node) =>
    node !== undefined &&
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
  // A function exported with no name of its own, by the name an import
  // gives it, and its node: `default` for `export default function () {}`,
  // `export default <function>`, and CommonJS's `module.exports =
  // <function>`; a CommonJS `exports.name = <function>` (or
  // `module.exports.name`) by its export's name, so `exports.default` is
  // `default` too.
  const exportedAs = (node) => {
    if (ts.isFunctionDeclaration(node) && !node.name && node.body)
      return [`default`, node]
    const value = assignedValue(ts, node)
    if (!isFunction(value)) return undefined
    if (ts.isExportAssignment(node)) return [`default`, value]
    const target = /^(module\.exports|(?:module\.)?exports\.([\w$]+))$/.exec(
      node.left.getText(file),
    )
    return target ? [target[2] ?? `default`, value] : undefined
  }
  const visit = (node) => {
    const cls =
      node.parent && ts.isClassLike(node.parent) ? node.parent : undefined
    const named = (text) =>
      cls ? `${cls.name?.text ?? `<class>`}.${text}` : text
    const hasBody =
      (ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node) ||
        ts.isConstructorDeclaration(node)) &&
      node.body !== undefined
    // A function written as the value of a name: a variable, a class field,
    // or an object literal's property.
    const valued =
      (ts.isVariableDeclaration(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isPropertyAssignment(node)) &&
      isFunction(node.initializer) &&
      (ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name))
    // Module-level data: a top-level variable whose value is not a function.
    // Its node is the declaration, whose initializer is its text.
    const data =
      ts.isVariableDeclaration(node) &&
      node.initializer !== undefined &&
      !valued &&
      ts.isIdentifier(node.name) &&
      ts.isVariableStatement(node.parent.parent) &&
      ts.isSourceFile(node.parent.parent.parent)
    const exported = exportedAs(node)
    if (exported)
      functions.push({
        name: exported[0],
        node: exported[1],
        start: node.getStart(file),
        end: node.end,
      })
    else if (
      (hasBody || valued || data) &&
      (node.name || ts.isConstructorDeclaration(node))
    )
      functions.push({
        name: named(node.name ? node.name.getText(file) : `constructor`),
        node: valued ? node.initializer : node,
        cls,
        start: node.getStart(file),
        end: node.end,
      })
    ts.forEachChild(node, visit)
  }
  visit(file)
  return functions
}

/**
 * Owners by source and function. `oracles` maps each oracle file to its
 * `owns` entries; `program` is a TypeScript program over the package's
 * sources and `pkg` the package's directory.
 */
export function ownership(ts, program, pkg, oracles) {
  const checker = program.getTypeChecker()
  const inPackage = (fileName) => {
    const path = relative(pkg, fileName)
    return !isOutside(path) && !path.split(/[\\/]/).includes(`node_modules`)
  }
  const indexed = new Map()
  const functionsOf = (source) => {
    if (!indexed.has(source)) {
      const file = program.getSourceFile(resolve(pkg, source))
      indexed.set(source, file ? functionsIn(ts, file) : [])
    }
    return indexed.get(source)
  }
  // The package functions a declaration names: itself, or, for a class used
  // as a value, all its members. `new C()` names only C's constructor; C's
  // members are owned where the tree refers to them.
  const targetsOf = (declaration, constructed) => {
    const file = declaration.getSourceFile()
    if (!inPackage(file.fileName)) return []
    const functions = functionsOf(relative(pkg, file.fileName))
    if (ts.isClassDeclaration(declaration) && declaration.name)
      return functions.filter(
        (fn) =>
          fn.cls === declaration &&
          (!constructed || ts.isConstructorDeclaration(fn.node)),
      )
    // An unnamed export is reached through its export: an export
    // assignment, a CommonJS assignment, or, for `exports.name`, the
    // property its assignment sets.
    const value =
      declaration.initializer ??
      assignedValue(
        ts,
        ts.isPropertyAccessExpression(declaration)
          ? declaration.parent
          : declaration,
      )
    return functions.filter(
      (fn) => fn.node === declaration || fn.node === value,
    )
  }
  // Every package function, method, or class an owned body refers to.
  const referencesOf = (node) => {
    const found = []
    const visit = (child) => {
      if (ts.isIdentifier(child) || ts.isPrivateIdentifier(child)) {
        let symbol = checker.getSymbolAtLocation(child)
        if (symbol && symbol.flags & ts.SymbolFlags.Alias)
          symbol = checker.getAliasedSymbol(symbol)
        const constructed =
          ts.isNewExpression(child.parent) && child.parent.expression === child
        for (const declaration of symbol?.declarations ?? [])
          found.push(...targetsOf(declaration, constructed))
      }
      // A function in module data's initializer is a unit of its own,
      // reached only when something refers to it.
      if (!(data && ts.isFunctionLike(child))) ts.forEachChild(child, visit)
    }
    // A function's body, or module data's initializer.
    const data = node.body === undefined
    const text = node.body ?? node.initializer
    if (text) visit(text)
    return found
  }
  // Owners by function, and a whole file's owners by its source.
  const owners = new Map()
  const add = (key, oracle) =>
    owners.set(key, new Set([...(owners.get(key) ?? []), oracle]))
  for (const [oracle, entries] of oracles)
    for (const entry of entries) {
      const [source, entryFunction] = splitEntry(entry)
      if (entryFunction === undefined) {
        add(source, oracle)
        continue
      }
      const seen = new Set()
      // Owning a function owns its whole text, every function defined in it
      // whether or not anything calls it (a gap there often marks dead
      // code), and what its text refers to outside it (maintainer
      // decision, 2026-11-08).
      const walk = (fn) => {
        if (seen.has(fn)) return
        seen.add(fn)
        add(fn, oracle)
        // The functions in a function's text follow it in document order.
        // Module data owns only its own sites, not the functions it holds.
        const functions = ts.isVariableDeclaration(fn.node)
          ? []
          : functionsOf(relative(pkg, fn.node.getSourceFile().fileName))
        for (
          let at = functions.indexOf(fn) + 1;
          at < functions.length && functions[at].start < fn.end;
          at += 1
        )
          walk(functions[at])
        for (const next of referencesOf(fn.node)) walk(next)
      }
      for (const fn of functionsOf(source))
        if (fn.name === entryFunction) walk(fn)
    }
  return {
    has: (source, name) => functionsOf(source).some((fn) => fn.name === name),
    /** Whether a function of the source, or the whole source, has an owner. */
    ownsAny: (source) =>
      owners.has(source) || functionsOf(source).some((fn) => owners.has(fn)),
    /**
     * The innermost unit (a function or module data) whose text holds a
     * position (an offset in the source), by its name (`<module>` for none),
     * and its owners. A whole-file entry owns every unit in the file.
     */
    at: (source, position) => {
      let best
      for (const fn of functionsOf(source))
        if (
          fn.start <= position &&
          position < fn.end &&
          (!best || fn.start > best.start)
        )
          best = fn
      return {
        name: best?.name ?? `<module>`,
        owners: new Set([
          ...(owners.get(best) ?? []),
          ...(owners.get(source) ?? []),
        ]),
      }
    },
  }
}
