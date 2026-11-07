import { beforeEach, describe, expect, test } from 'vitest'
import { clock as clockBalance, prototype } from '../../src/game/balance'
import { createClock } from '../../src/game/clock'
import { createOrderQueue } from '../../src/game/orders'
import { orderSettings, useShiftStore } from '../../src/store/shiftStore'

const interval = prototype.orders.spawnIntervalSec
const orderCount = () => useShiftStore.getState().orderQueue.orders.length

describe('pedidos durante el turno', () => {
  beforeEach(() => {
    useShiftStore.setState({
      clock: createClock(prototype.shift.durationSec),
      orderQueue: createOrderQueue(orderSettings),
    })
  })

  test('aparecen a medida que avanza el reloj', () => {
    const { tick } = useShiftStore.getState()
    tick(interval - 0.1)
    expect(orderCount()).toBe(0)
    tick(0.1)
    expect(orderCount()).toBe(1)
  })

  test('en pausa no aparecen pedidos', () => {
    const { tick, togglePause } = useShiftStore.getState()
    togglePause()
    tick(interval * 3)
    expect(orderCount()).toBe(0)
  })

  test('en 2x aparecen el doble de rápido', () => {
    const { tick, toggleSpeed } = useShiftStore.getState()
    toggleSpeed()
    tick(interval / clockBalance.fastSpeed)
    expect(orderCount()).toBe(1)
  })
})
