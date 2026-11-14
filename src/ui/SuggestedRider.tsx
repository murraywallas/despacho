import type { Order } from '../game/orders'
import { suggestRider } from '../game/stops'
import { t } from '../i18n'
import { speedsAt, useShiftStore } from '../store/shiftStore'
import { DeliveryEta } from './DeliveryEta'
import { gameMinutes } from './formatClock'
import { gameTime } from './gameTime'
import { Keycap } from './Keycap'
import { VEHICLE_TEXT, VehicleIcon } from './VehicleIcon'

/**
 * Next to an order that just turned urgent: the free rider who gets the food to the customer first
 * ("2 · Bicicleta  9 min": minutes until the customer, in red when even they arrive late). A click sends them; with the order picked, their
 * number key does too.
 */
export function SuggestedRider({ order }: { order: Order }) {
  const map = useShiftStore((state) => state.map)
  const riders = useShiftStore((state) => state.riders)
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const dispatchByDrop = useShiftStore((state) => state.dispatchByDrop)
  const best = suggestRider(map, riders, order, speedsAt(nowSec), nowSec)
  if (!best) return null
  const { rider, deliverAtSec, late } = best
  const vehicleKey = VEHICLE_TEXT[rider.vehicle]
  const vehicle = vehicleKey ? t(vehicleKey) : rider.vehicle
  const minutes = gameMinutes(deliverAtSec - nowSec, gameTime)
  const label = t('orders.suggestionLabel', {
    order: order.number,
    rider: rider.number,
    vehicle,
    minutes,
    late: late ? t('orders.suggestionLate') : '',
  })

  // The row only fits the vehicle and the minutes; the full sentence is the tooltip and the accessible name.
  return (
    <button
      type="button"
      className={`order-suggestion${late ? ' order-suggestion--late' : ''}`}
      onClick={() => dispatchByDrop(order.id, rider.number)}
      aria-label={label}
      title={label}
      data-testid="order-suggestion"
    >
      <Keycap label={String(rider.number)} />
      <VehicleIcon vehicle={rider.vehicle} size={14} aria-hidden />
      <span className="order-suggestion__text">{vehicle}</span>
      <DeliveryEta className="order-suggestion__eta" inSec={deliverAtSec - nowSec} late={late} />
    </button>
  )
}
