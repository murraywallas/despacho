import { describe, expect, test } from 'vitest'
import { hasText } from '../../src/i18n'
import { restaurantName } from '../../src/ui/restaurantName'

describe('nombres de restaurantes', () => {
  test('letra del mapa y nombre inventado, propio de cada barrio', () => {
    expect(restaurantName({ id: 'r1', label: 'A' })).toBe('A · Pho Søndag')
    expect(restaurantName({ id: 'r1', label: 'A' }, 'norrebro')).toBe('A · Pho Søndag')
    expect(restaurantName({ id: 'r1', label: 'A' }, 'vesterbro')).toBe('A · Grill Slagterhallen')
  })

  test('cada restaurante de Vesterbro y Frederiksberg tiene nombre', () => {
    for (const area of ['vesterbro', 'frederiksberg']) {
      for (let number = 1; number <= 5; number++) expect(hasText(`restaurants.${area}.r${number}`)).toBe(true)
    }
  })

  test('sin nombre en es.json, "Restaurante" y la letra', () => {
    expect(restaurantName({ id: 'r99', label: 'Z' })).toBe('Restaurante Z')
  })

  test('hasText solo reconoce claves que existen', () => {
    expect(hasText('restaurants.norrebro.r2')).toBe(true)
    expect(hasText('restaurants.norrebro.r99')).toBe(false)
    expect(hasText('toString')).toBe(false)
  })
})
