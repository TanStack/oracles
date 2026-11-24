/**
 * Inserts `value` into `sorted`, an array in ascending order, after every
 * element equal to it, and returns the index where it put it.
 */
export function insertSorted(sorted: Array<number>, value: number): number {
  const after = sorted.findIndex((element) => element > value)
  const index = after === -1 ? sorted.length : after
  sorted.splice(index, 0, value)
  return index
}
