import { describe, expect, test } from 'vitest'
import { computeLayout, toCanvas } from '../../src/map/layout'

describe('ubicación del mapa en el canvas', () => {
  test('en un canvas ancho, la grilla queda cuadrada y centrada', () => {
    const layout = computeLayout(1400, 800, 10, 20)
    const first = toCanvas(layout, { x: 0, y: 0 })
    const last = toCanvas(layout, { x: 9, y: 9 })
    expect(last.x - first.x).toBeCloseTo(last.y - first.y)
    expect(first.y).toBe(20)
    expect(last.y).toBe(780)
    expect(first.x + last.x).toBeCloseTo(1400)
  })

  test('en un canvas alto, también queda cuadrada y centrada', () => {
    const layout = computeLayout(600, 900, 10, 20)
    const first = toCanvas(layout, { x: 0, y: 0 })
    const last = toCanvas(layout, { x: 9, y: 9 })
    expect(last.x - first.x).toBeCloseTo(last.y - first.y)
    expect(first.x).toBe(20)
    expect(last.x).toBe(580)
    expect(first.y + last.y).toBeCloseTo(900)
  })

  test('un canvas sin tamaño no da distancias negativas', () => {
    expect(computeLayout(0, 0, 10, 20).spacing).toBe(0)
  })
})
