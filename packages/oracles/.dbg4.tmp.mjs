import * as fc from 'fast-check'
const { drawn } = await import(process.argv[2])
const keys = Object.keys(drawn.generator ? {} : {})
console.log('ok', typeof drawn)
