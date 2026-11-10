import { describe, expect, test } from 'vitest'
import { autoplay, firstComeBot, triageBot, type AutoplayOptions, type Bot } from '../../src/game/autoplay'
import { fleetOf, levelIds, levels, progression, prototype, shift as shiftBalance } from '../../src/game/balance'
import { balanceFor, briefingOf, expectedOrders, isUnlocked, nextLevel, recordResult } from '../../src/game/levels'
import { spawnIntervalAt, type OrderSettings } from '../../src/game/orders'
import { summarizeShift } from '../../src/game/results'
import { shiftSettingsFrom } from '../../src/game/shift'
import { useShiftStore } from '../../src/store/shiftStore'

const UNLOCK = progression.unlockAvgRating

describe('la pestaña Niveles', () => {
  test('Nørrebro tiene tres niveles: almuerzo, cena y viernes a la noche', () => {
    expect(levelIds).toEqual(['lunch', 'dinner', 'friday'])
    for (const id of levelIds) expect(levels[id].neighborhood).toBe('norrebro')
  })

  test('cada nivel pone sus números sobre los del prototipo', () => {
    const lunch = balanceFor('lunch')
    expect(lunch.shift.startHour).toBe(levels.lunch.startHour)
    expect(fleetOf(lunch)).toEqual(levels.lunch.fleet)
    expect(lunch.orders.deadlineSec).toBe(levels.lunch.deadlineSec)
    // Lo que no cambia por nivel sigue saliendo de Reglas.
    expect(lunch.heat).toEqual(prototype.heat)
    expect(lunch.orders.cancelAfterSec).toBe(prototype.orders.cancelAfterSec)
    expect(balanceFor(null)).toBe(prototype)
  })

  test('cada nivel es más exigente que el anterior: más pedidos, menos plazo, más flota', () => {
    const counts = levelIds.map((id) => expectedOrders(shiftSettingsFrom(balanceFor(id)).orders))
    const deadlines = levelIds.map((id) => levels[id].deadlineSec)
    const fleets = levelIds.map((id) => levels[id].fleet.length)
    for (let i = 1; i < levelIds.length; i++) {
      expect(counts[i]).toBeGreaterThan(counts[i - 1])
      expect(deadlines[i]).toBeLessThan(deadlines[i - 1])
      expect(fleets[i]).toBeGreaterThanOrEqual(fleets[i - 1])
    }
  })
})

describe('hora pico', () => {
  const settings: OrderSettings = {
    spawnIntervalSec: 20,
    peak: { fromSec: 100, toSec: 200, intervalSec: 10 },
    deadlineSec: 150,
    cookSec: 15,
    minCustomerDistanceM: 0,
    lastSpawnBeforeSec: 300,
  }

  test('en el pico los pedidos llegan más seguido', () => {
    expect(spawnIntervalAt(settings, 80)).toBe(20)
    expect(spawnIntervalAt(settings, 100)).toBe(10)
    expect(spawnIntervalAt(settings, 199)).toBe(10)
    expect(spawnIntervalAt(settings, 200)).toBe(20)
  })

  test('el briefing cuenta los pedidos del turno, pico incluido', () => {
    // 20, 40, 60, 80, 100 · 110 … 190 · 200, 220 … 280
    expect(expectedOrders(settings)).toBe(5 + 9 + 5)
    const briefing = briefingOf(balanceFor('lunch'), shiftSettingsFrom(balanceFor('lunch')).orders)
    expect(briefing.fleet).toEqual(levels.lunch.fleet)
    expect(briefing.peak).toEqual({ fromSec: levels.lunch.peakFromSec, toSec: levels.lunch.peakToSec })
  })
})

describe('progreso', () => {
  test('el primer nivel está abierto; los demás se abren con 4 estrellas en el anterior', () => {
    expect(isUnlocked(levelIds, {}, 'lunch', UNLOCK)).toBe(true)
    expect(isUnlocked(levelIds, {}, 'dinner', UNLOCK)).toBe(false)
    expect(isUnlocked(levelIds, { lunch: UNLOCK - 0.1 }, 'dinner', UNLOCK)).toBe(false)
    expect(isUnlocked(levelIds, { lunch: UNLOCK }, 'dinner', UNLOCK)).toBe(true)
    expect(isUnlocked(levelIds, { lunch: 5 }, 'friday', UNLOCK)).toBe(false)
    expect(isUnlocked(levelIds, {}, 'nope', UNLOCK)).toBe(false)
  })

  test('se guarda el mejor resultado de cada nivel', () => {
    const first = recordResult({}, 'lunch', 3.5)
    expect(first).toEqual({ lunch: 3.5 })
    expect(recordResult(first, 'lunch', 3)).toBe(first)
    expect(recordResult(first, 'lunch', 4.2)).toEqual({ lunch: 4.2 })
  })

  test('siguiente nivel', () => {
    expect(nextLevel(levelIds, 'lunch')).toBe('dinner')
    expect(nextLevel(levelIds, 'friday')).toBeUndefined()
  })

  test('el estado arranca un nivel con su flota y "Jugar otra vez" repite el mismo nivel', () => {
    const { startLevel } = useShiftStore.getState()
    startLevel('friday')
    expect(useShiftStore.getState().riders.map((rider) => rider.vehicle)).toEqual(levels.friday.fleet)
    expect(useShiftStore.getState().map.restaurants).toHaveLength(levels.friday.restaurants)
    useShiftStore.getState().tick(30)
    useShiftStore.getState().restartShift()
    expect(useShiftStore.getState()).toMatchObject({ levelId: 'friday', clock: { elapsedSec: 0 } })
    startLevel(null)
    expect(useShiftStore.getState().riders).toHaveLength(fleetOf(prototype).length)
  })
})

// Pilar 1 en cada nivel: siempre hay más pedidos que repartidores, y la presión sube de nivel en nivel.
// Si falla después de cambiar la pestaña Niveles, revisá los números antes de tocar el test.
describe('pilar 1 en cada nivel', () => {
  const options: AutoplayOptions = { reactionSec: 3, picksPerLook: 1, stepSec: 0.25 }
  const seeds = [11, 23, 37, 41, 59, 67, 73, 89]
  const play = (levelId: string, bot: Bot, seed?: number) => {
    const balance = balanceFor(levelId)
    const end = autoplay(balance, shiftSettingsFrom(balance), seed ?? balance.seed, bot, options)
    return summarizeShift(end.orderQueue.orders, balance.heat, balance.rating, shiftBalance)
  }

  test.each(levelIds)('%s: despachar sin pensar no gana; con cuidado se gana, pero no sale perfecto', (levelId) => {
    expect(play(levelId, firstComeBot).outcome).not.toBe('win')
    const careful = play(levelId, triageBot)
    expect(careful.outcome).toBe('win')
    expect(careful.average).toBeLessThan(prototype.rating.max)
    expect(careful.cancelled).toBeGreaterThan(0)
  })

  test('la dificultad crece: el bot cuidadoso saca menos estrellas en cada nivel', { timeout: 120_000 }, () => {
    const averages = levelIds.map(
      (levelId) => seeds.reduce((sum, seed) => sum + (play(levelId, triageBot, seed).average ?? 0), 0) / seeds.length,
    )
    for (let i = 1; i < averages.length; i++) expect(averages[i]).toBeLessThan(averages[i - 1])
    // El primero se gana en promedio; el último, ya no siempre.
    expect(averages[0]).toBeGreaterThanOrEqual(shiftBalance.winAtLeast)
  })
})
