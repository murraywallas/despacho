/**
 * What the player picked for the next trip, and the trip it makes: the orders picked, then the others waiting at
 * that restaurant (a rider takes them all, as many as fit). Pure helpers of the shift store.
 */
import { capacityOf } from '../game/dispatch'
import type { Order, OrderQueue } from '../game/orders'
import type { Rider } from '../game/riders'
import { fullTrip } from '../game/tripFill'

export interface PickState {
  readonly selectedOrderId: string | null
  /** Orders added with Shift (of a restaurant close by). */
  readonly addedOrderIds: readonly string[]
}

export interface TripState extends PickState {
  /** Orders of the picked one's restaurant the player left out of the trip (Shift + click). */
  readonly excludedOrderIds: readonly string[]
  readonly orderQueue: OrderQueue
  readonly riders: readonly Rider[]
}

/** Every order picked for the next trip: the first one and the ones added with Shift. */
export function selectedOrderIds(state: PickState): string[] {
  return state.selectedOrderId ? [state.selectedOrderId, ...state.addedOrderIds] : []
}

/**
 * The trip a rider of this capacity would take now: the orders picked, then the others waiting at that restaurant
 * (as many as fit). Without a capacity, the biggest of the free riders (of the whole fleet when nobody is free).
 */
export function tripIds(state: TripState, capacity?: number): string[] {
  const free = state.riders.filter((rider) => rider.status === 'idle')
  const biggest = Math.max(1, ...(free.length > 0 ? free : state.riders).map((rider) => capacityOf(rider.vehicle)))
  return fullTrip(state.orderQueue.orders, selectedOrderIds(state), state.excludedOrderIds, capacity ?? biggest)
}

/** The orders of the trip a rider would take now (see tripIds). */
export function tripOf(state: TripState, rider: Rider): Order[] {
  return tripIds(state, capacityOf(rider.vehicle)).flatMap((id) => state.orderQueue.orders.find((order) => order.id === id) ?? [])
}

/** Orders waiting for a rider, as the queue shows them: the closest deadline first. */
export function waitingQueue(orders: readonly Order[]): Order[] {
  return orders.filter((order) => order.status === 'pending').sort((a, b) => a.deadlineAtSec - b.deadlineAtSec)
}

/** The previous list when nothing changed, so watchers don't redo work for an equal list. */
export function keepIfSame(previous: readonly string[], next: readonly string[]): readonly string[] {
  return previous.length === next.length && previous.every((id, index) => id === next[index]) ? previous : next
}
