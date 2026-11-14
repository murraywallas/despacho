import { describe, expect, test } from 'vitest'
import { prototype, vehicles } from '../../src/game/balance'
import {
  advanceCharging,
  batteryShare,
  drain,
  fullBatteryM,
  hasBatteryFor,
  isLowBattery,
  sendToCharge,
  tripMeters,
} from '../../src/game/battery'
import { rankRiders } from '../../src/game/dispatch'
import { createLevelShift } from '../../src/game/levels'
import { advanceFleet } from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'
import { dispatchOrders, shiftSettingsFrom, type ShiftSnapshot } from '../../src/game/shift'
import { balanceFor } from '../../src/game/levels'

const settings = shiftSettingsFrom(balanceFor('lunch'))
const FULL_M = fullBatteryM(vehicles.e_scooter.rangeKm) ?? 0
const RECHARGE_SEC = prototype.riders.rechargeSec ?? 0
const STEP_SEC = 0.5

/** The lunch shift with one pending order far enough from the e-scooter to test with. */
function lunchWithOrder(): { shift: ShiftSnapshot; scooter: Rider; order: Order } {
  const { shift } = createLevelShift('lunch')
  const scooter = shift.riders.find((rider) => rider.vehicle === 'e_scooter')
  if (!scooter) throw new Error('El almuerzo no tiene monopatín')
  const restaurant = shift.map.restaurants[0]
  const customer = shift.map.addresses.find((node) => node !== restaurant.node && node !== scooter.node) ?? 0
  const order: Order = {
    id: 'o1',
    number: 1,
    restaurantId: restaurant.id,
    customer,
    createdAtSec: 0,
    readyAtSec: 0,
    deadlineAtSec: 10_000,
    status: 'pending',
  }
  return { shift: { ...shift, orderQueue: { ...shift.orderQueue, orders: [order] } }, scooter, order }
}

function withScooter(shift: ShiftSnapshot, change: Partial<Rider>): ShiftSnapshot {
  return { ...shift, riders: shift.riders.map((rider) => (rider.vehicle === 'e_scooter' ? { ...rider, ...change } : rider)) }
}

