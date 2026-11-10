import { useEffect, useRef, useState, type RefObject } from 'react'
import type { MapMarker } from '../map/mapData'
import { Marker, type MapLibreMap } from '../map/maplibre'

/** Called when the player clicks a marker, or presses Enter on it (shift: with the Shift key held). */
export type MarkerAction = (marker: Pick<MapMarker, 'kind' | 'id' | 'label'>, options: { shift: boolean }) => void

function setIfChanged(element: HTMLElement, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value)
}

function createMarkerElement(marker: MapMarker, act: (shift: boolean) => void): HTMLElement {
  const element = document.createElement('div')
  element.className = `map-marker map-marker--${marker.kind}`
  element.dataset.testid = `${marker.kind}-marker`
  element.setAttribute('role', 'button')
  element.tabIndex = 0
  element.addEventListener('click', (event) => {
    event.stopPropagation()
    act(event.shiftKey)
  })
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    act(event.shiftKey)
  })
  return element
}

/**
 * Keeps one MapLibre marker per map marker: adds the new ones, moves the ones that stay, removes the rest.
 * Returns the marker elements, for React to draw their content into (with portals).
 */
export function useMapMarkers(
  instanceRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  markers: readonly MapMarker[],
  describe: (marker: MapMarker) => string,
  onAction: MarkerAction,
): ReadonlyMap<string, HTMLElement> {
  const placedRef = useRef(new Map<string, Marker>())
  const latestRef = useRef({ markers, onAction })
  const [elements, setElements] = useState<ReadonlyMap<string, HTMLElement>>(new Map())

  useEffect(() => {
    latestRef.current = { markers, onAction }
  })

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance || !ready) return
    const placed = placedRef.current
    const keep = new Set<string>()
    let changed = false
    for (const marker of markers) {
      keep.add(marker.key)
      let current = placed.get(marker.key)
      if (!current) {
        const act = (shift: boolean) => {
          const latest = latestRef.current.markers.find((candidate) => candidate.key === marker.key)
          if (latest) latestRef.current.onAction(latest, { shift })
        }
        const anchor = marker.kind === 'customer' ? 'center' : 'bottom'
        current = new Marker({ element: createMarkerElement(marker, act), anchor }).setLngLat([...marker.lngLat]).addTo(instance)
        placed.set(marker.key, current)
        changed = true
      } else {
        const at = current.getLngLat()
        // Most markers stand still: moving them anyway costs a layout every frame.
        if (at.lng !== marker.lngLat[0] || at.lat !== marker.lngLat[1]) current.setLngLat([...marker.lngLat])
      }
      const element = current.getElement()
      element.classList.toggle('map-marker--selected', marker.selected)
      element.classList.toggle('map-marker--free', marker.rider?.status === 'idle')
      setIfChanged(element, 'aria-label', describe(marker))
      setIfChanged(element, 'aria-pressed', String(marker.selected))
    }
    for (const [key, current] of placed) {
      if (!keep.has(key)) {
        current.remove()
        placed.delete(key)
        changed = true
      }
    }
    if (changed) setElements(new Map([...placed].map(([key, current]) => [key, current.getElement()])))
  }, [instanceRef, ready, markers, describe])

  useEffect(() => {
    const placed = placedRef.current
    return () => {
      for (const current of placed.values()) current.remove()
      placed.clear()
    }
  }, [])

  return elements
}
