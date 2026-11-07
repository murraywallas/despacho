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
  /** Seed for everything random in the prototype (restaurant spots, orders). Same seed, same game. */
  readonly seed: number
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
    /** An order is shown as urgent when it has less than this left. */
    readonly urgentBelowSec: number
  }
  readonly kitchen: {
    /** Seconds the kitchen needs from the moment an order comes in until the food is ready. */
    readonly cookSec: number
  }
  readonly riders: {
    readonly count: number
    /** Vehicle id from the Vehículos tab. */
    readonly vehicle: string
    /** Speed on the prototype grid, in blocks per second. */
    readonly speedBlocksPerSec: number
  }
  readonly heat: {
    /** Heat of the food when the kitchen has it ready. */
    readonly start: number
    /** Heat lost per second from the moment the food is ready until it is delivered. */
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

/** How much each kind of stretch costs a route, as a multiple of its length (1 = neutral). */
export interface RoutingBalance {
  /** Stretches with a cycle track or lane, for vehicles that use them: below 1 makes them preferred. */
  readonly cycleTrackFactor: number
  /** Main streets without a cycle track, by bike. */
  readonly majorWithoutTrackFactor: number
  /** Pedestrian ways where bikes are allowed. */
  readonly pedestrianFactor: number
}

export interface ClockBalance {
  /** Multiplier of the fast speed button (the "2x"). */
  readonly fastSpeed: number
}

export const prototype: PrototypeBalance = data.prototype
export const routing: RoutingBalance = data.routing
export const shift: ShiftBalance = data.shift
export const clock: ClockBalance = data.clock
