/**
 * Battery of electric vehicles (the e-scooter): it runs down with every meter ridden, a trip longer than what is
 * left is refused, and the rider goes back to base to recharge, which takes a while. Pure.
 */
import { networkFor, type CityMap, type NodeId } from './cityMap'
import { restaurantOf } from './dispatch'
import type { Order } from './orders'
import type { Rider } from './riders'
import { cumulativeMeters, findRoute, type StreetNetwork } from './routing'

const METERS_PER_KM = 1000
/** Tolerance for floating-point leftovers when the battery is exactly enough. */
const EPSILON = 1e-6

/** Full battery in meters, for a vehicle with rangeKm; undefined for one without a battery. */
export function fullBatteryM(rangeKm: number | undefined): number | undefined {
  return rangeKm === undefined ? undefined : rangeKm * METERS_PER_KM
}

function metersBetween(network: StreetNetwork, from: NodeId, to: NodeId): number {
  if (from === to) return 0
  return findRoute(network, from, to)?.effectiveM ?? Infinity
}

/** Meters of a whole trip: from where the rider is to the restaurant, then to each customer in turn. */
export function tripMeters(map: CityMap, rider: Rider, orders: readonly Order[]): number {
  if (orders.length === 0) return 0
  const network = networkFor(map, rider.vehicle)
  let from = restaurantOf(map, orders[0]).node
  let meters = metersBetween(network, rider.node, from)
  for (const order of orders) {
    meters += metersBetween(network, from, order.customer)
    from = order.customer
  }
  return meters
}

/** Whether the battery is enough for this many meters (always, for a vehicle without a battery). */
export function hasBatteryFor(rider: Rider, meters: number): boolean {
  return rider.batteryM === undefined || meters <= rider.batteryM + EPSILON
}

/** What is left of the battery, from 0 to 1; undefined for a vehicle without a battery. */
export function batteryShare(rider: Rider, fullM: number | undefined): number | undefined {
  if (rider.batteryM === undefined || !fullM) return undefined
  return Math.max(0, Math.min(1, rider.batteryM / fullM))
}

/** A battery shown as low: below lowShare of its charge, and not charging right now. */
export function isLowBattery(rider: Rider, share: number | undefined, lowShare: number): boolean {
  return share !== undefined && rider.status !== 'charging' && share < lowShare
}

/** The battery after riding this many meters (it never goes below zero). */
export function drain(rider: Rider, meters: number): Rider {
  if (rider.batteryM === undefined || meters <= 0) return rider
  return { ...rider, batteryM: Math.max(0, rider.batteryM - meters) }
}

/** Sends an idle rider back to their base to recharge: riding there, or charging right away if already there. */
export function sendToCharge(map: CityMap, rider: Rider, rechargeSec: number): Rider {
  const home = rider.home ?? rider.node
  const base = { ...rider, orderIds: undefined, trip: undefined }
  if (rider.node === home) return { ...base, status: 'charging', chargeLeftSec: rechargeSec }
  const network = networkFor(map, rider.vehicle)
  const route = findRoute(network, rider.node, home)
  if (!route) return { ...base, status: 'charging', chargeLeftSec: rechargeSec }
  const path = [...route.nodes]
  const pathMeters = cumulativeMeters(network, path)
  return { ...base, status: 'toBase', trip: { path, pathMeters, traveledM: 0, kitchenLeftSec: 0 } }
}

/**
 * Moves a rider who is going back to recharge: riding to the base, then charging there. When the charge is done the
 * battery is full and the rider is free again, at the base.
 */
export function advanceCharging(
  rider: Rider,
  dtSec: number,
  metersPerSec: number,
  rechargeSec: number,
  fullM: number | undefined,
): Rider {
  let current = rider
  let left = dtSec
  if (current.status === 'toBase' && current.trip) {
    const trip = current.trip
    const total = trip.pathMeters[trip.pathMeters.length - 1]
    const remainingM = total - trip.traveledM
    const timeToEnd = remainingM / metersPerSec
    if (left < timeToEnd) {
      const traveledM = trip.traveledM + left * metersPerSec
      let index = 0
      while (index + 1 < trip.path.length && trip.pathMeters[index + 1] <= traveledM + EPSILON) index++
      return drain({ ...current, node: trip.path[index], trip: { ...trip, traveledM } }, left * metersPerSec)
    }
    left -= timeToEnd
    current = drain(current, remainingM)
    current = { ...current, node: trip.path[trip.path.length - 1], trip: undefined, status: 'charging', chargeLeftSec: rechargeSec }
  }
  if (current.status !== 'charging') return current
  const chargeLeftSec = (current.chargeLeftSec ?? 0) - left
  if (chargeLeftSec > EPSILON) return { ...current, chargeLeftSec }
  return { ...current, status: 'idle', chargeLeftSec: undefined, ...(fullM === undefined ? {} : { batteryM: fullM }) }
}
