import { create } from 'zustand'
import { clock as clockBalance, prototype } from '../game/balance'
import type { CityMap } from '../game/cityMap'
import { setSpeed, togglePause, type ShiftClock } from '../game/clock'
import type { OrderQueue, OrderSettings } from '../game/orders'
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
  /** Pending order the player picked (first click). */
  selectedOrderId: string | null
  /** Selects a pending order, or clears the selection with null. Clicking the selected one again clears it. */
  selectOrder: (orderId: string | null) => void
  /** Gives the selected order to a rider (second click, or keys 1–9). Works while paused too. */
  assignSelectedTo: (riderNumber: number) => void
  /** "Jugar otra vez": starts the shift over (clock, orders, riders and stars). */
  restartShift: () => void
}

const NORMAL_SPEED = 1

const settings = shiftSettingsFrom(prototype)
export const orderSettings: OrderSettings = settings.orders

// The random stream of the current shift (orders keep drawing from it as they appear).
let random: Random

type ShiftData = Pick<ShiftState, 'map' | 'riders' | 'clock' | 'orderQueue' | 'selectedOrderId'>

/** A fresh shift: clock at the start, no orders, riders at their starting spots. */
function newShift(): ShiftData {
  const fresh = createShift(prototype, prototype.seed)
  random = fresh.random
  return { ...fresh.shift, selectedOrderId: null }
}

export const useShiftStore = create<ShiftState>()((set) => ({
  ...newShift(),
  restartShift: () => set(newShift()),
  tick: (dtSec) =>
    set((state) => {
      const next = advanceShift(state, dtSec, random, settings)
      if (next === state) return state
      const selected = next.orderQueue.orders.find((order) => order.id === state.selectedOrderId)
      return {
        clock: next.clock,
        riders: next.riders,
        orderQueue: next.orderQueue,
        selectedOrderId: selected?.status === 'pending' ? state.selectedOrderId : null,
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
      if (orderId === null || orderId === state.selectedOrderId) return { selectedOrderId: null }
      const order = state.orderQueue.orders.find((candidate) => candidate.id === orderId)
      return order?.status === 'pending' && !state.clock.finished ? { selectedOrderId: orderId } : state
    }),
  assignSelectedTo: (riderNumber) =>
    set((state) => {
      const rider = state.riders.find((candidate) => candidate.number === riderNumber)
      if (!state.selectedOrderId || !rider || state.clock.finished) return state
      const result = dispatchOrder(state.map, state.orderQueue, state.riders, state.selectedOrderId, rider.id)
      return result ? { ...result, selectedOrderId: null } : state
    }),
}))
