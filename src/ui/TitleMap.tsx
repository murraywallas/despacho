import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { advanceDemo, createDemo, type Demo } from '../game/demo'
import { prototype } from '../game/balance'
import { urgencyOf } from '../game/orders'
import '../map/mapMarkers.css'
import { areaBounds, areaOutline, buildMarkers, outsideArea, routesGeoJson, routesKey, type MapMarker } from '../map/mapData'
import { AttributionControl, MapLibreMap, type GeoJSONSource } from '../map/maplibre'
import { fallbackStyle, LIGHTS, loadNightStyle } from '../map/nightStyle'
import { addRouteLayers, AREA_SOURCE, OUTSIDE_SOURCE, ROUTES_SOURCE } from '../map/routeLayers'
import { useSettingsStore } from '../store/settingsStore'
import { MapMarkerContent } from './MapMarkerContent'
import { useGameLoop } from './useGameLoop'
import { useMapMarkers } from './useMapMarkers'

/** The level that plays itself behind the title: Friday night in Vesterbro, six riders and Kødbyen full of orders. */
const DEMO_LEVEL = 'vesterbro_friday'
const DEMO_SEED = 1
/** Real seconds the demo runs before it is shown, so the streets are already busy. */
const WARM_UP_SEC = 45
const WARM_UP_STEP_SEC = 0.5
const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
/** Space around the neighborhood, in CSS pixels. */
const FIT_PADDING = 24
const SELECTION = { orderIds: [], riderId: null }
const noAction = () => {}
const noName = () => ''

function warmDemo(): Demo {
  let demo = createDemo(DEMO_LEVEL, DEMO_SEED)
  for (let elapsed = 0; elapsed < WARM_UP_SEC; elapsed += WARM_UP_STEP_SEC) demo = advanceDemo(demo, WARM_UP_STEP_SEC)
  return demo
}

/** True when the player or the system asks for reduced motion: then the map stays still. */
function useStill(): boolean {
  const setting = useSettingsStore((state) => state.reducedMotion)
  const system = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  return setting || system
}

/**
 * The background of the title screen: a shift of Vesterbro that plays itself, on the real map. Riders leave,
 * pick up, deliver and come back. Decoration only: it takes no clicks and screen readers skip it.
 */
export function TitleMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [styleVersion, setStyleVersion] = useState(0)
  const [demo, setDemo] = useState(warmDemo)
  const still = useStill()
  const { map, riders, orderQueue, clock } = demo.shift
  const streets = map.network.streets

  const onTick = useCallback((dtSec: number) => setDemo((current) => advanceDemo(current, dtSec)), [])
  useGameLoop(still ? noAction : onTick)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    const palette = LIGHTS.night
    const instance = new MapLibreMap({
      container,
      style: fallbackStyle(palette),
      bounds: areaBounds(streets),
      fitBoundsOptions: { padding: FIT_PADDING },
      interactive: false,
      attributionControl: false,
    })
    instance.addControl(new AttributionControl({ compact: true, customAttribution: ATTRIBUTION }))
    instance.on('style.load', () => {
      addRouteLayers(instance)
      setStyleVersion((version) => version + 1)
    })
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
  }, [streets])

  useEffect(() => {
    instanceRef.current?.getSource<GeoJSONSource>(AREA_SOURCE)?.setData(areaOutline(streets))
    instanceRef.current?.getSource<GeoJSONSource>(OUTSIDE_SOURCE)?.setData(outsideArea(streets))
  }, [streets, styleVersion])

  // The trips in progress glow, as in the game; redrawn only when some route changes.
  const routesChange = routesKey(riders)
  useEffect(() => {
    instanceRef.current?.getSource<GeoJSONSource>(ROUTES_SOURCE)?.setData(routesGeoJson(map, riders, orderQueue.orders))
  }, [routesChange, styleVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const nowSec = clock.elapsedSec
  const markers = useMemo(
    () => buildMarkers(map, orderQueue.orders, riders, SELECTION, (order) => urgencyOf(order, nowSec, prototype.orders.urgentBelowSec)),
    [map, orderQueue.orders, riders, nowSec],
  )
  const elements = useMapMarkers(instanceRef, ready, markers, noName, noAction)

  return (
    <div ref={containerRef} className="map-view title-map" data-testid="title-map" aria-hidden inert>
      {markers.map((marker: MapMarker) => {
        const element = elements.get(marker.key)
        return element ? createPortal(<MapMarkerContent marker={marker} />, element, marker.key) : null
      })}
    </div>
  )
}
