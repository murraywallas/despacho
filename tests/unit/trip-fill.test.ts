import { describe, expect, test } from 'vitest'
import type { Order } from '../../src/game/orders'
import { fullTrip } from '../../src/game/tripFill'

const order = (id: string, restaurantId: string, deadlineAtSec: number, status: Order['status'] = 'pending'): Order => ({
  id,
  number: Number(id.slice(1)),
  restaurantId,
  customer: 0,
  createdAtSec: 0,
  readyAtSec: 10,
  deadlineAtSec,
  status,
})
// Three waiting at A (#2 the most urgent), one at B, one at A already on its way.
const orders = [order('o1', 'r1', 200), order('o2', 'r1', 120), order('o3', 'r1', 300), order('o4', 'r2', 100), order('o5', 'r1', 50, 'assigned')]

describe('el repartidor se lleva todos los pedidos del restaurante', () => {
  test('al elegido le suma los demás que esperan ahí, el más urgente primero, hasta llenar el vehículo', () => {
    expect(fullTrip(orders, ['o1'], [], 5)).toEqual(['o1', 'o2', 'o3'])
    expect(fullTrip(orders, ['o1'], [], 2)).toEqual(['o1', 'o2'])
    expect(fullTrip(orders, ['o3'], [], 2)).toEqual(['o3', 'o2'])
  })

  test('un vehículo de a uno sale solo con el elegido', () => {
    expect(fullTrip(orders, ['o3'], [], 1)).toEqual(['o3'])
  })

  test('los que el jugador saca con Shift se quedan esperando', () => {
    expect(fullTrip(orders, ['o1'], ['o2'], 5)).toEqual(['o1', 'o3'])
  })

  test('no se suman los de otro restaurante ni los que ya tienen repartidor', () => {
    expect(fullTrip(orders, ['o4'], [], 5)).toEqual(['o4'])
    expect(fullTrip(orders, ['o1'], [], 5)).not.toContain('o5')
  })

  test('los elegidos a mano van primero; si son más de los que entran, quedan tal cual (el vehículo no puede)', () => {
    expect(fullTrip(orders, ['o1', 'o4'], [], 3)).toEqual(['o1', 'o4', 'o2'])
    expect(fullTrip(orders, ['o1', 'o4'], [], 1)).toEqual(['o1', 'o4'])
    expect(fullTrip(orders, [], [], 3)).toEqual([])
  })
})
