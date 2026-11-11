import { describe, expect, test } from 'vitest'
import { levels } from '../../src/game/balance'
import { neighborhoodOf } from '../../src/game/levels'
import { bikeNetworkOf, STREETS, streetsOf } from '../../src/game/neighborhoods'
import { cycleTrackMeters, findRoute, nearestNode } from '../../src/game/routing'
import { FLAG, type LonLat } from '../../src/game/streetGraph'

const AREAS = ['norrebro', 'vesterbro', 'frederiksberg'] as const

/** Nodes reachable from the first one by bike or on foot, ignoring one-way streets. */
function reachable(id: string): number {
  const streets = streetsOf(id)
  const neighbors: number[][] = streets.nodes.map(() => [])
  for (const [from, to, , , flags] of streets.edges as unknown as [number, number, number, number, number][]) {
    if (flags & (FLAG.bike | FLAG.foot)) {
      neighbors[from].push(to)
      neighbors[to].push(from)
    }
  }
  const seen = new Set([0])
  const queue = [0]
  for (let i = 0; i < queue.length; i++) {
    for (const next of neighbors[queue[i]]) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen.size
}

describe('calles de los barrios de la demo', () => {
  test.each(AREAS)('%s: con atribución de OpenStreetMap y una red de bici conexa', (id) => {
    const streets = streetsOf(id)
    expect(streets.attribution).toContain('OpenStreetMap')
    expect(streets.nodes.length).toBeGreaterThan(1000)
    expect(reachable(id)).toBe(streets.nodes.length)
  })

  /** A bike ride from the west edge to the east edge of the area, at mid height. */
  function crossByBike(id: string) {
    const [south, west, north, east] = streetsOf(id).bbox
    const middle = (south + north) / 2
    const width = east - west
    const network = bikeNetworkOf(id)
    const from = nearestNode(network, [west + width * 0.1, middle] as LonLat)
    const to = nearestNode(network, [east - width * 0.1, middle] as LonLat)
    const route = findRoute(network, from, to)
    expect(route).toBeDefined()
    return { route: route!, network }
  }

  test.each(['vesterbro', 'frederiksberg'])('%s se cruza en bici, buena parte por ciclovías', (id) => {
    const { route, network } = crossByBike(id)
    expect(route.lengthM).toBeGreaterThan(1000)
    expect(cycleTrackMeters(network, route.nodes)).toBeGreaterThan(route.lengthM * 0.2)
  })

  test('cada barrio de la pestaña Barrios con niveles tiene sus calles', () => {
    for (const id of Object.keys(levels)) expect(STREETS[neighborhoodOf(id)]).toBeDefined()
    expect(neighborhoodOf(null)).toBe('norrebro')
  })
})
