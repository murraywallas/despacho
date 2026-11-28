import { describe, expect, test } from 'vitest'
import { economy, fleetOf, levelIds, levels, neighborhoods } from '../../src/game/balance'
import {
  canStart,
  chosenFleet,
  garageRules,
  hireRider,
  isValidFleet,
  suggestedFleet,
  weatherAdvice,
} from '../../src/game/garage'
import { balanceFor } from '../../src/game/levels'
import { extraCostKr, fleetCostKr } from '../../src/game/money'

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

  test('la flota del nivel sale gratis: se paga lo que un vehículo cuesta de más, y entero el de un extra (#141)', () => {
    expect(extraCostKr(dinner, dinner, costOf)).toBe(0)
    // Un skate cambiado por monopatín: paga la diferencia (180 − 80).
    expect(extraCostKr(['bike', 'bike', 'e_scooter', 'e_scooter'], dinner, costOf)).toBe(100)
    // Más barato que el del nivel: no devuelve nada.
    expect(extraCostKr(['skateboard', 'bike', 'skateboard', 'e_scooter'], dinner, costOf)).toBe(0)
    // Un repartidor extra paga su vehículo entero.
    expect(extraCostKr([...dinner, 'bike'], dinner, costOf)).toBe(150)
    // Sin flota del nivel, se paga todo.
    expect(extraCostKr(dinner, [], costOf)).toBe(560)
  })

  test('la flota del nivel siempre puede salir, aunque la caja no alcance para los sueldos (#141)', () => {
    expect(canStart(dinner, 0, costOf, 120, dinner)).toBe(true)
    expect(canStart(dinner, -500, costOf, 120, dinner)).toBe(true)
    // Lo que se suma, sí se paga con lo que hay en caja (con los sueldos).
    expect(canStart([...dinner, 'bike'], 270, costOf, 120, dinner)).toBe(true)
    expect(canStart([...dinner, 'bike'], 269, costOf, 120, dinner)).toBe(false)
  })

  test('no se puede empezar con una flota que cuesta más de lo que hay en caja', () => {
    expect(canStart(dinner, 560, costOf)).toBe(true)
    expect(canStart(dinner, 559, costOf)).toBe(false)
    // Los sueldos también se pagan.
    expect(canStart(dinner, 600, costOf, 40)).toBe(true)
    expect(canStart(dinner, 599, costOf, 40)).toBe(false)
    expect(canStart([], 1000, costOf)).toBe(false)
  })

  test('un solo repartidor siempre puede salir, aunque la caja no alcance', () => {
    expect(canStart(['bike'], 0, costOf)).toBe(true)
    expect(canStart(['bike'], -300, costOf)).toBe(true)
    expect(canStart(['bike', 'skateboard'], 100, costOf)).toBe(false)
  })

  test('contratar suma un repartidor extra para siempre y cuesta plata', () => {
    expect(hireRider(500, 0, 200)).toEqual({ moneyKr: 300, hired: 1 })
    expect(hireRider(199, 0, 200)).toBeUndefined()
  })

  test('cada nivel sale con su flota completa; los extra contratados se suman (#141)', () => {
    expect(garageRules(dinner, norrebro, 0).maxRiders).toBe(4)
    expect(garageRules(dinner, norrebro, 2).maxRiders).toBe(6)
    expect(garageRules(norrebro, norrebro, 0).maxRiders).toBe(3)
  })

  test('la flota sugerida es la de Niveles, completa', () => {
    expect(suggestedFleet(dinner, garageRules(dinner, norrebro, 0))).toEqual(dinner)
  })

  test('cada repartidor usa un vehículo del barrio, de 1 al máximo', () => {
    const rules = garageRules(dinner, norrebro, 0)
    expect(isValidFleet(['e_scooter', 'e_scooter'], rules)).toBe(true)
    expect(isValidFleet(['motorcycle'], rules)).toBe(false)
    expect(isValidFleet([], rules)).toBe(false)
    expect(isValidFleet(['bike', 'bike', 'bike', 'bike', 'bike'], rules)).toBe(false)
  })

  test('la flota guardada se usa si sigue valiendo; si no, la sugerida', () => {
    const rules = garageRules(dinner, norrebro, 0)
    expect(chosenFleet(['e_scooter', 'e_scooter'], dinner, rules)).toEqual(['e_scooter', 'e_scooter'])
    expect(chosenFleet(['motorcycle'], dinner, rules)).toEqual(dinner)
    expect(chosenFleet(undefined, dinner, rules)).toEqual(dinner)
  })

  test('en cada nivel, la flota sugerida usa vehículos de su barrio y entra con los repartidores de Niveles', () => {
    for (const levelId of levelIds) {
      const fleet = fleetOf(balanceFor(levelId))
      const rules = garageRules(fleet, neighborhoods[levels[levelId].neighborhood].vehicles, 0)
      expect(isValidFleet(fleet, rules)).toBe(true)
    }
  })

  test('el primer almuerzo sale con su flota sin plata, y contratar un extra cuesta', () => {
    const fleet = fleetOf(balanceFor(levelIds[0]))
    expect(canStart(fleet, 0, costOf, 0, fleet)).toBe(true)
    expect(economy.hireRiderKr).toBeGreaterThan(0)
  })
})

describe('flota sugerida con mal tiempo anunciado', () => {
  // Fixed values, so the tests don't move when the balance sheet changes.
  const kinds = { rain: { swapBelowPct: -0.3, swapTo: 'bike' }, wind: {} }
  const rows = {
    bike: { rainSpeedPct: -0.1 },
    skateboard: { rainSpeedPct: -0.4 },
    rollers: { rainSpeedPct: -0.4 },
    e_scooter: { rainSpeedPct: -0.25 },
  }
  const all = ['bike', 'skateboard', 'rollers', 'e_scooter']
  const rain = [{ event: 'rain', announced: true }]

  test('cambia por bici lo que se frena tanto o más', () => {
    expect(weatherAdvice(['bike', 'skateboard', 'rollers', 'skateboard', 'e_scooter'], rain, kinds, rows, all)).toEqual({
      event: 'rain',
      slow: ['skateboard', 'rollers'],
      to: 'bike',
      fleet: ['bike', 'bike', 'bike', 'bike', 'e_scooter'],
    })
  })

  test('sin nada que cambiar, sin anuncio o sin regla, no sugiere nada', () => {
    expect(weatherAdvice(['bike', 'e_scooter'], rain, kinds, rows, all)).toBeUndefined()
    expect(weatherAdvice(['skateboard'], [{ event: 'rain', announced: false }], kinds, rows, all)).toBeUndefined()
    expect(weatherAdvice(['skateboard'], [{ event: 'wind', announced: true }], kinds, rows, all)).toBeUndefined()
  })

  test('si la bici no se puede elegir (otro barrio o huelga), no sugiere cambiarla', () => {
    expect(weatherAdvice(['skateboard'], rain, kinds, rows, ['skateboard', 'rollers'])).toBeUndefined()
  })
})
