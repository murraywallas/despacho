/**
 * Dispatching: estimating how long each rider takes to reach a restaurant, ranking the free riders
 * and assigning an order to one of them. Pure: functions return new arrays.
 */
import type { CityMap, Restaurant } from './cityMap'
import { shortestRoute, type Point } from './grid'
import type { Order } from './orders'
import type { Rider } from './riders'

/** Game seconds a rider needs to ride from one intersection to another. */
export function travelTimeSec(map: CityMap, from: Point, to: Point, speedBlocksPerSec: number): number {
  return shortestRoute(map.grid, from, to).blocks / speedBlocksPerSec
}

export function restaurantOf(map: CityMap, order: Order): Restaurant {
  const restaurant = map.restaurants.find((candidate) => candidate.id === order.restaurantId)
  if (!restaurant) throw new Error(`El pedido ${order.id} es de un restaurante que no existe: ${order.restaurantId}`)
  return restaurant
}

export interface RankedRider {
  readonly rider: Rider
  /** Game seconds until the rider reaches the order's restaurant. */
  readonly etaSec: number
}

/** Free riders, closest to the order's restaurant first (ties: lower number first). */
export function rankRiders(
  map: CityMap,
  riders: readonly Rider[],
  order: Order,
  speedBlocksPerSec: number,
): RankedRider[] {
  const restaurant = restaurantOf(map, order)
  return riders
    .filter((rider) => rider.status === 'idle')
    .map((rider) => ({ rider, etaSec: travelTimeSec(map, rider.position, restaurant.position, speedBlocksPerSec) }))
    .sort((a, b) => a.etaSec - b.etaSec || a.rider.number - b.rider.number)
}

/** The whole trip: from the rider to the restaurant, then to the customer. */
export function plannedRoute(map: CityMap, rider: Rider, order: Order): Point[] {
  const restaurant = restaurantOf(map, order).position
  const toRestaurant = shortestRoute(map.grid, rider.position, restaurant).points
  const toCustomer = shortestRoute(map.grid, restaurant, order.customer).points
  return [...toRestaurant, ...toCustomer.slice(1)]
}

export type AssignError = 'order-not-found' | 'rider-not-found' | 'order-not-pending' | 'rider-busy'

export type AssignResult =
  | { readonly ok: true; readonly orders: Order[]; readonly riders: Rider[] }
  | { readonly ok: false; readonly error: AssignError }

/** Gives a pending order to a free rider, who heads to the restaurant. */
export function assignOrder(
  orders: readonly Order[],
  riders: readonly Rider[],
  orderId: string,
  riderId: string,
): AssignResult {
  const order = orders.find((candidate) => candidate.id === orderId)
  const rider = riders.find((candidate) => candidate.id === riderId)
  if (!order) return { ok: false, error: 'order-not-found' }
  if (!rider) return { ok: false, error: 'rider-not-found' }
  if (order.status !== 'pending') return { ok: false, error: 'order-not-pending' }
  if (rider.status !== 'idle') return { ok: false, error: 'rider-busy' }

  return {
    ok: true,
    orders: orders.map((candidate) =>
      candidate.id === orderId ? { ...candidate, status: 'assigned', riderId } : candidate,
    ),
    riders: riders.map((candidate) =>
      candidate.id === riderId ? { ...candidate, status: 'toRestaurant', orderId } : candidate,
    ),
  }
}
