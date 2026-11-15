import { describe, expect, test } from 'vitest'
import { revealDelta, spreadApart, type Rect } from '../../src/map/screenLayout'

const free: Rect = { left: 250, top: 120, right: 1170, bottom: 820 }
const rect = (left: number, top: number, size = 30): Rect => ({ left, top, right: left + size, bottom: top + size })

describe('mover la cámara solo si lo elegido está tapado', () => {
  test('si todo está a la vista, no se mueve', () => {
    expect(revealDelta([rect(400, 300), rect(900, 600)], free)).toEqual({ dx: 0, dy: 0 })
    expect(revealDelta([], free)).toEqual({ dx: 0, dy: 0 })
  })

  test('debajo de la barra de arriba: baja lo justo', () => {
    expect(revealDelta([rect(400, 80)], free)).toEqual({ dx: 0, dy: 40 })
  })

  test('debajo de un panel: se corre hacia el centro, contando todo lo elegido', () => {
    expect(revealDelta([rect(200, 300), rect(500, 300)], free)).toEqual({ dx: 50, dy: 0 })
    expect(revealDelta([rect(1160, 830)], free)).toEqual({ dx: -20, dy: -40 })
  })

  test('si no entra todo, gana el primero (el restaurante)', () => {
    expect(revealDelta([rect(100, 300), rect(1300, 300)], free)).toEqual({ dx: 150, dy: 0 })
  })
})

describe('pines que se pisan', () => {
  const pin = (key: string, x: number, y: number) => ({ key, x, y, width: 38, height: 28 })

  test('dos cartas encimadas se separan hacia los costados, la mitad cada una', () => {
    const offsets = spreadApart([pin('B', 563, 730), pin('D', 542, 721)], 4)
    // Need 42 px between their middles; they are 21 apart: 10.5 each.
    expect(offsets.get('D')).toBeCloseTo(-10.5)
    expect(offsets.get('B')).toBeCloseTo(10.5)
  })

  test('las que no se tocan no se mueven', () => {
    expect(spreadApart([pin('A', 100, 100), pin('C', 300, 100), pin('E', 100, 200)], 4).size).toBe(0)
  })
})
