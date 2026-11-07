import { describe, expect, test } from 'vitest'
import {
  ATTRIBUTION,
  buildStreetGraph,
  distanceM,
  FLAG,
  flagsOf,
  STREET_KINDS,
  type OverpassAnswer,
  type StreetGraphFile,
} from '../../scripts/streets/convert.ts'

const BBOX: StreetGraphFile['bbox'] = [55.68, 12.53, 55.71, 12.57]

// A tiny piece of city: a main street (1-2-3), a one-way side street (3-4), a cycleway (1-5),
// a sidewalk (2-6, dropped), a private road (4-7, dropped) and a lonely street far away (8-9, dropped).
const answer: OverpassAnswer = {
  osm3s: { timestamp_osm_base: '2026-11-07T08:12:38Z' },
  elements: [
    { type: 'node', id: 1, lat: 55.69, lon: 12.55 },
    { type: 'node', id: 2, lat: 55.69, lon: 12.551 },
    { type: 'node', id: 3, lat: 55.69, lon: 12.552 },
    { type: 'node', id: 4, lat: 55.691, lon: 12.552 },
    { type: 'node', id: 5, lat: 55.689, lon: 12.55 },
    { type: 'node', id: 6, lat: 55.6895, lon: 12.551 },
    { type: 'node', id: 7, lat: 55.692, lon: 12.552 },
    { type: 'node', id: 8, lat: 55.7, lon: 12.56 },
    { type: 'node', id: 9, lat: 55.7, lon: 12.561 },
    { type: 'way', id: 100, nodes: [1, 2, 3], tags: { highway: 'secondary', 'cycleway:both': 'track' } },
    { type: 'way', id: 101, nodes: [3, 4], tags: { highway: 'residential', oneway: 'yes' } },
    { type: 'way', id: 102, nodes: [1, 5], tags: { highway: 'cycleway' } },
    { type: 'way', id: 103, nodes: [2, 6], tags: { highway: 'footway', footway: 'sidewalk' } },
    { type: 'way', id: 104, nodes: [4, 7], tags: { highway: 'service', access: 'private' } },
    { type: 'way', id: 105, nodes: [8, 9], tags: { highway: 'residential' } },
    { type: 'way', id: 106, nodes: [1, 2], tags: { building: 'yes' } },
  ],
}

describe('qué calles entran al juego', () => {
  test('una avenida con ciclovía: bici y auto, con ciclovía', () => {
    expect(flagsOf({ highway: 'secondary', 'cycleway:right': 'track' })).toEqual({
      kind: 'major',
      flags: FLAG.bike | FLAG.car | FLAG.cycleTrack,
    })
  })

  test('una ciclovía: solo bici', () => {
    expect(flagsOf({ highway: 'cycleway' })).toEqual({ kind: 'cycleway', flags: FLAG.bike | FLAG.cycleTrack })
  })

  test('mano única: también para la bici, salvo que esté exceptuada', () => {
    expect(flagsOf({ highway: 'residential', oneway: 'yes' })?.flags).toBe(
      FLAG.bike | FLAG.car | FLAG.carOneway | FLAG.bikeOneway,
    )
    expect(flagsOf({ highway: 'residential', oneway: 'yes', 'oneway:bicycle': 'no' })?.flags).toBe(
      FLAG.bike | FLAG.car | FLAG.carOneway,
    )
  })

  test('peatonal: solo si permite bicis', () => {
    expect(flagsOf({ highway: 'pedestrian' })).toBeUndefined()
    expect(flagsOf({ highway: 'pedestrian', bicycle: 'yes' })).toEqual({ kind: 'foot', flags: FLAG.bike })
  })

  test('fuera: veredas, privadas, estacionamientos, escaleras y no calles', () => {
    expect(flagsOf({ highway: 'footway', footway: 'sidewalk' })).toBeUndefined()
    expect(flagsOf({ highway: 'residential', access: 'private' })).toBeUndefined()
    expect(flagsOf({ highway: 'service', service: 'parking_aisle' })).toBeUndefined()
    expect(flagsOf({ highway: 'steps' })).toBeUndefined()
    expect(flagsOf({ building: 'yes' })).toBeUndefined()
  })
})

describe('grafo de calles', () => {
  const graph = buildStreetGraph(answer, BBOX)

  test('lleva la atribución de OpenStreetMap, la fecha de los datos y el área', () => {
    expect(graph.attribution).toBe(ATTRIBUTION)
    expect(graph.osmTimestamp).toBe('2026-11-07T08:12:38Z')
    expect(graph.bbox).toEqual(BBOX)
    expect(graph.kinds).toEqual(STREET_KINDS)
  })

  test('se queda con la parte conectada y descarta veredas, privadas y calles sueltas', () => {
    // Nodes 1, 2, 3, 4 and 5; edges 1-2, 2-3, 3-4 and 1-5.
    expect(graph.nodes).toHaveLength(5)
    expect(graph.edges).toHaveLength(4)
    expect(graph.nodes).not.toContainEqual([12.56, 55.7])
  })

  test('cada tramo tiene su largo real en metros', () => {
    const [a, b, length] = graph.edges[0]
    expect(length).toBeCloseTo(distanceM(graph.nodes[a], graph.nodes[b]), 0)
    // 0,001° de longitud a la latitud de Copenhague son unos 63 m.
    expect(length).toBeGreaterThan(60)
    expect(length).toBeLessThan(66)
  })

  test('guarda tipo y permisos de cada tramo', () => {
    const kinds = graph.edges.map(([, , , kind]) => graph.kinds[kind])
    expect(kinds).toEqual(['major', 'major', 'minor', 'cycleway'])
    const oneway = graph.edges[2][4]
    expect(oneway & FLAG.carOneway).toBeTruthy()
  })

  test('mano única al revés (-1): el tramo queda en el sentido en que se puede ir', () => {
    const reversed = buildStreetGraph(
      {
        elements: [
          { type: 'node', id: 1, lat: 55.69, lon: 12.55 },
          { type: 'node', id: 2, lat: 55.69, lon: 12.551 },
          { type: 'way', id: 1, nodes: [1, 2], tags: { highway: 'residential', oneway: '-1' } },
        ],
      },
      BBOX,
    )
    const [from, to] = reversed.edges[0]
    expect(reversed.nodes[from]).toEqual([12.551, 55.69])
    expect(reversed.nodes[to]).toEqual([12.55, 55.69])
  })

  test('sin calles usables avisa', () => {
    expect(() => buildStreetGraph({ elements: [] }, BBOX)).toThrow('no trae calles usables')
  })
})
