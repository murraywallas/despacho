import { readFileSync } from 'node:fs'

/** The prototype numbers from data/balance.json, so the browser tests follow the balance sheet. */
interface PrototypeTimes {
  orders: { spawnIntervalSec: number; deadlineSec: number; cancelAfterSec: number }
  kitchen: { cookSec: number }
  grid: { size: number }
  riders: { speedBlocksPerSec: number }
  shift: { durationSec: number }
}

const data = JSON.parse(readFileSync(new URL('../../data/balance.json', import.meta.url), 'utf8')) as {
  prototype: PrototypeTimes
}

export const prototype = data.prototype

/** Game milliseconds of the longest ride on the grid (corner to corner). */
export const longestRideMs = ((2 * (prototype.grid.size - 1)) / prototype.riders.speedBlocksPerSec) * 1000
