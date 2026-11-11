/**
 * The event radio: what just happened in the shift, told in short lines (a new order, a rider leaving a
 * restaurant, a delivery, an order going late, a cancellation). Several of the same kind at once become one
 * line, so a rush doesn't flood the screen. Pure.
 */
import type { HeatSettings } from './rating'
import { heatOf, isCold } from './rating'
import type { Order } from './orders'
import type { Rider } from './riders'

export type RadioKind = 'newOrder' | 'pickedUp' | 'delivered' | 'late' | 'cancelled'

/** How a delivery went: on time and warm, or not (late or cold: nothing to celebrate). */
export type DeliveryMood = 'good' | 'late' | 'cold'

export interface RadioItem {
  readonly kind: RadioKind
  /** Order numbers, in the order they happened. More than one when several came together. */
  readonly orderNumbers: readonly number[]
  /** Restaurant of the orders, when they share one. */
  readonly restaurantId?: string
  /** Rider who picked up the food. */
  readonly riderNumber?: number
  /** Deliveries only: how the delivery went (the worst one, if several). */
  readonly mood?: DeliveryMood
  /** Second of the shift when it happened. */
  readonly atSec: number
}

export interface RadioMoment {
  readonly orders: readonly Order[]
  readonly riders: readonly Rider[]
  readonly nowSec: number
}

/** Order in which the kinds are told when several happen in the same step. */
const KINDS: readonly RadioKind[] = ['newOrder', 'pickedUp', 'delivered', 'late', 'cancelled']
const MOOD_RANK: Record<DeliveryMood, number> = { good: 0, cold: 1, late: 2 }

/** How a delivered order went. */
export function deliveryMood(order: Order, heat: HeatSettings): DeliveryMood {
  const deliveredAtSec = order.deliveredAtSec ?? order.deadlineAtSec
  if (deliveredAtSec > order.deadlineAtSec) return 'late'
  if (isCold(heatOf(order, deliveredAtSec, heat), heat)) return 'cold'
  return 'good'
}

function isOpen(order: Order): boolean {
  return order.status !== 'delivered' && order.status !== 'cancelled'
}

interface Happening {
  readonly kind: RadioKind
  readonly order: Order
  readonly riderNumber?: number
  readonly mood?: DeliveryMood
}

/** The radio lines between two moments of the same shift, grouped by kind. */
export function radioBetween(before: RadioMoment, after: RadioMoment, heat: HeatSettings): RadioItem[] {
  const previous = new Map(before.orders.map((order) => [order.id, order]))
  const riderNumber = new Map(after.riders.map((rider) => [rider.id, rider.number]))
  const happened: Happening[] = []

  for (const order of after.orders) {
    const was = previous.get(order.id)
    if (!was) {
      happened.push({ kind: 'newOrder', order })
      continue
    }
    if (order.status === 'pickedUp' && was.status !== 'pickedUp') {
      happened.push({ kind: 'pickedUp', order, riderNumber: order.riderId ? riderNumber.get(order.riderId) : undefined })
    }
    if (order.status === 'delivered' && was.status !== 'delivered') {
      happened.push({ kind: 'delivered', order, mood: deliveryMood(order, heat) })
    }
    if (order.status === 'cancelled' && was.status !== 'cancelled') happened.push({ kind: 'cancelled', order })
    if (isOpen(order) && was.deadlineAtSec > before.nowSec && order.deadlineAtSec <= after.nowSec) {
      happened.push({ kind: 'late', order })
    }
  }

  return KINDS.flatMap((kind) => {
    const same = happened.filter((happening) => happening.kind === kind)
    if (same.length === 0) return []
    // Picked up by different riders: one line per rider, so each line says who.
    const groups =
      kind === 'pickedUp'
        ? [...new Set(same.map((happening) => happening.riderNumber))].map((rider) =>
            same.filter((happening) => happening.riderNumber === rider),
          )
        : [same]
    return groups.map((group): RadioItem => {
      const restaurants = new Set(group.map((happening) => happening.order.restaurantId))
      const moods = group.flatMap((happening) => (happening.mood ? [happening.mood] : []))
      const worst = moods.sort((a, b) => MOOD_RANK[b] - MOOD_RANK[a])[0]
      return {
        kind,
        orderNumbers: group.map((happening) => happening.order.number),
        ...(restaurants.size === 1 ? { restaurantId: group[0].order.restaurantId } : {}),
        ...(group[0].riderNumber !== undefined ? { riderNumber: group[0].riderNumber } : {}),
        ...(worst ? { mood: worst } : {}),
        atSec: after.nowSec,
      }
    })
  })
}
