import { describe, expect, test } from 'vitest'
import { eventKinds, shiftEvents, vehicles } from '../../src/game/balance'
import { travelTimeSec } from '../../src/game/dispatch'
import { balanceFor, createLevelShift } from '../../src/game/levels'
import { networkOf } from '../../src/game/neighborhoods'
import { mapAt, metersPerSecOf, shiftSettingsFrom } from '../../src/game/shift'
import { bearingDeg, windSpeedFactor, withWind } from '../../src/game/wind'

const WINDY = 'frederiksberg_lunch'
const FROM_WEST = 270

describe('dirección del viento', () => {
  test('rumbo de un tramo: norte 0, este 90, sur 180, oeste 270', () => {
    expect(bearingDeg([12.5, 55.6], [12.5, 55.7])).toBeCloseTo(0)
    expect(bearingDeg([12.5, 55.6], [12.6, 55.6])).toBeCloseTo(90)
    expect(bearingDeg([12.5, 55.7], [12.5, 55.6])).toBeCloseTo(180)
    expect(bearingDeg([12.6, 55.6], [12.5, 55.6])).toBeCloseTo(270)
  })

  test('con viento del oeste, ir al este es a favor y al oeste en contra; cruzarlo no cambia', () => {
    const pct = 0.25
    expect(windSpeedFactor([12.5, 55.6], [12.6, 55.6], FROM_WEST, pct)).toBeCloseTo(1 + pct)
    expect(windSpeedFactor([12.6, 55.6], [12.5, 55.6], FROM_WEST, pct)).toBeCloseTo(1 - pct)
    expect(windSpeedFactor([12.5, 55.6], [12.5, 55.7], FROM_WEST, pct)).toBeCloseTo(1)
    expect(windSpeedFactor([12.5, 55.6], [12.6, 55.6], FROM_WEST, 0)).toBe(1)
  })
})

describe('viento en las calles', () => {
  test('los números salen de la planilla: windSpeedPct en Vehículos, el tipo en Eventos y la dirección en Eventos de turno', () => {
    expect(eventKinds.wind.effectType).toBe('wind')
    expect(vehicles.bike.windSpeedPct).toBeGreaterThan(0)
    expect(vehicles.skateboard.windSpeedPct).toBeGreaterThan(0)
    expect(vehicles.e_scooter.windSpeedPct ?? 0).toBe(0)
    expect(vehicles.motorcycle.windSpeedPct ?? 0).toBe(0)
    expect(shiftEvents.frederiksberg_lunch_wind).toMatchObject({ event: 'wind', directionDeg: FROM_WEST })
  })

  test('el mismo tramo tarda más contra el viento que a favor, en bici', () => {
    const calm = networkOf('frederiksberg', 'bike')
    const windy = withWind(calm, FROM_WEST, vehicles.bike.windSpeedPct ?? 0)
    // A two-way stretch that runs mostly east–west.
    const edge = calm.streets.edges.find(([a, b, lengthM]) => {
      const bearing = bearingDeg(calm.streets.nodes[a], calm.streets.nodes[b])
      const eastward = Math.abs(bearing - 90) < 15
      return eastward && lengthM > 50 && calm.graph.getLink(a, b) && calm.graph.getLink(b, a)
    })
    expect(edge).toBeDefined()
    const [west, east] = edge!
    const speed = metersPerSecOf('bike')
    const withTheWind = travelTimeSec(windy, west, east, speed)
    const against = travelTimeSec(windy, east, west, speed)
    const still = travelTimeSec(calm, west, east, speed)
    expect(against).toBeGreaterThan(still)
    expect(withTheWind).toBeLessThan(still)
  })

  test('el monopatín y la moto no cambian con el viento', () => {
    for (const vehicle of ['e_scooter', 'motorcycle']) {
      const calm = networkOf('frederiksberg', vehicle)
      expect(withWind(calm, FROM_WEST, vehicles[vehicle].windSpeedPct ?? 0)).toBe(calm)
    }
  })

  test('en el turno, las calles se vuelven ventosas mientras sopla y vuelven a la calma al terminar', () => {
    const settings = shiftSettingsFrom(balanceFor(WINDY))
    const wind = settings.events.find((event) => event.event === 'wind')!
    const { map } = createLevelShift(WINDY).shift
    const before = mapAt(map, settings, wind.fromSec - 1)
    const during = mapAt(map, settings, wind.fromSec + 1)
    const after = mapAt(during, settings, wind.toSec)
    expect(before).toBe(map)
    expect(during).not.toBe(map)
    expect(during.networks.bike).not.toBe(map.networks.bike)
    expect(during.networks.e_scooter).toBe(map.networks.e_scooter)
    expect(during.networks.motorcycle).toBe(map.networks.motorcycle)
    expect(after).toBe(map)
    // While it blows, the same map object: watchers don't redo their work every tick.
    expect(mapAt(during, settings, wind.fromSec + 2)).toBe(during)
  })
})
