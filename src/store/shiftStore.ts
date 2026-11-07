import { create } from 'zustand'
import { clock as clockBalance, prototype } from '../game/balance'
import { cancelExpired } from '../game/cancellation'
import { createCityMap, type CityMap } from '../game/cityMap'
import { createClock, setSpeed, tick, togglePause, type ShiftClock } from '../game/clock'
import { assignOrder } from '../game/dispatch'
import { advanceFleet, startTrip, type MovementSettings } from '../game/movement'
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
  /** "Jugar otra vez": starts the shift over (clock, orders, riders and stars). */
  restartShift: () => void
}

const NORMAL_SPEED = 1

export const orderSettings: OrderSettings = {
  spawnIntervalSec: prototype.orders.spawnIntervalSec,
  deadlineSec: prototype.orders.deadlineSec,
  lastSpawnBeforeSec: prototype.shift.durationSec,
}

const movementSettings: MovementSettings = {
  speedBlocksPerSec: prototype.riders.speedBlocksPerSec,
  kitchenWaitSec: prototype.kitchen.waitSec,
}

// One random stream per shift: first the map, then the riders, then the orders.
// Same seed, same shift.
let random = createRandom(prototype.seed)

type ShiftData = Pick<ShiftState, 'map' | 'riders' | 'clock' | 'orderQueue' | 'selectedOrderId'>

/** A fresh shift: clock at the start, no orders, riders at their starting spots. */
function newShift(): ShiftData {
  random = createRandom(prototype.seed)
  const map = createCityMap(prototype.grid.size, prototype.grid.restaurants, random)
  return {
    map,
    riders: createRiders(map, prototype.riders.count, prototype.riders.vehicle, random),
    clock: createClock(prototype.shift.durationSec),
    orderQueue: createOrderQueue(orderSettings),
    selectedOrderId: null,
  }
}

export const useShiftStore = create<ShiftState>()((set) => ({
  ...newShift(),
  restartShift: () => set(newShift()),
  tick: (dtSec) =>
    set((state) => {
      const clock = tick(state.clock, dtSec)
      if (clock === state.clock) return state
      // Game seconds that really passed: 0 in pause, double at 2x, cut at the end of the shift.
      const gameDtSec = clock.elapsedSec - state.clock.elapsedSec
      const fleet = advanceFleet(
        state.map,
        state.riders,
        state.orderQueue.orders,
        gameDtSec,
        state.clock.elapsedSec,
        movementSettings,
      )
      // Deliveries in this step happen before cancellations, so a rider arriving just in time still counts.
      const after = cancelExpired(fleet.orders, fleet.riders, clock.elapsedSec, prototype.orders.cancelAfterSec)
      const moved =
        after.orders === state.orderQueue.orders ? state.orderQueue : { ...state.orderQueue, orders: [...after.orders] }
      const orderQueue = spawnOrders(moved, clock.elapsedSec, state.map, random, orderSettings)
      const selected = orderQueue.orders.find((order) => order.id === state.selectedOrderId)
      const selectedOrderId = selected?.status === 'pending' ? state.selectedOrderId : null
      return { clock, riders: after.riders, orderQueue, selectedOrderId }
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
      const result = assignOrder(state.orderQueue.orders, state.riders, state.selectedOrderId, rider.id)
      if (!result.ok) return state
      const order = result.orders.find((candidate) => candidate.id === state.selectedOrderId)
      return {
        orderQueue: { ...state.orderQueue, orders: result.orders },
        riders: result.riders.map((candidate) =>
          candidate.id === rider.id && order ? startTrip(state.map, candidate, order) : candidate,
        ),
        selectedOrderId: null,
      }
    }),
}))
