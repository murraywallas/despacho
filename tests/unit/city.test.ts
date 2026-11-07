import { describe, expect, test } from 'vitest'
import { clock, prototype, vehicles } from '../../src/game/balance'
import { createCityMap, positionOf, randomAddress } from '../../src/game/cityMap'
import { norrebroBikeNetwork, norrebroStreets } from '../../src/game/norrebro'
import { createRandom } from '../../src/game/random'
import { findRoute } from '../../src/game/routing'
import { metersPerSecOf } from '../../src/game/shift'
import { distanceM, STREET_KINDS } from '../../src/game/streetGraph'

const network = norrebroBikeNetwork()
const map = createCityMap(network, prototype.restaurants.count, createRandom(prototype.seed))

describe('Nørrebro como ciudad del turno', () => {
  test('los restaurantes están en cruces distintos de avenidas', () => {
    expect(map.restaurants).toHaveLength(prototype.restaurants.count)
    expect(new Set(map.restaurants.map((restaurant) => restaurant.node)).size).toBe(map.restaurants.length)
    const major = STREET_KINDS.indexOf('major')
    for (const restaurant of map.restaurants) {
      const onMajor = norrebroStreets.edges.some(
        ([a, b, , kind]) => kind === major && (a === restaurant.node || b === restaurant.node),
      )
      expect(onMajor, restaurant.label).toBe(true)
    }
  })

  test('hay miles de direcciones y todas están dentro del área', () => {
    expect(map.addresses.length).toBeGreaterThan(2000)
    const [south, west, north, east] = norrebroStreets.bbox
    for (const node of map.addresses) {
      const [lon, lat] = positionOf(map, node)
      expect(lon).toBeGreaterThanOrEqual(west - 0.01)
      expect(lon).toBeLessThanOrEqual(east + 0.01)
      expect(lat).toBeGreaterThanOrEqual(south - 0.01)
      expect(lat).toBeLessThanOrEqual(north + 0.01)
    }
  })

  test('entre direcciones siempre hay ruta en bici, en los dos sentidos', () => {
    const random = createRandom(7)
    for (let i = 0; i < 30; i++) {
      const a = map.addresses[Math.floor(random() * map.addresses.length)]
      const b = map.addresses[Math.floor(random() * map.addresses.length)]
      expect(findRoute(network, a, b), `${a} → ${b}`).toBeDefined()
      expect(findRoute(network, b, a), `${b} → ${a}`).toBeDefined()
    }
  })

  test('un cliente al azar vive lejos del restaurante, como pide balance.json', () => {
    const random = createRandom(3)
    const restaurant = map.restaurants[0].node
    for (let i = 0; i < 20; i++) {
      const customer = randomAddress(map, random, restaurant, prototype.orders.minCustomerDistanceM)
      expect(distanceM(positionOf(map, customer), positionOf(map, restaurant))).toBeGreaterThanOrEqual(
        prototype.orders.minCustomerDistanceM,
      )
    }
  })

  test('la misma semilla pone los restaurantes en el mismo lugar', () => {
    const again = createCityMap(network, prototype.restaurants.count, createRandom(prototype.seed))
    expect(again.restaurants).toEqual(map.restaurants)
  })
})

describe('velocidad de los vehículos', () => {
  test('km/h de la hoja Vehículos, acelerados como el reloj del juego', () => {
    const bike = vehicles.bike.speedKmh
    expect(metersPerSecOf('bike')).toBeCloseTo(((bike * 1000) / 3600) * clock.gameSecondsPerRealSecond)
    // 18 km/h son 5 m/s; con 20 segundos de juego por segundo real, 100 m por segundo de juego.
    expect(metersPerSecOf('bike', 1)).toBeCloseTo((bike * 1000) / 3600)
  })

  test('un vehículo que no existe avisa', () => {
    expect(() => metersPerSecOf('hoverboard')).toThrow('Vehículos')
  })
})
