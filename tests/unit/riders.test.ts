import { describe, expect, test } from 'vitest'
import { prototype } from '../../src/game/balance'
import { createCityMap } from '../../src/game/cityMap'
import { norrebroBikeNetwork } from '../../src/game/norrebro'
import { createRandom } from '../../src/game/random'
import { createRiders } from '../../src/game/riders'
import { useShiftStore } from '../../src/store/shiftStore'

function setup(seed = prototype.seed) {
  const random = createRandom(seed)
  const map = createCityMap(norrebroBikeNetwork(), prototype.restaurants.count, random)
  return { map, riders: createRiders(map, prototype.riders.count, prototype.riders.vehicle, random) }
}

describe('repartidores', () => {
  test('hay tantos como dice balance.json, con el vehículo de balance.json', () => {
    const { riders } = setup()
    expect(riders).toHaveLength(prototype.riders.count)
    for (const rider of riders) expect(rider.vehicle).toBe(prototype.riders.vehicle)
  })

  test('arrancan todos libres y numerados desde 1', () => {
    const { riders } = setup()
    expect(riders.map((rider) => rider.status)).toEqual(riders.map(() => 'idle'))
    expect(riders.map((rider) => rider.number)).toEqual(riders.map((_, index) => index + 1))
  })

  test('cada uno en una dirección distinta del barrio y fuera de los restaurantes', () => {
    const { map, riders } = setup()
    expect(new Set(riders.map((rider) => rider.node)).size).toBe(riders.length)
    for (const rider of riders) {
      expect(map.addresses).toContain(rider.node)
      expect(map.restaurants.some((restaurant) => restaurant.node === rider.node)).toBe(false)
    }
  })

  test('la misma semilla los pone en el mismo lugar', () => {
    expect(setup(3).riders).toEqual(setup(3).riders)
  })

  test('falla si no entran en el barrio', () => {
    const { map } = setup()
    expect(() => createRiders(map, 100_000, 'bike', createRandom(1))).toThrow('No entran')
  })

  test('el turno arranca con los repartidores de balance.json', () => {
    expect(useShiftStore.getState().riders).toHaveLength(prototype.riders.count)
  })
})
