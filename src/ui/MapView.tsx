import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { prototype } from '../game/balance'
import type { CityMap } from '../game/cityMap'
import { restaurantOf } from '../game/dispatch'
import { urgencyOf, type Order } from '../game/orders'
import type { Rider } from '../game/riders'
import { t } from '../i18n'
import '../map/mapMarkers.css'
import { areaBounds, areaOutline, buildMarkers, previewGeoJson, routesGeoJson, routesKey, type MapMarker } from '../map/mapData'
import { AttributionControl, MapLibreMap, NavigationControl, Popup, type GeoJSONSource, type PositionAnchor } from '../map/maplibre'
import { fallbackStyle, LIGHTS, loadNightStyle } from '../map/nightStyle'
import { mapLightOf } from './levelText'
import { panelInsets } from './panelInsets'
import { useDeliveryFx } from './useDeliveryFx'
import { addRouteLayers, AREA_SOURCE, PREVIEW_SOURCE, ROUTES_SOURCE } from '../map/routeLayers'
import { usePointerStore } from '../store/pointerStore'
import { selectedOrderIds, useShiftStore } from '../store/shiftStore'
import { MapMarkerContent } from './MapMarkerContent'
import { RestaurantPopup } from './RestaurantPopup'
import { restaurantName } from './restaurantName'
import { useMapMarkers, type MarkerAction } from './useMapMarkers'

interface MapViewProps {
  map: CityMap
  orders: readonly Order[]
  riders: readonly Rider[]
  selectedOrderId: string | null
}

/** Space around the area when the map opens, beyond the floating panels, in CSS pixels. */
const FIT_PADDING = 24
/**
 * How far past the area the player can drag the map, as a share of its size. The map runs under the panels,
 * so it needs room to center the area in the part of the screen between them.
 */
const DRAG_MARGIN = 0.75
/** Gap between the popup and the restaurant card (the card stands above its spot), in CSS pixels. */
const POPUP_OFFSETS: Record<PositionAnchor, [number, number]> = {
  center: [0, -18],
  bottom: [0, -40],
  'bottom-left': [8, -40],
  'bottom-right': [-8, -40],
  top: [0, 6],
  'top-left': [8, 6],
  'top-right': [-8, 6],
  left: [18, -18],
  right: [-18, -18],
}
// The game's own streets come from OpenStreetMap too, so the credit stays even without the base map
// (the base map adds its own: OpenFreeMap, OpenMapTiles).
const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'

/**
 * The map of the area, where dispatching happens: restaurants with orders waiting show a "!", a tap opens their
 * card; riders are tapped to pick them. Night style, glowing routes, fitted to the area.
 */
