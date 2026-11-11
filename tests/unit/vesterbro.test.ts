import { describe, expect, test } from 'vitest'
import { levels } from '../../src/game/balance'
import { positionOf } from '../../src/game/cityMap'
import { balanceFor, clusterOf, createLevelShift, levelsOf } from '../../src/game/levels'
import { streetsOf, ZONES } from '../../src/game/neighborhoods'
import { advanceShift, shiftSettingsFrom } from '../../src/game/shift'
import { distanceM } from '../../src/game/streetGraph'

describe('Kødbyen: varios restaurantes juntos', () => {
  test.each(levelsOf('vesterbro'))('%s: los primeros restaurantes están en Kødbyen, y todos en Vesterbro', (levelId) => {
    const level = levels[levelId]
    const { shift } = createLevelShift(levelId)
    const restaurants = shift.map.restaurants
    expect(restaurants).toHaveLength(level.restaurants)
    const inZone = restaurants.filter(
      (restaurant) => distanceM(positionOf(shift.map, restaurant.node), ZONES.kodbyen) <= (level.zoneRadiusM ?? 0),
    )
    expect(inZone.length).toBeGreaterThanOrEqual(level.zoneRestaurants ?? Infinity)
    expect(restaurants.slice(0, level.zoneRestaurants).every((restaurant) => inZone.includes(restaurant))).toBe(true)
    // Calles de Vesterbro, no de Nørrebro.
    expect(shift.map.network.streets).toBe(streetsOf('vesterbro'))
  })

  test('la mayoría de los pedidos sale de Kødbyen', () => {
    const levelId = 'vesterbro_dinner'
    const balance = balanceFor(levelId)
    const settings = shiftSettingsFrom(balance)
    let { shift, random } = createLevelShift(levelId)
    while (!shift.clock.finished) shift = advanceShift(shift, 1, random, settings)
    const zoneIds = new Set(shift.map.restaurants.slice(0, levels[levelId].zoneRestaurants).map((restaurant) => restaurant.id))
    const orders = shift.orderQueue.orders
    const fromZone = orders.filter((order) => zoneIds.has(order.restaurantId))
    expect(fromZone.length).toBeGreaterThan(orders.length / 2)
  })

  test('los niveles de Nørrebro no juntan restaurantes', () => {
    for (const levelId of levelsOf('norrebro')) expect(clusterOf(balanceFor(levelId))).toBeUndefined()
    expect(clusterOf(balanceFor('vesterbro_lunch'))).toEqual({
      center: ZONES.kodbyen,
      radiusM: levels.vesterbro_lunch.zoneRadiusM,
      count: levels.vesterbro_lunch.zoneRestaurants,
    })
  })

  test('una zona que no existe es un error claro', () => {
    const balance = balanceFor('vesterbro_lunch')
    const wrong = { ...balance, restaurants: { ...balance.restaurants, zone: 'nowhere' } }
    expect(() => clusterOf(wrong)).toThrow(/nowhere/)
  })
})
