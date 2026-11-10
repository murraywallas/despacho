/**
 * One step of a shift: the clock, the riders, the cancellations and the new orders, in that order.
 * The store and the balance bots (autoplay.ts) both play through these functions, so they follow the same rules. Pure.
 */
import { clock as clockBalance, fleetOf, vehicles, type PrototypeBalance } from './balance'
import { cancelExpired, closeShift } from './cancellation'
import { createCityMap, type CityMap } from './cityMap'
import { createClock, tick, type ShiftClock } from './clock'
import { assignOrder } from './dispatch'
import { advanceFleet, startTrip, type MovementSettings } from './movement'
import { createOrderQueue, spawnOrders, type OrderQueue, type OrderSettings } from './orders'
import { createRandom, type Random } from './random'
import { norrebroBikeNetwork, norrebroNetworkFor } from './norrebro'
import { createRiders, type Rider } from './riders'
import type { StreetNetwork } from './routing'

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

const SECONDS_PER_HOUR = 3600
const METERS_PER_KM = 1000

/** Meters a vehicle covers per second of play: its real speed, sped up like the game clock. */
export function metersPerSecOf(vehicle: string, gameSecondsPerRealSecond = clockBalance.gameSecondsPerRealSecond): number {
  const row = vehicles[vehicle]
  if (!row) throw new Error(`El vehículo ${vehicle} no está en la hoja Vehículos.`)
  return ((row.speedKmh * METERS_PER_KM) / SECONDS_PER_HOUR) * gameSecondsPerRealSecond
}

/** The rules of a prototype shift, from balance.json. */
export function shiftSettingsFrom(balance: PrototypeBalance): ShiftSettings {
  return {
    orders: {
      spawnIntervalSec: balance.orders.spawnIntervalSec,
      deadlineSec: balance.orders.deadlineSec,
      cookSec: balance.kitchen.cookSec,
      // The kitchen closes before the shift ends, so the last orders can still be delivered.
      lastSpawnBeforeSec: balance.shift.durationSec - balance.orders.lastOrderBeforeEndSec,
      minCustomerDistanceM: balance.orders.minCustomerDistanceM,
    },
    movement: {
      metersPerSec: Object.fromEntries(fleetOf(balance).map((vehicle) => [vehicle, metersPerSecOf(vehicle)])),
    },
    cancelAfterSec: balance.orders.cancelAfterSec,
  }
}

/**
 * A fresh shift and its random stream. One stream per shift: first the map, then the riders, then the orders.
 * Same seed, same shift.
 */
export function createShift(
  balance: PrototypeBalance,
  seed: number,
  network: StreetNetwork = norrebroBikeNetwork(),
  networkOf: (vehicle: string) => StreetNetwork = norrebroNetworkFor,
): { shift: ShiftSnapshot; random: Random } {
  const random = createRandom(seed)
  const fleet = fleetOf(balance)
  const networks = Object.fromEntries(fleet.map((vehicle) => [vehicle, networkOf(vehicle)]))
  const map = createCityMap(network, balance.restaurants.count, random, networks)
  return {
    random,
    shift: {
      map,
      riders: createRiders(map, fleet, random),
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
  // Seconds of play that really passed: 0 in pause, double at 2x, cut at the end of the shift.
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
  const expired = cancelExpired(fleet.orders, fleet.riders, clock.elapsedSec, settings.cancelAfterSec)
  // The shift just closed: whatever is still undelivered counts as cancelled.
  const after = clock.finished ? closeShift(expired.orders, expired.riders, clock.elapsedSec) : expired
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
