import { describe, expect, test } from 'vitest'
import { batchingBot, firstComeBot, triageBot, type Bot } from '../../src/game/autoplay'
import { experience, levelIds, tuning } from '../../src/game/balance'
import { playCampaign, vehicleShares } from '../../src/game/campaign'
import { neighborhoodOf } from '../../src/game/levels'

const MAX_TRIES = 8
/** Money saved, at most, in shifts of the level's fleet: past this the money stops mattering (#110). */
const MOST_SHIFTS_SAVED = 4

const careful = (levelId: string): Bot => (neighborhoodOf(levelId) === 'norrebro' ? triageBot : batchingBot)

// Si falla después de cambiar la planilla (Dinero, Repartidores o Vehículos), revisá los números antes de tocar el test.
describe('la campaña entera con la plata', { timeout: 300_000 }, () => {
  test('jugando con cuidado se termina, y los sueldos se llevan parte de lo ganado', () => {
    const paid = playCampaign(careful, { maxTries: MAX_TRIES })
    expect(paid.finished).toBe(true)
    // La plata sigue importando (#110): nunca sobran más de ~4 turnos de la flota del nivel, pero alcanza para sacarla entera.
    expect(paid.mostShiftsSaved).toBeLessThanOrEqual(MOST_SHIFTS_SAVED)
    expect(paid.shortShifts).toBe(0)
    const unpaid = playCampaign(careful, { maxTries: MAX_TRIES, rules: { ...experience, salaryPerLevelKr: 0 } })
    expect(paid.moneyKr).toBeLessThan(unpaid.moneyKr)
  })

  test('el que despacha sin pensar pasa el tutorial, y donde se traba nunca debe más que un turno de su flota', () => {
    const stuck = playCampaign(() => firstComeBot, { maxTries: MAX_TRIES })
    expect(stuck.tries[levelIds[0]]).toBe(1)
    expect(stuck.finished).toBe(false)
    expect(levelIds.some((levelId) => stuck.tries[levelId] === MAX_TRIES)).toBe(true)
    // Con un solo repartidor siempre se puede salir; la caja puede quedar en negativo, pero no se hunde.
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
