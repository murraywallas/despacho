import { AttributionControl, MapLibreMap, Marker, NavigationControl, type GeoJSONSource } from '../map/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CityMap } from '../game/cityMap'
import type { Order } from '../game/orders'
import type { Rider } from '../game/riders'
import { t } from '../i18n'
import '../map/mapMarkers.css'
import { areaBounds, buildMarkers, routesGeoJson, routesKey, type MapMarker } from '../map/mapData'
import { FALLBACK_STYLE, loadNightStyle } from '../map/nightStyle'

interface MapViewProps {
  map: CityMap
  orders: readonly Order[]
  riders: readonly Rider[]
  selectedOrderId: string | null
}

const ROUTES = 'routes'
/** Space around the area when the map opens, in CSS pixels. */
const FIT_PADDING = 16
/** How far past the area the player can drag the map, as a share of its size. */
const DRAG_MARGIN = 0.25
// The game's own streets come from OpenStreetMap too, so the credit stays even without the base map
// (the base map adds its own: OpenFreeMap, OpenMapTiles).
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'

function markerText(marker: MapMarker): string {
  if (marker.kind === 'restaurant') return t('orders.restaurant', { label: marker.label })
  if (marker.kind === 'customer') return t('map.customer', { number: marker.label })
  return t('riders.name', { number: marker.label })
}

function createMarkerElement(marker: MapMarker): HTMLElement {
  const element = document.createElement('div')
  element.className = `map-marker map-marker--${marker.kind}`
  element.dataset.testid = `${marker.kind}-marker`
  element.setAttribute('role', 'img')
  const label = document.createElement('span')
  label.className = 'map-marker__label'
  element.append(label)
  return element
}

function updateMarkerElement(element: HTMLElement, marker: MapMarker) {
  element.classList.toggle('map-marker--selected', marker.selected)
  element.setAttribute('aria-label', markerText(marker))
  const label = element.firstElementChild
  if (label && label.textContent !== marker.label) label.textContent = marker.label
}

function addGameLayers(instance: MapLibreMap) {
  if (instance.getSource(ROUTES)) return
  instance.addSource(ROUTES, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  instance.addLayer({
    id: ROUTES,
    type: 'line',
    source: ROUTES,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#4fb3ff', 'line-width': 3, 'line-dasharray': [1.5, 1.5] },
  })
}

/**
 * The map of the area: MapLibre with the night style, the trips in progress as lines and everything else as
 * markers. Starts fitted to the area and doesn't let the player drag it far away.
 */
export function MapView({ map, orders, riders, selectedOrderId }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef(new Map<string, Marker>())
  // Bumped every time a style finishes loading: the game layers have to be added again on top of it.
  const [styleVersion, setStyleVersion] = useState(0)
  const streets = map.network.streets

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    const markers = markersRef.current
    const instance = new MapLibreMap({
      container,
      style: FALLBACK_STYLE,
      bounds: areaBounds(streets),
      fitBoundsOptions: { padding: FIT_PADDING },
      maxBounds: areaBounds(streets, DRAG_MARGIN),
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    instance.touchZoomRotate.disableRotation()
    instance.addControl(new AttributionControl({ compact: false, customAttribution: ATTRIBUTION }))
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    instance.on('style.load', () => {
      addGameLayers(instance)
      setStyleVersion((version) => version + 1)
    })
    instanceRef.current = instance
    void loadNightStyle().then(({ style, online }) => {
      if (!cancelled && online) instance.setStyle(style)
    })
    return () => {
      cancelled = true
      for (const marker of markers.values()) marker.remove()
      markers.clear()
      instance.remove()
      instanceRef.current = null
    }
  }, [streets])

  const markers = useMemo(
    () => buildMarkers(map, orders, riders, selectedOrderId),
    [map, orders, riders, selectedOrderId],
  )
  // Riders move every frame, but their routes only change when they pass a crossing: the key says when,
  // so the map gets new route data a few times per trip instead of every frame.
  const routeKey = routesKey(riders)
  const routes = useMemo(() => routesGeoJson(map, riders), [map, routeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance) return
    const current = markersRef.current
    const keep = new Set<string>()
    for (const marker of markers) {
      keep.add(marker.key)
      let placed = current.get(marker.key)
      if (!placed) {
        placed = new Marker({ element: createMarkerElement(marker) }).setLngLat([...marker.lngLat]).addTo(instance)
        current.set(marker.key, placed)
      } else {
        placed.setLngLat([...marker.lngLat])
      }
      updateMarkerElement(placed.getElement(), marker)
    }
    for (const [key, placed] of current) {
      if (!keep.has(key)) {
        placed.remove()
        current.delete(key)
      }
    }
  }, [markers])

  useEffect(() => {
    const source = instanceRef.current?.getSource<GeoJSONSource>(ROUTES)
    source?.setData(routes)
  }, [routes, styleVersion])

  const customers = markers.filter((marker) => marker.kind === 'customer').length
  return (
    <div
      ref={containerRef}
      className="map-view"
      role="region"
      data-testid="map"
      aria-label={t('map.description', {
        restaurants: map.restaurants.length,
        riders: riders.length,
        customers,
      })}
    />
  )
}
