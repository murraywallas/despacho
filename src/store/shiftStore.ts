import { create } from 'zustand'
import { clock as clockBalance, prototype } from '../game/balance'
import type { CityMap } from '../game/cityMap'
import { setSpeed, togglePause, type ShiftClock } from '../game/clock'
import { reorderStops } from '../game/movement'
import { waitingAt, type OrderQueue, type OrderSettings } from '../game/orders'
import type { Random } from '../game/random'
import type { Rider } from '../game/riders'
import { advanceShift, capacityOf, createShift, dispatchOrders, shiftSettingsFrom } from '../game/shift'

interface ShiftState {
  map: CityMap
  riders: readonly Rider[]
  clock: ShiftClock
  orderQueue: OrderQueue
  /** Advances the game by dtSec real seconds. */
  tick: (dtSec: number) => void
  togglePause: () => void
  /** Switches between normal speed and the fast speed from balance.json. */
  toggleSpeed: () => void
  /** Pending order the player picked, waiting for a rider. */
  selectedOrderId: string | null
  /** More pending orders of the same restaurant added to the trip with Shift, in delivery order. */
  addedOrderIds: readonly string[]
  /** Free rider the player picked, waiting for an order. */
  selectedRiderId: string | null
  /**
   * The player picks an order (on the map, in the list). With a rider already picked, the order goes to that
   * rider; otherwise the order stays picked. Picking it again, or null, drops the selection.
   * With `add` (Shift + click), an order of the same restaurant joins the trip (or leaves it, if it was in).
   */
  selectOrder: (orderId: string | null, add?: boolean) => void
  /**
   * The player picks a rider (on the map, in the bar or with keys 1–9). With orders already picked, the rider
   * gets them (if their vehicle carries that many); otherwise a free rider stays picked. Works while paused too.
   */
  pickRider: (riderNumber: number) => void
  /**
   * With a rider picked, the player taps a restaurant: the rider goes for its most urgent waiting order. With
   * `fill` (Shift + tap), for as many of its orders as the vehicle carries. Returns false (and changes nothing)
   * when no rider is picked or nothing waits there.
   */
  sendRiderTo: (restaurantId: string, fill?: boolean) => boolean
  /** Changes the order of a busy rider's remaining stops (drag and drop in the rider card). */
  reorderStops: (riderNumber: number, orderIds: readonly string[]) => void
  /** Drops every selection (Esc). */
  clearSelection: () => void
  /** "Jugar otra vez": starts the shift over (clock, orders, riders and stars). */
  restartShift: () => void
}

const NORMAL_SPEED = 1
// One shared empty list: a new [] every frame would make everything that watches the selection redo its work.
const NO_ORDERS: readonly string[] = []
const NOTHING_SELECTED = { selectedOrderId: null, addedOrderIds: NO_ORDERS, selectedRiderId: null }

export const settings = shiftSettingsFrom(prototype)
export const orderSettings: OrderSettings = settings.orders

/** Every order picked for the next trip: the first one and the ones added with Shift. */
export function selectedOrderIds(state: Pick<ShiftState, 'selectedOrderId' | 'addedOrderIds'>): string[] {
  return state.selectedOrderId ? [state.selectedOrderId, ...state.addedOrderIds] : []
}

// The random stream of the current shift (orders keep drawing from it as they appear).
let random: Random

type ShiftData = Pick<
  ShiftState,
  'map' | 'riders' | 'clock' | 'orderQueue' | 'selectedOrderId' | 'addedOrderIds' | 'selectedRiderId'
>

/** A fresh shift: clock at the start, no orders, riders at their starting spots. */
function newShift(): ShiftData {
  const fresh = createShift(prototype, prototype.seed)
  random = fresh.random
  return { ...fresh.shift, ...NOTHING_SELECTED }
}

