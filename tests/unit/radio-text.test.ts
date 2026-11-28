import { describe, expect, test } from 'vitest'
import type { RadioItem } from '../../src/game/radio'
import { radioText } from '../../src/ui/radioText'

const delivered = (orderNumbers: number[], mood: RadioItem['mood'] = 'good'): RadioItem => ({ kind: 'delivered', orderNumbers, mood, atSec: 100 })
const customerOf = (number: number) => (number === 4 ? 'Mette Hansen (Jagtvej 34)' : undefined)

describe('la radio al entregar', () => {
  test('una entrega dice a quién y dónde', () => {
    expect(radioText(delivered([4]), [], 'norrebro', customerOf)).toBe('#4 · entregado a Mette Hansen (Jagtvej 34), a tiempo')
    expect(radioText(delivered([4], 'late'), [], 'norrebro', customerOf)).toBe('#4 · entregado a Mette Hansen (Jagtvej 34), tarde')
    expect(radioText(delivered([4], 'cold'), [], 'norrebro', customerOf)).toBe('#4 · entregado a Mette Hansen (Jagtvej 34), frío')
  })

  test('varias juntas, o sin cliente conocido, como antes', () => {
    expect(radioText(delivered([4, 5]), [], 'norrebro', customerOf)).toBe('#4, #5 · entregado a tiempo')
    expect(radioText(delivered([7]), [], 'norrebro', customerOf)).toBe('#7 · entregado a tiempo')
  })
})
