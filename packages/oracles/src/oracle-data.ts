// The data domain's encoding, shared by oracleProperty and failure fidelity:
// the text that compares two values and the text a failure report prints.
import { inspect, types } from 'node:util'

/**
 * A value outside the data domain, in an observation or an enumerated
 * history. Its message names the value's path in the trace and its kind.
 */
export class OracleDataError extends Error {
  override name = `OracleDataError`
}

/**
 * The encoding of a value in the data domain (maintainer decision,
 * 2026-11-08): primitives, with -0, NaN, the infinities, bigints, and
 * undefined; dense arrays; plain objects (a null prototype or a realm's
 * `Object.prototype`) whose own properties are enumerable data properties
 * with string keys; Maps and Sets without own properties; and Errors, as
 * their name and message (each a data property on the Error or its
 * prototype chain), their own enumerable data properties, cause, and
 * AggregateError `errors`, never their stack. An array is data when its own
 * keys are exactly its indices, each an enumerable data property, and
 * `length`. Arrays, Maps, Sets, and Errors are recognized by their brands,
 * so data from another realm is data. Two values have the same encoding
 * exactly when they are the same data: key order and Map and Set order
 * count, -0 is not 0, and an object's prototype is not data. JSON data
 * encodes as its JSON text.
 *
 * Reading a value never runs its code: only own property descriptors,
 * prototypes, and internal slots are read, never a getter, and a proxy is
 * not data. Anything else throws an `OracleDataError` that names `where` and
 * the value's path, a key that is not an identifier quoted. With `build`
 * false, the value is only checked; shared subtrees are read once either
 * way.
 */