export function MapView({ map, orders, riders, selectedOrderId }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<MapLibreMap | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const [ready, setReady] = useState(false)
  // Bumped every time a style finishes loading: the route layers have to be added again on top of it.
  const [styleVersion, setStyleVersion] = useState(0)
  const [openRestaurantId, setOpenRestaurantId] = useState<string | null>(null)
  const selectedRiderId = useShiftStore((state) => state.selectedRiderId)
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const selectOrder = useShiftStore((state) => state.selectOrder)
  const pickRider = useShiftStore((state) => state.pickRider)
  const sendRiderTo = useShiftStore((state) => state.sendRiderTo)
  const streets = map.network.streets
  // The level's light: noon at lunch, dusk at dinner, night on Friday.
  const palette = LIGHTS[mapLightOf(useShiftStore((state) => state.levelId))]

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    const instance = new MapLibreMap({
      container,
      style: fallbackStyle(palette),
      bounds: areaBounds(streets),
      fitBoundsOptions: { padding: panelInsets(container, FIT_PADDING) },
      maxBounds: areaBounds(streets, DRAG_MARGIN),
      attributionControl: false,
      locale: {
        'NavigationControl.ZoomIn': t('map.zoomIn'),
        'NavigationControl.ZoomOut': t('map.zoomOut'),
        'AttributionControl.ToggleAttribution': t('map.toggleAttribution'),
      },
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
    instance.on('click', () => setOpenRestaurantId(null))
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenRestaurantId(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    instance.once('remove', () => window.removeEventListener('keydown', closeOnEscape))
    instanceRef.current = instance
    setReady(true)
    void loadNightStyle(fetch, palette).then(({ style, online }) => {
      if (!cancelled && online) instance.setStyle(style)
    })
    return () => {
      cancelled = true
      setReady(false)
      instance.remove()
      instanceRef.current = null
    }
  }, [streets, palette])

  const addedOrderIds = useShiftStore((state) => state.addedOrderIds)
  const pickedIds = useMemo(
    () => selectedOrderIds({ selectedOrderId, addedOrderIds }),
    [selectedOrderId, addedOrderIds],
  )
  const hoveredOrderId = usePointerStore((state) => state.hoveredOrderId)
  const selection = useMemo(
    () => ({ orderIds: pickedIds, riderId: selectedRiderId, hoveredOrderId }),
    [pickedIds, selectedRiderId, hoveredOrderId],
  )
  const urgentBelowSec = prototype.orders.urgentBelowSec
  const markers = useMemo(
    () => buildMarkers(map, orders, riders, selection, (order) => urgencyOf(order, nowSec, urgentBelowSec)),
    [map, orders, riders, selection, nowSec, urgentBelowSec],
  )

  const describe = useCallback(
    (marker: MapMarker) => {
      if (marker.kind === 'restaurant') {
        const restaurant = map.restaurants.find((candidate) => candidate.id === marker.id)
        const name = restaurant ? restaurantName(restaurant) : marker.label
        return marker.waiting ? t('map.waiting', { name, count: marker.waiting.count }) : name
      }
      if (marker.kind === 'customer') {
        const name = t('map.customer', { number: marker.label })
        // The dot's color and shape say how urgent it is; the name says it too.
        if (marker.urgency === 'late') return `${name} · ${t('orders.lateTag')}`
        if (marker.urgency === 'urgent') return `${name} · ${t('orders.urgentTag')}`
        return name
      }
      return t('riders.name', { number: marker.label })
    },
    [map],
  )

  const onAction = useCallback<MarkerAction>(
    (marker, { shift }) => {
      if (marker.kind === 'restaurant') {
        // Rider picked first: tapping the restaurant sends them for its most urgent order, no card in between
        // (with Shift, for as many orders as their vehicle carries).
        if (sendRiderTo(marker.id, shift)) setOpenRestaurantId(null)
        else setOpenRestaurantId(marker.id)
      } else if (marker.kind === 'rider') pickRider(Number(marker.label))
      else selectOrder(marker.id, shift)
    },
    [pickRider, selectOrder, sendRiderTo],
  )
  const elements = useMapMarkers(instanceRef, ready, markers, describe, onAction)
  useDeliveryFx(instanceRef, ready, map)

  // The card shows the selected order's restaurant (while it waits for a rider), or the one the player opened.
  // An order already on a trip is picked to reassign it or call the customer: the selection bar handles that.
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const shownRestaurant = selectedOrder
    ? selectedOrder.status === 'pending'
      ? restaurantOf(map, selectedOrder)
      : undefined
    : map.restaurants.find((r) => r.id === openRestaurantId)
  const closePopup = useCallback(() => {
    setOpenRestaurantId(null)
    if (selectedOrderId) selectOrder(selectedOrderId)
  }, [selectOrder, selectedOrderId])

  const [popupElement] = useState(() => document.createElement('div'))
  useEffect(() => {
    const instance = instanceRef.current
    if (!instance || !ready) return
    popupRef.current?.remove()
    popupRef.current = null
    if (!shownRestaurant) return
    // No fixed side: MapLibre opens it where it fits (above the restaurant, or below or beside it near the edges).
    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: POPUP_OFFSETS, maxWidth: '260px' })
      .setLngLat([...map.network.streets.nodes[shownRestaurant.node]])
      .setDOMContent(popupElement)
      .addTo(instance)
    popupRef.current = popup
    return () => {
      popup.remove()
    }
  }, [ready, map, shownRestaurant, popupElement])

  // Riders move every frame, but their routes only change when they pass a crossing: the key says when,
  // so the map gets new route data a few times per trip instead of every frame.
  const routeKey = routesKey(riders)
  const routes = useMemo(() => routesGeoJson(map, riders, orders), [map, routeKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const idleKey = riders.map((rider) => (rider.status === 'idle' ? rider.node : '-')).join(',')
  // The picked trip, with each free rider's way to it; with nothing picked, the order under the mouse.
  const preview = useMemo(() => {
    const picked = pickedIds.flatMap((id) => orders.find((order) => order.id === id) ?? [])
    if (picked.length > 0) return previewGeoJson(map, riders, picked)
    const hovered = orders.find((order) => order.id === hoveredOrderId)
    return previewGeoJson(map, riders, hovered ? [hovered] : [], false)
  }, [map, pickedIds, idleKey, hoveredOrderId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    instanceRef.current?.getSource<GeoJSONSource>(ROUTES_SOURCE)?.setData(routes)
  }, [routes, styleVersion])

  useEffect(() => {
    instanceRef.current?.getSource<GeoJSONSource>(PREVIEW_SOURCE)?.setData(preview)
  }, [preview, styleVersion])

  // Where the neighborhood's streets end.
  useEffect(() => {
    instanceRef.current?.getSource<GeoJSONSource>(AREA_SOURCE)?.setData(areaOutline(streets))
  }, [streets, styleVersion])

  const customers = markers.filter((marker) => marker.kind === 'customer').length
  return (
    <div
      ref={containerRef}
      className="map-view"
      role="region"
      data-testid="map"
      aria-label={t('map.description', { restaurants: map.restaurants.length, riders: riders.length, customers })}
    >
      {markers.map((marker) => {
        const element = elements.get(marker.key)
        return element ? createPortal(<MapMarkerContent marker={marker} />, element, marker.key) : null
      })}
      {shownRestaurant &&
        createPortal(
          <RestaurantPopup restaurant={shownRestaurant} onClose={closePopup} onDispatched={() => setOpenRestaurantId(null)} />,
          popupElement,
        )}
    </div>
  )
}
