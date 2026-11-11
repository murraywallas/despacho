import { describe, expect, test } from 'vitest'
import { prototype } from '../../src/game/balance'
import type { Order } from '../../src/game/orders'
import { deliveryMood, radioBetween, type RadioMoment } from '../../src/game/radio'
import type { Rider } from '../../src/game/riders'

const heat = prototype.heat
const order = (id: string, number: number, extra: Partial<Order> = {}): Order => ({
  id,
  number,
  restaurantId: 'r1',
  customer: 0,
  createdAtSec: 0,
  readyAtSec: 20,
  deadlineAtSec: 150,
  status: 'pending',
  ...extra,
})
const riders: Rider[] = [
  { id: 'k1', number: 1, vehicle: 'bike', node: 0, status: 'toCustomer' },
  { id: 'k2', number: 2, vehicle: 'bike', node: 0, status: 'toCustomer' },
]
const at = (nowSec: number, orders: Order[]): RadioMoment => ({ orders, riders, nowSec })

describe('la radio del turno', () => {
  test('un pedido nuevo dice su número y su restaurante; varios juntos, una sola línea', () => {
    expect(radioBetween(at(0, []), at(1, [order('o1', 1)]), heat)).toEqual([
      { kind: 'newOrder', orderNumbers: [1], restaurantId: 'r1', atSec: 1 },
    ])
    const many = radioBetween(at(0, []), at(1, [order('o1', 1), order('o2', 2, { restaurantId: 'r2' })]), heat)
    expect(many).toEqual([{ kind: 'newOrder', orderNumbers: [1, 2], atSec: 1 }])
  })

  test('al salir del restaurante dice qué repartidor lleva qué pedidos, una línea por repartidor', () => {
    const before = [order('o1', 1, { status: 'assigned', riderId: 'k1' }), order('o2', 2, { status: 'assigned', riderId: 'k2' })]
    const after = before.map((candidate) => ({ ...candidate, status: 'pickedUp' as const }))
    expect(radioBetween(at(30, before), at(31, after), heat).map((item) => [item.riderNumber, item.orderNumbers])).toEqual([
      [1, [1]],
      [2, [2]],
    ])
  })

  test('una entrega dice si llegó bien, tarde o fría', () => {
    const delivered = (deliveredAtSec: number) =>
      radioBetween(
        at(deliveredAtSec - 1, [order('o1', 1, { status: 'pickedUp' })]),
        at(deliveredAtSec, [order('o1', 1, { status: 'delivered', deliveredAtSec })]),
        heat,
      )[0]
    expect(delivered(60).mood).toBe('good')
    expect(delivered(149 + 1 + 10).mood).toBe('late')
    // Cold: ready at 20, and long enough after to fall below coldBelow, but still on time.
    const coldAt = 20 + (heat.start - heat.coldBelow) / heat.lossPerSec + 1
    expect(deliveryMood(order('o1', 1, { status: 'delivered', deliveredAtSec: coldAt, deadlineAtSec: coldAt + 10 }), heat)).toBe('cold')
  })

  test('avisa una sola vez cuando un pedido pasa a estar tarde, y cuando se cancela', () => {
    const open = [order('o1', 1)]
    expect(radioBetween(at(149, open), at(151, open), heat).map((item) => item.kind)).toEqual(['late'])
    expect(radioBetween(at(151, open), at(152, open), heat)).toEqual([])
    const cancelled = [order('o1', 1, { status: 'cancelled' })]
    expect(radioBetween(at(210, open), at(211, cancelled), heat).map((item) => item.kind)).toEqual(['cancelled'])
  })
})
