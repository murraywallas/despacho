/**
 * Game numbers, read from data/balance.json (generated from the balance spreadsheet with `npm run balance`).
 * The interfaces below are the contract with the spreadsheet: if a key is missing or has the wrong type,
 * `npm run build` fails here.
 *
 * Only the groups and fields the game uses are typed. The rest (neighborhoods, events…) get typed
 * when a task needs them.
 *
 * Times are in real seconds of play. The clock on screen shows game time: clock.gameSecondsPerRealSecond
 * converts one into the other.
 */
import data from '../../data/balance.json'

export interface PrototypeBalance {
  /** Seed for everything random in the prototype (restaurant spots, orders). Same seed, same game. */
  readonly seed: number
  readonly shift: {
    /** Hour of the game clock when the shift starts (18 = 18:00). */
    readonly startHour: number
    readonly durationSec: number
  }
  readonly restaurants: {
    readonly count: number
  }
  readonly orders: {
    readonly spawnIntervalSec: number
    readonly deadlineSec: number
    /** How long after its deadline an undelivered order is cancelled. */
    readonly cancelAfterSec: number
    /** An order is shown as urgent when it has less than this left. */
    readonly urgentBelowSec: number
    /** Customers live at least this far from the restaurant, in meters. */
    readonly minCustomerDistanceM: number
    /** The kitchen closes this long before the end of the shift: no new orders after that. */
    readonly lastOrderBeforeEndSec: number
  }
  readonly kitchen: {
    /** Seconds the kitchen needs from the moment an order comes in until the food is ready. */
    readonly cookSec: number
  }
  readonly riders: {
    readonly count: number
    /** Vehicle id from the Vehículos tab. */
    readonly vehicle: string
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
  /** Game seconds that pass in one real second of play. */
  readonly gameSecondsPerRealSecond: number
}

/** A row of the Vehículos tab (only what the game uses so far). */
export interface VehicleBalance {
  readonly speedKmh: number
}

export const prototype: PrototypeBalance = data.prototype
export const routing: RoutingBalance = data.routing
export const shift: ShiftBalance = data.shift
export const clock: ClockBalance = data.clock
export const vehicles: Readonly<Record<string, VehicleBalance>> = data.vehicles
