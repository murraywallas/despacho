/**
 * Orders nobody delivered in time: some seconds after the deadline the customer gives up and the order is
 * cancelled. A rider who was on it is freed where they are. Pure.
 */
import type { Order } from './orders'
import type { Rider } from './riders'

function isOpen(order: Order): boolean {
  return order.status !== 'delivered' && order.status !== 'cancelled'
}

/** Game second when an undelivered order gets cancelled. */
export function cancelAtSec(order: Order, cancelAfterSec: number): number {
  return order.deadlineAtSec + cancelAfterSec
}

/**
 * Cancels every open order whose cancel time has come by game second nowSec, and frees its rider.
 * Returns the same arrays when nothing was cancelled.
 */
export function cancelExpired(
  orders: readonly Order[],
  riders: readonly Rider[],
  nowSec: number,
  cancelAfterSec: number,
): { orders: readonly Order[]; riders: readonly Rider[] } {
  const expired = orders.filter((order) => isOpen(order) && nowSec >= cancelAtSec(order, cancelAfterSec))
  if (expired.length === 0) return { orders, riders }

  const ids = new Set(expired.map((order) => order.id))
  return {
    orders: orders.map((order) =>
      ids.has(order.id) ? { ...order, status: 'cancelled', cancelledAtSec: cancelAtSec(order, cancelAfterSec) } : order,
    ),
    riders: riders.map((rider) =>
      rider.orderId && ids.has(rider.orderId)
        ? { ...rider, status: 'idle', orderId: undefined, trip: undefined }
        : rider,
    ),
  }
}
