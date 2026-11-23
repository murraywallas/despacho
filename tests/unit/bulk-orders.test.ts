import { describe, expect, test } from 'vitest'
import { autoplay, triageBot } from '../../src/game/autoplay'
import { eventKinds, fleetOf, levels, shiftEvents } from '../../src/game/balance'
import { spawnBulkOrders, type BulkKind } from '../../src/game/bulkOrders'
import { positionOf } from '../../src/game/cityMap'
import { balanceFor, neighborhoodOf } from '../../src/game/levels'
import { createOrderQueue, type OrderSettings } from '../../src/game/orders'
import { createRandom } from '../../src/game/random'
import { shiftSettingsFrom } from '../../src/game/shift'
import type { ShiftEvent } from '../../src/game/shiftEvents'
import { distanceM } from '../../src/game/streetGraph'
import { nodeAt, smallCity } from './smallCity'

const map = smallCity([nodeAt(0, 0)], 7)
const settings: OrderSettings = {
  spawnIntervalSec: 1000,
  deadlineSec: 100,
  cookSec: 15,
  minCustomerDistanceM: 300,
  lastSpawnBeforeSec: 500,
}
const kinds: Record<string, BulkKind> = {
  office_order: { effectType: 'bulk', bulkOrders: 5, bulkDeadlineSec: 300, bulkSpreadM: 150 },
  rain: { effectType: 'speed' },
}
const office: ShiftEvent = { id: 'lunch_office', event: 'office_order', fromSec: 60, toSec: 61, announced: true }
const rain: ShiftEvent = { id: 'lunch_rain', event: 'rain', fromSec: 0, toSec: 400, announced: true }

describe('pedido de oficina', () => {
  test('llegan 5 pedidos de golpe, de un mismo restaurante, a escritorios cercanos y con plazo largo', () => {
    const random = createRandom(7)
    const empty = createOrderQueue(settings)
    expect(spawnBulkOrders(empty, 59, map, random, settings, [office, rain], kinds)).toBe(empty)

    const queue = spawnBulkOrders(empty, 62, map, random, settings, [office, rain], kinds)
    expect(queue.orders).toHaveLength(5)
    expect(queue.orders.map((order) => order.number)).toEqual([1, 2, 3, 4, 5])
    expect(new Set(queue.orders.map((order) => order.restaurantId)).size).toBe(1)
    expect(new Set(queue.orders.map((order) => order.customer)).size).toBe(5)
    const desk = positionOf(map, queue.orders[0].customer)
    for (const order of queue.orders) {
      expect(order).toMatchObject({ createdAtSec: 60, readyAtSec: 75, deadlineAtSec: 360, status: 'pending', fromEvent: 'lunch_office' })
      expect(distanceM(positionOf(map, order.customer), desk)).toBeLessThanOrEqual(150 + 1e-6)
    }

    // Una sola vez: más tarde no vuelven a llegar.
    expect(spawnBulkOrders(queue, 200, map, random, settings, [office, rain], kinds)).toBe(queue)
  })

  test('el Almuerzo en Vesterbro trae su pedido de oficina, anunciado', () => {
    const event = shiftEvents.vesterbro_lunch_office
    expect(levels.vesterbro_lunch.events).toContain('vesterbro_lunch_office')
    expect(event.announced).toBe(true)
    const balance = balanceFor('vesterbro_lunch')
    const options = { reactionSec: 3, picksPerLook: 1, stepSec: 0.25 }
    const end = autoplay(balance, shiftSettingsFrom(balance), balance.seed, triageBot, options, neighborhoodOf('vesterbro_lunch'))
    const fromOffice = end.orderQueue.orders.filter((order) => order.fromEvent === 'vesterbro_lunch_office')
    expect(fromOffice).toHaveLength(eventKinds.office_order.bulkOrders ?? 0)
    expect(fromOffice.every((order) => order.createdAtSec === event.fromSec)).toBe(true)
    expect(fleetOf(balance)).not.toContain('cargo_bike') // la cargo se elige en el garage
  })
})
