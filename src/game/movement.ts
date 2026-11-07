/**
 * Riders on the move along real streets: riding to the restaurant, waiting for the kitchen if the food is not
 * ready yet, riding to the customer, delivering.
 * Everything advances with seconds of play, so pause and fast speed come for free. Pure.
 */
import { positionOf, type CityMap, type NodeId } from './cityMap'
import { restaurantOf } from './dispatch'
import type { Order } from './orders'
import type { Rider, Trip } from './riders'
import { cumulativeMeters, findRoute } from './routing'
import type { LonLat } from './streetGraph'

export interface MovementSettings {
  /** How fast riders go, in meters per second of play (vehicle speed × game time per real second). */
  readonly metersPerSec: number
}

/** Tolerance for floating-point leftovers when a rider arrives exactly at the end of a step. */
const EPSILON = 1e-9

function routeNodes(map: CityMap, from: NodeId, to: NodeId): NodeId[] {
  const route = findRoute(map.network, from, to)
  if (!route) throw new Error(`No hay ruta de ${from} a ${to}.`)
  return [...route.nodes]
}

function leg(map: CityMap, path: readonly NodeId[]): Pick<Trip, 'path' | 'pathMeters' | 'traveledM'> {
  return { path, pathMeters: cumulativeMeters(map.network, path), traveledM: 0 }
}

/** Starts the first leg (to the restaurant) of a rider who just got an order, and plans the second one. */
export function startTrip(map: CityMap, rider: Rider, order: Order): Rider {
  const restaurant = restaurantOf(map, order).node
  return {
    ...rider,
    trip: {
      orderId: order.id,
      ...leg(map, routeNodes(map, rider.node, restaurant)),
      kitchenLeftSec: 0,
      toCustomer: routeNodes(map, restaurant, order.customer),
    },
  }
}

/** Index of the last crossing passed along the leg. */
export function passedIndex(trip: Trip): number {
  let index = 0
  while (index + 1 < trip.path.length && trip.pathMeters[index + 1] <= trip.traveledM + EPSILON) index++
  return index
}

/** Where the rider is drawn: between two crossings while riding. */
export function riderDisplayPosition(map: CityMap, rider: Rider): LonLat {
  const trip = rider.trip
  if (!trip || (rider.status !== 'toRestaurant' && rider.status !== 'toCustomer')) return positionOf(map, rider.node)
  const index = passedIndex(trip)
  const from = positionOf(map, trip.path[index])
  if (index + 1 >= trip.path.length) return from
  const to = positionOf(map, trip.path[index + 1])
  const stretch = trip.pathMeters[index + 1] - trip.pathMeters[index]
  const fraction = stretch > 0 ? (trip.traveledM - trip.pathMeters[index]) / stretch : 0
  return [from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction]
}

/** What is left of the trip, from where the rider is now to the customer. */
export function remainingRoute(map: CityMap, rider: Rider): LonLat[] {
  const trip = rider.trip
  if (!trip) return []
  const toCustomer = trip.toCustomer.map((node) => positionOf(map, node))
  if (rider.status === 'atKitchen') return toCustomer
  const ahead = trip.path.slice(passedIndex(trip) + 1).map((node) => positionOf(map, node))
  const here = riderDisplayPosition(map, rider)
  if (rider.status === 'toRestaurant') return [here, ...ahead, ...toCustomer.slice(1)]
  return [here, ...ahead]
}

interface RiderStep {
  readonly rider: Rider
  readonly pickedUpAtSec?: number
  readonly deliveredAtSec?: number
}

/** Moves one rider forward by dtSec seconds of play, starting at second startSec of the shift. */
export function advanceRider(
  map: CityMap,
  rider: Rider,
  order: Order,
  dtSec: number,
  startSec: number,
  settings: MovementSettings,
): RiderStep {
  let current = rider
  let left = dtSec
  let now = startSec
  let pickedUpAtSec: number | undefined
  let deliveredAtSec: number | undefined

  while (current.trip && left > EPSILON) {
    const trip: Trip = current.trip

    if (current.status === 'atKitchen') {
      if (left < trip.kitchenLeftSec) {
        current = { ...current, trip: { ...trip, kitchenLeftSec: trip.kitchenLeftSec - left } }
        left = 0
        break
      }
      left -= trip.kitchenLeftSec
      now += trip.kitchenLeftSec
      pickedUpAtSec = now
      current = { ...current, status: 'toCustomer', trip: { ...trip, ...leg(map, trip.toCustomer), kitchenLeftSec: 0 } }
      continue
    }

    const remainingM = trip.pathMeters[trip.pathMeters.length - 1] - trip.traveledM
    const timeToEnd = remainingM / settings.metersPerSec
    if (left < timeToEnd - EPSILON) {
      const moved = { ...trip, traveledM: trip.traveledM + left * settings.metersPerSec }
      current = { ...current, node: moved.path[passedIndex(moved)], trip: moved }
      left = 0
      break
    }

    left -= timeToEnd
    now += timeToEnd
    const end = trip.path[trip.path.length - 1]
    if (current.status === 'toRestaurant') {
      current = {
        ...current,
        node: end,
        status: 'atKitchen',
        // Food already ready: kitchenLeftSec is 0 and the next pass of the loop picks it up right away.
        trip: { ...trip, ...leg(map, [end]), kitchenLeftSec: Math.max(0, order.readyAtSec - now) },
      }
    } else {
      deliveredAtSec = now
      current = { ...current, node: end, status: 'idle', orderId: undefined, trip: undefined }
    }
  }

  return { rider: current, pickedUpAtSec, deliveredAtSec }
}

/**
 * Moves every busy rider and updates their orders (picked up, delivered).
 * Returns the same arrays when nothing changed.
 */
export function advanceFleet(
  map: CityMap,
  riders: readonly Rider[],
  orders: readonly Order[],
  dtSec: number,
  startSec: number,
  settings: MovementSettings,
): { riders: readonly Rider[]; orders: readonly Order[] } {
  if (dtSec <= 0 || riders.every((rider) => !rider.trip)) return { riders, orders }

  const orderUpdates = new Map<string, Partial<Order>>()
  const nextRiders = riders.map((rider) => {
    const order = rider.trip && orders.find((candidate) => candidate.id === rider.trip?.orderId)
    if (!order) return rider
    const step = advanceRider(map, rider, order, dtSec, startSec, settings)
    const update: Partial<Order> = {}
    if (step.pickedUpAtSec !== undefined) Object.assign(update, { status: 'pickedUp', pickedUpAtSec: step.pickedUpAtSec })
    if (step.deliveredAtSec !== undefined) Object.assign(update, { status: 'delivered', deliveredAtSec: step.deliveredAtSec })
    if (Object.keys(update).length > 0) orderUpdates.set(order.id, update)
    return step.rider
  })

  const nextOrders =
    orderUpdates.size === 0
      ? orders
      : orders.map((order) => (orderUpdates.has(order.id) ? { ...order, ...orderUpdates.get(order.id) } : order))
  return { riders: nextRiders, orders: nextOrders }
}
