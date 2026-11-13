import { describe, expect, test } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import { levelIds, levels } from '../../src/game/balance'
import type { Order } from '../../src/game/orders'
import { rankByDelivery, suggestRider } from '../../src/game/stops'
import { DUSK, fallbackStyle, LIGHTS, NIGHT, NOON, toNightStyle } from '../../src/map/nightStyle'
import { mapLightOf } from '../../src/ui/levelText'
import { nodeAt, smallCity } from './smallCity'

describe('la luz de Copenhague', () => {
  test('cada barrio tiene mediodía, atardecer y noche, y la luz sale de la pestaña Niveles', () => {
    expect(levelIds.map((id) => mapLightOf(id))).toEqual(['noon', 'dusk', 'night', 'noon', 'dusk', 'night', 'noon', 'dusk', 'night'])
    for (const id of levelIds) expect(mapLightOf(id)).toBe(levels[id].light)
    expect(mapLightOf(null)).toBe('night')
  })

  test('mediodía, atardecer y noche pintan el mapa con colores distintos', () => {
    const base: StyleSpecification = {
      version: 8,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#000' } }],
    }
    const backgrounds = [NOON, DUSK, NIGHT].map(
      (palette) => (toNightStyle(base, palette).layers[0] as unknown as { paint: Record<string, string> }).paint['background-color'],
    )
    expect(new Set(backgrounds).size).toBe(3)
    expect(fallbackStyle(LIGHTS.dusk).layers[0]).toMatchObject({ paint: { 'background-color': DUSK.background } })
  })
})

describe('sugerencia en un pedido urgente', () => {
  test('propone el primero del ranking por entrega', () => {
    const map = smallCity([nodeAt(3, 0)])
    const riders = [
      { id: 'k1', number: 1, vehicle: 'bike', node: nodeAt(0, 4), status: 'idle' as const },
      { id: 'k2', number: 2, vehicle: 'bike', node: nodeAt(3, 1), status: 'idle' as const },
    ]
    const order: Order = {
      id: 'o1',
      number: 1,
      restaurantId: 'r1',
      customer: nodeAt(0, 0),
      createdAtSec: 0,
      readyAtSec: 10,
      deadlineAtSec: 100,
      status: 'pending',
    }
    const speeds = { bike: 5 }
    expect(suggestRider(map, riders, order, speeds, 0)?.rider.number).toBe(rankByDelivery(map, riders, [order], speeds, 0)[0].rider.number)
    expect(suggestRider(map, riders, order, speeds, 0)?.rider.number).toBe(2)
    expect(suggestRider(map, riders.map((rider) => ({ ...rider, status: 'toCustomer' as const })), order, speeds, 0)).toBeUndefined()
  })
})
