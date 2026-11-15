import { describe, expect, test } from 'vitest'
import { autoplay, triageBot, type AutoplayOptions } from '../../src/game/autoplay'
import { economy, fleetOf, shift as shiftBalance, vehicles } from '../../src/game/balance'
import { balanceFor, neighborhoodOf, withFleet } from '../../src/game/levels'
import { shiftMoney } from '../../src/game/money'
import { summarizeShift } from '../../src/game/results'
import { shiftSettingsFrom } from '../../src/game/shift'

const options: AutoplayOptions = { reactionSec: 3, picksPerLook: 1, stepSec: 0.25 }
const seeds = [11, 23, 37, 41, 59, 67, 73, 89]
const costOf = (vehicle: string) => vehicles[vehicle]?.costPerShiftKr ?? 0

/** Average stars and profit of a level with a fleet, over several shifts, played with care. */
function averages(levelId: string, fleet: string[]) {
  const results = seeds.map((seed) => {
    const balance = withFleet(balanceFor(levelId), fleet)
    const end = autoplay(balance, shiftSettingsFrom(balance), seed, triageBot, options, neighborhoodOf(levelId))
    const orders = end.orderQueue.orders
    return {
      stars: summarizeShift(orders, balance.heat, balance.rating, shiftBalance).average ?? 0,
      profitKr: shiftMoney(orders, fleet, costOf, balance.heat, balance.rating, economy).profitKr,
    }
  })
  const mean = (pick: (result: (typeof results)[number]) => number) =>
    results.reduce((sum, result) => sum + pick(result), 0) / results.length
  return { stars: mean((result) => result.stars), profitKr: mean((result) => result.profitKr) }
}

// Pilar 2: ningún vehículo es el mejor en todo. Si falla después de cambiar Vehículos o Dinero en la planilla,
// revisá los números antes de tocar el test.
describe('pilar 2: la patineta contra la bici', { timeout: 120_000 }, () => {
  test('en el Almuerzo, la bici saca más estrellas pero la patineta deja más plata', () => {
    const levelFleet = fleetOf(balanceFor('lunch'))
    expect(levelFleet).toContain('skateboard')
    const withBike = levelFleet.map((vehicle) => (vehicle === 'skateboard' ? 'bike' : vehicle))
    const skateboard = averages('lunch', levelFleet)
    const bike = averages('lunch', withBike)
    expect(bike.stars).toBeGreaterThan(skateboard.stars)
    expect(skateboard.profitKr).toBeGreaterThan(bike.profitKr)
  })
})
