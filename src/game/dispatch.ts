/**
 * Dispatching: estimating how long each rider takes to reach a restaurant, ranking the free riders
 * and assigning an order to one of them. Pure: functions return new arrays.
 */
import { networkFor, type CityMap, type NodeId, type Restaurant } from './cityMap'
import { speedOf, type Speeds } from './movement'
import type { Order } from './orders'
import type { Rider } from './riders'
import { vehicles } from './balance'
import { findRoute, type StreetNetwork } from './routing'

/** How many orders a vehicle carries at once (1 for a vehicle not in the Vehículos tab). */
export function capacityOf(vehicle: string): number {
  return vehicles[vehicle]?.capacity ?? 1
}

/** Seconds of play to ride from one crossing to another on a vehicle's streets (Infinity when there is no route). */
export function travelTimeSec(network: StreetNetwork, from: NodeId, to: NodeId, metersPerSec: number): number {
  const route = findRoute(network, from, to)
  return route ? route.effectiveM / metersPerSec : Infinity
}

/** Seconds of play a rider needs to ride from where they are to a crossing, on their vehicle. */
export function riderTimeSec(map: CityMap, rider: Rider, to: NodeId, speeds: Speeds): number {
  return travelTimeSec(networkFor(map, rider.vehicle), rider.node, to, speedOf(speeds, rider.vehicle))
}

export function restaurantOf(map: CityMap, order: Order): Restaurant {
  const restaurant = map.restaurants.find((candidate) => candidate.id === order.restaurantId)
  if (!restaurant) throw new Error(`El pedido ${order.id} es de un restaurante que no existe: ${order.restaurantId}`)
  return restaurant
}

export interface RankedRider {
  readonly rider: Rider
  /** Seconds of play until the rider reaches the order's restaurant. */
  readonly etaSec: number
}

/**
 * Free riders whose vehicle carries at least count orders, closest to the order's restaurant first (ties: lower
 * number first).
 */
export function rankRiders(
  map: CityMap,
  riders: readonly Rider[],
  order: Order,
  speeds: Speeds,
  count = 1,
): RankedRider[] {
  const restaurant = restaurantOf(map, order)
  return riders
    .filter((rider) => rider.status === 'idle' && capacityOf(rider.vehicle) >= count)
    .map((rider) => ({ rider, etaSec: riderTimeSec(map, rider, restaurant.node, speeds) }))
    .sort((a, b) => a.etaSec - b.etaSec || a.rider.number - b.rider.number)
}

export type AssignError =
  | 'order-not-found'
  | 'rider-not-found'
  | 'order-not-pending'
  | 'rider-busy'
  | 'no-orders'
  | 'different-restaurants'
  | 'over-capacity'

export type AssignResult =
  | { readonly ok: true; readonly orders: Order[]; readonly riders: Rider[] }
  | { readonly ok: false; readonly error: AssignError }

/**
 * Gives one or more pending orders of the same restaurant to a free rider, who heads there and delivers them in
 * the order given. `capacity` is how many orders the rider's vehicle carries (from the Vehículos tab).
 */
export function assignOrders(
  orders: readonly Order[],
  riders: readonly Rider[],
  orderIds: readonly string[],
  riderId: string,
  capacity = 1,
): AssignResult {
  const picked = orderIds.map((id) => orders.find((candidate) => candidate.id === id))
  const rider = riders.find((candidate) => candidate.id === riderId)
  if (orderIds.length === 0) return { ok: false, error: 'no-orders' }
  if (picked.some((order) => !order)) return { ok: false, error: 'order-not-found' }
  if (!rider) return { ok: false, error: 'rider-not-found' }
  const trip = picked as Order[]
  if (trip.some((order) => order.status !== 'pending')) return { ok: false, error: 'order-not-pending' }
  if (rider.status !== 'idle') return { ok: false, error: 'rider-busy' }
  if (trip.some((order) => order.restaurantId !== trip[0].restaurantId)) return { ok: false, error: 'different-restaurants' }
  if (trip.length > capacity) return { ok: false, error: 'over-capacity' }

  const ids = new Set(orderIds)
  return {
    ok: true,
    orders: orders.map((candidate) => (ids.has(candidate.id) ? { ...candidate, status: 'assigned', riderId } : candidate)),
    riders: riders.map((candidate) =>
      candidate.id === riderId ? { ...candidate, status: 'toRestaurant', orderIds: [...orderIds] } : candidate,
    ),
  }
}

/** Gives a pending order to a free rider, who heads to the restaurant. */
export function assignOrder(
  orders: readonly Order[],
  riders: readonly Rider[],
  orderId: string,
  riderId: string,
): AssignResult {
  return assignOrders(orders, riders, [orderId], riderId)
}
