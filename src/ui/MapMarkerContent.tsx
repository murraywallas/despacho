import { UtensilsCrossed } from 'lucide-react'
import type { MapMarker } from '../map/mapData'
import { VehicleIcon } from './VehicleIcon'

/**
 * What a marker looks like. Restaurants and riders are small cards with a point at the bottom that marks the
 * exact spot; customers are dots with the order number. The marker element carries the accessible name, so
 * everything here is decoration for screen readers.
 */
export function MapMarkerContent({ marker }: { marker: MapMarker }) {
  if (marker.kind === 'restaurant') {
    return (
      <span className="map-pin map-pin--restaurant" aria-hidden>
        {marker.waiting && (
          <span className={`map-pin__alert map-pin__alert--${marker.waiting.urgency}`}>
            !{marker.waiting.count > 1 && <span className="map-pin__alert-count">{marker.waiting.count}</span>}
          </span>
        )}
        <UtensilsCrossed size={13} strokeWidth={2.5} />
        <span className="map-pin__letter">{marker.label}</span>
      </span>
    )
  }
  if (marker.kind === 'rider') {
    return (
      <span className={`map-pin map-pin--rider map-pin--${marker.rider?.status ?? 'idle'}`} aria-hidden>
        <span className="map-pin__badge">{marker.label}</span>
        <VehicleIcon vehicle={marker.rider?.vehicle ?? 'bike'} size={18} strokeWidth={2.25} />
      </span>
    )
  }
  return (
    <span className={`map-dot map-dot--${marker.urgency ?? 'normal'}`} aria-hidden>
      {marker.label}
    </span>
  )
}
