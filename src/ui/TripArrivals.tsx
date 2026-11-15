import type { CityMap } from '../game/cityMap'
import type { Speeds } from '../game/movement'
import type { Order } from '../game/orders'
import type { Rider } from '../game/riders'
import { tripArrivals } from '../game/stops'
import { t } from '../i18n'
import { DeliveryEta } from './DeliveryEta'

interface TripArrivalsProps {
  readonly map: CityMap
  readonly rider: Rider
  readonly trip: readonly Order[]
  readonly speeds: Speeds
  readonly nowSec: number
}

/**
 * Two or more orders picked for one trip: with the rider who'd deliver soonest, when each one would reach its
 * customer, stop by stop, and which would be late. Batching is an informed choice, not a trap.
 */
export function TripArrivals({ map, rider, trip, speeds, nowSec }: TripArrivalsProps) {
  const arrivals = tripArrivals(map, rider, trip, speeds, nowSec)
  if (arrivals.length < 2) return null
  return (
    <div className="map-popup__trip" data-testid="popup-trip">
      <p className="map-popup__note">{t('map.tripWith', { rider: rider.number })}</p>
      <ol className="map-popup__trip-stops">
        {arrivals.map(({ order, atSec, late }, index) => (
          <li key={order.id} className="map-popup__trip-stop" data-testid="popup-trip-stop" data-late={late}>
            <span>{t('map.tripStop', { stop: index + 1, number: order.number })}</span>
            <DeliveryEta className="map-popup__eta" inSec={atSec - nowSec} late={late} />
          </li>
        ))}
      </ol>
    </div>
  )
}
