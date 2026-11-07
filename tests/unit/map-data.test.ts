import { describe, expect, test } from 'vitest'
import { assignOrder } from '../../src/game/dispatch'
import { startTrip } from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'
import { areaBounds, buildMarkers, previewGeoJson, routesGeoJson, waitingAt, type MapSelection } from '../../src/map/mapData'
import { latticeOf, nodeAt, smallCity, smallStreets } from './smallCity'

const map = smallCity([nodeAt(3, 0), nodeAt(0, 4)])
const NONE: MapSelection = { orderId: null, riderId: null }
const normal = () => 'normal' as const
const order = (id: string, number: number, customer: number, status: Order['status'] = 'pending'): Order => ({
  id,
  number,
  restaurantId: 'r1',
  customer,
  createdAtSec: 0,
  readyAtSec: 20,
  deadlineAtSec: 75,
  status,
})
const rider = (number: number, node: number): Rider => ({ id: `k${number}`, number, vehicle: 'bike', node, status: 'idle' })

describe('marcadores del mapa', () => {
  const orders = [order('o1', 1, nodeAt(3, 4)), order('o2', 2, nodeAt(1, 1), 'delivered'), order('o3', 3, nodeAt(4, 4), 'cancelled')]
  const riders = [rider(1, nodeAt(0, 0)), rider(2, nodeAt(2, 2))]

  test('restaurantes, clientes esperando y repartidores, cada uno con su etiqueta', () => {
    const markers = buildMarkers(map, orders, riders, NONE, normal)
    expect(markers.map((marker) => [marker.kind, marker.label])).toEqual([
      ['restaurant', 'A'],
      ['restaurant', 'B'],
      ['customer', '1'],
      ['rider', '1'],
      ['rider', '2'],
    ])
    expect(new Set(markers.map((marker) => marker.key)).size).toBe(markers.length)
  })

  test('cada marcador está donde corresponde', () => {
    const [restaurantA, , customer] = buildMarkers(map, orders, riders, NONE, normal)
    expect(latticeOf(restaurantA.lngLat)).toEqual({ x: expect.closeTo(3), y: expect.closeTo(0) })
    expect(latticeOf(customer.lngLat)).toEqual({ x: expect.closeTo(3), y: expect.closeTo(4) })
  })

  test('el pedido elegido marca su restaurante y su cliente', () => {
    const markers = buildMarkers(map, orders, riders, { orderId: 'o1', riderId: null }, normal)
    expect(markers.filter((marker) => marker.selected).map((marker) => marker.key)).toEqual([
      'restaurant:r1',
      'customer:o1',
    ])
  })

  test('el repartidor elegido queda marcado', () => {
    const markers = buildMarkers(map, orders, riders, { orderId: null, riderId: 'k2' }, normal)
    expect(markers.filter((marker) => marker.selected).map((marker) => marker.key)).toEqual(['rider:k2'])
  })

  test('cada restaurante lleva sus pedidos esperando y el más urgente marca el color', () => {
    const waiting = [order('o1', 1, nodeAt(3, 4)), order('o4', 4, nodeAt(4, 3)), order('o5', 5, nodeAt(2, 4), 'assigned')]
    const urgencies: Record<string, 'normal' | 'urgent' | 'late'> = { o1: 'normal', o4: 'urgent' }
    const [restaurantA, restaurantB] = buildMarkers(map, waiting, riders, NONE, (o) => urgencies[o.id] ?? 'normal')
    expect(restaurantA.waiting).toEqual({ count: 2, urgency: 'urgent' })
    expect(restaurantB.waiting).toBeUndefined()
  })
})

describe('pedidos esperando en un restaurante', () => {
  test('solo los que esperan repartidor, el de plazo más cercano primero', () => {
    const later = { ...order('o1', 1, nodeAt(3, 4)), deadlineAtSec: 90 }
    const sooner = { ...order('o2', 2, nodeAt(4, 4)), deadlineAtSec: 60 }
    const taken = order('o3', 3, nodeAt(1, 4), 'assigned')
    const other = { ...order('o4', 4, nodeAt(1, 1)), restaurantId: 'r2' }
    expect(waitingAt([later, sooner, taken, other], 'r1').map((o) => o.id)).toEqual(['o2', 'o1'])
  })
})

