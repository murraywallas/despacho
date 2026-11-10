/**
 * The operator's tools: taking an order away from one rider and giving it to another (it costs time), and calling
 * a customer to buy more time (a few times per shift). Pure.
 */
import { assignOrders, type AssignError } from './dispatch'
import type { Order } from './orders'
import type { Rider } from './riders'

export type ReassignError = AssignError | 'order-not-assigned' | 'same-rider'

export type ReassignResult =
  | { readonly ok: true; readonly orders: Order[]; readonly riders: Rider[] }
  | { readonly ok: false; readonly error: ReassignError }

/**
 * Takes an order that a rider is going to pick up (the food is still at the restaurant) and gives it to another
 * free rider. The order loses `penaltySec` of its deadline. The first rider keeps their other orders; with none
 * left, they are free where they are. The new rider still has to start the trip (startTrip).
 */
export function reassignOrder(
  orders: readonly Order[],
  riders: readonly Rider[],
  orderId: string,
  toRiderId: string,
  penaltySec: number,
  nowSec: number,
  capacity = 1,
): ReassignResult {
  const order = orders.find((candidate) => candidate.id === orderId)
  if (!order) return { ok: false, error: 'order-not-found' }
  if (order.status !== 'assigned' || !order.riderId) return { ok: false, error: 'order-not-assigned' }
  if (order.riderId === toRiderId) return { ok: false, error: 'same-rider' }

  const released = orders.map((candidate) =>
    candidate.id === orderId
      ? { ...candidate, status: 'pending' as const, riderId: undefined, deadlineAtSec: candidate.deadlineAtSec - penaltySec }
      : candidate,
  )
  const fromId = order.riderId
  const dropped = riders.map((rider) => {
    if (rider.id !== fromId) return rider
    const left = (rider.orderIds ?? []).filter((id) => id !== orderId)
    if (left.length === 0) return { ...rider, status: 'idle' as const, orderIds: undefined, trip: undefined }
    if (rider.status !== 'atKitchen' || !rider.trip) return { ...rider, orderIds: left }
    // At the kitchen: wait only for the orders still on the trip.
    const readyAtSec = Math.max(...left.map((id) => released.find((candidate) => candidate.id === id)?.readyAtSec ?? 0))
    return { ...rider, orderIds: left, trip: { ...rider.trip, kitchenLeftSec: Math.max(0, readyAtSec - nowSec) } }
  })

  const result = assignOrders(released, dropped, [orderId], toRiderId, capacity)
  return result.ok ? result : { ok: false, error: result.error }
}

/** True while the customer can still be called about this order: not delivered nor cancelled yet. */
export function canCall(order: Order): boolean {
  return order.status !== 'delivered' && order.status !== 'cancelled'
}

/** The operator calls the customer: the order gets `extendSec` more before its deadline (and its cancellation). */
export function callCustomer(orders: readonly Order[], orderId: string, extendSec: number): readonly Order[] {
  const order = orders.find((candidate) => candidate.id === orderId)
  if (!order || !canCall(order)) return orders
  return orders.map((candidate) =>
    candidate.id === orderId
      ? { ...candidate, deadlineAtSec: candidate.deadlineAtSec + extendSec, called: true }
      : candidate,
  )
}
