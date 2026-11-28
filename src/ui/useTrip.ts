import { useMemo } from 'react'
import type { Order } from '../game/orders'
import type { Rider } from '../game/riders'
import { tripIds, tripOf, useShiftStore } from '../store/shiftStore'

export interface Trip {
  /** Ids of the trip shown: the orders picked and the others waiting at that restaurant that the biggest free vehicle takes. */
  readonly ids: readonly string[]
  readonly orders: readonly Order[]
  /** The trip this rider would take (as many of the waiting orders as fit in their vehicle). */
  readonly of: (rider: Rider) => Order[]
}

/** The trip being put together: what the picked order takes with it from its restaurant. */
export function useTrip(): Trip {
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const addedOrderIds = useShiftStore((state) => state.addedOrderIds)
  const excludedOrderIds = useShiftStore((state) => state.excludedOrderIds)
  const orderQueue = useShiftStore((state) => state.orderQueue)
  const riders = useShiftStore((state) => state.riders)
  const state = useMemo(
    () => ({ selectedOrderId, addedOrderIds, excludedOrderIds, orderQueue, riders }),
    [selectedOrderId, addedOrderIds, excludedOrderIds, orderQueue, riders],
  )
  // The same list while the trip doesn't change, so the map doesn't redo its work on every tick.
  const key = tripIds(state).join(',')
  const ids = useMemo(() => (key === '' ? [] : key.split(',')), [key])
  return useMemo(
    () => ({
      ids,
      orders: ids.flatMap((id) => state.orderQueue.orders.find((order) => order.id === id) ?? []),
      of: (rider: Rider) => tripOf(state, rider),
    }),
    [ids, state],
  )
}