describe('rutas en el mapa', () => {
  function dispatchedRider() {
    const result = assignOrder([order('o1', 1, nodeAt(3, 4))], [rider(1, nodeAt(0, 0))], 'o1', 'k1')
    if (!result.ok) throw new Error(result.error)
    return startTrip(map, result.riders[0], result.orders[0])
  }
  const ends = (coordinates: number[][]) => [latticeOf(coordinates[0] as [number, number]), latticeOf(coordinates.at(-1) as [number, number])]
  const near = (x: number, y: number) => ({ x: expect.closeTo(x), y: expect.closeTo(y) })

  test('yendo al restaurante: un tramo hasta el restaurante y el siguiente, planeado, hasta el cliente', () => {
    const routes = routesGeoJson(map, [dispatchedRider(), rider(2, nodeAt(2, 2))])
    expect(routes.features.map((feature) => feature.properties)).toEqual([
      { leg: 'toRestaurant', rider: 1 },
      { leg: 'planned', rider: 1 },
    ])
    expect(ends(routes.features[0].geometry.coordinates)).toEqual([near(0, 0), near(3, 0)])
    expect(ends(routes.features[1].geometry.coordinates)).toEqual([near(3, 0), near(3, 4)])
  })

  test('esperando la cocina, el tramo al cliente sigue planeado; con la comida, es el viaje al cliente', () => {
    const atKitchen: Rider = { ...dispatchedRider(), status: 'atKitchen' }
    const kitchen = atKitchen.trip
    if (!kitchen) throw new Error('sin viaje')
    expect(routesGeoJson(map, [{ ...atKitchen, trip: { ...kitchen, path: [nodeAt(3, 0)], pathMeters: [0] } }]).features.map((f) => f.properties?.leg)).toEqual(['planned'])
    const carrying: Rider = { ...atKitchen, status: 'toCustomer', trip: { ...kitchen, path: kitchen.toCustomer, pathMeters: [0, 100, 200, 300, 400], traveledM: 150 } }
    const routes = routesGeoJson(map, [carrying])
    expect(routes.features.map((feature) => feature.properties?.leg)).toEqual(['toCustomer'])
    // Arranca en el último cruce que pasó: (3, 1).
    expect(ends(routes.features[0].geometry.coordinates)).toEqual([near(3, 1), near(3, 4)])
  })

  test('sin viajes no hay líneas', () => {
    expect(routesGeoJson(map, [rider(1, 0)]).features).toEqual([])
  })

  test('el pedido elegido muestra cómo llegaría cada repartidor libre, y el tramo al cliente', () => {
    const pending = order('o1', 1, nodeAt(3, 4))
    const preview = previewGeoJson(map, [rider(1, nodeAt(0, 0)), { ...rider(2, nodeAt(4, 4)), status: 'toCustomer' }, rider(3, nodeAt(3, 2))], pending)
    expect(preview.features.map((feature) => feature.properties)).toEqual([
      { leg: 'preview', rider: 1 },
      { leg: 'preview', rider: 3 },
      { leg: 'planned' },
    ])
    expect(ends(preview.features[0].geometry.coordinates)).toEqual([near(0, 0), near(3, 0)])
  })

  test('sin pedido elegido, o si ya tiene repartidor, no hay vista previa', () => {
    expect(previewGeoJson(map, [rider(1, 0)], undefined).features).toEqual([])
    expect(previewGeoJson(map, [rider(1, 0)], order('o1', 1, nodeAt(3, 4), 'assigned')).features).toEqual([])
  })
})

describe('límites del barrio', () => {
  test('la caja del área, agrandada por el margen', () => {
    const streets = smallStreets()
    const [south, west, north, east] = streets.bbox
    expect(areaBounds(streets)).toEqual([
      [west, south],
      [east, north],
    ])
    const [[w, s], [e, n]] = areaBounds(streets, 0.5)
    expect(e - w).toBeCloseTo((east - west) * 2)
    expect(n - s).toBeCloseTo((north - south) * 2)
  })
})
