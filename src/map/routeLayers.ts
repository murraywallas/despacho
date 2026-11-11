/**
 * How the routes look on the map: trips in progress glow (light blue riding to the restaurant, orange carrying
 * the food), planned legs are dashed, and the selected order's preview is a thin dashed white line.
 */
import type { LineLayerSpecification } from 'maplibre-gl'
import type { MapLibreMap } from './maplibre'

export const ROUTE_COLORS = {
  toRestaurant: '#4fd1ff',
  toCustomer: '#ffb347',
  preview: '#e6f0ff',
} as const

export const ROUTES_SOURCE = 'routes'
export const PREVIEW_SOURCE = 'preview'
/** The outline of the neighborhood: where the game's streets end. */
export const AREA_SOURCE = 'area'
const AREA_COLOR = '#d8ff54'

const legIs = (...legs: string[]): LineLayerSpecification['filter'] => ['in', ['get', 'leg'], ['literal', legs]]
const legColor: LineLayerSpecification['paint'] = {
  'line-color': ['match', ['get', 'leg'], 'toRestaurant', ROUTE_COLORS.toRestaurant, ROUTE_COLORS.toCustomer],
}
const ROUND = { 'line-cap': 'round', 'line-join': 'round' } as const

/** Layers from bottom to top. */
const LAYERS: LineLayerSpecification[] = [
  {
    id: 'area-limit',
    type: 'line',
    source: AREA_SOURCE,
    layout: ROUND,
    paint: { 'line-color': AREA_COLOR, 'line-width': 1.5, 'line-opacity': 0.35, 'line-dasharray': [4, 3] },
  },
  {
    id: 'preview-line',
    type: 'line',
    source: PREVIEW_SOURCE,
    filter: legIs('preview'),
    layout: ROUND,
    paint: { 'line-color': ROUTE_COLORS.preview, 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [1, 2] },
  },
  {
    id: 'preview-planned',
    type: 'line',
    source: PREVIEW_SOURCE,
    filter: legIs('planned'),
    layout: ROUND,
    paint: { 'line-color': ROUTE_COLORS.toCustomer, 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [1, 2] },
  },
  {
    id: 'routes-planned',
    type: 'line',
    source: ROUTES_SOURCE,
    filter: legIs('planned'),
    layout: ROUND,
    paint: { 'line-color': ROUTE_COLORS.toCustomer, 'line-width': 2, 'line-opacity': 0.55, 'line-dasharray': [2, 2] },
  },
  {
    id: 'routes-glow',
    type: 'line',
    source: ROUTES_SOURCE,
    filter: legIs('toRestaurant', 'toCustomer'),
    layout: ROUND,
    paint: { ...legColor, 'line-width': 12, 'line-blur': 8, 'line-opacity': 0.45 },
  },
  {
    id: 'routes-core',
    type: 'line',
    source: ROUTES_SOURCE,
    filter: legIs('toRestaurant', 'toCustomer'),
    layout: ROUND,
    paint: { ...legColor, 'line-width': 3.5 },
  },
  {
    id: 'routes-center',
    type: 'line',
    source: ROUTES_SOURCE,
    filter: legIs('toRestaurant', 'toCustomer'),
    layout: ROUND,
    paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.7 },
  },
]

/** Adds the route sources and layers on top of the base map (again after every style change). */
export function addRouteLayers(map: MapLibreMap): void {
  for (const id of [AREA_SOURCE, PREVIEW_SOURCE, ROUTES_SOURCE]) {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  }
  for (const layer of LAYERS) if (!map.getLayer(layer.id)) map.addLayer(layer)
}
