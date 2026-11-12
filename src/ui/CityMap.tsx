import 'maplibre-gl/dist/maplibre-gl.css'
import { Lock, Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { streetsOf } from '../game/neighborhoods'
import { t } from '../i18n'
import { AttributionControl, MapLibreMap } from '../map/maplibre'
import { fallbackStyle, LIGHTS, loadNightStyle } from '../map/nightStyle'
import { formatRating } from './formatRating'
import { neighborhoodName } from './levelText'

const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
/** Space around the city, in CSS pixels. */
const FIT_PADDING = 48

export interface CityArea {
  readonly id: string
  readonly open: boolean
  /** Average stars of its shifts (unplayed ones count as zero). */
  readonly average: number
  /** Whether any of its shifts has been played. */
  readonly played: boolean
}

interface CityMapProps {
  readonly areas: readonly CityArea[]
  readonly selected: string
  readonly onSelect: (id: string) => void
  /** Part of the screen covered by the floating panel on the left, so the city shows beside it. */
  readonly leftInset: number
  /** Average stars that open a neighborhood, already formatted ("4,0"). */
  readonly stars: string
}

/** Where a neighborhood sits on the screen: its box and its middle, in CSS pixels. */
interface Placed {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** [west, south, east, north] of a neighborhood's streets. */
function boxOf(id: string): [number, number, number, number] {
  const [south, west, north, east] = streetsOf(id).bbox
  return [west, south, east, north]
}

/**
 * The start screen's map: Copenhagen with the game's neighborhoods on it, one button each. A neighborhood shows
 * locked or open and the average stars of its shifts; choosing one shows its shifts in the panel.
 */
export function CityMap({ areas, selected, onSelect, leftInset, stars }: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [placed, setPlaced] = useState<Readonly<Record<string, Placed>>>({})
  const ids = areas.map((area) => area.id).join(',')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    const boxes = ids.split(',').map((id) => [id, boxOf(id)] as const)
    const instance = new MapLibreMap({
      container,
      style: fallbackStyle(LIGHTS.night),
      bounds: [
        [Math.min(...boxes.map(([, box]) => box[0])), Math.min(...boxes.map(([, box]) => box[1]))],
        [Math.max(...boxes.map(([, box]) => box[2])), Math.max(...boxes.map(([, box]) => box[3]))],
      ],
      fitBoundsOptions: {
        padding: { top: FIT_PADDING, bottom: FIT_PADDING, right: FIT_PADDING, left: leftInset + FIT_PADDING },
      },
      interactive: false,
      attributionControl: false,
    })
    instance.addControl(new AttributionControl({ compact: true, customAttribution: ATTRIBUTION }))
    const place = () => {
      const next: Record<string, Placed> = {}
      for (const [id, [west, south, east, north]] of boxes) {
        const topLeft = instance.project([west, north])
        const bottomRight = instance.project([east, south])
        next[id] = { left: topLeft.x, top: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y }
      }
      setPlaced(next)
    }
    place()
    instance.on('resize', place)
    instance.on('move', place)
    void loadNightStyle(fetch, LIGHTS.night).then(({ style, online }) => {
      if (!cancelled && online) instance.setStyle(style)
    })
    return () => {
      cancelled = true
      instance.remove()
    }
  }, [ids, leftInset])

  const box = placed[selected]

  return (
    <div className="city-map">
      <div className="backdrop-map map-view" ref={containerRef} data-testid="city-map" />
      {box && <div className="city-map__outline" style={box} aria-hidden />}
      <nav className="city-map__areas" aria-label={t('levels.neighborhoods')}>
        {areas.map((area, index) => {
          const spot = placed[area.id]
          const name = neighborhoodName(area.id)
          const previous = index > 0 ? neighborhoodName(areas[index - 1].id) : ''
          const status = !area.open
            ? t('levels.areaLocked')
            : area.played
              ? t('levels.areaAverage', { rating: formatRating(area.average) })
              : t('levels.notPlayed')
          return (
            <button
              key={area.id}
              type="button"
              className="city-map__area"
              data-open={area.open}
              aria-pressed={area.id === selected}
              aria-label={
                area.open
                  ? t('levels.areaLabel', { name, status })
                  : t('levels.neighborhoodLocked', { name, stars, previous })
              }
              style={spot ? { left: spot.left + spot.width / 2, top: spot.top + spot.height / 2 } : { visibility: 'hidden' }}
              onClick={() => onSelect(area.id)}
              data-testid="neighborhood"
              data-neighborhood={area.id}
            >
              <span className="city-map__name">{name}</span>
              <span className="city-map__status">
                {!area.open ? (
                  <Lock size={12} aria-hidden />
                ) : (
                  area.played && <Star size={12} aria-hidden className="level-card__star" />
                )}
                {status}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
