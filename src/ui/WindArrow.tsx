import { Navigation } from 'lucide-react'
import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { eventKinds } from '../game/balance'
import { activeEvents } from '../game/shiftEvents'
import { windOf } from '../game/wind'
import { t } from '../i18n'
import type { MapLibreMap } from '../map/maplibre'
import { levelEvents, useShiftStore } from '../store/shiftStore'
import { windFromName } from './eventText'

const HALF_TURN_DEG = 180
/** Lucide's Navigation arrow points up and to the right: turn it back so 0° points north. */
const ICON_OFFSET_DEG = -45

/** A MapLibre control that only holds an element: React draws the arrow into it. */
class HolderControl {
  private readonly element: HTMLElement
  constructor(element: HTMLElement) {
    this.element = element
  }
  onAdd(): HTMLElement {
    return this.element
  }
  onRemove(): void {
    this.element.remove()
  }
}

/**
 * While the wind blows, an arrow under the zoom buttons shows where it blows to (the map always has north up).
 * Returns the arrow, to render in the map's tree.
 */
export function useWindArrow(instanceRef: RefObject<MapLibreMap | null>, ready: boolean): ReactNode {
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const wind = windOf(activeEvents(levelEvents(), nowSec), eventKinds)
  const [element] = useState(() => {
    const holder = document.createElement('div')
    holder.className = 'maplibregl-ctrl wind-control'
    return holder
  })
  const windId = wind?.id

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance || !ready || !windId) return
    const control = new HolderControl(element)
    instance.addControl(control, 'top-right')
    return () => {
      instance.removeControl(control)
    }
  }, [instanceRef, ready, windId, element])

  if (!wind || wind.directionDeg === undefined) return null
  const towardsDeg = wind.directionDeg + HALF_TURN_DEG
  const from = windFromName(wind.directionDeg)
  return createPortal(
    <span className="wind-arrow" role="img" aria-label={t('map.wind', { from })} title={t('map.wind', { from })} data-testid="wind-arrow">
      <Navigation size={18} style={{ transform: `rotate(${towardsDeg + ICON_OFFSET_DEG}deg)` }} aria-hidden />
    </span>,
    element,
  )
}
