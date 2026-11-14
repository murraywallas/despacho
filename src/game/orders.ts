/**
 * Orders: they appear every few seconds, each from a restaurant to a customer somewhere in the area,
 * with a deadline. Pure: functions return new values.
 */
import { randomAddress, type CityMap, type NodeId } from './cityMap'
import { demandAt, type DemandWindow } from './shiftEvents'
import { randomInt, type Random } from './random'

/**
 * The kitchen starts cooking as soon as an order comes in; the food is ready at readyAtSec.
 *
 * pending: waiting for a rider. assigned: a rider is heading to the restaurant or waiting for the kitchen.
 * pickedUp: on its way to the customer. delivered: done. cancelled: the customer gave up waiting.
 */
export type OrderStatus = 'pending' | 'assigned' | 'pickedUp' | 'delivered' | 'cancelled'

export interface Order {
  readonly id: string
  /** Number shown to the player: 1, 2, 3… */
  readonly number: number
  readonly restaurantId: string
  /** Crossing where the customer lives. */
  readonly customer: NodeId
  /** Second of the shift when the order appeared. */
  readonly createdAtSec: number
  /** Second of the shift when the kitchen has the food ready (and it starts getting cold). */
  readonly readyAtSec: number
  /** Second of the shift when it should be delivered. */
  readonly deadlineAtSec: number
  readonly status: OrderStatus
  /** Rider carrying the order, once assigned. */
  readonly riderId?: string
  /** Second of the shift when the food left the restaurant. */
  readonly pickedUpAtSec?: number
  /** Second of the shift when it reached the customer. */
  readonly deliveredAtSec?: number
  /** Second of the shift when it was cancelled. */
  readonly cancelledAtSec?: number
  /** The operator called the customer to extend the deadline. */
  readonly called?: boolean
}

export interface OrderQueue {
  readonly orders: readonly Order[]
  /** Second of the shift when the next order appears. */
  readonly nextSpawnAtSec: number
}

/** A rush: between fromSec and toSec of the shift, orders come every intervalSec instead. */
export interface OrderPeak {
  readonly fromSec: number
  readonly toSec: number
  readonly intervalSec: number
}

export interface OrderSettings {
  readonly spawnIntervalSec: number
  /** The rush of the shift, if it has one. */
  readonly peak?: OrderPeak
  readonly deadlineSec: number
  /** Seconds the kitchen needs to have the food ready. */
  readonly cookSec: number
  /** Customers live at least this far from the restaurant, in meters. */
  readonly minCustomerDistanceM: number
  /** No orders appear at or after this second of the shift (the end of the shift). */
  readonly lastSpawnBeforeSec: number
  /** Stretches with more orders because of an event (rain…). */
  readonly demand?: readonly DemandWindow[]
}

/** Seconds until the next order, for an order that appeared at second atSec. */
export function spawnIntervalAt(settings: OrderSettings, atSec: number): number {
  const peak = settings.peak
  const interval = peak && atSec >= peak.fromSec && atSec < peak.toSec ? peak.intervalSec : settings.spawnIntervalSec
  // More demand, orders closer together: 30 % more orders is the interval divided by 1.3.
  return interval / demandAt(settings.demand, atSec)
}

export function createOrderQueue(settings: OrderSettings): OrderQueue {
  return { orders: [], nextSpawnAtSec: spawnIntervalAt(settings, 0) }
}

/** Adds every order due up to second of the shift nowSec. Returns the same queue when nothing is due. */
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
      customer: randomAddress(map, random, restaurant.node, settings.minCustomerDistanceM),
      createdAtSec: nextSpawnAtSec,
      readyAtSec: nextSpawnAtSec + settings.cookSec,
      deadlineAtSec: nextSpawnAtSec + settings.deadlineSec,
      status: 'pending',
    })
    nextSpawnAtSec += spawnIntervalAt(settings, nextSpawnAtSec)
  }
  if (orders.length === queue.orders.length) return queue
  return { orders, nextSpawnAtSec }
}

/** Seconds of play left until the deadline. Negative when the order is late. */
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

/** Orders waiting for a rider at a restaurant, the most urgent (closest deadline) first. */
export function waitingAt(orders: readonly Order[], restaurantId: string): Order[] {
  return orders
    .filter((order) => order.status === 'pending' && order.restaurantId === restaurantId)
    .sort((a, b) => a.deadlineAtSec - b.deadlineAtSec)
}
