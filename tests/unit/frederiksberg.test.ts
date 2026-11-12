import { describe, expect, test } from 'vitest'
import { levelIds, levels, prototype } from '../../src/game/balance'
import { positionOf } from '../../src/game/cityMap'
import { restaurantOf, travelTimeSec } from '../../src/game/dispatch'
import { balanceFor, createLevelShift, levelsOf, neighborhoodOf } from '../../src/game/levels'
import { networkOf } from '../../src/game/neighborhoods'
import type { Order } from '../../src/game/orders'
import { parkingSecOf } from '../../src/game/parking'
import { advanceShift, metersPerSecOf, shiftSettingsFrom, type ShiftSnapshot } from '../../src/game/shift'
import { distanceM } from '../../src/game/streetGraph'

/** Every order a level's shift brings, on its own streets. */
function ordersOf(levelId: string): { shift: ShiftSnapshot; orders: readonly Order[] } {
  const settings = shiftSettingsFrom(balanceFor(levelId))
  let { shift, random } = createLevelShift(levelId)
  while (!shift.clock.finished) shift = advanceShift(shift, 1, random, settings)
  return { shift, orders: shift.orderQueue.orders }
}

/** From the restaurant to the customer: the ride plus parking at both ends. */
function deliverySec(levelId: string, shift: ShiftSnapshot, order: Order, vehicle: string): number {
  const from = restaurantOf(shift.map, order).node
  const ride = travelTimeSec(networkOf(neighborhoodOf(levelId), vehicle), from, order.customer, metersPerSecOf(vehicle))
  return ride + 2 * parkingSecOf(vehicle)
}

describe('Frederiksberg: avenidas anchas y clientes lejos', () => {
  test.each(levelsOf('frederiksberg'))('%s: los clientes viven a la distancia que pide la hoja Niveles', (levelId) => {
    const { shift, orders } = ordersOf(levelId)
    expect(orders.length).toBeGreaterThan(0)
    const minM = levels[levelId].minCustomerDistanceM ?? 0
    for (const order of orders) {
      const restaurant = positionOf(shift.map, restaurantOf(shift.map, order).node)
      expect(distanceM(restaurant, positionOf(shift.map, order.customer))).toBeGreaterThanOrEqual(minM)
    }
  })

  test.each(levelsOf('frederiksberg'))('%s: los pedidos lejanos llegan antes en moto que en bici', (levelId) => {
    const { shift, orders } = ordersOf(levelId)
    const motoFirst = orders.filter(
      (order) => deliverySec(levelId, shift, order, 'motorcycle') < deliverySec(levelId, shift, order, 'bike'),
    )
    // Casi siempre gana la moto, aunque estacione en el restaurante y en el cliente.
    expect(motoFirst.length).toBeGreaterThan(orders.length * 0.75)
  })

  test('en el almuerzo de Nørrebro, con clientes más cerca, la bici le gana a la moto', () => {
    const { shift, orders } = ordersOf('lunch')
    const total = (vehicle: string) => orders.reduce((sum, order) => sum + deliverySec('lunch', shift, order, vehicle), 0)
    expect(total('bike')).toBeLessThan(total('motorcycle'))
  })
})

describe('restaurantes separados', () => {
  test.each(levelIds)('%s: ningún par de restaurantes está tan cerca que sus marcadores se tapen', (levelId) => {
    const { map } = createLevelShift(levelId).shift
    const minM = prototype.restaurants.minSpacingM ?? 0
    expect(minM).toBeGreaterThan(0)
    for (const a of map.restaurants) {
      for (const b of map.restaurants) {
        if (a !== b) expect(distanceM(positionOf(map, a.node), positionOf(map, b.node))).toBeGreaterThanOrEqual(minM)
      }
    }
  })
})
