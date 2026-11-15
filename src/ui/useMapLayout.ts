import { useEffect, type RefObject } from 'react'
import type { MapMarker } from '../map/mapData'
import type { MapLibreMap } from '../map/maplibre'
import { revealDelta, spreadApart, type Rect } from '../map/screenLayout'
import { panelInsets } from './panelInsets'

/** Room kept between what the camera reveals and the edge of the free part of the screen, in CSS pixels. */
const REVEAL_MARGIN = 12
/** Space between two restaurant cards pushed apart, in CSS pixels. */
const SPREAD_GAP = 4
/** Overlays over the map's top edge, besides the top bar: the picked order's strip and the first-shift guide. */
const TOP_OVERLAYS = ['.selection-bar', '.guide']

/** The part of the map not under the panels, the bars or the guide, in screen pixels. */
function freeRect(container: HTMLElement): Rect {
  const box = container.getBoundingClientRect()
  const insets = panelInsets(container, REVEAL_MARGIN)
  const overlays = TOP_OVERLAYS.flatMap((selector) => [...document.querySelectorAll(selector)])
  const top = Math.max(box.top + insets.top, ...overlays.map((element) => element.getBoundingClientRect().bottom + REVEAL_MARGIN))
  return { left: box.left + insets.left, top, right: box.right - insets.right, bottom: box.bottom - insets.bottom }
}

/**
 * When the player picks an order (or, during the guide, an order waits), its restaurant and customers have to be
 * seen: if any is under a panel, a bar or the guide, the map slides just enough. Otherwise the camera stays still.
 */
export function useRevealPicked(
  instanceRef: RefObject<MapLibreMap | null>,
  containerRef: RefObject<HTMLElement | null>,
  ready: boolean,
  elements: ReadonlyMap<string, HTMLElement>,
  targetKeys: readonly string[],
  guideKeys: readonly string[],
): void {
  const key = `${targetKeys.join(',')}|${guideKeys.join(',')}`
  useEffect(() => {
    const instance = instanceRef.current
    const container = containerRef.current
    if (!instance || !container || !ready) return
    // Wait a frame: the order's strip (or the guide's next bubble) is drawn with the same change.
    const frame = requestAnimationFrame(() => {
      const keys = document.querySelector('.guide') ? [...targetKeys, ...guideKeys] : targetKeys
      const targets = keys.flatMap((target) => {
        const element = elements.get(target)
        return element ? [element.getBoundingClientRect()] : []
      })
      const { dx, dy } = revealDelta(targets, freeRect(container))
      if (dx !== 0 || dy !== 0) instance.panBy([-dx, -dy])
    })
    return () => cancelAnimationFrame(frame)
  }, [instanceRef, containerRef, ready, key]) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Restaurants close together would show as one blur of cards: at every zoom, cards that overlap are pushed
 * sideways (the --spread-x of their marker), so each letter can be read and clicked.
 */
export function useSpreadRestaurants(
  instanceRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  markers: readonly MapMarker[],
  elements: ReadonlyMap<string, HTMLElement>,
): void {
  const restaurantKey = markers
    .filter((marker) => marker.kind === 'restaurant')
    .map((marker) => marker.key)
    .join(',')
  useEffect(() => {
    const instance = instanceRef.current
    if (!instance || !ready) return
    const restaurants = markers.filter((marker) => marker.kind === 'restaurant')
    const spread = () => {
      const pins = restaurants.flatMap((marker) => {
        const element = elements.get(marker.key)
        if (!element) return []
        const point = instance.project([...marker.lngLat])
        return [{ key: marker.key, x: point.x, y: point.y, width: element.offsetWidth, height: element.offsetHeight }]
      })
      const offsets = spreadApart(pins, SPREAD_GAP)
      for (const marker of restaurants) {
        elements.get(marker.key)?.style.setProperty('--spread-x', `${offsets.get(marker.key) ?? 0}px`)
      }
    }
    spread()
    instance.on('zoomend', spread)
    return () => {
      instance.off('zoomend', spread)
    }
  }, [instanceRef, ready, restaurantKey, elements]) // eslint-disable-line react-hooks/exhaustive-deps
}
