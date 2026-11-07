/**
 * The map's look: a dispatch room at night. It starts from OpenFreeMap's dark style (free, no key) and
 * recolors it in blues: dark navy land, blue water, streets a little lighter, quiet labels.
 */
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

export const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'

/** Map colors. They are art, not game numbers, so they live here and not in the balance sheet. */
export const NIGHT = {
  background: '#0e1a33',
  residential: '#112040',
  park: '#10283d',
  water: '#1a3d66',
  building: '#13223f',
  buildingOutline: '#1b2d50',
  minorStreet: '#20365e',
  majorStreetCasing: '#2d4a7c',
  majorStreetInner: '#1d3359',
  path: '#1c3156',
  railway: '#1a2c4e',
  label: '#7189b8',
  labelHalo: '#0e1a33',
  waterLabel: '#5b84b8',
} as const

type Paint = Record<string, unknown>

/** New paint for a layer of the base style, by its id. Layers not listed keep their own colors. */
function nightPaint(layer: LayerSpecification): Paint | undefined {
  const { id } = layer
  if (id === 'background') return { 'background-color': NIGHT.background }
  if (id === 'water') return { 'fill-color': NIGHT.water }
  if (id === 'waterway') return { 'line-color': NIGHT.water }
  if (id === 'landuse_residential') return { 'fill-color': NIGHT.residential }
  if (id === 'landuse_park' || id === 'landcover_wood') return { 'fill-color': NIGHT.park }
  if (id === 'building') return { 'fill-color': NIGHT.building, 'fill-outline-color': NIGHT.buildingOutline }
  if (id === 'highway_minor') return { 'line-color': NIGHT.minorStreet }
  if (id === 'highway_path') return { 'line-color': NIGHT.path }
  if (id.endsWith('_casing')) return { 'line-color': NIGHT.majorStreetCasing }
  if (id.startsWith('highway_') && id.endsWith('_inner')) return { 'line-color': NIGHT.majorStreetInner }
  if (id.startsWith('railway')) return { 'line-color': id.endsWith('dashline') ? NIGHT.background : NIGHT.railway }
  if (id === 'water_name') return { 'text-color': NIGHT.waterLabel, 'text-halo-color': NIGHT.labelHalo }
  if (layer.type === 'symbol') return { 'text-color': NIGHT.label, 'text-halo-color': NIGHT.labelHalo }
  return undefined
}

/** The base style with the night colors. Returns a new style; the base is not changed. */
export function toNightStyle(base: StyleSpecification): StyleSpecification {
  return {
    ...base,
    layers: base.layers.map((layer) => {
      const paint = nightPaint(layer)
      if (!paint) return layer
      return { ...layer, paint: { ...(layer as { paint?: Paint }).paint, ...paint } } as LayerSpecification
    }),
  }
}

/** Shown when the base style can't be downloaded: plain night background, so the game still works. */
export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': NIGHT.background } }],
}

/** Downloads the base style and recolors it. Never fails: without a connection, the fallback style. */
export async function loadNightStyle(fetchStyle: typeof fetch = fetch): Promise<{ style: StyleSpecification; online: boolean }> {
  try {
    const response = await fetchStyle(BASE_STYLE_URL)
    if (!response.ok) return { style: FALLBACK_STYLE, online: false }
    return { style: toNightStyle((await response.json()) as StyleSpecification), online: true }
  } catch {
    return { style: FALLBACK_STYLE, online: false }
  }
}
