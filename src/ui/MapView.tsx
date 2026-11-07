import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CityMap } from '../game/cityMap'
import type { Order } from '../game/orders'
import { t } from '../i18n'
import '../map/mapMarkers.css'
import { areaBounds, buildMarkers, previewGeoJson, routesGeoJson, routesKey, type MapMarker } from '../map/mapData'
import { AttributionControl, MapLibreMap, Marker, NavigationControl, type GeoJSONSource } from '../map/maplibre'
import { FALLBACK_STYLE, loadNightStyle } from '../map/nightStyle'
import { addRouteLayers, PREVIEW_SOURCE, ROUTES_SOURCE } from '../map/routeLayers'
import type { Rider } from '../game/riders'
import { MapMarkerContent } from './MapMarkerContent'
import { restaurantName } from './restaurantName'

interface MapViewProps {
  map: CityMap
  orders: readonly Order[]
  riders: readonly Rider[]
  selectedOrderId: string | null
}

/** Space around the area when the map opens, in CSS pixels. */
const FIT_PADDING = 24
/** How far past the area the player can drag the map, as a share of its size. */
const DRAG_MARGIN = 0.25
// The game's own streets come from OpenStreetMap too, so the credit stays even without the base map
// (the base map adds its own: OpenFreeMap, OpenMapTiles).
const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'

function markerText(map: CityMap, marker: MapMarker): string {
  if (marker.kind === 'restaurant') {
    const restaurant = map.restaurants.find((candidate) => candidate.label === marker.label)
    return restaurant ? restaurantName(restaurant) : t('orders.restaurant', { label: marker.label })
  }
  if (marker.kind === 'customer') return t('map.customer', { number: marker.label })
  return t('riders.name', { number: marker.label })
}

function createMarkerElement(marker: MapMarker): HTMLElement {
  const element = document.createElement('div')
  element.className = `map-marker map-marker--${marker.kind}`
  element.dataset.testid = `${marker.kind}-marker`
  element.setAttribute('role', 'img')
  return element
}

/**
 * The map of the area: MapLibre with the night style, glowing routes for the trips in progress and cards for
 * restaurants and riders. Starts fitted to the area and doesn't let the player drag it far away.
 */
export function MapView({ map, orders, riders, selectedOrderId }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<MapLibreMap | null>(null)
  const placedRef = useRef(new Map<string, Marker>())
  // Marker elements React draws into (with portals). Changes only when markers come or go.
  const [elements, setElements] = useState<ReadonlyMap<string, HTMLElement>>(new Map())
  // Bumped every time a style finishes loading: the route layers have to be added again on top of it.
  const [styleVersion, setStyleVersion] = useState(0)
  const streets = map.network.streets

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    const placed = placedRef.current
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
      addRouteLayers(instance)
      setStyleVersion((version) => version + 1)
    })
    instanceRef.current = instance
    void loadNightStyle().then(({ style, online }) => {
      if (!cancelled && online) instance.setStyle(style)
    })
    return () => {
      cancelled = true
      for (const marker of placed.values()) marker.remove()
      placed.clear()
      setElements(new Map())
      instance.remove()
      instanceRef.current = null
    }
  }, [streets])

  const markers = useMemo(
    () => buildMarkers(map, orders, riders, selectedOrderId),
    [map, orders, riders, selectedOrderId],
  )

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance) return
    const placed = placedRef.current
    const keep = new Set<string>()
    let changed = false
    for (const marker of markers) {
      keep.add(marker.key)
      let current = placed.get(marker.key)
      if (!current) {
        const anchor = marker.kind === 'customer' ? 'center' : 'bottom'
        current = new Marker({ element: createMarkerElement(marker), anchor }).setLngLat([...marker.lngLat]).addTo(instance)
        placed.set(marker.key, current)
        changed = true
      } else {
        current.setLngLat([...marker.lngLat])
      }
      const element = current.getElement()
      element.classList.toggle('map-marker--selected', marker.selected)
      element.classList.toggle('map-marker--free', marker.rider?.status === 'idle')
      element.setAttribute('aria-label', markerText(map, marker))
    }
    for (const [key, current] of placed) {
      if (!keep.has(key)) {
        current.remove()
        placed.delete(key)
        changed = true
      }
    }
    if (changed) setElements(new Map([...placed].map(([key, current]) => [key, current.getElement()])))
  }, [map, markers])

  // Riders move every frame, but their routes only change when they pass a crossing: the key says when,
  // so the map gets new route data a few times per trip instead of every frame.
  const routeKey = routesKey(riders)
  const routes = useMemo(() => routesGeoJson(map, riders), [map, routeKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const idleKey = riders.map((rider) => (rider.status === 'idle' ? rider.node : '-')).join(',')
  const preview = useMemo(
    () => previewGeoJson(map, riders, selectedOrder),
    [map, selectedOrder, idleKey], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    instanceRef.current?.getSource<GeoJSONSource>(ROUTES_SOURCE)?.setData(routes)
  }, [routes, styleVersion])

  useEffect(() => {
    instanceRef.current?.getSource<GeoJSONSource>(PREVIEW_SOURCE)?.setData(preview)
  }, [preview, styleVersion])

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
    >
      {markers.map((marker) => {
        const element = elements.get(marker.key)
        return element ? createPortal(<MapMarkerContent marker={marker} />, element, marker.key) : null
      })}
    </div>
  )
}
