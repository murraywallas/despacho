/**
 * A rider at a restaurant takes every order waiting there, as in real life: the orders the player picked, then
 * the others waiting at the first one's restaurant, most urgent first, until the vehicle is full. The player can
 * leave some out. Pure.
 */
import type { Order } from './orders'

/**
 * The ids of the trip a rider with this capacity takes: the picked ones (in that order), then the other orders
 * waiting at the first picked one's restaurant, closest deadline first, leaving out the excluded ones, up to
 * capacity. When more were picked than fit, just the picked ones (the vehicle can't take them: a refusal).
 */
export function fullTrip(
  orders: readonly Order[],
  pickedIds: readonly string[],
  excludedIds: readonly string[],
  capacity: number,
): string[] {
  const first = orders.find((order) => order.id === pickedIds[0])
  if (!first || pickedIds.length >= capacity) return [...pickedIds]
  const waiting = orders
    .filter(
      (order) =>
        order.status === 'pending' &&
        order.restaurantId === first.restaurantId &&
        !pickedIds.includes(order.id) &&
        !excludedIds.includes(order.id),
    )
    .sort((a, b) => a.deadlineAtSec - b.deadlineAtSec)
  return [...pickedIds, ...waiting.slice(0, capacity - pickedIds.length).map((order) => order.id)]
}
