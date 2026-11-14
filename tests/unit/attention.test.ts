import { describe, expect, test } from 'vitest'
import { markSeen, needsAttention, ridersFreed, updateFreeSince } from '../../src/game/attention'
import { radioBetween } from '../../src/game/radio'
import type { Rider } from '../../src/game/riders'

const HEAT = { start: 100, lossPerSec: 0.5, coldBelow: 40 }
const HIGHLIGHT_SEC = 6
const rider = (id: string, number: number, status: Rider['status']): Rider => ({ id, number, vehicle: 'bike', node: 0, status })

describe('aviso cuando un repartidor queda libre', () => {
  const before = [rider('k1', 1, 'toCustomer'), rider('k2', 2, 'idle'), rider('k3', 3, 'charging')]
  const after = [rider('k1', 1, 'idle'), rider('k2', 2, 'idle'), rider('k3', 3, 'idle')]

  test('detecta en un tick quién pasó a libre (y no a quien ya lo estaba)', () => {
    expect(ridersFreed(before, after).map((each) => each.id)).toEqual(['k1', 'k3'])
    expect(ridersFreed(after, after)).toEqual([])
  })

  test('la radio lo cuenta: una línea por repartidor', () => {
    const items = radioBetween({ orders: [], riders: before, nowSec: 10 }, { orders: [], riders: after, nowSec: 11 }, HEAT)
    expect(items).toEqual([
      { kind: 'riderFree', orderNumbers: [], riderNumber: 1, atSec: 11 },
      { kind: 'riderFree', orderNumbers: [], riderNumber: 3, atSec: 11 },
    ])
  })

  test('se destaca mientras haya pedidos esperando; sin pedidos, unos segundos', () => {
    const freeSince = updateFreeSince({}, before, after, 100)
    expect(freeSince).toEqual({ k1: 100, k3: 100 })
    expect(needsAttention(freeSince, 'k1', 100 + HIGHLIGHT_SEC - 1, 0, HIGHLIGHT_SEC)).toBe(true)
    expect(needsAttention(freeSince, 'k1', 100 + HIGHLIGHT_SEC, 0, HIGHLIGHT_SEC)).toBe(false)
    expect(needsAttention(freeSince, 'k1', 100 + 60, 2, HIGHLIGHT_SEC)).toBe(true)
    expect(needsAttention(freeSince, 'k2', 100, 2, HIGHLIGHT_SEC)).toBe(false)
  })

  test('deja de destacarse cuando se le asigna algo o el jugador lo elige', () => {
    const freeSince = updateFreeSince({}, before, after, 100)
    const busyAgain = [rider('k1', 1, 'toRestaurant'), rider('k2', 2, 'idle'), rider('k3', 3, 'idle')]
    expect(updateFreeSince(freeSince, after, busyAgain, 120)).toEqual({ k3: 100 })
    expect(markSeen(freeSince, 'k3')).toEqual({ k1: 100 })
    // Nothing changed: the same object, so nothing redraws.
    expect(updateFreeSince(freeSince, after, after, 130)).toBe(freeSince)
    expect(markSeen(freeSince, 'k2')).toBe(freeSince)
  })
})
