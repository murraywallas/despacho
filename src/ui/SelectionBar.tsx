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
import { useNeighborhood } from './useNeighborhood'
import { useTrip } from './useTrip'

/** "A y B", "A, B y C": a list, the Spanish way. */
function listNames(names: readonly string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ${t('list.and')} ${names.at(-1)}`
}

/** "#3 y #4", "#3, #4 y #5": the orders of a trip. */
function listNumbers(picked: readonly { readonly number: number }[]): string {
  return listNames(picked.map((order) => `#${order.number}`))
}

/**
 * A strip over the map while an order is picked: what it is, what can be done with it now, and the call to the
 * customer (once per shift, key L) to buy more time.
 */
export function SelectionBar() {
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const riders = useShiftStore((state) => state.riders)
  const restaurants = useShiftStore((state) => state.map.restaurants)
  const neighborhood = useNeighborhood()
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const trip = useTrip().orders
  const callsLeft = useShiftStore((state) => state.callsLeft)
  const callCustomer = useShiftStore((state) => state.callCustomer)
  const clearSelection = useShiftStore((state) => state.clearSelection)

  const order = orders.find((candidate) => candidate.id === selectedOrderId)
  if (!order) return null
  // The whole trip when the order waits for a rider; just the order when it is already on its way.
  const picked = order.status === 'pending' && trip.length > 0 ? trip : [order]
  // The trip's restaurants: one, or a few close together.
  const tripRestaurants = [...new Set(picked.map((candidate) => candidate.restaurantId))].flatMap(
    (id) => restaurants.find((candidate) => candidate.id === id) ?? [],
  )
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
          {picked.length < 2
            ? t('orders.number', { number: order.number })
            : t('selection.orders', { numbers: listNumbers(picked) })}
          {tripRestaurants.length > 0 && ` · ${listNames(tripRestaurants.map((restaurant) => restaurantName(restaurant, neighborhood)))}`}
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
