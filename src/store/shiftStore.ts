import { create } from 'zustand'
import { clock as clockBalance, prototype } from '../game/balance'
import { createCityMap, type CityMap } from '../game/cityMap'
import { createClock, setSpeed, tick, togglePause, type ShiftClock } from '../game/clock'
import { assignOrder } from '../game/dispatch'
import { createOrderQueue, spawnOrders, type OrderQueue, type OrderSettings } from '../game/orders'
import { createRandom } from '../game/random'
import { createRiders, type Rider } from '../game/riders'

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
}

const NORMAL_SPEED = 1

export const orderSettings: OrderSettings = {
  spawnIntervalSec: prototype.orders.spawnIntervalSec,
  deadlineSec: prototype.orders.deadlineSec,
  lastSpawnBeforeSec: prototype.shift.durationSec,
}

// One random stream for the whole shift: first the map, then the riders, then the orders.
// Same seed, same shift.
const random = createRandom(prototype.seed)
const map = createCityMap(prototype.grid.size, prototype.grid.restaurants, random)

export const useShiftStore = create<ShiftState>()((set) => ({
  map,
  riders: createRiders(map, prototype.riders.count, prototype.riders.vehicle, random),
  clock: createClock(prototype.shift.durationSec),
  orderQueue: createOrderQueue(orderSettings),
  tick: (dtSec) =>
    set((state) => {
      const clock = tick(state.clock, dtSec)
      if (clock === state.clock) return state
      const orderQueue = spawnOrders(state.orderQueue, clock.elapsedSec, state.map, random, orderSettings)
      return orderQueue === state.orderQueue ? { clock } : { clock, orderQueue }
    }),
  togglePause: () => set((state) => ({ clock: togglePause(state.clock) })),
  toggleSpeed: () =>
    set((state) => {
      const speed = state.clock.speed === NORMAL_SPEED ? clockBalance.fastSpeed : NORMAL_SPEED
      return { clock: setSpeed(state.clock, speed) }
    }),
  selectedOrderId: null,
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
      const result = assignOrder(state.orderQueue.orders, state.riders, state.selectedOrderId, rider.id)
      if (!result.ok) return state
      return {
        orderQueue: { ...state.orderQueue, orders: result.orders },
        riders: result.riders,
        selectedOrderId: null,
      }
    }),
}))
