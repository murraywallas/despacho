import { describe, expect, test } from 'vitest'
import { autoplay, batchingBot, firstComeBot, triageBot } from '../../src/game/autoplay'
import { experience, levelIds, prototype, shift as shiftBalance } from '../../src/game/balance'
import { riderTimeSec } from '../../src/game/dispatch'
import { addShiftXp, levelOf, levelProgress, speedBonusOf, train, xpOfRiders, type ExperienceRules } from '../../src/game/experience'
import { balanceFor, createLevelShift, levelNeighborhoods, levelsOf, neighborhoodOf } from '../../src/game/levels'
import { advanceRider, startTrip } from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import { summarizeShift } from '../../src/game/results'
import { shiftSettingsFrom } from '../../src/game/shift'

// Fixed values, so the tests don't move when the balance sheet changes.
const rules: ExperienceRules = { xpPerDelivery: 1, xpPerLevel: 10, maxLevel: 5, speedBonusPerLevelPct: 0.05, trainingKr: 250 }

describe('experiencia de los repartidores', () => {
  test('sube de nivel con la experiencia, hasta el máximo', () => {
    expect(levelOf(0, rules)).toBe(0)
    expect(levelOf(9, rules)).toBe(0)
    expect(levelOf(10, rules)).toBe(1)
    expect(levelOf(35, rules)).toBe(3)
    expect(levelOf(999, rules)).toBe(5)
    expect(levelProgress(35, rules)).toBeCloseTo(0.5)
    expect(levelProgress(999, rules)).toBe(1)
  })

  test('cada nivel suma speedBonusPerLevelPct de velocidad', () => {
    expect(speedBonusOf(0, rules)).toBe(0)
    expect(speedBonusOf(3, rules)).toBeCloseTo(0.15)
    expect(experience.speedBonusPerLevelPct).toBeCloseTo(0.05)
  })

  test('cada entrega da experiencia a quien la hizo; los lugares nuevos arrancan en cero', () => {
    const orders = [
      { id: 'o1', status: 'delivered', riderId: 'k1' },
      { id: 'o2', status: 'delivered', riderId: 'k1' },
      { id: 'o3', status: 'delivered', riderId: 'k3' },
      { id: 'o4', status: 'cancelled', riderId: 'k2' },
    ] as Order[]
    const riders = [
      { id: 'k1', number: 1 },
      { id: 'k2', number: 2 },
      { id: 'k3', number: 3 },
    ]
    expect(addShiftXp([5], riders, orders, rules)).toEqual([7, 0, 1])
    expect(xpOfRiders([7, 0, 1], 4)).toEqual([7, 0, 1, 0])
  })

  test('un curso sube un nivel por su precio; no si ya está arriba o no alcanza la plata', () => {
    expect(train([13, 0], 0, 1000, rules)).toEqual({ xp: [20, 0], moneyKr: 750 })
    expect(train([13, 0], 1, 1000, rules)).toEqual({ xp: [13, 10], moneyKr: 750 })
    expect(train([13], 0, 249, rules)).toBeUndefined()
    expect(train([50], 0, 1000, rules)).toBeUndefined()
  })

  test('el bono de velocidad acorta la ETA y el viaje', () => {
    const settings = shiftSettingsFrom(balanceFor('lunch'))
    const speeds = settings.movement.metersPerSec
    const { shift } = createLevelShift('lunch', undefined, [0, 0, 0])
    const { shift: trained } = createLevelShift('lunch', undefined, [experience.xpPerLevel * 3, 0, 0])
    const rookie = shift.riders[0]
    const veteran = trained.riders[0]
    expect(rookie.level).toBeUndefined()
    expect(veteran.level).toBe(3)
    expect(veteran.speedBonus).toBeCloseTo(speedBonusOf(3, experience))
    const restaurant = shift.map.restaurants.find((candidate) => candidate.node !== rookie.node)!
    expect(riderTimeSec(trained.map, veteran, restaurant.node, speeds)).toBeLessThan(riderTimeSec(shift.map, rookie, restaurant.node, speeds))

    // The same trip for both: the veteran gets farther in the same seconds.
    const order = { id: 'o1', number: 1, restaurantId: restaurant.id, customer: rookie.node, createdAtSec: 0, readyAtSec: 0, deadlineAtSec: 999, status: 'assigned' } as Order
    const going = (rider: typeof rookie) => startTrip(shift.map, { ...rider, status: 'toRestaurant', orderIds: ['o1'] }, [order])
    const SECONDS = 5
    const rookieStep = advanceRider(shift.map, going(rookie), [order], SECONDS, 0, settings.movement).rider
    const veteranStep = advanceRider(shift.map, going(veteran), [order], SECONDS, 0, settings.movement).rider
    expect(veteranStep.trip!.traveledM).toBeCloseTo(rookieStep.trip!.traveledM * (1 + veteran.speedBonus!))
  })
})

describe('pilar 1 con repartidores al nivel máximo', () => {
  const options = { reactionSec: 3, picksPerLook: 1, stepSec: 0.25 }
  const MAX_XP = experience.xpPerLevel * experience.maxLevel
  const veterans = Array.from({ length: 10 }, () => MAX_XP)
  const play = (levelId: string, bot: typeof firstComeBot) => {
    const balance = balanceFor(levelId)
    const end = autoplay(balance, shiftSettingsFrom(balance), balance.seed, bot, { ...options, xp: veterans }, neighborhoodOf(levelId))
    return summarizeShift(end.orderQueue.orders, prototype.heat, prototype.rating, shiftBalance)
  }

  test('con todos al nivel máximo, despachar sin pensar no gana todos los turnos: ningún viernes', () => {
    const won = levelIds.filter((levelId) => play(levelId, firstComeBot).outcome === 'win')
    expect(won.length).toBeLessThan(levelIds.length)
    for (const area of levelNeighborhoods()) expect(won).not.toContain(levelsOf(area).at(-1))
  })

  test.each(levelIds)('%s: con todos al nivel máximo, despachar con cuidado no sale perfecto', (levelId) => {
    const careful = play(levelId, neighborhoodOf(levelId) === 'norrebro' ? triageBot : batchingBot)
    expect(careful.average).toBeLessThan(prototype.rating.max)
  })
})