describe('batería del monopatín', () => {
  test('sale con la batería llena de la pestaña Vehículos; los demás vehículos no tienen batería', () => {
    expect(FULL_M).toBe(vehicles.e_scooter.rangeKm! * 1000)
    const { shift, scooter } = lunchWithOrder()
    expect(scooter.batteryM).toBe(FULL_M)
    expect(scooter.home).toBe(scooter.node)
    for (const rider of shift.riders.filter((each) => each.vehicle !== 'e_scooter')) expect(rider.batteryM).toBeUndefined()
    expect(RECHARGE_SEC).toBeGreaterThan(0)
  })

  test('la batería baja con cada metro recorrido', () => {
    const { shift, scooter, order } = lunchWithOrder()
    const meters = tripMeters(shift.map, scooter, [order])
    expect(meters).toBeGreaterThan(0)
    const dispatched = dispatchOrders(shift.map, shift.orderQueue, shift.riders, [order.id], scooter.id)
    expect(dispatched).toBeDefined()
    let riders = dispatched!.riders
    let orders = dispatched!.orderQueue.orders
    let now = 0
    while (orders[0].status !== 'delivered' && now < 3600) {
      ;({ riders, orders } = advanceFleet(shift.map, riders, orders, STEP_SEC, now, settings.movement))
      now += STEP_SEC
    }
    const after = riders.find((rider) => rider.id === scooter.id)!
    expect(after.batteryM).toBeCloseTo(FULL_M - meters, 0)
  })

  test('drain nunca baja de cero y no toca vehículos sin batería', () => {
    const { scooter } = lunchWithOrder()
    expect(drain(scooter, FULL_M * 2).batteryM).toBe(0)
    const bike: Rider = { id: 'k1', number: 1, vehicle: 'bike', node: 0, status: 'idle' }
    expect(drain(bike, 500)).toBe(bike)
    expect(hasBatteryFor(bike, 1e9)).toBe(true)
    expect(batteryShare({ ...scooter, batteryM: FULL_M / 4 }, FULL_M)).toBeCloseTo(0.25)
  })

  test('la batería se marca baja por debajo del 20 % de Reglas, salvo mientras recarga', () => {
    const { scooter } = lunchWithOrder()
    const lowShare = prototype.riders.lowBatteryPct ?? 0
    expect(lowShare).toBeCloseTo(0.2)
    const at = (share: number) => ({ ...scooter, batteryM: FULL_M * share })
    expect(isLowBattery(at(0.19), batteryShare(at(0.19), FULL_M), lowShare)).toBe(true)
    expect(isLowBattery(at(0.21), batteryShare(at(0.21), FULL_M), lowShare)).toBe(false)
    const charging = { ...at(0.05), status: 'charging' as const }
    expect(isLowBattery(charging, batteryShare(charging, FULL_M), lowShare)).toBe(false)
  })

  test('sin batería suficiente no toma el viaje: el pedido sigue esperando y el monopatín vuelve a recargar', () => {
    const { shift, scooter, order } = lunchWithOrder()
    const moved = scooter.home === shift.map.addresses[0] ? shift.map.addresses[1] : shift.map.addresses[0]
    const low = withScooter(shift, { batteryM: 10, node: moved })
    const result = dispatchOrders(low.map, low.orderQueue, low.riders, [order.id], scooter.id)
    expect(result).toBeDefined()
    expect(result!.orderQueue.orders[0].status).toBe('pending')
    const after = result!.riders.find((rider) => rider.id === scooter.id)!
    expect(after.status).toBe('toBase')
    expect(after.orderIds).toBeUndefined()
  })

  test('el ranking no ofrece un monopatín sin batería para el viaje', () => {
    const { shift, scooter, order } = lunchWithOrder()
    const speeds = settings.movement.metersPerSec
    expect(rankRiders(shift.map, shift.riders, order, speeds).map((ranked) => ranked.rider.id)).toContain(scooter.id)
    const low = withScooter(shift, { batteryM: 10 })
    expect(rankRiders(low.map, low.riders, order, speeds).map((ranked) => ranked.rider.id)).not.toContain(scooter.id)
  })

  test('recarga: vuelve a la base, tarda el tiempo de Reglas y queda libre con la batería llena', () => {
    const { shift, scooter } = lunchWithOrder()
    const away = shift.map.addresses.find((node) => node !== scooter.home) ?? 0
    const going = sendToCharge(shift.map, { ...scooter, node: away, batteryM: 100 }, RECHARGE_SEC)
    expect(going.status).toBe('toBase')
    const speed = settings.movement.metersPerSec.e_scooter
    let rider = going
    let elapsed = 0
    while (rider.status === 'toBase') {
      rider = advanceCharging(rider, STEP_SEC, speed, RECHARGE_SEC, FULL_M)
      elapsed += STEP_SEC
    }
    expect(rider.status).toBe('charging')
    expect(rider.node).toBe(scooter.home)
    const arrivedAt = elapsed
    while (rider.status === 'charging') {
      rider = advanceCharging(rider, STEP_SEC, speed, RECHARGE_SEC, FULL_M)
      elapsed += STEP_SEC
    }
    expect(rider.status).toBe('idle')
    expect(rider.batteryM).toBe(FULL_M)
    expect(elapsed - arrivedAt).toBeGreaterThanOrEqual(RECHARGE_SEC - STEP_SEC)
    expect(elapsed - arrivedAt).toBeLessThanOrEqual(RECHARGE_SEC + STEP_SEC)
  })

  test('si ya está en la base, recarga sin viajar', () => {
    const { shift, scooter } = lunchWithOrder()
    expect(sendToCharge(shift.map, { ...scooter, batteryM: 0 }, RECHARGE_SEC)).toMatchObject({
      status: 'charging',
      chargeLeftSec: RECHARGE_SEC,
    })
  })

  test('mientras recarga avanza con el reloj del turno', () => {
    const { shift, scooter } = lunchWithOrder()
    const charging = withScooter(shift, { status: 'charging', chargeLeftSec: RECHARGE_SEC, batteryM: 0 })
    const { riders } = advanceFleet(charging.map, charging.riders, [], RECHARGE_SEC + 1, 0, settings.movement)
    const after = riders.find((rider) => rider.id === scooter.id)!
    expect(after.status).toBe('idle')
    expect(after.batteryM).toBe(FULL_M)
  })
})
