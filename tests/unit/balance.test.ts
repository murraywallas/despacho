import { describe, expect, test } from 'vitest'
import data from '../../data/balance.json'
import { fleetOf, prototype, shift } from '../../src/game/balance'

/** Every number inside an object, with its path, e.g. ["heat.start", 100]. */
function numbersIn(value: unknown, path = ''): [string, number][] {
  if (typeof value === 'number') return [[path, value]]
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, child]) => numbersIn(child, path ? `${path}.${key}` : key))
}

describe('balance', () => {
  test('carga los números del prototipo desde balance.json', () => {
    expect(prototype.restaurants.count).toBe(data.prototype.restaurants.count)
    expect(prototype.orders.deadlineSec).toBe(data.prototype.orders.deadlineSec)
    expect(shift.winAtLeast).toBe(data.shift.winAtLeast)
  })

  test('todos los números del prototipo son positivos', () => {
    const numbers = numbersIn(prototype)
    expect(numbers.length).toBeGreaterThan(0)
    for (const [path, value] of numbers) {
      expect(value, path).toBeGreaterThan(0)
    }
  })

  test('los vehículos de la flota existen en la pestaña Vehículos', () => {
    const fleet = fleetOf(prototype)
    expect(fleet.length).toBeGreaterThan(0)
    for (const vehicle of fleet) expect(Object.keys(data.vehicles)).toContain(vehicle)
  })

  test('para ganar hacen falta más estrellas que para no perder', () => {
    expect(shift.winAtLeast).toBeGreaterThan(shift.loseBelow)
  })
})
