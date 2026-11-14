import { describe, expect, test } from 'vitest'
import { autoplay, batchingBot } from '../../src/game/autoplay'
import { eventKinds, fleetOf, levelIds, levels, prototype, shiftEvents, vehicles } from '../../src/game/balance'
import { balanceFor, expectedOrders, neighborhoodOf, withFleet } from '../../src/game/levels'
import { spawnIntervalAt } from '../../src/game/orders'
import { averageRating } from '../../src/game/rating'
import { activeEvents, demandAt, speedsWith, type ShiftEvent } from '../../src/game/shiftEvents'
import { movementAt, shiftSettingsFrom } from '../../src/game/shift'

const RAINY = 'vesterbro_dinner'
const rain: ShiftEvent = { id: 'test_rain', event: 'rain', fromSec: 100, toSec: 200, announced: true }

describe('motor de eventos', () => {
  test('un evento empieza y termina a tiempo', () => {
    expect(activeEvents([rain], 99.9)).toEqual([])
    expect(activeEvents([rain], 100)).toEqual([rain])
    expect(activeEvents([rain], 199.9)).toEqual([rain])
    expect(activeEvents([rain], 200)).toEqual([])
  })

  test('cada nivel toma sus eventos de la pestaña Eventos de turno; el turno de prueba no tiene', () => {
    expect(balanceFor(null).events ?? []).toEqual([])
    for (const levelId of levelIds) {
      const events = balanceFor(levelId).events ?? []
      expect(events.map((event) => event.id)).toEqual(levels[levelId].events ?? [])
      for (const event of events) {
        expect(eventKinds[event.event]).toBeDefined()
        expect(event.toSec).toBeGreaterThan(event.fromSec)
      }
    }
    expect(levels[RAINY].events).toContain('vesterbro_dinner_rain')
    expect(shiftEvents.vesterbro_dinner_rain).toMatchObject({ event: 'rain', announced: true })
  })
})

describe('lluvia', () => {
  test('cada vehículo pierde su rainSpeedPct de velocidad mientras llueve, y nada más', () => {
    const speeds = { bike: 10, skateboard: 10, motorcycle: 10, car: 10 }
    const wet = speedsWith(speeds, [rain], eventKinds, vehicles)
    for (const vehicle of Object.keys(speeds)) {
      expect(wet[vehicle]).toBeCloseTo(10 * (1 + (vehicles[vehicle].rainSpeedPct ?? 0)))
    }
    expect(wet.skateboard).toBeLessThan(wet.bike)
    expect(speedsWith(speeds, [], eventKinds, vehicles)).toBe(speeds)
  })

  test('en el turno, la velocidad baja solo mientras dura la lluvia', () => {
    const settings = shiftSettingsFrom(balanceFor(RAINY))
    const event = settings.events[0]
    const dry = movementAt(settings, event.fromSec - 1).metersPerSec
    const wet = movementAt(settings, event.fromSec + 1).metersPerSec
    const after = movementAt(settings, event.toSec).metersPerSec
    expect(wet.skateboard).toBeCloseTo(dry.skateboard * (1 + (vehicles.skateboard.rainSpeedPct ?? 0)))
    expect(wet.bike).toBeCloseTo(dry.bike * (1 + (vehicles.bike.rainSpeedPct ?? 0)))
    expect(after).toEqual(dry)
  })

  test('mientras llueve llegan un demandPct más de pedidos', () => {
    const demand = 1 + (eventKinds.rain.demandPct ?? 0)
    expect(demand).toBeCloseTo(1.3)
    const settings = shiftSettingsFrom(balanceFor(RAINY)).orders
    const event = shiftSettingsFrom(balanceFor(RAINY)).events[0]
    const base = { ...settings, demand: [] }
    expect(spawnIntervalAt(settings, event.fromSec + 1)).toBeCloseTo(spawnIntervalAt(base, event.fromSec + 1) / demand)
    expect(spawnIntervalAt(settings, event.toSec)).toBe(spawnIntervalAt(base, event.toSec))
    expect(demandAt(settings.demand, event.fromSec - 1)).toBe(1)
    expect(expectedOrders(settings)).toBeGreaterThan(expectedOrders(base))
  })
})

describe('balance con lluvia', () => {
  const options = { reactionSec: 3, picksPerLook: 1, stepSec: 0.25 }
  const SEEDS = 8

  function averageWith(fleet: readonly string[]): number {
    const balance = withFleet(balanceFor(RAINY), fleet)
    const settings = shiftSettingsFrom(balance)
    let sum = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      const end = autoplay(balance, settings, balance.seed + seed, batchingBot, options, neighborhoodOf(RAINY))
      sum += averageRating(end.orderQueue.orders, prototype.heat, prototype.rating) ?? 0
    }
    return sum / SEEDS
  }

  test('con lluvia, el bot que cambia la patineta por una bici saca más estrellas que el que sigue con la patineta', () => {
    const suggested = fleetOf(balanceFor(RAINY))
    expect(suggested).toContain('skateboard')
    const withBike = suggested.map((vehicle) => (vehicle === 'skateboard' ? 'bike' : vehicle))
    expect(averageWith(withBike)).toBeGreaterThan(averageWith(suggested))
  })
})
