/**
 * Orders nobody delivered: some seconds after the deadline the customer gives up and the order is cancelled,
 * and when the shift closes every order still open is cancelled too. A rider who was on it is freed where
 * they are. Pure.
 */
import type { Order } from './orders'
import type { Rider } from './riders'

function isOpen(order: Order): boolean {
  return order.status !== 'delivered' && order.status !== 'cancelled'
}

/** Second of the shift when an undelivered order gets cancelled. */
export function cancelAtSec(order: Order, cancelAfterSec: number): number {
  return order.deadlineAtSec + cancelAfterSec
}

/** Cancels the given open orders (each at its own second) and frees the riders on them. */
function cancelOrders(
  orders: readonly Order[],
  riders: readonly Rider[],
  cancelled: ReadonlyMap<string, number>,
): { orders: readonly Order[]; riders: readonly Rider[] } {
  if (cancelled.size === 0) return { orders, riders }
  return {
    orders: orders.map((order) => {
      const at = cancelled.get(order.id)
      return at === undefined ? order : { ...order, status: 'cancelled', cancelledAtSec: at }
    }),
    riders: riders.map((rider) =>
      rider.orderId && cancelled.has(rider.orderId)
        ? { ...rider, status: 'idle', orderId: undefined, trip: undefined }
        : rider,
    ),
  }
}

/**
 * Cancels every open order whose cancel time has come by second of the shift nowSec, and frees its rider.
 * Returns the same arrays when nothing was cancelled.
 */
export function cancelExpired(
  orders: readonly Order[],
  riders: readonly Rider[],
  nowSec: number,
  cancelAfterSec: number,
): { orders: readonly Order[]; riders: readonly Rider[] } {
  const expired = orders.filter((order) => isOpen(order) && nowSec >= cancelAtSec(order, cancelAfterSec))
  return cancelOrders(orders, riders, new Map(expired.map((order) => [order.id, cancelAtSec(order, cancelAfterSec)])))
}

/**
 * The shift closes: every order still open (waiting, on its way) counts as cancelled, at the closing second.
 * Returns the same arrays when everything was already delivered or cancelled.
 */
export function closeShift(
  orders: readonly Order[],
  riders: readonly Rider[],
  closingSec: number,
): { orders: readonly Order[]; riders: readonly Rider[] } {
  return cancelOrders(orders, riders, new Map(orders.filter(isOpen).map((order) => [order.id, closingSec])))
}
