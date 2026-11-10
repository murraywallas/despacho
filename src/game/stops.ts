/**
 * When a rider reaches each customer of their trip: the rest of the ride to the restaurant, the wait until every
 * order is ready, then each customer in turn. The last customer waits the most: that is the price of batching. Pure.
 */
import { networkFor, type CityMap, type NodeId } from './cityMap'
import { restaurantOf, travelTimeSec } from './dispatch'
import { ordersOf, speedOf, type Speeds } from './movement'
import type { Order } from './orders'
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
  const speed = speedOf(speeds, rider.vehicle)
  const leftOfLeg = (trip.pathMeters[trip.pathMeters.length - 1] - trip.traveledM) / speed
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
    at += travelTimeSec(network, from, stop.customer, speed)
    etas.push({ orderId: stop.id, atSec: at })
    from = stop.customer
  }
  return etas
}
