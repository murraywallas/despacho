import { describe, expect, test } from 'vitest'
import { economy, fleetOf, levelIds, levels, neighborhoods } from '../../src/game/balance'
import {
  canStart,
  canUseMoreRiders,
  chosenFleet,
  garageRules,
  hireRider,
  isValidFleet,
  suggestedFleet,
} from '../../src/game/garage'
import { balanceFor } from '../../src/game/levels'
import { fleetCostKr } from '../../src/game/money'

// Fixed values, so the tests don't move when the balance sheet changes.
const costs: Record<string, number> = { bike: 150, skateboard: 80, e_scooter: 180 }
const costOf = (vehicle: string) => costs[vehicle]
const dinner = ['bike', 'bike', 'skateboard', 'e_scooter']
const norrebro = ['bike', 'skateboard', 'e_scooter']

describe('garage', () => {
  test('el costo de la flota es la suma de sus vehículos', () => {
    expect(fleetCostKr(dinner, costOf)).toBe(560)
    expect(fleetCostKr(['e_scooter'], costOf)).toBe(180)
  })

  test('no se puede empezar con una flota que cuesta más de lo que hay en caja', () => {
    expect(canStart(dinner, 560, costOf)).toBe(true)
    expect(canStart(dinner, 559, costOf)).toBe(false)
    expect(canStart([], 1000, costOf)).toBe(false)
  })

  test('un solo repartidor siempre puede salir, aunque la caja no alcance', () => {
    expect(canStart(['bike'], 0, costOf)).toBe(true)
    expect(canStart(['bike'], -300, costOf)).toBe(true)
    expect(canStart(['bike', 'skateboard'], 100, costOf)).toBe(false)
  })

  test('contratar suma un lugar para siempre y cuesta plata', () => {
    expect(hireRider(500, 3, 200)).toEqual({ moneyKr: 300, hired: 4 })
    expect(hireRider(199, 3, 200)).toBeUndefined()
    // Con un lugar más, la cena sale con sus 4.
    expect(garageRules(dinner, norrebro, 3).maxRiders).toBe(3)
    expect(garageRules(dinner, norrebro, 4).maxRiders).toBe(4)
    expect(canUseMoreRiders(dinner, 3)).toBe(true)
    expect(canUseMoreRiders(dinner, 4)).toBe(false)
  })

  test('el nivel pone el techo: más contratados que su flota no suman', () => {
    expect(garageRules(norrebro, norrebro, 6).maxRiders).toBe(3)
  })

  test('la flota sugerida es la de Niveles, recortada a los repartidores que tenés', () => {
    expect(suggestedFleet(dinner, garageRules(dinner, norrebro, 3))).toEqual(['bike', 'bike', 'skateboard'])
    expect(suggestedFleet(dinner, garageRules(dinner, norrebro, 4))).toEqual(dinner)
  })

  test('cada repartidor usa un vehículo del barrio, de 1 al máximo', () => {
    const rules = garageRules(dinner, norrebro, 4)
    expect(isValidFleet(['e_scooter', 'e_scooter'], rules)).toBe(true)
    expect(isValidFleet(['motorcycle'], rules)).toBe(false)
    expect(isValidFleet([], rules)).toBe(false)
    expect(isValidFleet(['bike', 'bike', 'bike', 'bike', 'bike'], rules)).toBe(false)
  })

  test('la flota guardada se usa si sigue valiendo; si no, la sugerida', () => {
    const rules = garageRules(dinner, norrebro, 3)
    expect(chosenFleet(['e_scooter', 'e_scooter'], dinner, rules)).toEqual(['e_scooter', 'e_scooter'])
    expect(chosenFleet(['motorcycle'], dinner, rules)).toEqual(['bike', 'bike', 'skateboard'])
    expect(chosenFleet(undefined, dinner, rules)).toEqual(['bike', 'bike', 'skateboard'])
  })

  test('en cada nivel, la flota sugerida usa vehículos de su barrio y entra con los repartidores de Niveles', () => {
    for (const levelId of levelIds) {
      const fleet = fleetOf(balanceFor(levelId))
      const rules = garageRules(fleet, neighborhoods[levels[levelId].neighborhood].vehicles, fleet.length)
      expect(isValidFleet(fleet, rules)).toBe(true)
    }
  })

  test('el primer almuerzo se puede jugar con la plata y los repartidores del arranque', () => {
    const fleet = fleetOf(balanceFor(levelIds[0]))
    expect(fleet.length).toBeLessThanOrEqual(economy.startingRiders)
    expect(economy.hireRiderKr).toBeGreaterThan(0)
  })
})
