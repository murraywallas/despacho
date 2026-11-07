import { create } from 'zustand'
import { clock as clockBalance, prototype } from '../game/balance'
import { createCityMap, type CityMap } from '../game/cityMap'
import { createClock, setSpeed, tick, togglePause, type ShiftClock } from '../game/clock'
import { createOrderQueue, spawnOrders, type OrderQueue, type OrderSettings } from '../game/orders'
import { createRandom } from '../game/random'

interface ShiftState {
  map: CityMap
  clock: ShiftClock
  orderQueue: OrderQueue
  /** Advances the game by dtSec real seconds. */
  tick: (dtSec: number) => void
  togglePause: () => void
  /** Switches between normal speed and the fast speed from balance.json. */
  toggleSpeed: () => void
}

const NORMAL_SPEED = 1

export const orderSettings: OrderSettings = {
  spawnIntervalSec: prototype.orders.spawnIntervalSec,
  deadlineSec: prototype.orders.deadlineSec,
  lastSpawnBeforeSec: prototype.shift.durationSec,
}

// One random stream for the whole shift: first the map, then the orders. Same seed, same shift.
const random = createRandom(prototype.seed)

export const useShiftStore = create<ShiftState>()((set) => ({
  map: createCityMap(prototype.grid.size, prototype.grid.restaurants, random),
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
}))
