/**
 * Riders: the people the player sends to pick up and deliver orders.
 * A rider stays wherever their last delivery ended, so where the fleet is matters.
 */
import type { CityMap, NodeId } from './cityMap'
import { randomInt, type Random } from './random'

/** What a rider is doing. */
export type RiderStatus = 'idle' | 'toRestaurant' | 'atKitchen' | 'toCustomer'

/** The leg of an order the rider is on. */
export interface Trip {
  readonly orderId: string
  /** Crossings of the current leg, from where it started to where it ends. */
  readonly path: readonly NodeId[]
  /** Meters from the start of the leg to each crossing of `path`. */
  readonly pathMeters: readonly number[]
  /** Meters already ridden along `path`. */
  readonly traveledM: number
  /** Seconds left at the kitchen (only while "atKitchen"). */
  readonly kitchenLeftSec: number
  /** Route from the restaurant to the customer, planned when the order was assigned. */
  readonly toCustomer: readonly NodeId[]
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
  /** Order the rider is working on, when not idle. */
  readonly orderId?: string
  /** Current leg, while working on an order. */
  readonly trip?: Trip
}

/** Places `count` riders on different addresses, none of them on a restaurant. */
export function createRiders(map: CityMap, count: number, vehicle: string, random: Random): Rider[] {
  const taken = new Set(map.restaurants.map((restaurant) => restaurant.node))
  if (count > map.addresses.length - taken.size) throw new Error(`No entran ${count} repartidores en el barrio.`)
  const riders: Rider[] = []
  while (riders.length < count) {
    const node = map.addresses[randomInt(random, map.addresses.length)]
    if (taken.has(node)) continue
    taken.add(node)
    const number = riders.length + 1
    riders.push({ id: `k${number}`, number, vehicle, node, status: 'idle' })
  }
  return riders
}
