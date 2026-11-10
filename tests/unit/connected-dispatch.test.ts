import { beforeEach, describe, expect, test } from 'vitest'
import type { Order, Urgency } from '../../src/game/orders'
import { buildMarkers, previewGeoJson } from '../../src/map/mapData'
import { useShiftStore, waitingQueue } from '../../src/store/shiftStore'
import { nodeAt, smallCity } from './smallCity'

const map = smallCity([nodeAt(3, 0), nodeAt(0, 4)])
const order = (id: string, number: number, deadlineAtSec: number, status: Order['status'] = 'pending'): Order => ({
  id,
  number,
  restaurantId: 'r1',
  customer: nodeAt(3, 4),
  createdAtSec: 0,
  readyAtSec: 20,
  deadlineAtSec,
  status,
})

describe('el mapa sigue a la cola', () => {
  const orders = [order('o1', 1, 200), order('o2', 2, 30), order('o3', 3, 5)]
  const urgency = (candidate: Order): Urgency => (candidate.deadlineAtSec < 10 ? 'late' : candidate.deadlineAtSec < 60 ? 'urgent' : 'normal')

  test('cada cliente lleva la urgencia de su pedido', () => {
    const customers = buildMarkers(map, orders, [], { orderIds: [], riderId: null }, urgency).filter((marker) => marker.kind === 'customer')
    expect(customers.map((marker) => [marker.id, marker.urgency])).toEqual([
      ['o1', 'normal'],
      ['o2', 'urgent'],
      ['o3', 'late'],
    ])
  })

  test('el pedido bajo el mouse ilumina su restaurante y su cliente', () => {
    const markers = buildMarkers(map, orders, [], { orderIds: [], riderId: null, hoveredOrderId: 'o2' }, urgency)
    const lit = markers.filter((marker) => marker.highlighted).map((marker) => marker.key)
    expect(lit).toEqual(['restaurant:r1', 'customer:o2'])
  })

  test('la vista previa del pedido bajo el mouse es solo el viaje al cliente, sin los repartidores', () => {
    const riders = [{ id: 'k1', number: 1, vehicle: 'bike', node: nodeAt(0, 0), status: 'idle' as const }]
    const lines = previewGeoJson(map, riders, [orders[0]], false).features
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((line) => line.properties?.leg === 'planned')).toBe(true)
  })
})

describe('despacho con teclado y arrastrando', () => {
  beforeEach(() => {
    useShiftStore.getState().startLevel(null)
    const orders = [order('o1', 1, 200), order('o2', 2, 100), order('o3', 3, 150)]
    useShiftStore.setState({ orderQueue: { orders, nextSpawnAtSec: 999 } })
  })

  test('las flechas recorren la cola del más urgente al menos urgente, y dan la vuelta', () => {
    const { selectNextOrder } = useShiftStore.getState()
    expect(waitingQueue(useShiftStore.getState().orderQueue.orders).map((candidate) => candidate.id)).toEqual(['o2', 'o3', 'o1'])
    selectNextOrder(1)
    expect(useShiftStore.getState().selectedOrderId).toBe('o2')
    selectNextOrder(1)
    expect(useShiftStore.getState().selectedOrderId).toBe('o3')
    selectNextOrder(-1)
    selectNextOrder(-1)
    expect(useShiftStore.getState().selectedOrderId).toBe('o1')
  })

  test('soltar un repartidor sobre un pedido se lo da, como elegir los dos a mano', () => {
    useShiftStore.getState().dispatchByDrop('o3', 1)
    const state = useShiftStore.getState()
    expect(state.orderQueue.orders.find((candidate) => candidate.id === 'o3')).toMatchObject({ status: 'assigned', riderId: 'k1' })
    expect(state.riders.find((rider) => rider.number === 1)?.status).not.toBe('idle')
    expect(state.selectedOrderId).toBeNull()
  })
})
