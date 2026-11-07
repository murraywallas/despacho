/**
 * Orders: they appear every few seconds of game time, each from a restaurant to a customer
 * somewhere on the grid, with a deadline. Pure: functions return new values.
 */
import type { CityMap } from './cityMap'
import { samePoint, type Point } from './grid'
import { randomInt, type Random } from './random'

/**
 * pending: waiting for a rider. assigned: a rider is heading to the restaurant or waiting for the kitchen.
 * pickedUp: on its way to the customer. delivered: done. cancelled: the customer gave up waiting.
 */
export type OrderStatus = 'pending' | 'assigned' | 'pickedUp' | 'delivered' | 'cancelled'

export interface Order {
  readonly id: string
  /** Number shown to the player: 1, 2, 3… */
  readonly number: number
  readonly restaurantId: string
  readonly customer: Point
  /** Game second when the order appeared. */
  readonly createdAtSec: number
  /** Game second when it should be delivered. */
  readonly deadlineAtSec: number
  readonly status: OrderStatus
  /** Rider carrying the order, once assigned. */
  readonly riderId?: string
  /** Game second when the food left the restaurant. */
  readonly pickedUpAtSec?: number
  /** Game second when it reached the customer. */
  readonly deliveredAtSec?: number
  /** Game second when it was cancelled. */
  readonly cancelledAtSec?: number
}

export interface OrderQueue {
  readonly orders: readonly Order[]
  /** Game second when the next order appears. */
  readonly nextSpawnAtSec: number
}

export interface OrderSettings {
  readonly spawnIntervalSec: number
  readonly deadlineSec: number
  /** No orders appear at or after this game second (the end of the shift). */
  readonly lastSpawnBeforeSec: number
}

export function createOrderQueue(settings: OrderSettings): OrderQueue {
  return { orders: [], nextSpawnAtSec: settings.spawnIntervalSec }
}

function randomCustomer(map: CityMap, restaurant: Point, random: Random): Point {
  for (;;) {
    const spot = { x: randomInt(random, map.grid.size), y: randomInt(random, map.grid.size) }
    if (!samePoint(spot, restaurant)) return spot
  }
}

/** Adds every order due up to game second nowSec. Returns the same queue when nothing is due. */
export function spawnOrders(
  queue: OrderQueue,
  nowSec: number,
  map: CityMap,
  random: Random,
  settings: OrderSettings,
): OrderQueue {
  if (queue.nextSpawnAtSec > nowSec || map.restaurants.length === 0) return queue

  const orders = [...queue.orders]
  let nextSpawnAtSec = queue.nextSpawnAtSec
  while (nextSpawnAtSec <= nowSec && nextSpawnAtSec < settings.lastSpawnBeforeSec) {
    const restaurant = map.restaurants[randomInt(random, map.restaurants.length)]
    const number = orders.length + 1
    orders.push({
      id: `o${number}`,
      number,
      restaurantId: restaurant.id,
      customer: randomCustomer(map, restaurant.position, random),
      createdAtSec: nextSpawnAtSec,
      deadlineAtSec: nextSpawnAtSec + settings.deadlineSec,
      status: 'pending',
    })
    nextSpawnAtSec += settings.spawnIntervalSec
  }
  if (orders.length === queue.orders.length) return queue
  return { orders, nextSpawnAtSec }
}

/** Game seconds left until the deadline. Negative when the order is late. */
export function timeLeftSec(order: Order, nowSec: number): number {
  return order.deadlineAtSec - nowSec
}

export type Urgency = 'normal' | 'urgent' | 'late'

export function urgencyOf(order: Order, nowSec: number, urgentBelowSec: number): Urgency {
  const left = timeLeftSec(order, nowSec)
  if (left <= 0) return 'late'
  if (left < urgentBelowSec) return 'urgent'
  return 'normal'
}
