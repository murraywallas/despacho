import { beforeEach, describe, expect, test } from 'vitest'
import { createLevelShift, balanceFor } from '../../src/game/levels'
import { advanceFleet, startTrip } from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'
import { shiftSettingsFrom } from '../../src/game/shift'
import { freeAtSec, stopEtas } from '../../src/game/stops'
import { useShiftStore } from '../../src/store/shiftStore'

const settings = shiftSettingsFrom(balanceFor('lunch'))
const speeds = settings.movement.metersPerSec
const STEP_SEC = 0.25

function lunchTrip() {
  const { shift } = createLevelShift('lunch')
  const restaurant = shift.map.restaurants[0]
  const rider = shift.riders[0]
  const customer = shift.map.addresses.find((node) => node !== restaurant.node && node !== rider.node)!
  const order: Order = {
    id: 'o1',
    number: 1,
    restaurantId: restaurant.id,
    customer,
    createdAtSec: 0,
    readyAtSec: 30,
    deadlineAtSec: 9999,
    status: 'assigned',
    riderId: rider.id,
  }
  const going = startTrip(shift.map, { ...rider, status: 'toRestaurant', orderIds: ['o1'] }, [order])
  return { shift, order, going }
}

describe('cuándo queda libre un repartidor ocupado', () => {
  test('libre ya, si está libre', () => {
    const { shift } = lunchTrip()
    expect(freeAtSec(shift.map, shift.riders[0], [], speeds, 12)).toBe(12)
  })

  test('después de su última parada, con la cocina incluida', () => {
    const { shift, order, going } = lunchTrip()
    const at = freeAtSec(shift.map, going, [order], speeds, 0)!
    expect(at).toBe(stopEtas(shift.map, going, [order], speeds, 0).at(-1)!.atSec)
    // No puede salir de la cocina antes de que la comida esté lista.
    expect(at).toBeGreaterThan(order.readyAtSec)
  })

  test('la estimación coincide con el momento real en que queda libre', () => {
    const { shift, order, going } = lunchTrip()
    const estimate = freeAtSec(shift.map, going, [order], speeds, 0)!
    let riders: readonly Rider[] = [going]
    let orders: readonly Order[] = [order]
    let now = 0
    while (riders[0].status !== 'idle' && now < 3600) {
      ;({ riders, orders } = advanceFleet(shift.map, riders, orders, STEP_SEC, now, settings.movement))
      now += STEP_SEC
    }
    expect(Math.abs(now - estimate)).toBeLessThanOrEqual(STEP_SEC)
  })

  test('recargando: lo que falta de la recarga; volviendo a la base: el viaje más la recarga', () => {
    const { shift } = lunchTrip()
    const rider = shift.riders[0]
    expect(freeAtSec(shift.map, { ...rider, status: 'charging', chargeLeftSec: 20 }, [], speeds, 100)).toBe(120)
    const back: Rider = { ...rider, status: 'toBase', trip: { path: [0, 1], pathMeters: [0, 300], traveledM: 100, kitchenLeftSec: 0 } }
    expect(freeAtSec(shift.map, back, [], speeds, 100, 60)).toBeCloseTo(100 + 200 / speeds[rider.vehicle] + 60)
  })
})

describe('asignar a un repartidor ocupado o lleno', () => {
  beforeEach(() => useShiftStore.getState().startLevel('lunch'))

  /** Puts two pending orders in the shift and sends rider 1 with the first. */
  function busyRiderOne() {
    const store = useShiftStore.getState()
    const restaurant = store.map.restaurants[0]
    const make = (id: string, number: number): Order => ({
      id,
      number,
      restaurantId: restaurant.id,
      customer: store.map.addresses[number],
      createdAtSec: 0,
      readyAtSec: 0,
      deadlineAtSec: 9999,
      status: 'pending',
    })
    useShiftStore.setState({ orderQueue: { ...store.orderQueue, orders: [make('o1', 1), make('o2', 2)] } })
    useShiftStore.getState().selectOrder('o1')
    useShiftStore.getState().pickRider(1)
    expect(useShiftStore.getState().riders[0].status).not.toBe('idle')
  }

  test('a uno ocupado: avisa por qué y no cambia nada del turno', () => {
    busyRiderOne()
    useShiftStore.getState().selectOrder('o2')
    const before = useShiftStore.getState()
    useShiftStore.getState().pickRider(1)
    const after = useShiftStore.getState()
    expect(after.refusal).toMatchObject({ riderId: before.riders[0].id, reason: 'busy' })
    expect(after.orderQueue).toBe(before.orderQueue)
    expect(after.riders).toBe(before.riders)
    expect(after.selectedOrderId).toBe('o2')
    // Otro intento: otro aviso (para que se vuelva a ver el sacudón).
    useShiftStore.getState().pickRider(1)
    expect(useShiftStore.getState().refusal!.seq).toBe(after.refusal!.seq + 1)
    // Elegir otro pedido borra el aviso.
    useShiftStore.getState().selectOrder('o2')
    expect(useShiftStore.getState().refusal).toBeNull()
  })

  test('a uno que no le entran tantos pedidos: avisa que va lleno', () => {
    const store = useShiftStore.getState()
    const restaurant = store.map.restaurants[0]
    const orders = [1, 2, 3].map(
      (number): Order => ({
        id: `o${number}`,
        number,
        restaurantId: restaurant.id,
        customer: store.map.addresses[number],
        createdAtSec: 0,
        readyAtSec: 0,
        deadlineAtSec: 9999,
        status: 'pending',
      }),
    )
    useShiftStore.setState({ orderQueue: { ...store.orderQueue, orders } })
    useShiftStore.getState().selectOrder('o1')
    useShiftStore.getState().selectOrder('o2', true)
    // Rider 2 is the skateboard: it carries one.
    const skateboard = store.riders.find((rider) => rider.vehicle === 'skateboard')!
    useShiftStore.getState().pickRider(skateboard.number)
    expect(useShiftStore.getState().refusal).toMatchObject({ riderId: skateboard.id, reason: 'full' })
    expect(useShiftStore.getState().orderQueue.orders.every((order) => order.status === 'pending')).toBe(true)
  })
})
