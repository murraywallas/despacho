/**
 * Riders: the people the player sends to pick up and deliver orders.
 * A rider stays wherever their last delivery ended, so where the fleet is matters.
 */
import type { CityMap } from './cityMap'
import { samePoint, type Point } from './grid'
import { randomInt, type Random } from './random'

/** What a rider is doing. Only "idle" is used until dispatching arrives (tasks #7 and #8). */
export type RiderStatus = 'idle' | 'toRestaurant' | 'atKitchen' | 'toCustomer'

export interface Rider {
  /** "k1", "k2"… */
  readonly id: string
  /** Number shown to the player and used by the 1–9 keys. */
  readonly number: number
  /** Vehicle id from the Vehículos tab, e.g. "bike". */
  readonly vehicle: string
  readonly position: Point
  readonly status: RiderStatus
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