export function encodeData(
  value: unknown,
  where: string,
  what: string,
  build = true,
  ordered = true,
): string {
  const open = new Set<object>()
  const done = new Map<object, string>()
  const fail = (path: string, kind: string): never => {
    throw new OracleDataError(
      `${where}${path === `` ? `` : ` ${path.trimStart()}`}: ${kind} is not ${what} data`,
    )
  }
  const at = (path: string, key: string) =>
    /^[A-Za-z_$][\w$]*$/.test(key)
      ? `${path}.${key}`
      : `${path}[${JSON.stringify(key)}]`
  const descriptor = Object.getOwnPropertyDescriptor
  const prototypeOf = Object.getPrototypeOf as (object: object) => object | null
  // A data property's value; a hidden one only where `hidden` allows.
  const data = (property: PropertyDescriptor, path: string, hidden = false) => {
    if (!(`value` in property)) return fail(path, `an accessor`)
    if (!property.enumerable && !hidden) return fail(path, `a hidden property`)
    return property.value as unknown
  }
  // A data property on the object or its prototype chain, which holds no
  // proxy by the time this is called.
  const inherited = (object: object, key: string, path: string): unknown => {
    for (
      let holder = object as object | null;
      holder;
      holder = prototypeOf(holder)
    ) {
      const property = descriptor(holder, key)
      if (property) return data(property, path, true)
    }
    return undefined
  }
  // A realm's `Object.prototype`: no prototype, and Object's own methods.
  const objectPrototype = (prototype: object | null) =>
    prototype !== null &&
    prototypeOf(prototype) === null &&
    typeof descriptor(prototype, `hasOwnProperty`)?.value === `function`
  // A prototype's constructor, read as data; a proxy is never read.
  const constructorOf = (prototype: object | null): unknown => {
    const constructor: unknown =
      prototype && descriptor(prototype, `constructor`)?.value
    return typeof constructor === `function` && types.isProxy(constructor)
      ? `proxy`
      : constructor
  }
  // A realm's prototype for the constructor named `name`.
  const intrinsic = (prototype: object | null, name: string) => {
    const constructor = constructorOf(prototype)
    return (
      prototype !== null &&
      objectPrototype(prototypeOf(prototype)) &&
      typeof constructor === `function` &&
      descriptor(constructor, `name`)?.value === name
    )
  }
  // How an object outside the domain is named.
  const named = (prototype: object | null): string => {
    const constructor = constructorOf(prototype)
    if (constructor === `proxy`) return `an instance of a proxied class`
    if (typeof constructor !== `function`)
      return `an object with a custom prototype`
    const name: unknown = descriptor(constructor, `name`)?.value
    return typeof name === `string` && name !== ``
      ? name
      : `an instance of an anonymous class`
  }
  // Encodings in order, or sorted where order is not compared.
  const joined = (parts: Array<string>) =>
    (ordered ? parts : parts.sort()).join(`,`)
  const fields = (
    object: object,
    path: string,
    apart: ReadonlyArray<string> = [],
    hidden: ReadonlyArray<string> = [],
  ) =>
    joined(
      Reflect.ownKeys(object)
        .filter((key) => !apart.includes(key as string))
        .map((key) => {
          if (typeof key === `symbol`) return fail(path, `a symbol key`)
          const place = at(path, key)
          const text = encode(
            data(descriptor(object, key)!, place, hidden.includes(key)),
            place,
          )
          return build ? `${JSON.stringify(key)}:${text}` : ``
        }),
    )
  const container = (item: object, path: string): string => {
    if (types.isProxy(item)) return fail(path, `a proxy`)
    const prototype = prototypeOf(item)
    // No proxy on the prototype chain, so walking it runs no trap.
    for (let holder = prototype; holder; holder = prototypeOf(holder))
      if (types.isProxy(holder))
        return fail(path, `an object with a proxy prototype`)
    if (Array.isArray(item)) {
      if (!intrinsic(prototype, `Array`)) return fail(path, named(prototype))
      const length = descriptor(item, `length`)!.value as number
      const extra = Reflect.ownKeys(item)[length + 1]
      if (extra !== undefined)
        return typeof extra === `symbol`
          ? fail(path, `a symbol key`)
          : fail(at(path, extra), `a property on an array`)
      const items: Array<string> = []
      for (let index = 0; index < length; index += 1) {
        const property = descriptor(item, String(index))
        if (!property) return fail(path, `a sparse array`)
        const place = `${path}[${index}]`
        items.push(encode(data(property, place), place))
      }
      return build ? `[${items.join(`,`)}]` : ``
    }
    if (types.isMap(item) || types.isSet(item)) {
      const kind = types.isMap(item) ? `Map` : `Set`
      if (!intrinsic(prototype, kind)) return fail(path, named(prototype))
      const [key] = Reflect.ownKeys(item)
      if (key !== undefined)
        return typeof key === `symbol`
          ? fail(path, `a symbol key`)
          : fail(at(path, key), `a property on a ${kind}`)
      const members = types.isMap(item)
        ? [...Map.prototype.entries.call(item)].map(
            ([entryKey, entry], index) => {
              const keyText = encode(entryKey, `${path} map key ${index}`)
              const entryText = encode(entry, `${path} map value ${index}`)
              return build ? `${keyText}=>${entryText}` : ``
            },
          )
        : [...Set.prototype.values.call(item)].map((entry, index) =>
            encode(entry, `${path} set item ${index}`),
          )
      return build ? `${kind}{${joined(members)}}` : ``
    }
    if (types.isNativeError(item)) {
      if (typeof DOMException === `function` && item instanceof DOMException)
        return fail(path, `DOMException`)
      const name = encode(
        inherited(item, `name`, at(path, `name`)),
        at(path, `name`),
      )
      const message = encode(
        inherited(item, `message`, at(path, `message`)),
        at(path, `message`),
      )
      const own = fields(
        item,
        path,
        [`stack`, `name`, `message`],
        [`cause`, `errors`],
      )
      return build ? `Error(${name},${message}){${own}}` : ``
    }
    if (item instanceof Error)
      return fail(path, `an old-style Error without the native brand`)
    if (prototype !== null && !objectPrototype(prototype))
      return fail(path, named(prototype))
    const own = fields(item, path)
    return build ? `{${own}}` : ``
  }
  const encode = (item: unknown, path: string): string => {
    if (typeof item === `string`) return build ? JSON.stringify(item) : ``
    if (typeof item === `number`)
      return build ? (Object.is(item, -0) ? `-0` : String(item)) : ``
    if (typeof item === `bigint`) return build ? `${item}n` : ``
    if (item === null || item === undefined || typeof item === `boolean`)
      return build ? String(item) : ``
    if (typeof item !== `object`) return fail(path, `a ${typeof item}`)
    if (open.has(item)) return fail(path, `a cycle`)
    const known = done.get(item)
    if (known !== undefined) return known
    open.add(item)
    let text: string
    try {
      text = container(item, path)
    } catch (error) {
      // A framework limit is not a verdict about the value.
      if (error instanceof OracleDataError || error instanceof RangeError)
        throw error
      // An exotic object that throws while it is read is not data.
      return fail(path, `an object that cannot be read`)
    }
    open.delete(item)
    done.set(item, text)
    return text
  }
  try {
    return encode(value, ``)
  } catch (error) {
    // A stack or a string too large for the engine: data that is too deep
    // or too large for the framework, which is not a property of the data.
    if (error instanceof RangeError)
      throw new Error(
        `${where}: the value is deeper or larger than the framework's encoding limit`,
        { cause: error },
      )
    throw error
  }
}

// A value as report text, which never throws and is never a name or a
// comparison: its data encoding, or, for a value that is not data, Node's
// inspection on one line without stack frames, which name this machine's
// files. At most `limit` characters.
export function reportText(value: unknown, limit = 2000): string {
  try {
    return encodeData(value, ``, `report`).slice(0, limit)
  } catch {
    try {
      return (
        inspect(value, { depth: 6, breakLength: Infinity })
          .split(`\n`)
          // A frame's text goes; the brace an Error's properties open after
          // its last frame stays.
          .map((line) => line.replace(/^\s+(?:at |\.\.\. ).*?( \{)?$/, `$1`))
          .filter(Boolean)
          .join(` `)
          .slice(0, limit)
      )
    } catch {
      return Object.prototype.toString.call(value)
    }
  }
}
