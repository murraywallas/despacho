import { create } from 'zustand'
import { clock as clockBalance, prototype } from '../game/balance'
import type { CityMap } from '../game/cityMap'
import { setSpeed, togglePause, type ShiftClock } from '../game/clock'
import { waitingAt, type OrderQueue, type OrderSettings } from '../game/orders'
import type { Random } from '../game/random'
import type { Rider } from '../game/riders'
import { advanceShift, createShift, dispatchOrder, shiftSettingsFrom } from '../game/shift'

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
  /** Free rider the player picked, waiting for an order. */
  selectedRiderId: string | null
  /**
   * The player picks an order (on the map, in the list). With a rider already picked, the order goes to that
   * rider; otherwise the order stays picked. Picking it again, or null, drops the selection.
   */
  selectOrder: (orderId: string | null) => void
  /**
   * The player picks a rider (on the map, in the bar or with keys 1–9). With an order already picked, the rider
   * gets it; otherwise a free rider stays picked. Works while paused too.
   */
  pickRider: (riderNumber: number) => void
  /**
   * With a rider picked, the player taps a restaurant: the rider goes for its most urgent waiting order.
   * Returns false (and changes nothing) when no rider is picked or nothing waits there.
   */
  sendRiderTo: (restaurantId: string) => boolean
  /** Drops both selections (Esc). */
  clearSelection: () => void
  /** "Jugar otra vez": starts the shift over (clock, orders, riders and stars). */
  restartShift: () => void
}

const NORMAL_SPEED = 1
const NOTHING_SELECTED = { selectedOrderId: null, selectedRiderId: null }

export const settings = shiftSettingsFrom(prototype)
export const orderSettings: OrderSettings = settings.orders

// The random stream of the current shift (orders keep drawing from it as they appear).
let random: Random

type ShiftData = Pick<ShiftState, 'map' | 'riders' | 'clock' | 'orderQueue' | 'selectedOrderId' | 'selectedRiderId'>

/** A fresh shift: clock at the start, no orders, riders at their starting spots. */
function newShift(): ShiftData {
  const fresh = createShift(prototype, prototype.seed)
  random = fresh.random
  return { ...fresh.shift, selectedOrderId: null, selectedRiderId: null }
}

export const useShiftStore = create<ShiftState>()((set, get) => ({
  ...newShift(),
  restartShift: () => set(newShift()),
  tick: (dtSec) =>
    set((state) => {
      const next = advanceShift(state, dtSec, random, settings)
      if (next === state) return state
      const order = next.orderQueue.orders.find((candidate) => candidate.id === state.selectedOrderId)
      const rider = next.riders.find((candidate) => candidate.id === state.selectedRiderId)
      return {
        clock: next.clock,
        riders: next.riders,
        orderQueue: next.orderQueue,
        selectedOrderId: order?.status === 'pending' ? state.selectedOrderId : null,
        selectedRiderId: rider?.status === 'idle' ? state.selectedRiderId : null,
      }
    }),
  togglePause: () => set((state) => ({ clock: togglePause(state.clock) })),
  toggleSpeed: () =>
    set((state) => {
      const speed = state.clock.speed === NORMAL_SPEED ? clockBalance.fastSpeed : NORMAL_SPEED
      return { clock: setSpeed(state.clock, speed) }
    }),
  selectOrder: (orderId) =>
    set((state) => {
      if (orderId === null) return NOTHING_SELECTED
      if (orderId === state.selectedOrderId) return { selectedOrderId: null }
      const order = state.orderQueue.orders.find((candidate) => candidate.id === orderId)
      if (order?.status !== 'pending' || state.clock.finished) return state
      if (state.selectedRiderId) {
        const result = dispatchOrder(state.map, state.orderQueue, state.riders, orderId, state.selectedRiderId)
        return result ? { ...result, ...NOTHING_SELECTED } : state
      }
      return { selectedOrderId: orderId }
    }),
  pickRider: (riderNumber) =>
    set((state) => {
      const rider = state.riders.find((candidate) => candidate.number === riderNumber)
      if (!rider || state.clock.finished) return state
      if (state.selectedOrderId) {
        const result = dispatchOrder(state.map, state.orderQueue, state.riders, state.selectedOrderId, rider.id)
        return result ? { ...result, ...NOTHING_SELECTED } : state
      }
      if (rider.status !== 'idle') return state
      return { selectedRiderId: rider.id === state.selectedRiderId ? null : rider.id }
    }),
  sendRiderTo: (restaurantId) => {
    const state = get()
    const order = waitingAt(state.orderQueue.orders, restaurantId)[0]
    if (!state.selectedRiderId || !order || state.clock.finished) return false
    const result = dispatchOrder(state.map, state.orderQueue, state.riders, order.id, state.selectedRiderId)
    if (!result) return false
    set({ ...result, ...NOTHING_SELECTED })
    return true
  },
  clearSelection: () => set(NOTHING_SELECTED),
}))
