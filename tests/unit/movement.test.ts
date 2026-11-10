import { describe, expect, test } from 'vitest'
import { assignOrder } from '../../src/game/dispatch'
import { advanceFleet, remainingRoute, riderDisplayPosition, startTrip, type MovementSettings } from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'
import type { LonLat } from '../../src/game/streetGraph'
import { BLOCK_M, latticeOf, nodeAt, smallCity } from './smallCity'

// Restaurant 3 blocks east of the rider, customer 4 blocks south of the restaurant. One block per second.
// The food is ready 8 s after dispatch: the rider gets there in 3 s and waits 5 s at the kitchen.
const map = smallCity([nodeAt(3, 0)])
const settings: MovementSettings = { metersPerSec: { bike: BLOCK_M } }
const START = 10

const pendingOrder: Order = {
  id: 'o1',
  number: 1,
  restaurantId: 'r1',
  customer: nodeAt(3, 4),
  createdAtSec: START,
  readyAtSec: START + 8,
  deadlineAtSec: START + 120,
  status: 'pending',
}
const idleRider: Rider = { id: 'k1', number: 1, vehicle: 'bike', node: nodeAt(0, 0), status: 'idle' }

function dispatched(riderAt = idleRider.node, order = pendingOrder) {
  const result = assignOrder([order], [{ ...idleRider, node: riderAt }], 'o1', 'k1')
  if (!result.ok) throw new Error(result.error)
  return { riders: [startTrip(map, result.riders[0], result.orders)], orders: result.orders }
}

/** Advances in small steps, like the game loop does. */
function run(seconds: number, step = 0.1, start = dispatched()) {
  let riders: readonly Rider[] = start.riders
  let orders: readonly Order[] = start.orders
  let now = START
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += step) {
    const dt = Math.min(step, seconds - elapsed)
    ;({ riders, orders } = advanceFleet(map, riders, orders, dt, now, settings))
    now += dt
  }
  return { rider: riders[0], order: orders[0] }
}

/** Where the rider is drawn, in blocks of the lattice. */
function drawnAt(rider: Rider) {
  return latticeOf(riderDisplayPosition(map, rider))
}

function expectLattice(point: LonLat, x: number, y: number) {
  const lattice = latticeOf(point)
  expect(lattice.x).toBeCloseTo(x, 3)
  expect(lattice.y).toBeCloseTo(y, 3)
}

describe('viaje de un pedido', () => {
  test('va por las calles hasta el restaurante a la velocidad del vehículo', () => {
    const { rider } = run(1.5)
    expect(rider.status).toBe('toRestaurant')
    expect(drawnAt(rider).x).toBeCloseTo(1.5, 3)
    expect(drawnAt(rider).y).toBeCloseTo(0, 3)
    expect(rider.node).toBe(nodeAt(1, 0))
  })

  test('espera la cocina en el restaurante', () => {
    const { rider, order } = run(3 + 2)
    expect(rider.status).toBe('atKitchen')
    expect(rider.node).toBe(nodeAt(3, 0))
    expect(rider.trip?.kitchenLeftSec).toBeCloseTo(3)
    expect(order.status).toBe('assigned')
  })

  test('sale de la cocina y lleva la comida al cliente', () => {
    const { rider, order } = run(3 + 5 + 1)
    expect(rider.status).toBe('toCustomer')
    expect(order.status).toBe('pickedUp')
    expect(order.pickedUpAtSec).toBeCloseTo(START + 8)
    expect(drawnAt(rider).x).toBeCloseTo(3, 3)
    expect(drawnAt(rider).y).toBeCloseTo(1, 3)
  })

  test('un viaje conocido tarda 3 + 5 + 4 = 12 s y el repartidor queda libre donde entregó', () => {
    const almost = run(11.9)
    expect(almost.order.status).toBe('pickedUp')

    const { rider, order } = run(12)
    expect(order.status).toBe('delivered')
    expect(order.deliveredAtSec).toBeCloseTo(START + 12)
    expect(rider).toMatchObject({ status: 'idle', node: nodeAt(3, 4) })
    expect(rider.trip).toBeUndefined()
    expect(rider.orderIds).toBeUndefined()
  })

  test('avanzar de golpe da el mismo resultado que de a poco', () => {
    const { rider, order } = run(20, 20)
    expect(order.deliveredAtSec).toBeCloseTo(START + 12)
    expect(rider.node).toBe(nodeAt(3, 4))
  })

  test('nunca corta camino: siempre está sobre una calle', () => {
    for (let seconds = 0.25; seconds <= 12; seconds += 0.25) {
      const { x, y } = drawnAt(run(seconds).rider)
      const onStreet = Number.isInteger(+x.toFixed(6)) || Number.isInteger(+y.toFixed(6))
      expect(onStreet, `${seconds} s: ${x}, ${y}`).toBe(true)
    }
  })

  test('si ya está en el restaurante, espera lo que le falta a la cocina', () => {
    const { rider } = run(1, 0.1, dispatched(nodeAt(3, 0)))
    expect(rider.status).toBe('atKitchen')
    expect(rider.trip?.kitchenLeftSec).toBeCloseTo(7)
  })

  test('si la comida ya está lista, la retira sin esperar', () => {
    const ready = { ...pendingOrder, readyAtSec: START - 30 }
    const { rider, order } = run(4, 0.1, dispatched(idleRider.node, ready))
    expect(order.pickedUpAtSec).toBeCloseTo(START + 3)
    expect(rider.status).toBe('toCustomer')
    expect(drawnAt(rider).y).toBeCloseTo(1, 3)
  })

  test('sin tiempo de juego no se mueve nadie', () => {
    const start = dispatched()
    const result = advanceFleet(map, start.riders, start.orders, 0, START, settings)
    expect(result.riders).toBe(start.riders)
    expect(result.orders).toBe(start.orders)
  })
})

describe('ruta que falta', () => {
  test('mientras va al restaurante incluye el tramo hasta el cliente', () => {
    const { rider, order } = run(1.5)
    const route = remainingRoute(map, rider, [order])
    expectLattice(route[0], 1.5, 0)
    expectLattice(route[route.length - 1], 3, 4)
  })

  test('esperando la cocina, la ruta es la del restaurante al cliente', () => {
    const { rider, order } = run(5)
    const route = remainingRoute(map, rider, [order])
    expectLattice(route[0], 3, 0)
    expect(route).toHaveLength(5)
  })

  test('mientras lleva la comida, solo lo que falta hasta el cliente', () => {
    const { rider, order } = run(10)
    const route = remainingRoute(map, rider, [order])
    expectLattice(route[0], 3, 2)
    expectLattice(route[route.length - 1], 3, 4)
    expect(route.every((point) => latticeOf(point).y >= 2 - 1e-6)).toBe(true)
  })

  test('libre: no hay ruta', () => {
    expect(remainingRoute(map, idleRider, [])).toEqual([])
  })
})
