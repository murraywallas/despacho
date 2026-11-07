/** A source of random numbers in [0, 1). */
export type Random = () => number

/**
 * Seeded random numbers (mulberry32): the same seed always gives the same sequence,
 * so a shift can be replayed and tests are repeatable.
 */
export function createRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

/** A random whole number from 0 up to (not including) max. */
export function randomInt(random: Random, max: number): number {
  return Math.floor(random() * max)
}
