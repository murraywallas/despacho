/**
 * Game numbers, read from data/balance.json (generated from the balance spreadsheet with `npm run balance`).
 * The interfaces below are the contract with the spreadsheet: if a key is missing or has the wrong type,
 * `npm run build` fails here.
 *
 * Only the groups the prototype uses are typed. The rest (vehicles, neighborhoods, events…) get typed
 * when a task needs them.
 */
import data from '../../data/balance.json'

export interface PrototypeBalance {
  readonly grid: {
    /** Streets per side of the grid. */
    readonly size: number
    readonly restaurants: number
  }
  readonly shift: {
    readonly durationSec: number
  }
  readonly orders: {
    readonly spawnIntervalSec: number
    readonly deadlineSec: number
    /** How long after its deadline an undelivered order is cancelled. */
    readonly cancelAfterSec: number
  }
  readonly kitchen: {
    readonly waitSec: number
  }
  readonly riders: {
    readonly count: number
    /** Vehicle id from the Vehículos tab. */
    readonly vehicle: string
    /** Speed on the prototype grid, in blocks per second. */
    readonly speedBlocksPerSec: number
  }
  readonly heat: {
    readonly start: number
    readonly lossPerSec: number
    readonly coldBelow: number
  }
  readonly rating: {
    readonly max: number
    readonly latePenalty: number
    readonly coldPenalty: number
    readonly min: number
    readonly cancelled: number
  }
}

export interface ShiftBalance {
  /** Average rating needed to win a shift. */
  readonly winAtLeast: number
  /** A shift is lost below this average rating. */
  readonly loseBelow: number
  readonly minDurationMin: number
  readonly maxDurationMin: number
}

export const prototype: PrototypeBalance = data.prototype
export const shift: ShiftBalance = data.shift