export const useShiftStore = create<ShiftState>()((set, get) => ({
  ...newShift(),
  restartShift: () => set(newShift()),
  tick: (dtSec) =>
    set((state) => {
      const next = advanceShift(state, dtSec, random, settings)
      if (next === state) return state
      const stillPending = (id: string) => next.orderQueue.orders.find((order) => order.id === id)?.status === 'pending'
      const rider = next.riders.find((candidate) => candidate.id === state.selectedRiderId)
      const firstLeft = state.selectedOrderId && stillPending(state.selectedOrderId)
      return {
        clock: next.clock,
        riders: next.riders,
        orderQueue: next.orderQueue,
        selectedOrderId: firstLeft ? state.selectedOrderId : null,
        addedOrderIds: keepIfSame(state.addedOrderIds, firstLeft ? state.addedOrderIds.filter(stillPending) : NO_ORDERS),
        selectedRiderId: rider?.status === 'idle' ? state.selectedRiderId : null,
      }
    }),
  togglePause: () => set((state) => ({ clock: togglePause(state.clock) })),
  toggleSpeed: () =>
    set((state) => {
      const speed = state.clock.speed === NORMAL_SPEED ? clockBalance.fastSpeed : NORMAL_SPEED
      return { clock: setSpeed(state.clock, speed) }
    }),
  selectOrder: (orderId, add = false) =>
    set((state) => {
      if (orderId === null) return NOTHING_SELECTED
      const order = state.orderQueue.orders.find((candidate) => candidate.id === orderId)
      if (add && state.selectedOrderId && orderId !== state.selectedOrderId) {
        if (state.addedOrderIds.includes(orderId)) return { addedOrderIds: state.addedOrderIds.filter((id) => id !== orderId) }
        const first = state.orderQueue.orders.find((candidate) => candidate.id === state.selectedOrderId)
        if (order?.status !== 'pending' || order.restaurantId !== first?.restaurantId) return state
        return { addedOrderIds: [...state.addedOrderIds, orderId] }
      }
      if (orderId === state.selectedOrderId) return { selectedOrderId: null, addedOrderIds: NO_ORDERS }
      if (order?.status !== 'pending' || state.clock.finished) return state
      if (state.selectedRiderId) {
        const result = dispatchOrders(state.map, state.orderQueue, state.riders, [orderId], state.selectedRiderId)
        return result ? { ...result, ...NOTHING_SELECTED } : state
      }
      return { selectedOrderId: orderId, addedOrderIds: NO_ORDERS }
    }),
  pickRider: (riderNumber) =>
    set((state) => {
      const rider = state.riders.find((candidate) => candidate.number === riderNumber)
      if (!rider || state.clock.finished) return state
      const picked = selectedOrderIds(state)
      if (picked.length > 0) {
        const result = dispatchOrders(state.map, state.orderQueue, state.riders, picked, rider.id)
        return result ? { ...result, ...NOTHING_SELECTED } : state
      }
      if (rider.status !== 'idle') return state
      return { selectedRiderId: rider.id === state.selectedRiderId ? null : rider.id }
    }),
  sendRiderTo: (restaurantId, fill = false) => {
    const state = get()
    const rider = state.riders.find((candidate) => candidate.id === state.selectedRiderId)
    const waiting = waitingAt(state.orderQueue.orders, restaurantId)
    if (!rider || waiting.length === 0 || state.clock.finished) return false
    const take = fill ? waiting.slice(0, capacityOf(rider.vehicle)) : waiting.slice(0, 1)
    const result = dispatchOrders(state.map, state.orderQueue, state.riders, take.map((order) => order.id), rider.id)
    if (!result) return false
    set({ ...result, ...NOTHING_SELECTED })
    return true
  },
  reorderStops: (riderNumber, orderIds) =>
    set((state) => ({
      riders: state.riders.map((rider) => (rider.number === riderNumber ? reorderStops(rider, orderIds) : rider)),
    })),
  clearSelection: () => set(NOTHING_SELECTED),
}))

/** The previous list when nothing changed, so watchers don't redo work for an equal list. */
function keepIfSame(previous: readonly string[], next: readonly string[]): readonly string[] {
  return previous.length === next.length && previous.every((id, index) => id === next[index]) ? previous : next
}
