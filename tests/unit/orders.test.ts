import { describe, expect, test } from 'vitest'
import { prototype } from '../../src/game/balance'
import { createCityMap, type CityMap } from '../../src/game/cityMap'
import { samePoint } from '../../src/game/grid'
import {
  createOrderQueue,
  spawnOrders,
  timeLeftSec,
  urgencyOf,
  type Order,
  type OrderSettings,
} from '../../src/game/orders'
import { createRandom } from '../../src/game/random'

const settings: OrderSettings = {
  spawnIntervalSec: prototype.orders.spawnIntervalSec,
  deadlineSec: prototype.orders.deadlineSec,
  cookSec: prototype.kitchen.cookSec,
  lastSpawnBeforeSec: prototype.shift.durationSec,
}

function setup(seed = prototype.seed): { map: CityMap; run: (nowSec: number) => readonly Order[] } {
  const random = createRandom(seed)
  const map = createCityMap(prototype.grid.size, prototype.grid.restaurants, random)
  let queue = createOrderQueue(settings)
  return {
    map,
    run: (nowSec) => {
      queue = spawnOrders(queue, nowSec, map, random, settings)
      return queue.orders
    },
  }
}

describe('pedidos', () => {
  test('con el reloj en 60 s hay uno por cada intervalo (6 con un pedido cada 10 s)', () => {
    expect(setup().run(60)).toHaveLength(Math.floor(60 / settings.spawnIntervalSec))
  })

  test('aparece uno cada intervalo de balance.json', () => {
    const { run } = setup()
    expect(run(settings.spawnIntervalSec - 0.1)).toHaveLength(0)
    expect(run(settings.spawnIntervalSec)).toHaveLength(1)
    expect(run(settings.spawnIntervalSec * 2 - 0.1)).toHaveLength(1)
  })

  test('avanzar de a poco o de golpe da los mismos pedidos', () => {
    const stepByStep = setup()
    for (let now = 0; now <= 60; now += 0.5) stepByStep.run(now)
    expect(stepByStep.run(60)).toEqual(setup().run(60))
  })

  test('cada pedido tiene plazo, restaurante del mapa y cliente en otra esquina', () => {
    const { map, run } = setup()
    for (const order of run(120)) {
      expect(order.deadlineAtSec - order.createdAtSec).toBe(settings.deadlineSec)
      const restaurant = map.restaurants.find((r) => r.id === order.restaurantId)
      expect(restaurant).toBeDefined()
      expect(samePoint(order.customer, restaurant!.position)).toBe(false)
      expect(order.customer.x).toBeLessThan(map.grid.size)
      expect(order.customer.y).toBeLessThan(map.grid.size)
      expect(order.status).toBe('pending')
    }
  })

  test('la misma semilla da los mismos pedidos, otra semilla no', () => {
    expect(setup(5).run(100)).toEqual(setup(5).run(100))
    expect(setup(6).run(100)).not.toEqual(setup(5).run(100))
  })

  test('no aparecen pedidos al terminar el turno', () => {
    const orders = setup().run(prototype.shift.durationSec + 60)
    const last = orders.at(-1)!
    expect(last.createdAtSec).toBeLessThan(prototype.shift.durationSec)
    expect(orders).toHaveLength(Math.ceil(prototype.shift.durationSec / settings.spawnIntervalSec) - 1)
  })
})

describe('urgencia', () => {
  const order = setup().run(10)[0]
  const urgentBelow = prototype.orders.urgentBelowSec

  test('el tiempo restante baja con el reloj y puede quedar negativo', () => {
    expect(timeLeftSec(order, order.createdAtSec)).toBe(settings.deadlineSec)
    expect(timeLeftSec(order, order.deadlineAtSec + 5)).toBe(-5)
  })

  test('normal, urgente y tarde', () => {
    expect(urgencyOf(order, order.createdAtSec, urgentBelow)).toBe('normal')
    expect(urgencyOf(order, order.deadlineAtSec - urgentBelow + 1, urgentBelow)).toBe('urgent')
    expect(urgencyOf(order, order.deadlineAtSec, urgentBelow)).toBe('late')
  })
})
