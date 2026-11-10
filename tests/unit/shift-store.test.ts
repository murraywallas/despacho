import { beforeEach, describe, expect, test } from 'vitest'
import { clock as clockBalance, prototype } from '../../src/game/balance'
import { createClock } from '../../src/game/clock'
import { speedOf } from '../../src/game/movement'
import { createOrderQueue } from '../../src/game/orders'
import { orderSettings, settings, useShiftStore } from '../../src/store/shiftStore'

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
      selectedRiderId: null,
      callsLeft: prototype.tools.callsPerShift,
    })
    useShiftStore.getState().tick(interval * 2)
  })

  const firstOrder = () => useShiftStore.getState().orderQueue.orders[0]

  test('elegir un pedido y después un repartidor lo asigna y limpia la selección', () => {
    const { selectOrder, pickRider } = useShiftStore.getState()
    selectOrder(firstOrder().id)
    expect(useShiftStore.getState().selectedOrderId).toBe(firstOrder().id)
    pickRider(2)
    const state = useShiftStore.getState()
    expect(firstOrder()).toMatchObject({ status: 'assigned', riderId: 'k2' })
    expect(state.riders[1]).toMatchObject({ status: 'toRestaurant', orderIds: [firstOrder().id] })
    expect(state.selectedOrderId).toBeNull()
  })

  test('sin pedido elegido, elegir un repartidor libre lo deja elegido y no lo manda a ningún lado', () => {
    useShiftStore.getState().pickRider(1)
    const state = useShiftStore.getState()
    expect(state.riders.every((rider) => rider.status === 'idle')).toBe(true)
    expect(state.selectedRiderId).toBe('k1')
  })

  test('repartidor primero y pedido después: el pedido queda asignado y se limpia todo', () => {
    const { pickRider, selectOrder } = useShiftStore.getState()
    pickRider(2)
    selectOrder(firstOrder().id)
    const state = useShiftStore.getState()
    expect(firstOrder()).toMatchObject({ status: 'assigned', riderId: 'k2' })
    expect(state.riders[1]).toMatchObject({ status: 'toRestaurant', orderIds: [firstOrder().id] })
    expect(state.selectedRiderId).toBeNull()
    expect(state.selectedOrderId).toBeNull()
  })

  test('volver a elegir el mismo repartidor lo deselecciona; elegir otro lo cambia', () => {
    const { pickRider } = useShiftStore.getState()
    pickRider(1)
    pickRider(1)
    expect(useShiftStore.getState().selectedRiderId).toBeNull()
    pickRider(1)
    pickRider(3)
    expect(useShiftStore.getState().selectedRiderId).toBe('k3')
  })

  test('un repartidor ocupado no queda elegido', () => {
    const { pickRider, selectOrder } = useShiftStore.getState()
    selectOrder(firstOrder().id)
    pickRider(1)
    pickRider(1)
    expect(useShiftStore.getState().selectedRiderId).toBeNull()
  })

  test('repartidor y después restaurante: va a buscar el pedido más urgente de ese restaurante', () => {
    const { pickRider, sendRiderTo } = useShiftStore.getState()
    const restaurantId = firstOrder().restaurantId
    const mostUrgent = useShiftStore
      .getState()
      .orderQueue.orders.filter((order) => order.restaurantId === restaurantId)
      .sort((a, b) => a.deadlineAtSec - b.deadlineAtSec)[0]
    pickRider(3)
    expect(sendRiderTo(restaurantId)).toBe(true)
    const state = useShiftStore.getState()
    expect(state.orderQueue.orders.find((order) => order.id === mostUrgent.id)).toMatchObject({
      status: 'assigned',
      riderId: 'k3',
    })
    expect(state.riders[2]).toMatchObject({ status: 'toRestaurant', orderIds: [mostUrgent.id] })
    expect(state).toMatchObject({ selectedOrderId: null, selectedRiderId: null })
  })

  test('sin repartidor elegido, o en un restaurante sin pedidos, no pasa nada', () => {
    const { pickRider, sendRiderTo } = useShiftStore.getState()
    const before = useShiftStore.getState().orderQueue
    expect(sendRiderTo(firstOrder().restaurantId)).toBe(false)
    const empty = useShiftStore
      .getState()
      .map.restaurants.find((restaurant) => !before.orders.some((order) => order.restaurantId === restaurant.id))
    pickRider(1)
    if (empty) expect(sendRiderTo(empty.id)).toBe(false)
    expect(useShiftStore.getState().orderQueue).toBe(before)
    expect(useShiftStore.getState().selectedRiderId).toBe('k1')
  })

  test('Esc limpia las dos elecciones', () => {
    const { pickRider, clearSelection, selectOrder } = useShiftStore.getState()
    selectOrder(firstOrder().id)
    clearSelection()
    pickRider(1)
    clearSelection()
    expect(useShiftStore.getState()).toMatchObject({ selectedOrderId: null, selectedRiderId: null })
  })

  test('un repartidor ocupado no recibe otro pedido y la selección se mantiene', () => {
    const { selectOrder, pickRider } = useShiftStore.getState()
    selectOrder(firstOrder().id)
    pickRider(1)
    const second = useShiftStore.getState().orderQueue.orders[1]
    selectOrder(second.id)
    pickRider(1)
    expect(useShiftStore.getState().orderQueue.orders[1].status).toBe('pending')
    expect(useShiftStore.getState().selectedOrderId).toBe(second.id)
  })

  test('un pedido ya asignado se puede elegir otra vez, para reasignarlo a otro repartidor', () => {
    const { selectOrder, pickRider } = useShiftStore.getState()
    selectOrder(firstOrder().id)
    pickRider(1)
    const deadline = firstOrder().deadlineAtSec
    selectOrder(firstOrder().id)
    expect(useShiftStore.getState().selectedOrderId).toBe(firstOrder().id)
    pickRider(3)
    const state = useShiftStore.getState()
    expect(firstOrder()).toMatchObject({
      status: 'assigned',
      riderId: 'k3',
      deadlineAtSec: deadline - prototype.tools.reassignPenaltySec,
    })
    expect(state.riders[0].status).toBe('idle')
    expect(state.riders[2]).toMatchObject({ status: 'toRestaurant', orderIds: [firstOrder().id] })
    expect(state.selectedOrderId).toBeNull()
  })

  test('repartidor libre primero y después un pedido de otro repartidor: también lo reasigna', () => {
    const { selectOrder, pickRider } = useShiftStore.getState()
    selectOrder(firstOrder().id)
    pickRider(1)
    pickRider(2)
    selectOrder(firstOrder().id)
    expect(firstOrder()).toMatchObject({ status: 'assigned', riderId: 'k2' })
  })

  test('una llamada al cliente por turno: extiende el plazo del pedido elegido', () => {
    const { selectOrder, callCustomer } = useShiftStore.getState()
    selectOrder(firstOrder().id)
    const deadline = firstOrder().deadlineAtSec
    expect(callCustomer()).toBe(true)
    expect(firstOrder()).toMatchObject({ deadlineAtSec: deadline + prototype.tools.callExtendSec, called: true })
    expect(useShiftStore.getState().callsLeft).toBe(prototype.tools.callsPerShift - 1)
    for (let i = 1; i < prototype.tools.callsPerShift; i++) callCustomer()
    expect(callCustomer()).toBe(false)
  })

  test('sin pedido elegido no se llama a nadie', () => {
    expect(useShiftStore.getState().callCustomer()).toBe(false)
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
      selectedRiderId: null,
      callsLeft: prototype.tools.callsPerShift,
    })
    const { tick, selectOrder, pickRider } = useShiftStore.getState()
    tick(interval)
    selectOrder(useShiftStore.getState().orderQueue.orders[0].id)
    pickRider(1)
  })

  const riderOne = () => useShiftStore.getState().riders[0]

  test('el repartidor asignado se mueve con el reloj', () => {
    const before = riderOne()
    useShiftStore.getState().tick(0.5)
    expect(riderOne().trip?.traveledM).toBeGreaterThan(before.trip?.traveledM ?? 0)
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
    const before = riderOne().trip?.traveledM ?? 0
    toggleSpeed()
    tick(0.25)
    const meters = (riderOne().trip?.traveledM ?? 0) - before
    expect(meters).toBeCloseTo(0.25 * clockBalance.fastSpeed * speedOf(settings.movement.metersPerSec, riderOne().vehicle))
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
      selectedRiderId: null,
      callsLeft: prototype.tools.callsPerShift,
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

    const { tick, selectOrder, pickRider, toggleSpeed } = fresh
    tick(interval)
    selectOrder(useShiftStore.getState().orderQueue.orders[0].id)
    pickRider(1)
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

describe('cierre de la cocina y del turno', () => {
  beforeEach(() => useShiftStore.getState().restartShift())

  test('no llegan pedidos nuevos cuando la cocina ya cerró', () => {
    const { tick } = useShiftStore.getState()
    const closesAt = prototype.shift.durationSec - prototype.orders.lastOrderBeforeEndSec
    for (let elapsed = 0; elapsed < prototype.shift.durationSec; elapsed += 1) tick(1)
    const last = useShiftStore.getState().orderQueue.orders.at(-1)
    expect(last?.createdAtSec).toBeLessThan(closesAt)
  })

  test('al terminar el turno no queda ningún pedido abierto: lo no entregado cuenta como cancelado', () => {
    const { tick } = useShiftStore.getState()
    for (let elapsed = 0; elapsed < prototype.shift.durationSec; elapsed += 1) tick(1)
    const orders = useShiftStore.getState().orderQueue.orders
    expect(orders.length).toBeGreaterThan(0)
    expect(orders.every((order) => order.status === 'delivered' || order.status === 'cancelled')).toBe(true)
  })
})

describe('varios pedidos por viaje', () => {
  beforeEach(() => useShiftStore.getState().restartShift())

  /** Lets orders come in until some restaurant has two waiting, and returns them. */
  function twoFromOneRestaurant() {
    const { tick } = useShiftStore.getState()
    for (let i = 0; i < 200; i++) {
      tick(1)
      const orders = useShiftStore.getState().orderQueue.orders.filter((order) => order.status === 'pending')
      for (const order of orders) {
        const pair = orders.filter((other) => other.restaurantId === order.restaurantId)
        if (pair.length >= 2) return pair.slice(0, 2)
      }
    }
    throw new Error('Nunca hubo dos pedidos del mismo restaurante.')
  }

  test('Shift + clic suma un pedido del mismo restaurante; otro restaurante no entra', () => {
    const [a, b] = twoFromOneRestaurant()
    const { selectOrder } = useShiftStore.getState()
    selectOrder(a.id)
    selectOrder(b.id, true)
    expect(useShiftStore.getState()).toMatchObject({ selectedOrderId: a.id, addedOrderIds: [b.id] })
    const other = useShiftStore
      .getState()
      .orderQueue.orders.find((order) => order.status === 'pending' && order.restaurantId !== a.restaurantId)
    if (other) {
      selectOrder(other.id, true)
      expect(useShiftStore.getState().addedOrderIds).toEqual([b.id])
    }
    // Volver a sumar el mismo lo saca.
    selectOrder(b.id, true)
    expect(useShiftStore.getState().addedOrderIds).toEqual([])
  })

  test('la bici lleva los dos; la patineta, que lleva uno, no los acepta', () => {
    const [a, b] = twoFromOneRestaurant()
    const { selectOrder, pickRider } = useShiftStore.getState()
    selectOrder(a.id)
    selectOrder(b.id, true)
    pickRider(2) // patineta
    expect(useShiftStore.getState().riders[1].status).toBe('idle')
    pickRider(1) // bici
    expect(useShiftStore.getState().riders[0]).toMatchObject({ status: 'toRestaurant', orderIds: [a.id, b.id] })
    expect(useShiftStore.getState()).toMatchObject({ selectedOrderId: null, addedOrderIds: [] })
  })

  test('repartidor y después Shift + restaurante: lleva tantos como entran en su vehículo', () => {
    const [a] = twoFromOneRestaurant()
    const { pickRider, sendRiderTo } = useShiftStore.getState()
    pickRider(1)
    expect(sendRiderTo(a.restaurantId, true)).toBe(true)
    expect(useShiftStore.getState().riders[0].orderIds).toHaveLength(2)
  })
})
