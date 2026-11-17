/**
 * Pickups of a trip: a rider can take orders from restaurants standing close to each other (Kødbyen…) on the same
 * trip. They pick up at each restaurant in turn, in the order the restaurants first appear among the stops, and
 * only then ride to the customers. Pure.
 */
import { positionOf, type CityMap, type NodeId, type Restaurant } from './cityMap'
import { prototype } from './balance'
import type { Order } from './orders'
import { distanceM } from './streetGraph'

/** One stop to pick up food: a restaurant and the orders of the trip waiting there. */
export interface Pickup {
  readonly restaurant: Restaurant
  readonly orders: readonly Order[]
  /** Second of the shift when the kitchen has every one of these orders ready. */
  readonly readyAtSec: number
}

/** Restaurants of different orders can share a trip when they stand at most this far apart (straight line). */
export const NEARBY_RESTAURANTS_M = prototype.orders.nearbyRestaurantsM ?? 0

function restaurantById(map: CityMap, id: string): Restaurant {
  const restaurant = map.restaurants.find((candidate) => candidate.id === id)
  if (!restaurant) throw new Error(`No existe el restaurante ${id}.`)
  return restaurant
}

/**
 * The restaurants still to visit for these orders (the ones already picked up are skipped), each once, in the
 * order they first appear in the list.
 */
export function pickupsOf(map: CityMap, orders: readonly Order[]): Pickup[] {
  const pickups: { restaurant: Restaurant; orders: Order[] }[] = []
  for (const order of orders) {
    if (order.status === 'pickedUp' || order.status === 'delivered' || order.status === 'cancelled') continue
    const found = pickups.find((pickup) => pickup.restaurant.id === order.restaurantId)
    if (found) found.orders.push(order)
    else pickups.push({ restaurant: restaurantById(map, order.restaurantId), orders: [order] })
  }
  return pickups.map((pickup) => ({ ...pickup, readyAtSec: Math.max(...pickup.orders.map((order) => order.readyAtSec)) }))
}

/** The restaurants to visit after the one at `here` (the one the rider is at or riding to), in turn. */
export function laterPickups(map: CityMap, orders: readonly Order[], here: NodeId): Pickup[] {
  return pickupsOf(map, orders).filter((pickup) => pickup.restaurant.node !== here)
}

/** Whether two restaurants are close enough to share a trip (always, for the same one). */
export function nearEnough(map: CityMap, a: string, b: string, maxApartM = NEARBY_RESTAURANTS_M): boolean {
  if (a === b) return true
  const from = positionOf(map, restaurantById(map, a).node)
  const to = positionOf(map, restaurantById(map, b).node)
  return distanceM(from, to) <= maxApartM
}

/** Whether these orders can go on one trip: every two of their restaurants are close enough. */
export function canShareTrip(map: CityMap, orders: readonly Order[], maxApartM = NEARBY_RESTAURANTS_M): boolean {
  const ids = [...new Set(orders.map((order) => order.restaurantId))]
  return ids.every((a, index) => ids.slice(index + 1).every((b) => nearEnough(map, a, b, maxApartM)))
}
