/**
 * Riders: the people the player sends to pick up and deliver orders.
 * A rider stays wherever their last delivery ended, so where the fleet is matters.
 */
import type { CityMap, NodeId } from './cityMap'
import { randomInt, type Random } from './random'

/** What a rider is doing. toBase and charging: an electric vehicle going back to recharge its battery. */
export type RiderStatus = 'idle' | 'toRestaurant' | 'atKitchen' | 'toCustomer' | 'toBase' | 'charging'

/** The leg of the trip the rider is on: to the restaurant, or to the next customer. */
export interface Trip {
  /** Crossings of the current leg, from where it started to where it ends. */
  readonly path: readonly NodeId[]
  /** Meters at full speed from the start of the leg to each crossing of `path`. */
  readonly pathMeters: readonly number[]
  /** Meters at full speed already ridden along `path`. */
  readonly traveledM: number
  /** Seconds left at the kitchen (only while "atKitchen"). */
  readonly kitchenLeftSec: number
  /** Seconds still to park at the end of this leg, before the stop (motorbike, car). Missing means none. */
  readonly parkLeftSec?: number
}

export interface Rider {
  /** "k1", "k2"… */
  readonly id: string
  /** Number shown to the player and used by the 1–9 keys. */
  readonly number: number
  /** Vehicle id from the Vehículos tab, e.g. "bike". */
  readonly vehicle: string
  /** Last crossing the rider was at. While riding, see riderDisplayPosition for where they are now. */
  readonly node: NodeId
  readonly status: RiderStatus
  /**
   * Orders the rider is working on, all from the same restaurant, in delivery order: the first one is the next
   * stop. Delivered orders leave the list. Empty or missing when idle.
   */
  readonly orderIds?: readonly string[]
  /** Current leg, while working on an order (or going back to the base). */
  readonly trip?: Trip
  /** Where the rider started the shift: their base, where an electric vehicle recharges (missing: where they are). */
  readonly home?: NodeId
  /** Meters of battery left, for vehicles with a battery (rangeKm in the Vehículos tab). */
  readonly batteryM?: number
  /** Seconds of play left to finish recharging (only while "charging"). */
  readonly chargeLeftSec?: number
}

/**
 * One rider per vehicle of the fleet, in order, on different addresses, none of them on a restaurant. Each one's
 * address is their base; batteryMOf gives the full battery of a vehicle that has one.
 */
export function createRiders(
  map: CityMap,
  fleet: readonly string[],
  random: Random,
  batteryMOf: (vehicle: string) => number | undefined = () => undefined,
): Rider[] {
  const taken = new Set(map.restaurants.map((restaurant) => restaurant.node))
  if (fleet.length > map.addresses.length - taken.size) {
    throw new Error(`No entran ${fleet.length} repartidores en el barrio.`)
  }
  const riders: Rider[] = []
  while (riders.length < fleet.length) {
    const node = map.addresses[randomInt(random, map.addresses.length)]
    if (taken.has(node)) continue
    taken.add(node)
    const number = riders.length + 1
    const vehicle = fleet[number - 1]
    const batteryM = batteryMOf(vehicle)
    riders.push({ id: `k${number}`, number, vehicle, node, home: node, status: 'idle', ...(batteryM === undefined ? {} : { batteryM }) })
  }
  return riders
}
