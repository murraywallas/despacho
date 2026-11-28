import { describe, expect, test } from 'vitest'
import { autoplay, batchingBot, firstComeBot, triageBot, type Bot } from '../../src/game/autoplay'
import { economy, experience, levelIds, shift as shiftBalance, tuning } from '../../src/game/balance'
import { playCampaign, suggestedFleetOf, vehicleShares } from '../../src/game/campaign'
import { balanceFor, neighborhoodOf, withFleet } from '../../src/game/levels'
import { summarizeShift } from '../../src/game/results'
import { shiftSettingsFrom } from '../../src/game/shift'

const MAX_TRIES = 8

const careful = (levelId: string): Bot => (neighborhoodOf(levelId) === 'norrebro' ? triageBot : batchingBot)

// Si falla después de cambiar la planilla (Dinero, Repartidores o Vehículos), revisá los números antes de tocar el test.
describe('la campaña entera con la plata', { timeout: 300_000 }, () => {
  test('jugando con cuidado se termina, la plata crece para mejorar, y los sueldos se llevan parte de lo ganado', () => {
    const paid = playCampaign(careful, { maxTries: MAX_TRIES })
    expect(paid.finished).toBe(true)
    // La flota de cada nivel sale gratis (#141): la plata que se junta es para extras, vehículos mejores y cursos.
    expect(paid.moneyKr).toBeGreaterThan(economy.startingKr)
    const unpaid = playCampaign(careful, { maxTries: MAX_TRIES, rules: { ...experience, salaryPerLevelKr: 0 } })
    expect(paid.moneyKr).toBeLessThan(unpaid.moneyKr)
  })

  test('el que despacha sin pensar pasa el tutorial, y donde se traba nunca debe más que un turno de sueldos', () => {
    const stuck = playCampaign(() => firstComeBot, { maxTries: MAX_TRIES })
    expect(stuck.tries[levelIds[0]]).toBe(1)
    expect(stuck.finished).toBe(false)
    expect(levelIds.some((levelId) => stuck.tries[levelId] === MAX_TRIES)).toBe(true)
    // La flota del nivel siempre sale; la caja puede quedar en negativo por los sueldos, pero no se hunde.
    expect(stuck.lowestKr).toBeGreaterThanOrEqual(-stuck.fleetKr)
  })
})

/** The route through the 9 levels should take about 45 minutes of play (#71). */
const ROUTE_MINUTES = 45
const ROUTE_MARGIN_MINUTES = 5

describe('el recorrido de los 9 niveles (#71)', { timeout: 300_000 }, () => {
  test('el bot cuidadoso lo termina en unos 45 minutos, y ningún vehículo hace más de la mitad de las entregas', () => {
    const game = playCampaign(careful, { maxTries: MAX_TRIES })
    expect(game.finished).toBe(true)
    expect(Math.abs(game.minutes - ROUTE_MINUTES)).toBeLessThanOrEqual(ROUTE_MARGIN_MINUTES)
    for (const share of Object.values(vehicleShares(game.deliveredBy))) expect(share).toBeLessThanOrEqual(tuning.maxVehicleSharePct)
  })
})

// #146: con la flota gratis (#141) la plata se junta; los extra no pueden resolver el nivel solos.
describe('pilar 1 con repartidores extra (#146)', { timeout: 300_000 }, () => {
  const seeds = [11, 23, 37, 41, 59, 67, 73, 89]
  const averageWithExtras = (levelId: string) => {
    const base = suggestedFleetOf(levelId)
    const fleet = [...base, ...Array.from({ length: economy.maxExtraRiders }, () => base[0])]
    const balance = withFleet(balanceFor(levelId), fleet)
    const options = { reactionSec: 3, picksPerLook: 1, stepSec: 0.25 }
    return (
      seeds.reduce((sum, seed) => {
        const end = autoplay(balance, shiftSettingsFrom(balance), seed, careful(levelId), options, neighborhoodOf(levelId))
        return sum + (summarizeShift(end.orderQueue.orders, balance.heat, balance.rating, shiftBalance).average ?? 0)
      }, 0) / seeds.length
    )
  }

  // Menos el tutorial (#94), que puede ser fácil.
  test.each(levelIds.slice(1))('%s: con todos los extra que se permiten, el bot cuidadoso no lo encuentra muy fácil', (levelId) => {
    expect(averageWithExtras(levelId)).toBeLessThanOrEqual(tuning.tooEasyAbove)
  })

  test('gastando todo en extras, nunca salen más de los que permite la regla', () => {
    const rich = playCampaign(careful, { maxTries: MAX_TRIES, spendOnExtras: true })
    expect(rich.finished).toBe(true)
    expect(Math.max(...rich.levels.map((report) => report.extras))).toBe(economy.maxExtraRiders)
  })
})
