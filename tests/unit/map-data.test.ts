import { describe, expect, test } from 'vitest'
import { assignOrder } from '../../src/game/dispatch'
import { startTrip } from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'
import { areaBounds, buildMarkers, routesGeoJson } from '../../src/map/mapData'
import { latticeOf, nodeAt, smallCity, smallStreets } from './smallCity'

const map = smallCity([nodeAt(3, 0), nodeAt(0, 4)])
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
    const markers = buildMarkers(map, orders, riders, null)
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
    const [restaurantA, , customer] = buildMarkers(map, orders, riders, null)
    expect(latticeOf(restaurantA.lngLat)).toEqual({ x: expect.closeTo(3), y: expect.closeTo(0) })
    expect(latticeOf(customer.lngLat)).toEqual({ x: expect.closeTo(3), y: expect.closeTo(4) })
  })

  test('el pedido elegido marca su restaurante y su cliente', () => {
    const markers = buildMarkers(map, orders, riders, 'o1')
    expect(markers.filter((marker) => marker.selected).map((marker) => marker.key)).toEqual([
      'restaurant:r1',
      'customer:o1',
    ])
  })
})

describe('rutas en el mapa', () => {
  test('una línea por viaje en curso, de donde está el repartidor al cliente', () => {
    const result = assignOrder([order('o1', 1, nodeAt(3, 4))], [rider(1, nodeAt(0, 0))], 'o1', 'k1')
    if (!result.ok) throw new Error(result.error)
    const busy = startTrip(map, result.riders[0], result.orders[0])
    const routes = routesGeoJson(map, [busy, rider(2, nodeAt(2, 2))])
    expect(routes.features).toHaveLength(1)
    const coordinates = routes.features[0].geometry.coordinates
    expect(latticeOf(coordinates[0] as [number, number])).toEqual({ x: expect.closeTo(0), y: expect.closeTo(0) })
    expect(latticeOf(coordinates.at(-1) as [number, number])).toEqual({ x: expect.closeTo(3), y: expect.closeTo(4) })
    expect(routes.features[0].properties).toEqual({ rider: 1, leg: 'toRestaurant' })
  })

  test('sin viajes no hay líneas', () => {
    expect(routesGeoJson(map, [rider(1, 0)]).features).toEqual([])
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
