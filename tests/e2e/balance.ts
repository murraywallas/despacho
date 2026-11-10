import { readFileSync } from 'node:fs'

/** The numbers from data/balance.json the browser tests need, so they follow the balance sheet. */
interface BalanceData {
  prototype: {
    orders: { spawnIntervalSec: number; deadlineSec: number; cancelAfterSec: number }
    kitchen: { cookSec: number }
    shift: { durationSec: number; startHour: number }
    riders: { fleet: string }
    tools: { reassignPenaltySec: number; callsPerShift: number; callExtendSec: number }
  }
  levels: Record<
    string,
    {
      startHour: number
      durationSec: number
      fleet: string[]
      spawnIntervalSec: number
      deadlineSec: number
    }
  >
  vehicles: Record<string, { speedKmh: number }>
  clock: { gameSecondsPerRealSecond: number }
}

const data = JSON.parse(readFileSync(new URL('../../data/balance.json', import.meta.url), 'utf8')) as BalanceData

/** The level the browser tests play: the first one, opened straight from the address. */
export const LEVEL = 'lunch'
export const SHIFT_URL = '/?level=' + LEVEL

const level = data.levels[LEVEL]
/** The rules of that level: the prototype's (Reglas tab), with the level's numbers on top (Niveles tab). */
export const prototype = {
  ...data.prototype,
  shift: { startHour: level.startHour, durationSec: level.durationSec },
  riders: { fleet: level.fleet.join(', ') },
  orders: { ...data.prototype.orders, spawnIntervalSec: level.spawnIntervalSec, deadlineSec: level.deadlineSec },
}

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
// The slowest vehicle of the fleet sets the longest ride.
const slowestKmh = Math.min(...prototype.riders.fleet.split(',').map((vehicle) => data.vehicles[vehicle.trim()].speedKmh))
const metersPerSec = ((slowestKmh * 1000) / 3600) * data.clock.gameSecondsPerRealSecond
/** Milliseconds of play of the longest ride in the area. */
export const longestRideMs = (LONGEST_RIDE_M / metersPerSec) * 1000
