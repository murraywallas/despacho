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
    /** A zone of the neighborhood (Kødbyen…) where zoneRestaurants of them stand within zoneRadiusM of its middle. */
    readonly zone?: string
    readonly zoneRestaurants?: number
    readonly zoneRadiusM?: number
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
    /** The rush of the shift (optional): from this second to that one, orders come every peakIntervalSec. */
    readonly peakFromSec?: number
    readonly peakToSec?: number
    readonly peakIntervalSec?: number
  }
  readonly kitchen: {
    /** Seconds the kitchen needs from the moment an order comes in until the food is ready. */
    readonly cookSec: number
  }
  readonly riders: {
    /** One rider per vehicle, in order: ids from the Vehículos tab separated by commas ("bike, skateboard"). */
    readonly fleet: string
  }
  readonly heat: {
    /** Heat of the food when the kitchen has it ready. */
    readonly start: number
    /** Heat lost per second from the moment the food is ready until it is delivered. */
    readonly lossPerSec: number
    readonly coldBelow: number
  }
  /** The operator's tools. */
  readonly tools: {
    /** Reassigning an order costs this much of its deadline. */
    readonly reassignPenaltySec: number
    /** How many times per shift the operator can call a customer. */
    readonly callsPerShift: number
    /** Extra time a call to the customer adds to the deadline. */
    readonly callExtendSec: number
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
  /** Speeds the player can pick, separated by commas ("1, 2, 3"). */
  readonly speeds: string
}

/** The clock speeds the player can pick, from slowest to fastest. Always includes normal speed (1). */
export function clockSpeeds(balance: Pick<ClockBalance, 'speeds'>): number[] {
  const listed = balance.speeds
    .split(',')
    .map((speed) => Number(speed.trim()))
    .filter((speed) => Number.isFinite(speed) && speed > 0)
  return [...new Set([1, ...listed])].sort((a, b) => a - b)
}

/** A row of the Vehículos tab (only what the game uses so far). */
export interface VehicleBalance {
  readonly speedKmh: number
  /** Orders it can carry at once. */
  readonly capacity: number
  /** Speed change on cobblestones, as a share (−0.5 = half speed). */
  readonly cobblestoneSpeedPct?: number
  readonly usesBikeLanes?: boolean
  /** May ride through pedestrian streets and footways. */
  readonly allowedInPedestrian?: boolean
  /** Battery range, for electric vehicles. */
  readonly rangeKm?: number
  /** Minutes of game time it takes to park at each stop. */
  readonly parkingMin?: number
  /** Streets it rides: "bike" (cycle tracks and streets) or "car" (the car network, no cycle tracks). */
  readonly roads?: string
}

/**
 * A row of the Niveles tab: one shift of a neighborhood (lunch, dinner, Friday night). Its numbers replace the
 * prototype's (Reglas tab); everything else (heat, stars, tools, kitchen) is the same for every level.
 */
export interface LevelBalance {
  /** Position in the neighborhood: 1, 2, 3… */
  readonly order: number
  readonly neighborhood: string
  readonly startHour: number
  readonly durationSec: number
  readonly restaurants: number
  /** Zone where zoneRestaurants of them stand together, within zoneRadiusM of its middle (optional). */
  readonly zone?: string
  readonly zoneRestaurants?: number
  readonly zoneRadiusM?: number
  /** One rider per vehicle, in order (ids of the Vehículos tab). */
  readonly fleet: readonly string[]
  readonly spawnIntervalSec: number
  readonly peakFromSec?: number
  readonly peakToSec?: number
  readonly peakIntervalSec?: number
  readonly deadlineSec: number
  readonly seed: number
  /** Light of the map: "noon", "dusk" or "night" (the interface knows the colors of each). */
  readonly light?: string
}

export interface ProgressionBalance {
  /** Average stars in a level needed to unlock the next one. */
  readonly unlockAvgRating: number
}

export const prototype: PrototypeBalance = data.prototype
export const levels: Readonly<Record<string, LevelBalance>> = data.levels
export const progression: ProgressionBalance = data.progression

/** Level ids in the order they are played. */
export const levelIds: readonly string[] = Object.keys(levels).sort((a, b) => levels[a].order - levels[b].order)

/** The rules of one level: the prototype's, with the level's own numbers on top. */
export function levelBalance(base: PrototypeBalance, level: LevelBalance): PrototypeBalance {
  return {
    ...base,
    seed: level.seed,
    shift: { startHour: level.startHour, durationSec: level.durationSec },
    restaurants: {
      count: level.restaurants,
      ...(level.zone ? { zone: level.zone, zoneRestaurants: level.zoneRestaurants, zoneRadiusM: level.zoneRadiusM } : {}),
    },
    riders: { fleet: level.fleet.join(', ') },
    orders: {
      ...base.orders,
      spawnIntervalSec: level.spawnIntervalSec,
      deadlineSec: level.deadlineSec,
      peakFromSec: level.peakFromSec,
      peakToSec: level.peakToSec,
      peakIntervalSec: level.peakIntervalSec,
    },
  }
}
export const routing: RoutingBalance = data.routing
export const shift: ShiftBalance = data.shift
export const clock: ClockBalance = data.clock
export const vehicles: Readonly<Record<string, VehicleBalance>> = data.vehicles

/** The vehicles of the fleet, one per rider, in order. */
export function fleetOf(balance: Pick<PrototypeBalance, 'riders'>): string[] {
  return balance.riders.fleet
    .split(',')
    .map((vehicle) => vehicle.trim())
    .filter((vehicle) => vehicle !== '')
}
