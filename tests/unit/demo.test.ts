import { describe, expect, test } from 'vitest'
import { clock as clockBalance } from '../../src/game/balance'
import { advanceDemo, createDemo, type Demo } from '../../src/game/demo'

const FRAME_SEC = 0.25

/** Runs the demo this many real seconds, frame by frame. */
function run(demo: Demo, seconds: number): Demo {
  let current = demo
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME_SEC) current = advanceDemo(current, FRAME_SEC)
  return current
}

describe('el turno de la pantalla de inicio', () => {
  test('arranca a la velocidad rápida, con restaurantes y repartidores en sus calles', () => {
    const demo = createDemo('vesterbro_lunch', 1)
    expect(demo.shift.clock.speed).toBe(clockBalance.fastSpeed)
    expect(demo.shift.map.restaurants.length).toBeGreaterThan(0)
    expect(demo.shift.riders.length).toBeGreaterThan(0)
  })

  test('se juega solo: llegan pedidos, salen repartidores y se entregan', () => {
    const later = run(createDemo('vesterbro_lunch', 1), 90)
    const orders = later.shift.orderQueue.orders
    expect(orders.length).toBeGreaterThan(0)
    expect(later.shift.riders.some((rider) => rider.status !== 'idle')).toBe(true)
    expect(orders.some((order) => order.status === 'delivered')).toBe(true)
  })

  test('cuando termina el turno, empieza otro con otra semilla', () => {
    const demo = createDemo('vesterbro_lunch', 1)
    const ended: Demo = { ...demo, shift: { ...demo.shift, clock: { ...demo.shift.clock, finished: true } } }
    const next = advanceDemo(ended, FRAME_SEC)
    expect(next.seed).toBe(2)
    expect(next.shift.clock.elapsedSec).toBe(0)
    expect(next.shift.orderQueue.orders).toHaveLength(0)
  })
})
