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

describe('despacho en el estado del turno', () => {
  beforeEach(() => {
    const initial = useShiftStore.getInitialState()
    useShiftStore.setState({
      clock: createClock(prototype.shift.durationSec),
      orderQueue: createOrderQueue(orderSettings),
      riders: initial.riders,
      selectedOrderId: null,
    })
    useShiftStore.getState().tick(interval * 2)
  })

  const firstOrder = () => useShiftStore.getState().orderQueue.orders[0]

  test('elegir un pedido y después un repartidor lo asigna y limpia la selección', () => {
    const { selectOrder, assignSelectedTo } = useShiftStore.getState()
    selectOrder(firstOrder().id)
    expect(useShiftStore.getState().selectedOrderId).toBe(firstOrder().id)
    assignSelectedTo(2)
    const state = useShiftStore.getState()
    expect(firstOrder()).toMatchObject({ status: 'assigned', riderId: 'k2' })
    expect(state.riders[1]).toMatchObject({ status: 'toRestaurant', orderId: firstOrder().id })
    expect(state.selectedOrderId).toBeNull()
  })

  test('sin pedido elegido, una tecla de repartidor no hace nada', () => {
    useShiftStore.getState().assignSelectedTo(1)
    expect(useShiftStore.getState().riders.every((rider) => rider.status === 'idle')).toBe(true)
  })

  test('un repartidor ocupado no recibe otro pedido y la selección se mantiene', () => {
    const { selectOrder, assignSelectedTo } = useShiftStore.getState()
    selectOrder(firstOrder().id)
    assignSelectedTo(1)
    const second = useShiftStore.getState().orderQueue.orders[1]
    selectOrder(second.id)
    assignSelectedTo(1)
    expect(useShiftStore.getState().orderQueue.orders[1].status).toBe('pending')
    expect(useShiftStore.getState().selectedOrderId).toBe(second.id)
  })

  test('un pedido ya asignado no se puede volver a elegir', () => {
    const { selectOrder, assignSelectedTo } = useShiftStore.getState()
    selectOrder(firstOrder().id)
    assignSelectedTo(1)
    selectOrder(firstOrder().id)
    expect(useShiftStore.getState().selectedOrderId).toBeNull()
  })

  test('volver a tocar el pedido elegido lo deselecciona', () => {
    const { selectOrder } = useShiftStore.getState()
    selectOrder(firstOrder().id)
    selectOrder(firstOrder().id)
    expect(useShiftStore.getState().selectedOrderId).toBeNull()
  })
})

describe('viaje durante el turno', () => {
  beforeEach(() => {
    const initial = useShiftStore.getInitialState()
    useShiftStore.setState({
      clock: createClock(prototype.shift.durationSec),
      orderQueue: createOrderQueue(orderSettings),
      riders: initial.riders,
      selectedOrderId: null,
    })
    const { tick, selectOrder, assignSelectedTo } = useShiftStore.getState()
    tick(interval)
    selectOrder(useShiftStore.getState().orderQueue.orders[0].id)
    assignSelectedTo(1)
  })

  const riderOne = () => useShiftStore.getState().riders[0]

  test('el repartidor asignado se mueve con el reloj', () => {
    const before = riderOne()
    useShiftStore.getState().tick(0.5)
    expect(riderOne().trip?.traveledBlocks).toBeGreaterThan(before.trip?.traveledBlocks ?? 0)
  })

  test('en pausa no se mueve', () => {
    const { tick, togglePause } = useShiftStore.getState()
    togglePause()
    const before = riderOne()
    tick(2)
    expect(riderOne()).toBe(before)
  })

  test('en 2x recorre el doble', () => {
    const { tick, toggleSpeed } = useShiftStore.getState()
    const before = riderOne().trip?.traveledBlocks ?? 0
    toggleSpeed()
    tick(0.25)
    const blocks = (riderOne().trip?.traveledBlocks ?? 0) - before
    expect(blocks).toBeCloseTo(0.25 * clockBalance.fastSpeed * prototype.riders.speedBlocksPerSec)
  })

  test('termina entregando y queda libre', () => {
    const { tick } = useShiftStore.getState()
    for (let i = 0; i < 400 && riderOne().status !== 'idle'; i++) tick(0.25)
    expect(riderOne().status).toBe('idle')
    expect(useShiftStore.getState().orderQueue.orders[0].status).toBe('delivered')
  })
})

describe('cancelación durante el turno', () => {
  const cancelAt = interval + prototype.orders.deadlineSec + prototype.orders.cancelAfterSec

  beforeEach(() => {
    const initial = useShiftStore.getInitialState()
    useShiftStore.setState({
      clock: createClock(prototype.shift.durationSec),
      orderQueue: createOrderQueue(orderSettings),
      riders: initial.riders,
      selectedOrderId: null,
    })
  })

  const firstOrder = () => useShiftStore.getState().orderQueue.orders[0]

  test('un pedido que nadie atiende se cancela al pasar plazo + margen', () => {
    const { tick } = useShiftStore.getState()
    tick(cancelAt - 0.1)
    expect(firstOrder().status).toBe('pending')
    tick(0.1)
    expect(firstOrder().status).toBe('cancelled')
  })

  test('si estaba elegido, la selección se limpia', () => {
    const { tick, selectOrder } = useShiftStore.getState()
    tick(interval)
    selectOrder(firstOrder().id)
    tick(cancelAt - interval)
    expect(firstOrder().status).toBe('cancelled')
    expect(useShiftStore.getState().selectedOrderId).not.toBe(firstOrder().id)
  })
})

describe('jugar otra vez', () => {
  test('reinicia reloj, pedidos, repartidores y estrellas', () => {
    const { restartShift } = useShiftStore.getState()
    restartShift()
    const fresh = useShiftStore.getState()

    const { tick, selectOrder, assignSelectedTo, toggleSpeed } = fresh
    tick(interval)
    selectOrder(useShiftStore.getState().orderQueue.orders[0].id)
    assignSelectedTo(1)
    toggleSpeed()
    for (let i = 0; i < 2000 && !useShiftStore.getState().clock.finished; i++) tick(0.25)
    const ended = useShiftStore.getState()
    expect(ended.clock.finished).toBe(true)
    expect(ended.orderQueue.orders.some((order) => order.status === 'delivered')).toBe(true)

    useShiftStore.getState().restartShift()
    const again = useShiftStore.getState()
    expect(again.clock).toEqual(createClock(prototype.shift.durationSec))
    expect(again.orderQueue).toEqual(createOrderQueue(orderSettings))
    expect(again.riders).toEqual(fresh.riders)
    expect(again.map).toEqual(fresh.map)
    expect(again.selectedOrderId).toBeNull()
  })

  test('mismo turno otra vez: los pedidos llegan igual que la primera vez', () => {
    const { restartShift } = useShiftStore.getState()
    restartShift()
    useShiftStore.getState().tick(interval * 3)
    const first = useShiftStore.getState().orderQueue.orders
    restartShift()
    useShiftStore.getState().tick(interval * 3)
    expect(useShiftStore.getState().orderQueue.orders).toEqual(first)
  })
})
