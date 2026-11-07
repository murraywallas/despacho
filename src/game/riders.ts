/**
 * Riders: the people the player sends to pick up and deliver orders.
 * A rider stays wherever their last delivery ended, so where the fleet is matters.
 */
import type { CityMap } from './cityMap'
import { samePoint, type Point } from './grid'
import { randomInt, type Random } from './random'

/** What a rider is doing. */
export type RiderStatus = 'idle' | 'toRestaurant' | 'atKitchen' | 'toCustomer'

/** The leg of an order the rider is on. */
export interface Trip {
  readonly orderId: string
  /** Intersections of the current leg, from where it started to where it ends. */
  readonly path: readonly Point[]
  /** Blocks already ridden along `path` (can be fractional). */
  readonly traveledBlocks: number
  /** Game seconds left at the kitchen (only while "atKitchen"). */
  readonly kitchenLeftSec: number
}

export interface Rider {
  /** "k1", "k2"… */
  readonly id: string
  /** Number shown to the player and used by the 1–9 keys. */
  readonly number: number
  /** Vehicle id from the Vehículos tab, e.g. "bike". */
  readonly vehicle: string
  /** Last intersection the rider was at. While riding, see riderDisplayPosition for where they are now. */
  readonly position: Point
  readonly status: RiderStatus
  /** Order the rider is working on, when not idle. */
  readonly orderId?: string
  /** Current leg, while working on an order. */
  readonly trip?: Trip
}

/** Places `count` riders on different intersections, none of them on a restaurant. */
export function createRiders(map: CityMap, count: number, vehicle: string, random: Random): Rider[] {
  const freeSpots = map.grid.size * map.grid.size - map.restaurants.length
  if (count > freeSpots) {
    throw new Error(`No entran ${count} repartidores en una grilla de ${map.grid.size}×${map.grid.size}.`)
  }
  const taken: Point[] = map.restaurants.map((restaurant) => restaurant.position)
  const riders: Rider[] = []
  while (riders.length < count) {
    const position = { x: randomInt(random, map.grid.size), y: randomInt(random, map.grid.size) }
    if (taken.some((spot) => samePoint(spot, position))) continue
    taken.push(position)
    const number = riders.length + 1
    riders.push({ id: `k${number}`, number, vehicle, position, status: 'idle' })
  }
  return riders
}
