import { describe, expect, test } from 'vitest'
import { autoplay, batchingBot, firstComeBot, triageBot, type Bot } from '../../src/game/autoplay'
import {
  economy,
  eventKinds,
  experience,
  fleetOf,
  levelIds,
  levels,
  neighborhoods,
  progression,
  shift as shiftBalance,
  vehicles,
} from '../../src/game/balance'
import { addShiftXp, salariesKr, xpOfRiders, type ExperienceRules } from '../../src/game/experience'
import { weatherAdvice } from '../../src/game/garage'
import { balanceFor, neighborhoodOf, withFleet } from '../../src/game/levels'
import { fleetCostKr, shiftMoney } from '../../src/game/money'
import { summarizeShift } from '../../src/game/results'
import { shiftSettingsFrom } from '../../src/game/shift'

const costOf = (vehicle: string) => vehicles[vehicle]?.costPerShiftKr ?? 0
const MAX_TRIES = 8
/** Money saved, at most, in shifts of the level's fleet: past this the money stops mattering (#110). */
const MOST_SHIFTS_SAVED = 4

/** The fleet the garage suggests for a level (with the weather swap). */
function suggestedFleetOf(levelId: string): string[] {
  const balance = balanceFor(levelId)
  const allowed = neighborhoods[levels[levelId].neighborhood]?.vehicles ?? fleetOf(balance)
  return weatherAdvice(fleetOf(balance), balance.events ?? [], eventKinds, vehicles, allowed)?.fleet.slice() ?? fleetOf(balance)
}

/**
 * A whole game with the money: starts with the starting money and riders, hires when it can pay the next level's
 * fleet, takes out what it can pay, and replays each level until it opens the next one (or gives up).
 */
function playCampaign(botOf: (levelId: string) => Bot, rules: ExperienceRules = experience) {
  let moneyKr = economy.startingKr
  let hired = economy.startingRiders
  let xp: number[] = []
  let lowestKr = moneyKr
  // The most money saved, counted in shifts of the level's whole fleet (vehicles only).
  let mostShiftsSaved = 0
  // Shifts that went out with fewer riders than the level suggests, for lack of money.
  let shortShifts = 0
  // The most a level's whole fleet cost for one shift (vehicles and salaries).
  let fleetKr = 0
  const tries: Record<string, number> = {}
  for (const levelId of levelIds) {
    const levelFleet = suggestedFleetOf(levelId)
    const costOfFleet = (fleet: readonly string[]) => fleetCostKr(fleet, costOf) + salariesKr(xp, fleet.length, rules)
    let best = 0
    tries[levelId] = 0
    while (best < progression.unlockAvgRating && tries[levelId] < MAX_TRIES) {
      while (hired < levelFleet.length && moneyKr >= economy.hireRiderKr + costOfFleet(levelFleet.slice(0, hired + 1))) {
        moneyKr -= economy.hireRiderKr
        hired++
      }
      let fleet = levelFleet.slice(0, hired)
      while (fleet.length > 1 && costOfFleet(fleet) > moneyKr) fleet = fleet.slice(0, -1)
      if (fleet.length < levelFleet.length) shortShifts++
      fleetKr = Math.max(fleetKr, costOfFleet(levelFleet))
      const salaries = salariesKr(xp, fleet.length, rules)
      const balance = withFleet(balanceFor(levelId), fleet)
      const options = { reactionSec: 3, picksPerLook: 1, stepSec: 0.25, xp: xpOfRiders(xp, fleet.length) }
      const end = autoplay(balance, shiftSettingsFrom(balance), balance.seed, botOf(levelId), options, neighborhoodOf(levelId))
      const orders = end.orderQueue.orders
      moneyKr += shiftMoney(orders, fleet, costOf, balance.heat, balance.rating, economy, salaries).profitKr
      lowestKr = Math.min(lowestKr, moneyKr)
      mostShiftsSaved = Math.max(mostShiftsSaved, moneyKr / fleetCostKr(levelFleet, costOf))
      xp = addShiftXp(xpOfRiders(xp, hired), end.riders, orders, rules)
      tries[levelId]++
      best = Math.max(best, summarizeShift(orders, balance.heat, balance.rating, shiftBalance).average ?? 0)
    }
    if (best < progression.unlockAvgRating) return { finished: false, moneyKr, lowestKr, tries, mostShiftsSaved, shortShifts, fleetKr }
  }
  return { finished: true, moneyKr, lowestKr, tries, mostShiftsSaved, shortShifts, fleetKr }
}

const careful = (levelId: string): Bot => (neighborhoodOf(levelId) === 'norrebro' ? triageBot : batchingBot)

// Si falla después de cambiar la planilla (Dinero, Repartidores o Vehículos), revisá los números antes de tocar el test.
describe('la campaña entera con la plata', { timeout: 300_000 }, () => {
  test('jugando con cuidado se termina, y los sueldos se llevan parte de lo ganado', () => {
    const paid = playCampaign(careful)
    expect(paid.finished).toBe(true)
    // La plata sigue importando (#110): nunca sobran más de ~4 turnos de la flota del nivel, pero alcanza para sacarla entera.
    expect(paid.mostShiftsSaved).toBeLessThanOrEqual(MOST_SHIFTS_SAVED)
    expect(paid.shortShifts).toBe(0)
    const unpaid = playCampaign(careful, { ...experience, salaryPerLevelKr: 0 })
    expect(paid.moneyKr).toBeLessThan(unpaid.moneyKr)
  })

  test('el que despacha sin pensar pasa el tutorial, y donde se traba nunca debe más que un turno de su flota', () => {
    const stuck = playCampaign(() => firstComeBot)
    expect(stuck.tries[levelIds[0]]).toBe(1)
    expect(stuck.finished).toBe(false)
    expect(levelIds.some((levelId) => stuck.tries[levelId] === MAX_TRIES)).toBe(true)
    // Con un solo repartidor siempre se puede salir; la caja puede quedar en negativo, pero no se hunde.
    expect(stuck.lowestKr).toBeGreaterThanOrEqual(-stuck.fleetKr)
  })
})
