/**
 * Riders on the move: riding to the restaurant, waiting for the kitchen if the food is not ready yet,
 * riding to the customer, delivering.
 * Everything advances with game seconds, so pause and fast speed come for free. Pure.
 */
import type { CityMap } from './cityMap'
import { restaurantOf } from './dispatch'
import { shortestRoute, type Point } from './grid'
import type { Order } from './orders'
import type { Rider } from './riders'

export interface MovementSettings {
  readonly speedBlocksPerSec: number
}

/** Tolerance for floating-point leftovers when a rider arrives exactly at the end of a step. */
const EPSILON = 1e-9

/** Starts the first leg (to the restaurant) of a rider who just got an order. */
export function startTrip(map: CityMap, rider: Rider, order: Order): Rider {
  const restaurant = restaurantOf(map, order).position
  return {
    ...rider,
    trip: {
      orderId: order.id,
      path: shortestRoute(map.grid, rider.position, restaurant).points,
      traveledBlocks: 0,
      kitchenLeftSec: 0,
    },
  }
}

/** Where the rider is drawn: between two intersections while riding. */
export function riderDisplayPosition(rider: Rider): Point {
  const trip = rider.trip
  if (!trip || (rider.status !== 'toRestaurant' && rider.status !== 'toCustomer')) return rider.position
  const index = Math.min(Math.floor(trip.traveledBlocks), trip.path.length - 1)
  const from = trip.path[index]
  const to = trip.path[Math.min(index + 1, trip.path.length - 1)]
  const fraction = trip.traveledBlocks - index
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction }
}

/** What is left of the trip, from where the rider is now to the customer. */
export function remainingRoute(map: CityMap, rider: Rider, order: Order): Point[] {
  const trip = rider.trip
  if (!trip) return []
  const restaurant = restaurantOf(map, order).position
  const ahead = trip.path.slice(Math.floor(trip.traveledBlocks) + 1)
  const here = riderDisplayPosition(rider)
  const toCustomer = shortestRoute(map.grid, restaurant, order.customer).points
  if (rider.status === 'toRestaurant') return [here, ...ahead, ...toCustomer.slice(1)]
  if (rider.status === 'atKitchen') return [...toCustomer]
  return [here, ...ahead]
}

interface RiderStep {
  readonly rider: Rider
  readonly pickedUpAtSec?: number
  readonly deliveredAtSec?: number
}

/** Moves one rider forward by dtSec game seconds, starting at game second startSec. */
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
    const trip: NonNullable<Rider['trip']> = current.trip

    if (current.status === 'atKitchen') {
      if (left < trip.kitchenLeftSec) {
        current = { ...current, trip: { ...trip, kitchenLeftSec: trip.kitchenLeftSec - left } }
        left = 0
        break
      }
      left -= trip.kitchenLeftSec
      now += trip.kitchenLeftSec
      pickedUpAtSec = now
      const path = shortestRoute(map.grid, current.position, order.customer).points
      current = { ...current, status: 'toCustomer', trip: { ...trip, path, traveledBlocks: 0, kitchenLeftSec: 0 } }
      continue
    }

    const remainingBlocks = trip.path.length - 1 - trip.traveledBlocks
    const timeToEnd = remainingBlocks / settings.speedBlocksPerSec
    if (left < timeToEnd - EPSILON) {
      const traveledBlocks = trip.traveledBlocks + left * settings.speedBlocksPerSec
      const position = trip.path[Math.min(Math.floor(traveledBlocks + EPSILON), trip.path.length - 1)]
      current = { ...current, position, trip: { ...trip, traveledBlocks } }
      left = 0
      break
    }

    left -= timeToEnd
    now += timeToEnd
    const end = trip.path[trip.path.length - 1]
    if (current.status === 'toRestaurant') {
      current = {
        ...current,
        position: end,
        status: 'atKitchen',
        // Food already ready: kitchenLeftSec is 0 and the next pass of the loop picks it up right away.
        trip: { ...trip, path: [end], traveledBlocks: 0, kitchenLeftSec: Math.max(0, order.readyAtSec - now) },
      }
    } else {
      deliveredAtSec = now
      current = { ...current, position: end, status: 'idle', orderId: undefined, trip: undefined }
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
