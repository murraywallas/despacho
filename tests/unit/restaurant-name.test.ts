import { describe, expect, test } from 'vitest'
import { hasText } from '../../src/i18n'
import { restaurantName } from '../../src/ui/restaurantName'

describe('nombres de restaurantes', () => {
  test('letra del mapa y nombre inventado', () => {
    expect(restaurantName({ id: 'r1', label: 'A' })).toBe('A · Pho Søndag')
  })

  test('sin nombre en es.json, "Restaurante" y la letra', () => {
    expect(restaurantName({ id: 'r99', label: 'Z' })).toBe('Restaurante Z')
  })

  test('hasText solo reconoce claves que existen', () => {
    expect(hasText('restaurants.r2')).toBe(true)
    expect(hasText('restaurants.r99')).toBe(false)
    expect(hasText('toString')).toBe(false)
  })
})
