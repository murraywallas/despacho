/**
 * When a rider reaches each customer of their trip: the rest of the ride to the restaurant, the wait until every
 * order is ready, then each customer in turn. The last customer waits the most: that is the price of batching.
 * Also what a free rider would do with a trip before getting it, so the player can compare riders by when the food
 * reaches the customer (not by who gets to the restaurant first). Pure.
 */
import { networkFor, type CityMap, type NodeId } from './cityMap'
import { rankRiders, restaurantOf, travelTimeSec, type RankedRider } from './dispatch'
import { hasBatteryFor, tripMeters } from './battery'
import { ordersOf, riderSpeed, startTrip, type Speeds } from './movement'
import type { Order } from './orders'
import { parkingSecOf } from './parking'
import type { Rider } from './riders'

export interface StopEta {
  readonly orderId: string
  /** Second of the shift when the rider reaches this customer. */
  readonly atSec: number
}

export function stopEtas(map: CityMap, rider: Rider, orders: readonly Order[], speeds: Speeds, nowSec: number): StopEta[] {
  const trip = rider.trip
  const stops = ordersOf(rider, orders)
  if (!trip || stops.length === 0) return []
  const network = networkFor(map, rider.vehicle)
  const speed = riderSpeed(speeds, rider)
  // The rest of the current leg, including the parking still to do at its end.
  const leftOfLeg = (trip.pathMeters[trip.pathMeters.length - 1] - trip.traveledM) / speed + (trip.parkLeftSec ?? 0)
  const park = parkingSecOf(rider.vehicle)
  const etas: StopEta[] = []
  let at = nowSec
  let from: NodeId

  if (rider.status === 'toRestaurant') {
    at += leftOfLeg
    at = Math.max(at, ...stops.map((order) => order.readyAtSec))
    from = restaurantOf(map, stops[0]).node
  } else if (rider.status === 'atKitchen') {
    at += trip.kitchenLeftSec
    from = rider.node
  } else if (trip.path[trip.path.length - 1] === stops[0].customer) {
    at += leftOfLeg
    etas.push({ orderId: stops[0].id, atSec: at })
    from = stops[0].customer
    stops.shift()
  } else {
    // Just reordered: the rider heads to the new first stop from the last crossing passed.
    from = rider.node
  }

  for (const stop of stops) {
    at += travelTimeSec(network, from, stop.customer, speed) + park
    etas.push({ orderId: stop.id, atSec: at })
    from = stop.customer
  }
  return etas
}

/**
 * When a free rider would reach each customer if they got these orders now (same restaurant, in delivery order):
 * the ride to the restaurant and the parking, the wait until the kitchen has every order, then each customer in
 * turn. Empty when the rider can't reach the restaurant.
 */
export function plannedEtas(map: CityMap, rider: Rider, trip: readonly Order[], speeds: Speeds, nowSec: number): StopEta[] {
  if (trip.length === 0) return []
  const restaurant = restaurantOf(map, trip[0]).node
  if (!Number.isFinite(travelTimeSec(networkFor(map, rider.vehicle), rider.node, restaurant, riderSpeed(speeds, rider)))) return []
  const planned = startTrip(map, { ...rider, status: 'toRestaurant', orderIds: trip.map((order) => order.id) }, trip)
  return stopEtas(map, planned, trip, speeds, nowSec)
}

export interface DeliveryOption extends RankedRider {
  /** Second of the shift when the first order of the trip would reach its customer. */
  readonly deliverAtSec: number
  /** The first order of the trip would arrive after its deadline. */
  readonly late: boolean
}

/**
 * Free riders whose vehicle carries the whole trip and whose battery (if any) lasts it, by when the first order would reach its customer (ties: lower
 * number first). Riders who can't get there at all are left out.
 */
export function rankByDelivery(
  map: CityMap,
  riders: readonly Rider[],
  trip: readonly Order[],
  speeds: Speeds,
  nowSec: number,
): DeliveryOption[] {
  const [first] = trip
  if (!first) return []
  return rankRiders(map, riders, first, speeds, trip.length)
    .filter((ranked) => ranked.rider.batteryM === undefined || hasBatteryFor(ranked.rider, tripMeters(map, ranked.rider, trip)))
    .flatMap((ranked) => {
      const eta = plannedEtas(map, ranked.rider, trip, speeds, nowSec)[0]
      if (!eta || !Number.isFinite(eta.atSec)) return []
      return [{ ...ranked, deliverAtSec: eta.atSec, late: eta.atSec > first.deadlineAtSec }]
    })
    .sort((a, b) => a.deliverAtSec - b.deliverAtSec || a.rider.number - b.rider.number)
}

/** The free rider who gets the order to its customer soonest: the suggestion shown next to an urgent order. */
export function suggestRider(map: CityMap, riders: readonly Rider[], order: Order, speeds: Speeds, nowSec: number): DeliveryOption | undefined {
  return rankByDelivery(map, riders, [order], speeds, nowSec)[0]
}

/**
 * Second of the shift when a rider will be free again: now if free; after the last stop of the trip (kitchen
 * included) if working; after riding back and recharging if going to recharge. Undefined when it can't be worked out.
 */
export function freeAtSec(
  map: CityMap,
  rider: Rider,
  orders: readonly Order[],
  speeds: Speeds,
  nowSec: number,
  rechargeSec = 0,
): number | undefined {
  if (rider.status === 'idle') return nowSec
  if (rider.status === 'charging') return nowSec + (rider.chargeLeftSec ?? 0)
  if (rider.status === 'toBase') {
    const trip = rider.trip
    if (!trip) return nowSec + rechargeSec
    return nowSec + (trip.pathMeters[trip.pathMeters.length - 1] - trip.traveledM) / riderSpeed(speeds, rider) + rechargeSec
  }
  return stopEtas(map, rider, orders, speeds, nowSec).at(-1)?.atSec
}
