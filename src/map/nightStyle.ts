/**
 * The map's look: a dispatch room at night. It starts from OpenFreeMap's dark style (free, no key) and
 * recolors it in blues: dark navy land, blue water, streets a little lighter, quiet labels.
 */
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

export const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'

/** Map colors. They are art, not game numbers, so they live here and not in the balance sheet. */
export interface MapPalette {
  readonly background: string
  readonly residential: string
  readonly park: string
  readonly water: string
  readonly building: string
  readonly buildingOutline: string
  readonly minorStreet: string
  readonly majorStreetCasing: string
  readonly majorStreetInner: string
  readonly path: string
  readonly railway: string
  readonly label: string
  readonly labelHalo: string
  readonly waterLabel: string
}

export const NIGHT: MapPalette = {
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
}

/** Noon (lunch): the same dark dispatch room, in a lighter steel teal. Markers keep their contrast. */
export const NOON: MapPalette = {
  background: '#1c3a4d',
  residential: '#21455a',
  park: '#1f4a3e',
  water: '#2a6c96',
  building: '#244559',
  buildingOutline: '#2e5369',
  minorStreet: '#31566e',
  majorStreetCasing: '#4b7895',
  majorStreetInner: '#2f566f',
  path: '#2d5169',
  railway: '#284a5f',
  label: '#a9c4d6',
  labelHalo: '#1c3a4d',
  waterLabel: '#8cc0e0',
}

/** Dusk (dinner): violet streets with a warm edge on the avenues. */
export const DUSK: MapPalette = {
  background: '#23183a',
  residential: '#2b1d45',
  park: '#24263f',
  water: '#3a2f6b',
  building: '#2e2048',
  buildingOutline: '#3c2a59',
  minorStreet: '#45305f',
  majorStreetCasing: '#7a4a6e',
  majorStreetInner: '#4c3465',
  path: '#40305b',
  railway: '#392851',
  label: '#c9a0c0',
  labelHalo: '#23183a',
  waterLabel: '#a693d6',
}

/** The map's light for each level light of the Niveles tab. */
export type MapLight = 'noon' | 'dusk' | 'night'
export const LIGHTS: Record<MapLight, MapPalette> = { noon: NOON, dusk: DUSK, night: NIGHT }

type Paint = Record<string, unknown>

/** New paint for a layer of the base style, by its id. Layers not listed keep their own colors. */
function nightPaint(layer: LayerSpecification, palette: MapPalette): Paint | undefined {
  const { id } = layer
  if (id === 'background') return { 'background-color': palette.background }
  if (id === 'water') return { 'fill-color': palette.water }
  if (id === 'waterway') return { 'line-color': palette.water }
  if (id === 'landuse_residential') return { 'fill-color': palette.residential }
  if (id === 'landuse_park' || id === 'landcover_wood') return { 'fill-color': palette.park }
  if (id === 'building') return { 'fill-color': palette.building, 'fill-outline-color': palette.buildingOutline }
  if (id === 'highway_minor') return { 'line-color': palette.minorStreet }
  if (id === 'highway_path') return { 'line-color': palette.path }
  if (id.endsWith('_casing')) return { 'line-color': palette.majorStreetCasing }
  if (id.startsWith('highway_') && id.endsWith('_inner')) return { 'line-color': palette.majorStreetInner }
  if (id.startsWith('railway')) return { 'line-color': id.endsWith('dashline') ? palette.background : palette.railway }
  if (id === 'water_name') return { 'text-color': palette.waterLabel, 'text-halo-color': palette.labelHalo }
  if (layer.type === 'symbol') return { 'text-color': palette.label, 'text-halo-color': palette.labelHalo }
  return undefined
}

/** The base style with the night colors. Returns a new style; the base is not changed. */
export function toNightStyle(base: StyleSpecification, palette: MapPalette = NIGHT): StyleSpecification {
  return {
    ...base,
    layers: base.layers.map((layer) => {
      const paint = nightPaint(layer, palette)
      if (!paint) return layer
      return { ...layer, paint: { ...(layer as { paint?: Paint }).paint, ...paint } } as LayerSpecification
    }),
  }
}

/** Shown when the base style can't be downloaded: plain background, so the game still works. */
export function fallbackStyle(palette: MapPalette = NIGHT): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': palette.background } }],
  }
}

export const FALLBACK_STYLE: StyleSpecification = fallbackStyle(NIGHT)

/** Downloads the base style and recolors it. Never fails: without a connection, the fallback style. */
export async function loadNightStyle(
  fetchStyle: typeof fetch = fetch,
  palette: MapPalette = NIGHT,
): Promise<{ style: StyleSpecification; online: boolean }> {
  try {
    const response = await fetchStyle(BASE_STYLE_URL)
    if (!response.ok) return { style: fallbackStyle(palette), online: false }
    return { style: toNightStyle((await response.json()) as StyleSpecification, palette), online: true }
  } catch {
    return { style: fallbackStyle(palette), online: false }
  }
}
