import { UtensilsCrossed, X } from 'lucide-react'
import { prototype } from '../game/balance'
import type { Restaurant } from '../game/cityMap'
import { rankRiders } from '../game/dispatch'
import { timeLeftSec, urgencyOf } from '../game/orders'
import { isReady } from '../game/rating'
import { t } from '../i18n'
import { waitingAt } from '../map/mapData'
import { settings, useShiftStore } from '../store/shiftStore'
import { FoodHeat } from './FoodHeat'
import { gameMinutes } from './formatClock'
import { gameTime } from './gameTime'
import { restaurantName } from './restaurantName'


interface RestaurantPopupProps {
  restaurant: Restaurant
  onClose: () => void
  /** An order was just given to a rider from this card: the card closes, like a handled call. */
  onDispatched: () => void
}

/**
 * The card that opens over a restaurant on the map: its orders waiting for a rider and, once one is picked,
 * the free riders by how soon they get there. One tap on each and the order is dispatched.
 */
export function RestaurantPopup({ restaurant, onClose, onDispatched }: RestaurantPopupProps) {
  const map = useShiftStore((state) => state.map)
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const riders = useShiftStore((state) => state.riders)
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const selectedRiderId = useShiftStore((state) => state.selectedRiderId)
  const selectOrder = useShiftStore((state) => state.selectOrder)
  const pickRider = useShiftStore((state) => state.pickRider)

  const name = restaurantName(restaurant)
  const waiting = waitingAt(orders, restaurant.id)
  const selectedOrder = waiting.find((order) => order.id === selectedOrderId)
  const selectedRider = riders.find((rider) => rider.id === selectedRiderId)
  const ranked = selectedOrder ? rankRiders(map, riders, selectedOrder, settings.movement.metersPerSec) : []

  return (
    <div className="map-popup" role="dialog" aria-label={name} data-testid="map-popup">
      <div className="map-popup__header">
        <UtensilsCrossed size={15} aria-hidden />
        <span className="map-popup__title">{name}</span>
        <button type="button" className="map-popup__close" onClick={onClose} aria-label={t('map.close')}>
          <X size={15} aria-hidden />
        </button>
      </div>

      {waiting.length === 0 ? (
        <p className="map-popup__note">{t('map.noOrders')}</p>
      ) : (
        <>
          <p className="map-popup__note">
            {selectedRider
              ? t('map.pickOrderFor', { number: selectedRider.number })
              : selectedOrder
                ? t('map.pickRider')
                : t('map.pickOrder')}
          </p>
          <ul className="map-popup__list">
            {waiting.map((order) => {
              const left = timeLeftSec(order, nowSec)
              const urgency = urgencyOf(order, nowSec, prototype.orders.urgentBelowSec)
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    className={`map-popup__order map-popup__order--${urgency}`}
                    aria-pressed={order.id === selectedOrderId}
                    data-testid="popup-order"
                    onClick={() => {
                      selectOrder(order.id)
                      if (selectedRider) onDispatched()
                    }}
                  >
                    <span className="map-popup__order-number">{t('orders.number', { number: order.number })}</span>
                    <span className="map-popup__order-time">
                      {left > 0 ? t('orders.minutesLeft', { minutes: gameMinutes(left, gameTime) }) : t('orders.late')}
                    </span>
                    {isReady(order, nowSec) ? (
                      <FoodHeat order={order} nowSec={nowSec} />
                    ) : (
                      <span className="map-popup__cooking">{t('orders.cooking')}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {selectedOrder && (
        <>
          <p className="map-popup__note">{ranked.length > 0 ? t('map.closestRiders') : t('map.noFreeRiders')}</p>
          <ul className="map-popup__list">
            {ranked.map(({ rider, etaSec }) => (
              <li key={rider.id}>
                <button
                  type="button"
                  className="map-popup__rider"
                  data-testid="popup-rider"
                  onClick={() => {
                    pickRider(rider.number)
                    onDispatched()
                  }}
                >
                  <span>{t('riders.name', { number: rider.number })}</span>
                  <span className="map-popup__eta">{t('riders.eta', { minutes: gameMinutes(etaSec, gameTime) })}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
