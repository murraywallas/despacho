import type { StyleSpecification } from 'maplibre-gl'
import { describe, expect, test } from 'vitest'
import { FALLBACK_STYLE, loadNightStyle, NIGHT, toNightStyle } from '../../src/map/nightStyle'

// A few layers named like OpenFreeMap's dark style.
const base: StyleSpecification = {
  version: 8,
  sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'rgb(12,12,12)' } },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#111', 'fill-antialias': false } },
    { id: 'highway_major_casing', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#333', 'line-width': 2 } },
    { id: 'highway_major_inner', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#222' } },
    { id: 'place_suburb', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', paint: { 'text-color': '#666' } },
    { id: 'aeroway-area', type: 'fill', source: 'openmaptiles', 'source-layer': 'aeroway', paint: { 'fill-color': '#000' } },
  ],
}

const paintOf = (style: StyleSpecification, id: string) =>
  (style.layers.find((layer) => layer.id === id) as { paint?: Record<string, unknown> }).paint

describe('estilo nocturno del mapa', () => {
  const night = toNightStyle(base)

  test('pinta fondo, agua, calles y nombres con los azules de la noche', () => {
    expect(paintOf(night, 'background')).toEqual({ 'background-color': NIGHT.background })
    expect(paintOf(night, 'water')?.['fill-color']).toBe(NIGHT.water)
    expect(paintOf(night, 'highway_major_casing')?.['line-color']).toBe(NIGHT.majorStreetCasing)
    expect(paintOf(night, 'highway_major_inner')?.['line-color']).toBe(NIGHT.majorStreetInner)
    expect(paintOf(night, 'place_suburb')).toEqual({ 'text-color': NIGHT.label, 'text-halo-color': NIGHT.labelHalo })
  })

  test('conserva el resto de la pintura y las capas que no conoce', () => {
    expect(paintOf(night, 'water')?.['fill-antialias']).toBe(false)
    expect(paintOf(night, 'highway_major_casing')?.['line-width']).toBe(2)
    expect(paintOf(night, 'aeroway-area')).toEqual({ 'fill-color': '#000' })
    expect(night.sources).toBe(base.sources)
  })

  test('no cambia el estilo original', () => {
    expect(paintOf(base, 'background')).toEqual({ 'background-color': 'rgb(12,12,12)' })
  })
})

describe('carga del estilo', () => {
  test('baja el estilo de OpenFreeMap y lo recolorea', async () => {
    const fakeFetch = (async () => new Response(JSON.stringify(base))) as typeof fetch
    const { style, online } = await loadNightStyle(fakeFetch)
    expect(online).toBe(true)
    expect(paintOf(style, 'background')).toEqual({ 'background-color': NIGHT.background })
  })

  test('sin conexión usa un fondo liso y el juego sigue', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(await loadNightStyle(offline)).toEqual({ style: FALLBACK_STYLE, online: false })
    const notFound = (async () => new Response('', { status: 404 })) as typeof fetch
    expect((await loadNightStyle(notFound)).online).toBe(false)
  })
})
