/**
 * The balance bot plays the route through the 9 levels (#71) and prints a report: stars, money, vehicles and minutes
 * of each level, and the level averages over many shifts. Run it with `npm run recorrido`.
 */
import { test } from 'vitest'
import { autoplay, batchingBot, triageBot, type Bot } from '../../src/game/autoplay'
import { shift as shiftBalance, tuning } from '../../src/game/balance'
import { playCampaign, suggestedFleetOf, vehicleShares } from '../../src/game/campaign'
import { balanceFor, neighborhoodOf, withFleet } from '../../src/game/levels'
import { summarizeShift } from '../../src/game/results'
import { shiftSettingsFrom } from '../../src/game/shift'

const careful = (levelId: string): Bot => (neighborhoodOf(levelId) === 'norrebro' ? triageBot : batchingBot)
// SHIFTS=20 npm run recorrido: fewer shifts per level, for a quick look.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const SHIFTS = Number(env.SHIFTS ?? tuning.botShiftsPerLevel)
const PERCENT = 100

/** Average stars of a level over many shifts (seeds 1…SHIFTS), with the fleet the garage suggests (and extras). */
function levelAverage(levelId: string, fleet: readonly string[] = suggestedFleetOf(levelId)): number {
  const balance = withFleet(balanceFor(levelId), fleet)
  const options = { reactionSec: 3, picksPerLook: 1, stepSec: 0.25 }
  let sum = 0
  for (let seed = 1; seed <= SHIFTS; seed++) {
    const end = autoplay(balance, shiftSettingsFrom(balance), seed, careful(levelId), options, neighborhoodOf(levelId))
    sum += summarizeShift(end.orderQueue.orders, balance.heat, balance.rating, shiftBalance).average ?? 0
  }
  return sum / SHIFTS
}

const fixed = (value: number, digits = 2) => value.toFixed(digits).replace('.', ',')

test('recorrido', () => {
  const game = playCampaign(careful)
  const lines = ['# Recorrido del bot cuidadoso', '', `Terminó: ${game.finished ? 'sí' : 'no'} · ${fixed(game.minutes, 0)} min de juego a velocidad normal · caja final ${Math.round(game.moneyKr)} kr (la más baja: ${Math.round(game.lowestKr)} kr)`, '']
  lines.push(`| Nivel | Turnos | Estrellas por turno | Promedio en ${SHIFTS} turnos | Min | Caja | Flota |`, '|---|---|---|---|---|---|---|')
  const problems: string[] = []
  for (const report of game.levels) {
    const average = levelAverage(report.levelId)
    if (average > tuning.tooEasyAbove) problems.push(`${report.levelId}: muy fácil (${fixed(average)})`)
    if (average < tuning.tooHardBelow) problems.push(`${report.levelId}: muy difícil (${fixed(average)})`)
    lines.push(`| ${report.levelId} | ${report.tries} | ${report.stars.map((stars) => fixed(stars)).join(' · ')} | ${fixed(average)} | ${fixed(report.minutes, 1)} | ${Math.round(report.moneyKr)} | ${report.fleet.join(', ')} |`)
  }
  const shares = Object.entries(vehicleShares(game.deliveredBy)).sort((a, b) => b[1] - a[1])
  lines.push('', '## Pedidos entregados por vehículo', '')
  for (const [vehicle, share] of shares) {
    lines.push(`- ${vehicle}: ${fixed(share * PERCENT, 0)} % (${game.deliveredBy[vehicle]})`)
    if (share > tuning.maxVehicleSharePct) problems.push(`${vehicle}: ${fixed(share * PERCENT, 0)} % de los pedidos (máximo ${fixed(tuning.maxVehicleSharePct * PERCENT, 0)} %)`)
  }
  // #146: a rich player who spends the money on extra riders. Does any level stop being hard?
  const rich = playCampaign(careful, { spendOnExtras: true })
  lines.push('', '## Gastando la plata en repartidores extra (#146)', '', `Terminó: ${rich.finished ? 'sí' : 'no'} · caja final ${Math.round(rich.moneyKr)} kr`, '')
  lines.push(`| Nivel | Extra | Estrellas por turno | Promedio en ${SHIFTS} turnos | Caja |`, '|---|---|---|---|---|')
  for (const report of rich.levels) {
    const average = levelAverage(report.levelId, report.fleet)
    if (average > tuning.tooEasyAbove) problems.push(`${report.levelId} con ${report.extras} extra: muy fácil (${fixed(average)})`)
    lines.push(`| ${report.levelId} | ${report.extras} | ${report.stars.map((stars) => fixed(stars)).join(' · ')} | ${fixed(average)} | ${Math.round(report.moneyKr)} |`)
  }
  lines.push('', '## Problemas', '', ...(problems.length > 0 ? problems.map((problem) => `- ${problem}`) : ['Ninguno.']))
  console.log(lines.join('\n'))
})
