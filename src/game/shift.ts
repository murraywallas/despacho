/**
 * One step of a shift: the clock, the riders, the cancellations and the new orders, in that order.
 * The store and the balance bots (autoplay.ts) both play through these functions, so they follow the same rules. Pure.
 */
import type { PrototypeBalance } from './balance'
import { cancelExpired } from './cancellation'
import { createCityMap, type CityMap } from './cityMap'
import { createClock, tick, type ShiftClock } from './clock'
import { assignOrder } from './dispatch'
import { advanceFleet, startTrip, type MovementSettings } from './movement'
import { createOrderQueue, spawnOrders, type OrderQueue, type OrderSettings } from './orders'
import { createRandom, type Random } from './random'
import { createRiders, type Rider } from './riders'

export interface ShiftSettings {
  readonly orders: OrderSettings
  readonly movement: MovementSettings
  /** How long after its deadline an undelivered order is cancelled. */
  readonly cancelAfterSec: number
}

export interface ShiftSnapshot {
  readonly map: CityMap
  readonly clock: ShiftClock
  readonly riders: readonly Rider[]
  readonly orderQueue: OrderQueue
}

/** The rules of a prototype shift, from balance.json. */
export function shiftSettingsFrom(balance: PrototypeBalance): ShiftSettings {
  return {
    orders: {
      spawnIntervalSec: balance.orders.spawnIntervalSec,
      deadlineSec: balance.orders.deadlineSec,
      cookSec: balance.kitchen.cookSec,
      lastSpawnBeforeSec: balance.shift.durationSec,
    },
    movement: {
      speedBlocksPerSec: balance.riders.speedBlocksPerSec,
    },
    cancelAfterSec: balance.orders.cancelAfterSec,
  }
}

/**
 * A fresh shift and its random stream. One stream per shift: first the map, then the riders, then the orders.
 * Same seed, same shift.
 */
export function createShift(balance: PrototypeBalance, seed: number): { shift: ShiftSnapshot; random: Random } {
  const random = createRandom(seed)
  const map = createCityMap(balance.grid.size, balance.grid.restaurants, random)
  return {
    random,
    shift: {
      map,
      riders: createRiders(map, balance.riders.count, balance.riders.vehicle, random),
      clock: createClock(balance.shift.durationSec),
      orderQueue: createOrderQueue(shiftSettingsFrom(balance).orders),
    },
  }
}

/**
 * Advances the shift by dtSec real seconds. Returns the same snapshot when the clock did not move
 * (paused, finished or no time).
 */
export function advanceShift(
  shift: ShiftSnapshot,
  dtSec: number,
  random: Random,
  settings: ShiftSettings,
): ShiftSnapshot {
  const clock = tick(shift.clock, dtSec)
  if (clock === shift.clock) return shift
  // Game seconds that really passed: 0 in pause, double at 2x, cut at the end of the shift.
  const gameDtSec = clock.elapsedSec - shift.clock.elapsedSec
  const fleet = advanceFleet(
    shift.map,
    shift.riders,
    shift.orderQueue.orders,
    gameDtSec,
    shift.clock.elapsedSec,
    settings.movement,
  )
  // Deliveries in this step happen before cancellations, so a rider arriving just in time still counts.
  const after = cancelExpired(fleet.orders, fleet.riders, clock.elapsedSec, settings.cancelAfterSec)
  const kept =
    after.orders === shift.orderQueue.orders ? shift.orderQueue : { ...shift.orderQueue, orders: [...after.orders] }
  const orderQueue = spawnOrders(kept, clock.elapsedSec, shift.map, random, settings.orders)
  return { ...shift, clock, riders: after.riders, orderQueue }
}

/** Gives an order to a rider and starts the trip. Undefined when the order or the rider can't take it. */
export function dispatchOrder(
  map: CityMap,
  orderQueue: OrderQueue,
  riders: readonly Rider[],
  orderId: string,
  riderId: string,
): { orderQueue: OrderQueue; riders: readonly Rider[] } | undefined {
  const result = assignOrder(orderQueue.orders, riders, orderId, riderId)
  if (!result.ok) return undefined
  const order = result.orders.find((candidate) => candidate.id === orderId)
  return {
    orderQueue: { ...orderQueue, orders: result.orders },
    riders: result.riders.map((rider) => (rider.id === riderId && order ? startTrip(map, rider, order) : rider)),
  }
}
