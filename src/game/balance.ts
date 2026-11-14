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
import type { ExperienceRules } from './experience'
import { struckVehicles, withoutStruck } from './shiftEvents'

export interface PrototypeBalance {
  /** Seed for everything random in the prototype (restaurant spots, orders). Same seed, same game. */
  readonly seed: number
  /** Events of the shift (rain…), from the level's events column; none for the prototype. */
  readonly events?: readonly (ShiftEventBalance & { readonly id: string })[]
  readonly shift: {
    /** Hour of the game clock when the shift starts (18 = 18:00). */
    readonly startHour: number
    readonly durationSec: number
  }
  readonly restaurants: {
    readonly count: number
    /** No two restaurants closer than this, in meters (optional), so their pins don't cover each other. */
    readonly minSpacingM?: number
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
    /** Seconds of play a battery takes to recharge at the rider's base (optional). */
    readonly rechargeSec?: number
    /** Below this share of its charge, a battery is shown as low (0.2 = 20 %). */
    readonly lowBatteryPct?: number
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
    /** A rider who goes free stands out this long when no orders are waiting (with orders waiting, until used). */
    readonly freeHighlightSec?: number
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
  /** Speed change in the rain, as a share (−0.1 = 10 % slower). */
  readonly rainSpeedPct?: number
  /** Speed change with the wind right behind (+) or straight into it (−), as a share; pedal vehicles only. */
  readonly windSpeedPct?: number
  /** What a rider on this vehicle costs per shift, in kr. */
  readonly costPerShiftKr: number
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
  /** Events of the shift: ids of the Eventos de turno tab (optional). */
  readonly events?: readonly string[]
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
  /** Customers live at least this far from the restaurant, in meters (optional: the Reglas tab's otherwise). */
  readonly minCustomerDistanceM?: number
  readonly seed: number
  /** Light of the map: "noon", "dusk" or "night" (the interface knows the colors of each). */
  readonly light?: string
}

export interface ProgressionBalance {
  /** Stars needed in a level to open the next one, and average stars in a neighborhood to open the next one. */
  readonly unlockAvgRating: number
}

export const prototype: PrototypeBalance = data.prototype
export const levels: Readonly<Record<string, LevelBalance>> = data.levels
export const progression: ProgressionBalance = data.progression

/** Money (Reglas tab, group Dinero). */
export interface EconomyBalance {
  /** What each delivery on time pays, before the tip, in kr. */
  readonly deliveryPayKr: number
  /** Tip per star of the delivery, in kr. */
  readonly tipPerStarKr: number
  /** Money the player starts the game with, in kr. */
  readonly startingKr: number
  /** Riders the player has hired when the game starts. */
  readonly startingRiders: number
  /** What hiring one more rider costs, once, in kr. */
  readonly hireRiderKr: number
}

export const economy: EconomyBalance = data.economy

/** Riders' experience (Reglas tab, group Repartidores). */
export const experience: ExperienceRules = data.riders

/** A neighborhood of the Barrios tab (only what the game uses). */
export interface NeighborhoodBalance {
  /** Vehicles the garage offers there (ids of the Vehículos tab). */
  readonly vehicles: readonly string[]
}

export const neighborhoods: Readonly<Record<string, NeighborhoodBalance>> = data.neighborhoods

/** Level ids in the order they are played. */
export const levelIds: readonly string[] = Object.keys(levels).sort((a, b) => levels[a].order - levels[b].order)

/** The rules of one level: the prototype's, with the level's own numbers on top. */
export function levelBalance(base: PrototypeBalance, level: LevelBalance): PrototypeBalance {
  return {
    ...base,
    seed: level.seed,
    shift: { startHour: level.startHour, durationSec: level.durationSec },
    restaurants: {
      ...base.restaurants,
      count: level.restaurants,
      ...(level.zone ? { zone: level.zone, zoneRestaurants: level.zoneRestaurants, zoneRadiusM: level.zoneRadiusM } : {}),
    },
    // A vehicle on strike doesn't go out: the suggested fleet takes the next vehicle of the neighborhood instead.
    riders: { ...base.riders, fleet: withoutStruck(level.fleet, struckOf(level), neighborhoods[level.neighborhood]?.vehicles ?? level.fleet).join(', ') },
    orders: {
      ...base.orders,
      spawnIntervalSec: level.spawnIntervalSec,
      deadlineSec: level.deadlineSec,
      peakFromSec: level.peakFromSec,
      peakToSec: level.peakToSec,
      peakIntervalSec: level.peakIntervalSec,
      minCustomerDistanceM: level.minCustomerDistanceM ?? base.orders.minCustomerDistanceM,
    },
    events: (level.events ?? []).map((id) => {
      const row = shiftEvents[id]
      if (!row) throw new Error(`El evento ${id} del nivel no está en la pestaña Eventos de turno.`)
      return { id, ...row }
    }),
  }
}
/** A row of the Eventos de turno tab: one event of a level's shift. */
export interface ShiftEventBalance {
  /** Kind of event: a row of the Eventos tab. */
  readonly event: string
  readonly fromSec: number
  readonly toSec: number
  readonly announced: boolean
  /** Wind: where it blows from, in degrees (0 = north, 90 = east, 270 = west). */
  readonly directionDeg?: number
  /** Closed streets (marathon): a route of data/closures.json. */
  readonly closure?: string
  /** Strike: the vehicle (Vehículos id) that doesn't go out. */
  readonly vehicle?: string
}

export const shiftEvents: Readonly<Record<string, ShiftEventBalance>> = data.shiftEvents

/** Vehicles on strike in a level's shift. */
export function struckOf(level: LevelBalance): string[] {
  return struckVehicles((level.events ?? []).flatMap((id) => shiftEvents[id] ?? []), eventKinds)
}

/** A kind of event (Eventos tab), only what the game uses so far. */
export interface EventKindBalance {
  /** speed, roads, fleet, demand, kitchen. */
  readonly effectType: string
  /** Extra orders while it lasts (0.3 = 30 % more). */
  readonly demandPct?: number
}

export const eventKinds: Readonly<Record<string, EventKindBalance>> = data.events

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
