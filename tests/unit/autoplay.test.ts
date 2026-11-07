import { describe, expect, test } from 'vitest'
import { autoplay, firstComeBot, triageBot, type AutoplayOptions, type Bot } from '../../src/game/autoplay'
import { prototype, shift as shiftBalance, type PrototypeBalance } from '../../src/game/balance'
import { heatOf, isCold } from '../../src/game/rating'
import { summarizeShift } from '../../src/game/results'
import { shiftSettingsFrom } from '../../src/game/shift'

// A player who looks at the screen every second; steps as small as the game loop's.
const options: AutoplayOptions = { reactionSec: 1, stepSec: 0.25 }

function play(bot: Bot, balance: PrototypeBalance = prototype, seed = prototype.seed) {
  const end = autoplay(balance, shiftSettingsFrom(balance), seed, bot, options)
  return summarizeShift(end.orderQueue.orders, balance.heat, balance.rating, shiftBalance)
}

describe('bots de balance', () => {
  test('juegan el turno entero con las reglas del juego', () => {
    const relaxed: PrototypeBalance = { ...prototype, orders: { ...prototype.orders, spawnIntervalSec: 30 } }
    const results = play(firstComeBot, relaxed)
    expect(results.delivered).toBeGreaterThan(0)
    expect(results).toMatchObject({ late: 0, cancelled: 0, average: prototype.rating.max, outcome: 'win' })
  })

  test('el bot cuidadoso deja para el final los pedidos que ya no llegan a tiempo', () => {
    const results = play(triageBot)
    expect(results.late).toBeLessThan(play(firstComeBot).late)
  })
})

// Pilar 1: siempre hay más pedidos que repartidores. Si este bloque falla después de cambiar la planilla,
// el turno perdió presión (o se volvió imposible): revisá los números antes de tocar el test.
describe('pilar 1 con los números de balance.json', () => {
  test('despachar sin pensar no gana el turno', () => {
    expect(play(firstComeBot).outcome).not.toBe('win')
  })

  test('despachar con cuidado puede ganar, pero no sale perfecto', () => {
    const results = play(triageBot)
    expect(results.outcome).toBe('win')
    expect(results.average).toBeLessThan(prototype.rating.max)
    expect(results.cancelled).toBeGreaterThan(0)
  })

  test('en varios turnos distintos, pensar paga', () => {
    const seeds = [11, 23, 37, 41, 59, 67, 73, 89]
    const average = (bot: Bot) =>
      seeds.reduce((sum, seed) => sum + (play(bot, prototype, seed).average ?? 0), 0) / seeds.length
    expect(average(triageBot) - average(firstComeBot)).toBeGreaterThan(0.5)
  })
})

describe('frío con los números de balance.json', () => {
  const coldDeliveries = (bot: Bot) => {
    const end = autoplay(prototype, shiftSettingsFrom(prototype), prototype.seed, bot, options)
    return end.orderQueue.orders.filter(
      (order) =>
        order.status === 'delivered' && isCold(heatOf(order, order.deliveredAtSec ?? 0, prototype.heat), prototype.heat),
    ).length
  }

  test('despachar sin pensar entrega comida fría', () => {
    expect(coldDeliveries(firstComeBot)).toBeGreaterThan(0)
  })

  test('despachar con cuidado entrega menos comida fría', () => {
    expect(coldDeliveries(triageBot)).toBeLessThan(coldDeliveries(firstComeBot))
  })
})
