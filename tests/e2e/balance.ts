import { readFileSync } from 'node:fs'

/** The numbers from data/balance.json the browser tests need, so they follow the balance sheet. */
interface BalanceData {
  prototype: {
    orders: { spawnIntervalSec: number; deadlineSec: number; cancelAfterSec: number }
    kitchen: { cookSec: number }
    shift: { durationSec: number; startHour: number }
    riders: { vehicle: string }
  }
  vehicles: Record<string, { speedKmh: number }>
  clock: { gameSecondsPerRealSecond: number }
}

const data = JSON.parse(readFileSync(new URL('../../data/balance.json', import.meta.url), 'utf8')) as BalanceData

export const prototype = data.prototype

/** The game clock when the shift starts and when it ends: "18:00", "19:40". */
function clockAt(seconds: number): string {
  const minutes = prototype.shift.startHour * 60 + Math.floor((seconds * data.clock.gameSecondsPerRealSecond) / 60)
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
export const shiftStartsAt = clockAt(0)
export const shiftEndsAt = clockAt(prototype.shift.durationSec)

/** Real seconds the game clock needs to move one minute. */
export const gameMinuteMs = (60 / data.clock.gameSecondsPerRealSecond) * 1000

// The longest bike ride inside the Nørrebro area is about 5 km of streets.
const LONGEST_RIDE_M = 5000
const metersPerSec = ((data.vehicles[prototype.riders.vehicle].speedKmh * 1000) / 3600) * data.clock.gameSecondsPerRealSecond
/** Milliseconds of play of the longest ride in the area. */
export const longestRideMs = (LONGEST_RIDE_M / metersPerSec) * 1000
