/**
 * What just happened in the shift, found by comparing two moments: a new order, a dispatch, a delivery, an order
 * turning urgent or late, a cancellation, the end of the shift. Sound (and later other feedback) reacts to these.
 * Pure.
 */
import { urgencyOf, type Order } from './orders'

export type GameEvent = 'newOrder' | 'dispatch' | 'delivered' | 'urgent' | 'late' | 'cancelled' | 'shiftEnd'

/** The order the events are reported in: one of each kind at most. */
export const GAME_EVENTS: readonly GameEvent[] = [
  'newOrder',
  'dispatch',
  'delivered',
  'urgent',
  'late',
  'cancelled',
  'shiftEnd',
]

export interface ShiftMoment {
  readonly orders: readonly Order[]
  readonly nowSec: number
  readonly finished: boolean
}

function isOpen(order: Order): boolean {
  return order.status !== 'delivered' && order.status !== 'cancelled'
}

/** The kinds of events between two moments of the same shift, each once, in GAME_EVENTS order. */
export function eventsBetween(before: ShiftMoment, after: ShiftMoment, urgentBelowSec: number): GameEvent[] {
  const found = new Set<GameEvent>()
  const previous = new Map(before.orders.map((order) => [order.id, order]))

  for (const order of after.orders) {
    const was = previous.get(order.id)
    if (!was) {
      found.add('newOrder')
      continue
    }
    if (order.status === 'assigned' && (was.status !== 'assigned' || was.riderId !== order.riderId)) found.add('dispatch')
    if (order.status === 'delivered' && was.status !== 'delivered') found.add('delivered')
    if (order.status === 'cancelled' && was.status !== 'cancelled') found.add('cancelled')
    if (isOpen(order) && isOpen(was)) {
      const from = urgencyOf(was, before.nowSec, urgentBelowSec)
      const to = urgencyOf(order, after.nowSec, urgentBelowSec)
      if (to === 'urgent' && from === 'normal') found.add('urgent')
      if (to === 'late' && from !== 'late') found.add('late')
    }
  }
  if (after.finished && !before.finished) found.add('shiftEnd')

  return GAME_EVENTS.filter((event) => found.has(event))
}
