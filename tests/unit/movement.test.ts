import { describe, expect, test } from 'vitest'
import type { CityMap } from '../../src/game/cityMap'
import { assignOrder } from '../../src/game/dispatch'
import { createGrid } from '../../src/game/grid'
import {
  advanceFleet,
  remainingRoute,
  riderDisplayPosition,
  startTrip,
  type MovementSettings,
} from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'

// Restaurant 3 blocks east of the rider, customer 4 blocks south of the restaurant.
const map: CityMap = { grid: createGrid(10), restaurants: [{ id: 'r1', label: 'A', position: { x: 3, y: 0 } }] }
const settings: MovementSettings = { speedBlocksPerSec: 1, kitchenWaitSec: 5 }
const START = 10

const pendingOrder: Order = {
  id: 'o1',
  number: 1,
  restaurantId: 'r1',
  customer: { x: 3, y: 4 },
  createdAtSec: START,
  deadlineAtSec: START + 120,
  status: 'pending',
}
const idleRider: Rider = { id: 'k1', number: 1, vehicle: 'bike', position: { x: 0, y: 0 }, status: 'idle' }

function dispatched(riderAt = idleRider.position) {
  const result = assignOrder([pendingOrder], [{ ...idleRider, position: riderAt }], 'o1', 'k1')
  if (!result.ok) throw new Error(result.error)
  return { riders: [startTrip(map, result.riders[0], result.orders[0])], orders: result.orders }
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

describe('viaje de un pedido', () => {
  test('va por las calles hasta el restaurante a la velocidad de balance', () => {
    const { rider } = run(1.5)
    expect(rider.status).toBe('toRestaurant')
    expect(riderDisplayPosition(rider)).toEqual({ x: 1.5, y: 0 })
    expect(rider.position).toEqual({ x: 1, y: 0 })
  })

  test('espera la cocina en el restaurante', () => {
    const { rider, order } = run(3 + 2)
    expect(rider.status).toBe('atKitchen')
    expect(rider.position).toEqual({ x: 3, y: 0 })
    expect(rider.trip?.kitchenLeftSec).toBeCloseTo(3)
    expect(order.status).toBe('assigned')
  })

  test('sale de la cocina y lleva la comida al cliente', () => {
    const { rider, order } = run(3 + 5 + 1)
    expect(rider.status).toBe('toCustomer')
    expect(order.status).toBe('pickedUp')
    expect(order.pickedUpAtSec).toBeCloseTo(START + 8)
    expect(riderDisplayPosition(rider).x).toBeCloseTo(3)
    expect(riderDisplayPosition(rider).y).toBeCloseTo(1)
  })

  test('un viaje conocido tarda 3 + 5 + 4 = 12 s y el repartidor queda libre donde entregó', () => {
    const almost = run(11.9)
    expect(almost.order.status).toBe('pickedUp')

    const { rider, order } = run(12)
    expect(order.status).toBe('delivered')
    expect(order.deliveredAtSec).toBeCloseTo(START + 12)
    expect(rider).toMatchObject({ status: 'idle', position: { x: 3, y: 4 } })
    expect(rider.trip).toBeUndefined()
    expect(rider.orderId).toBeUndefined()
  })

  test('avanzar de golpe da el mismo resultado que de a poco', () => {
    const { rider, order } = run(20, 20)
    expect(order.deliveredAtSec).toBeCloseTo(START + 12)
    expect(rider.position).toEqual({ x: 3, y: 4 })
  })

  test('nunca va en diagonal: siempre está sobre una calle', () => {
    for (let seconds = 0.25; seconds <= 12; seconds += 0.25) {
      const position = riderDisplayPosition(run(seconds).rider)
      const onStreet = Number.isInteger(+position.x.toFixed(9)) || Number.isInteger(+position.y.toFixed(9))
      expect(onStreet, `${seconds} s: ${position.x}, ${position.y}`).toBe(true)
    }
  })

  test('si ya está en el restaurante, empieza directo por la cocina', () => {
    const { rider } = run(1, 0.1, dispatched({ x: 3, y: 0 }))
    expect(rider.status).toBe('atKitchen')
    expect(rider.trip?.kitchenLeftSec).toBeCloseTo(4)
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
    const route = remainingRoute(map, rider, order)
    expect(route[0]).toEqual({ x: 1.5, y: 0 })
    expect(route.at(-1)).toEqual({ x: 3, y: 4 })
  })

  test('mientras lleva la comida, solo lo que falta hasta el cliente', () => {
    const { rider, order } = run(10)
    const route = remainingRoute(map, rider, order)
    expect(route[0].y).toBeCloseTo(2)
    expect(route.at(-1)).toEqual({ x: 3, y: 4 })
    expect(route).not.toContainEqual({ x: 0, y: 0 })
  })
})
