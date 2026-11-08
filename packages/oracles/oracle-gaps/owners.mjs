// Ownership: which oracle files judge a function.
//
// An oracle file names what it owns in `declareOracle({ owns: [...] })`. Each
// entry is a source path relative to the package, either alone (the whole
// file) or with an entry function (`src/x.ts#run`, `src/x.ts#Class.method`).
// Owning an entry function owns its static reference tree within the package,
// as the TypeScript type checker resolves it: every function, method, or
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
// object literal (named by its property). A mutant belongs to the innermost
// one whose lines hold it. Two functions may share a name, as a getter and
// its setter do, or two nested helpers; each is still its own function, and
// owns entry that names them owns them all. A function's owners are the
// oracle files whose trees contain it. A gap is judged across all of them: a
// mutant is killed when any owner kills it, and a function with no owner is
// reported as `unowned`, a warning rather than a gap.
import { relative, resolve } from 'node:path'

/**
 * Whether a test file calls `declareOracle` (which makes it an oracle file),
 * the `owns` entries it names, and a problem when the list cannot be read
 * statically: it must be a literal list of strings or plain template
 * literals, because an entry the CLI cannot read would hide gaps.
 */
export function readOwns(ts, path, text) {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const result = { declares: false, entries: [], problem: undefined }
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === `declareOracle`
    ) {
      result.declares = true
      const parts = node.arguments[0]
      for (const property of parts && ts.isObjectLiteralExpression(parts)
        ? parts.properties
        : [])
        if (property.name?.getText(file) === `owns`) {
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
    ts.forEachChild(node, visit)
  }
  visit(file)
  return result
}

/**
 * The functions of one source file, in document order, each with its name,
 * its node, the class it is a member of (if any), and its line span.
 */
export function functionsIn(ts, file) {
  const lineOf = (pos) => file.getLineAndCharacterOfPosition(pos).line + 1
  const functions = []
  const isFunction = (node) =>
    node !== undefined &&
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
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
    if ((hasBody || valued) && (node.name || ts.isConstructorDeclaration(node)))
      functions.push({
        name: named(node.name ? node.name.getText(file) : `constructor`),
        node: valued ? node.initializer : node,
        cls,
        start: lineOf(node.getStart(file)),
        end: lineOf(node.end),
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
    return (
      !path.startsWith(`..`) && !path.split(/[\\/]/).includes(`node_modules`)
    )
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
    return functions.filter(
      (fn) => fn.node === declaration || fn.node === declaration.initializer,
    )
  }
  // Every package function, method, or class an owned body refers to.
  const referencesOf = (node) => {
    const found = []
    const visit = (child) => {
      if (ts.isIdentifier(child)) {
        let symbol = checker.getSymbolAtLocation(child)
        if (symbol && symbol.flags & ts.SymbolFlags.Alias)
          symbol = checker.getAliasedSymbol(symbol)
        const constructed =
          ts.isNewExpression(child.parent) && child.parent.expression === child
        for (const declaration of symbol?.declarations ?? [])
          found.push(...targetsOf(declaration, constructed))
      }
      ts.forEachChild(child, visit)
    }
    if (node.body) visit(node.body)
    return found
  }
  // Owners by function, and a whole file's owners by its source.
  const owners = new Map()
  const add = (key, oracle) =>
    owners.set(key, new Set([...(owners.get(key) ?? []), oracle]))
  for (const [oracle, entries] of oracles)
    for (const entry of entries) {
      const [source, entryFunction] = entry.split(`#`)
      if (entryFunction === undefined) {
        add(source, oracle)
        continue
      }
      const seen = new Set()
      const walk = (fn) => {
        if (seen.has(fn)) return
        seen.add(fn)
        add(fn, oracle)
        for (const next of referencesOf(fn.node)) walk(next)
      }
      for (const fn of functionsOf(source))
        if (fn.name === entryFunction) walk(fn)
    }
  return {
    has: (source, name) => functionsOf(source).some((fn) => fn.name === name),
    /**
     * The innermost function that holds a line, by its name (`<module>` for
     * none), and its owners. A whole-file entry owns every function in the
     * file.
     */
    at: (source, line) => {
      let best
      for (const fn of functionsOf(source))
        if (
          fn.start <= line &&
          line <= fn.end &&
          (!best || fn.start >= best.start)
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
