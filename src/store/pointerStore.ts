import { create } from 'zustand'

/**
 * What the pointer is doing right now, shared by the lists and the map: the order under the mouse (its restaurant
 * and customer light up on the map) and what is being dragged (to dispatch by dropping a rider on an order, or
 * an order on a rider). Only interface state: the game doesn't depend on it.
 */
interface PointerState {
  hoveredOrderId: string | null
  draggedRiderId: string | null
  draggedOrderId: string | null
  hoverOrder: (orderId: string | null) => void
  dragRider: (riderId: string | null) => void
  dragOrder: (orderId: string | null) => void
}

export const usePointerStore = create<PointerState>()((set) => ({
  hoveredOrderId: null,
  draggedRiderId: null,
  draggedOrderId: null,
  hoverOrder: (orderId) => set({ hoveredOrderId: orderId }),
  dragRider: (riderId) => set({ draggedRiderId: riderId, draggedOrderId: null }),
  dragOrder: (orderId) => set({ draggedOrderId: orderId, draggedRiderId: null }),
}))
