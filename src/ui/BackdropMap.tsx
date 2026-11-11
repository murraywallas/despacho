import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { LonLat } from '../game/streetGraph'
import { norrebroStreets } from '../game/norrebro'
import '../map/mapMarkers.css'
import { areaBounds } from '../map/mapData'
import { AttributionControl, MapLibreMap, Marker } from '../map/maplibre'
import { FALLBACK_STYLE, loadNightStyle } from '../map/nightStyle'

const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
/** Space around the neighborhood, in CSS pixels. */
const FIT_PADDING = 32

export interface BackdropPin {
  readonly key: string
  readonly label: string
  readonly lngLat: LonLat
}

interface BackdropMapProps {
  /** Restaurants to mark on the map (the briefing shows the level's). */
  pins?: readonly BackdropPin[]
  /** Part of the screen covered by the floating panel on the left, so the neighborhood shows beside it. */
  leftInset?: number
}

/**
 * The neighborhood's night map as the background of the screens around the shift (start, briefing). It doesn't
 * move or take clicks: it sets the scene and, in the briefing, shows where the restaurants are.
 */
export function BackdropMap({ pins = [], leftInset = 0 }: BackdropMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    const instance = new MapLibreMap({
      container,
      style: FALLBACK_STYLE,
      bounds: areaBounds(norrebroStreets),
      fitBoundsOptions: {
        padding: { top: FIT_PADDING, bottom: FIT_PADDING, right: FIT_PADDING, left: leftInset + FIT_PADDING },
      },
      interactive: false,
      attributionControl: false,
    })
    instance.addControl(new AttributionControl({ compact: true, customAttribution: ATTRIBUTION }))
    for (const pin of pins) {
      // The pin goes inside a wrapper: MapLibre positions the wrapper, the pin keeps its own layout.
      const element = document.createElement('div')
      element.setAttribute('aria-hidden', 'true')
      const label = document.createElement('span')
      label.className = 'map-pin map-pin--restaurant backdrop-pin'
      label.textContent = pin.label
      element.append(label)
      new Marker({ element, anchor: 'bottom' }).setLngLat([...pin.lngLat]).addTo(instance)
    }
    void loadNightStyle().then(({ style, online }) => {
      if (!cancelled && online) instance.setStyle(style)
    })
    return () => {
      cancelled = true
      instance.remove()
    }
  }, [pins, leftInset])

  return <div className="backdrop-map map-view" ref={containerRef} data-testid="backdrop-map" />
}
