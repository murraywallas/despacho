import { describe, expect, test } from 'vitest'
import { balanceFor, createLevelShift } from '../../src/game/levels'
import { advanceFleet } from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'
import { dispatchOrders, shiftSettingsFrom } from '../../src/game/shift'
import { tripArrivals } from '../../src/game/stops'

const settings = shiftSettingsFrom(balanceFor('lunch'))
const speeds = settings.movement.metersPerSec
const STEP_SEC = 0.25

/** Lunch with two orders of the same restaurant, for customers in different places, and the bike free. */
function twoOrders(deadlineAtSec = 9999) {
  const { shift } = createLevelShift('lunch')
  const restaurant = shift.map.restaurants[0]
  const bike = shift.riders.find((rider) => rider.vehicle === 'bike')!
  const customers = shift.map.addresses.filter((node) => node !== restaurant.node && node !== bike.node)
  const make = (id: string, number: number, customer: number): Order => ({
    id,
    number,
    restaurantId: restaurant.id,
    customer,
    createdAtSec: 0,
    readyAtSec: 20,
    deadlineAtSec,
    status: 'pending',
  })
  const trip = [make('o1', 1, customers[0]), make('o2', 2, customers[customers.length - 1])]
  return { shift, bike, trip }
}

describe('llegada de cada pedido de un viaje con varias paradas', () => {
  test('una por pedido, en el orden de entrega, y la segunda después de la primera', () => {
    const { shift, bike, trip } = twoOrders()
    const arrivals = tripArrivals(shift.map, bike, trip, speeds, 0)
    expect(arrivals.map((arrival) => arrival.order.id)).toEqual(['o1', 'o2'])
    expect(arrivals[0].atSec).toBeGreaterThan(trip[0].readyAtSec)
    expect(arrivals[1].atSec).toBeGreaterThan(arrivals[0].atSec)
    expect(arrivals.every((arrival) => !arrival.late)).toBe(true)
  })

  test('coincide con cuándo llega de verdad cada uno', () => {
    const { shift, bike, trip } = twoOrders()
    const arrivals = tripArrivals(shift.map, bike, trip, speeds, 0)
    const sent = dispatchOrders(shift.map, { ...shift.orderQueue, orders: trip }, shift.riders, ['o1', 'o2'], bike.id)!
    let riders: readonly Rider[] = sent.riders
    let orders: readonly Order[] = sent.orderQueue.orders
    let now = 0
    while (orders.some((order) => order.status !== 'delivered') && now < 3600) {
      ;({ riders, orders } = advanceFleet(shift.map, riders, orders, STEP_SEC, now, settings.movement))
      now += STEP_SEC
    }
    for (const arrival of arrivals) {
      const delivered = orders.find((order) => order.id === arrival.order.id)!.deliveredAtSec!
      expect(Math.abs(delivered - arrival.atSec)).toBeLessThanOrEqual(STEP_SEC)
    }
  })

  test('marca los que llegarían después de su plazo', () => {
    const { shift, bike, trip } = twoOrders()
    const first = tripArrivals(shift.map, bike, trip, speeds, 0)
    // Un plazo entre las dos llegadas: la primera a tiempo, la segunda tarde.
    const between = (first[0].atSec + first[1].atSec) / 2
    const tight = trip.map((order) => ({ ...order, deadlineAtSec: between }))
    expect(tripArrivals(shift.map, bike, tight, speeds, 0).map((arrival) => arrival.late)).toEqual([false, true])
  })

  test('sin manera de llegar, no hay estimación', () => {
    const { shift, bike, trip } = twoOrders()
    const nowhere: Rider = { ...bike, node: -1 }
    expect(tripArrivals(shift.map, nowhere, trip, speeds, 0)).toEqual([])
  })
})
