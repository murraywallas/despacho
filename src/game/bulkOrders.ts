/**
 * Big orders (Eventos tab, effect "bulk"): at one moment of the shift an office asks one restaurant for several
 * meals at once, for desks a few blocks apart, with a longer deadline. One trip of a vehicle that carries many
 * (the cargo bike) takes them all; a bike needs several. Pure.
 */
import { positionOf, randomAddress, type CityMap, type NodeId } from './cityMap'
import type { Order, OrderQueue, OrderSettings } from './orders'
import { randomInt, type Random } from './random'
import type { ShiftEvent } from './shiftEvents'
import { distanceM } from './streetGraph'

/** What a big order brings (Eventos tab). */
export interface BulkKind {
  readonly effectType: string
  /** How many orders come at once. */
  readonly bulkOrders?: number
  /** Deadline of each of them, from the moment they come in (seconds of play). */
  readonly bulkDeadlineSec?: number
  /** Their customers live this close to each other (meters, straight line, around the office). */
  readonly bulkSpreadM?: number
}

/** The big-order events of a shift. */
export function bulkEvents(events: readonly ShiftEvent[], kinds: Readonly<Record<string, BulkKind>>): ShiftEvent[] {
  return events.filter((event) => kinds[event.event]?.effectType === 'bulk')
}

/** `count` customers around the office: the office first, then other addresses within spreadM, none twice if it can be helped. */
function desks(map: CityMap, random: Random, office: NodeId, count: number, spreadM: number): NodeId[] {
  const center = positionOf(map, office)
  const near = map.addresses.filter((node) => node !== office && distanceM(positionOf(map, node), center) <= spreadM)
  const picked = [office]
  while (picked.length < count) {
    if (near.length === 0) picked.push(office)
    else picked.push(near.splice(randomInt(random, near.length), 1)[0])
  }
  return picked
}

/**
 * Adds the orders of every big-order event that started by second nowSec and has not come in yet. Returns the same
 * queue when there is nothing to add.
 */
export function spawnBulkOrders(
  queue: OrderQueue,
  nowSec: number,
  map: CityMap,
  random: Random,
  settings: OrderSettings,
  events: readonly ShiftEvent[],
  kinds: Readonly<Record<string, BulkKind>>,
): OrderQueue {
  const due = bulkEvents(events, kinds).filter(
    (event) => event.fromSec <= nowSec && !queue.orders.some((order) => order.fromEvent === event.id),
  )
  if (due.length === 0 || map.restaurants.length === 0) return queue
  const orders = [...queue.orders]
  for (const event of due) {
    const kind = kinds[event.event]
    const restaurant = map.restaurants[randomInt(random, map.restaurants.length)]
    const office = randomAddress(map, random, restaurant.node, settings.minCustomerDistanceM)
    const customers = desks(map, random, office, kind.bulkOrders ?? 1, kind.bulkSpreadM ?? 0)
    for (const customer of customers) {
      const number = orders.length + 1
      const order: Order = {
        id: `o${number}`,
        number,
        restaurantId: restaurant.id,
        customer,
        createdAtSec: event.fromSec,
        readyAtSec: event.fromSec + settings.cookSec,
        deadlineAtSec: event.fromSec + (kind.bulkDeadlineSec ?? settings.deadlineSec),
        status: 'pending',
        fromEvent: event.id,
      }
      orders.push(order)
    }
  }
  return { ...queue, orders }
}
