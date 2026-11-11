import { suggestRider } from '../game/dispatch'
import type { Order } from '../game/orders'
import { t } from '../i18n'
import { settings, useShiftStore } from '../store/shiftStore'
import { gameMinutes } from './formatClock'
import { gameTime } from './gameTime'
import { Keycap } from './Keycap'
import { VEHICLE_TEXT, VehicleIcon } from './VehicleIcon'

/**
 * Next to an order that just turned urgent: the free rider who gets there first ("2 · Bicicleta · 3 min").
 * A click sends them; with the order picked, their number key does too.
 */
export function SuggestedRider({ order }: { order: Order }) {
  const map = useShiftStore((state) => state.map)
  const riders = useShiftStore((state) => state.riders)
  const dispatchByDrop = useShiftStore((state) => state.dispatchByDrop)
  const best = suggestRider(map, riders, order, settings.movement.metersPerSec)
  if (!best) return null
  const { rider, etaSec } = best
  const vehicleKey = VEHICLE_TEXT[rider.vehicle]
  const vehicle = vehicleKey ? t(vehicleKey) : rider.vehicle
  const minutes = gameMinutes(etaSec, gameTime)

  return (
    <button
      type="button"
      className="order-suggestion"
      onClick={() => dispatchByDrop(order.id, rider.number)}
      aria-label={t('orders.suggestionLabel', { order: order.number, rider: rider.number, vehicle, minutes })}
      data-testid="order-suggestion"
    >
      <Keycap label={String(rider.number)} />
      <VehicleIcon vehicle={rider.vehicle} size={14} aria-hidden />
      <span>{t('orders.suggestion', { vehicle, minutes })}</span>
    </button>
  )
}
