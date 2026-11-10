import { Phone, X } from 'lucide-react'
import { prototype } from '../game/balance'
import { timeLeftSec } from '../game/orders'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { gameMinutes } from './formatClock'
import { gameTime } from './gameTime'
import './operatorTools.css'
import { Keycap } from './Keycap'
import { restaurantName } from './restaurantName'

/**
 * A strip over the map while an order is picked: what it is, what can be done with it now, and the call to the
 * customer (once per shift, key L) to buy more time.
 */
export function SelectionBar() {
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const riders = useShiftStore((state) => state.riders)
  const restaurants = useShiftStore((state) => state.map.restaurants)
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const callsLeft = useShiftStore((state) => state.callsLeft)
  const callCustomer = useShiftStore((state) => state.callCustomer)
  const clearSelection = useShiftStore((state) => state.clearSelection)

  const order = orders.find((candidate) => candidate.id === selectedOrderId)
  if (!order) return null
  const restaurant = restaurants.find((candidate) => candidate.id === order.restaurantId)
  const rider = riders.find((candidate) => candidate.id === order.riderId)
  const left = timeLeftSec(order, nowSec)
  const extra = gameMinutes(prototype.tools.callExtendSec, gameTime)

  let hint: string
  if (order.status === 'assigned' && rider) {
    hint = t('selection.reassign', { rider: rider.number, minutes: gameMinutes(prototype.tools.reassignPenaltySec, gameTime) })
  } else if (order.status === 'pickedUp' && rider) {
    hint = t('selection.onItsWay', { rider: rider.number })
  } else {
    hint = t('selection.pickRider')
  }

  return (
    <div className="selection-bar" role="status" aria-live="polite" data-testid="selection-bar">
      <div className="selection-bar__text">
        <span className="selection-bar__title">
          {t('orders.number', { number: order.number })}
          {restaurant && ` · ${restaurantName(restaurant)}`}
          {' · '}
          {left > 0 ? t('orders.minutesLeft', { minutes: gameMinutes(left, gameTime) }) : t('orders.late')}
        </span>
        <span className="selection-bar__hint">{hint}</span>
      </div>
      <button
        type="button"
        className="selection-bar__call"
        onClick={() => callCustomer()}
        disabled={callsLeft <= 0}
        aria-keyshortcuts="L"
        title={t('selection.callTitle', { calls: callsLeft })}
      >
        <Phone size={15} aria-hidden />
        {t('selection.call', { minutes: extra })}
        <Keycap label="L" />
      </button>
      <button
        type="button"
        className="selection-bar__close"
        onClick={clearSelection}
        aria-label={t('selection.cancel')}
        aria-keyshortcuts="Escape"
      >
        <X size={15} aria-hidden />
        <Keycap label="Esc" />
      </button>
    </div>
  )
}
