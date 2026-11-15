import { describe, expect, test } from 'vitest'
import { clock as clockBalance } from '../../src/game/balance'
import { isOver, shownSec } from '../../src/game/clock'
import { balanceFor, createLevelShift } from '../../src/game/levels'
import type { Order } from '../../src/game/orders'
import { advanceShift, dispatchOrders, shiftSettingsFrom, type ShiftSnapshot } from '../../src/game/shift'

const settings = shiftSettingsFrom(balanceFor('lunch'))
const STEP_SEC = 0.25
const LIMIT_SEC = 3600

/** Lunch with one order dispatched and already picked up, a little before the closing hour. */
function foodOnItsWayAtClosing() {
  const created = createLevelShift('lunch')
  let shift: ShiftSnapshot = created.shift
  const restaurant = shift.map.restaurants[0]
  const make = (id: string, number: number): Order => ({
    id,
    number,
    restaurantId: restaurant.id,
    customer: shift.map.addresses.find((node) => node !== restaurant.node)!,
    createdAtSec: 0,
    readyAtSec: 0,
    deadlineAtSec: 1,
    status: 'pending',
  })
  shift = { ...shift, orderQueue: { ...shift.orderQueue, orders: [make('o1', 1)] } }
  const sent = dispatchOrders(shift.map, shift.orderQueue, shift.riders, ['o1'], shift.riders[0].id)!
  shift = { ...shift, ...sent }
  const status = () => shift.orderQueue.orders.find((order) => order.id === 'o1')?.status
  while (status() !== 'pickedUp' && shift.clock.elapsedSec < LIMIT_SEC) shift = advanceShift(shift, STEP_SEC, created.random, settings)
  expect(status()).toBe('pickedUp')
  // Jump to just before the closing hour, with one more order waiting that nobody took.
  shift = {
    ...shift,
    clock: { ...shift.clock, elapsedSec: shift.clock.durationSec - STEP_SEC / 2 },
    orderQueue: { ...shift.orderQueue, orders: [...shift.orderQueue.orders.filter((order) => order.id === 'o1'), make('o2', 2)] },
  }
  return { shift, random: created.random }
}

describe('cierre del turno con comida en camino', () => {
  test('a la hora de cierre: se cancela lo que nadie recogió, y el turno sigue (más rápido) hasta entregar lo que va en camino', () => {
    const start = foodOnItsWayAtClosing()
    let shift = advanceShift(start.shift, STEP_SEC, start.random, settings)
    const status = (id: string) => shift.orderQueue.orders.find((order) => order.id === id)?.status
    expect(shift.clock).toMatchObject({ closing: true, finished: false, speed: clockBalance.closingSpeed })
    expect(isOver(shift.clock)).toBe(true)
    expect(status('o1')).toBe('pickedUp')
    expect(status('o2')).toBe('cancelled')
    // El reloj de pantalla queda en la hora de cierre.
    const count = shift.orderQueue.orders.length
    while (!shift.clock.finished && shift.clock.elapsedSec < LIMIT_SEC) {
      shift = advanceShift(shift, STEP_SEC, start.random, settings)
      expect(shownSec(shift.clock)).toBe(shift.clock.durationSec)
    }
    expect(shift.clock).toMatchObject({ closing: false, finished: true })
    expect(status('o1')).toBe('delivered')
    // Mientras cierra no entran pedidos nuevos.
    expect(shift.orderQueue.orders).toHaveLength(count)
  })

  test('sin comida en camino, el turno termina justo a la hora de cierre', () => {
    const start = foodOnItsWayAtClosing()
    const nothingOnTheWay: ShiftSnapshot = {
      ...start.shift,
      orderQueue: { ...start.shift.orderQueue, orders: start.shift.orderQueue.orders.filter((order) => order.id !== 'o1') },
      riders: start.shift.riders.map((rider) => ({ ...rider, status: 'idle', orderIds: undefined, trip: undefined })),
    }
    const shift = advanceShift(nothingOnTheWay, STEP_SEC, start.random, settings)
    expect(shift.clock).toMatchObject({ closing: false, finished: true, elapsedSec: shift.clock.durationSec })
  })
})
