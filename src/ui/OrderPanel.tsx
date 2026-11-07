import { ChefHat, CircleAlert, Clock, TriangleAlert } from 'lucide-react'
import { prototype } from '../game/balance'
import { timeLeftSec, urgencyOf, type Order, type Urgency } from '../game/orders'
import { isReady } from '../game/rating'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { FoodHeat } from './FoodHeat'
import { gameMinutes } from './formatClock'
import { gameTime } from './gameTime'
import { restaurantName } from './restaurantName'

const ICON_SIZE = 14

function DeadlineIcon({ urgency }: { urgency: Urgency }) {
  if (urgency === 'late') return <CircleAlert size={ICON_SIZE} aria-hidden />
  if (urgency === 'urgent') return <TriangleAlert size={ICON_SIZE} aria-hidden />
  return <Clock size={ICON_SIZE} aria-hidden />
}

interface OrderCardProps {
  order: Order
  nowSec: number
  restaurantName: string
  selected: boolean
  onSelect: (orderId: string) => void
}

/** A compact order: number and time left, then restaurant and food heat. */
function OrderCard({ order, nowSec, restaurantName, selected, onSelect }: OrderCardProps) {
  const urgency = urgencyOf(order, nowSec, prototype.orders.urgentBelowSec)
  const left = timeLeftSec(order, nowSec)

  return (
    <li data-testid="order-card">
      <button
        type="button"
        className={`order-card order-card--${urgency}${selected ? ' order-card--selected' : ''}`}
        aria-pressed={selected}
        onClick={() => onSelect(order.id)}
      >
        <span className="order-card__header">
          <span className="order-card__number">{t('orders.number', { number: order.number })}</span>
          <span className="order-card__deadline">
            <DeadlineIcon urgency={urgency} />
            <span className="order-card__time">
              {left > 0 ? t('orders.minutesLeft', { minutes: gameMinutes(left, gameTime) }) : t('orders.late')}
            </span>
          </span>
        </span>
        <span className="order-card__restaurant">
          <span className="order-card__name">{restaurantName}</span>
          {isReady(order, nowSec) ? (
            <FoodHeat order={order} nowSec={nowSec} />
          ) : (
            <span className="order-card__cooking" role="img" aria-label={t('orders.cooking')} title={t('orders.cooking')}>
              <ChefHat size={ICON_SIZE} aria-hidden />
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

/**
 * A slim strip with the orders waiting for a rider, the most urgent first. Dispatching happens on the map; this
 * is the backup: clicking an order picks it, like tapping it on the map.
 */
export function OrderPanel() {
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const restaurants = useShiftStore((state) => state.map.restaurants)
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const selectOrder = useShiftStore((state) => state.selectOrder)
  const pending = orders
    .filter((order) => order.status === 'pending')
    .sort((a, b) => a.deadlineAtSec - b.deadlineAtSec)
  const delivered = orders.filter((order) => order.status === 'delivered').length
  const cancelled = orders.filter((order) => order.status === 'cancelled').length
  const nameOf = (id: string) => {
    const restaurant = restaurants.find((candidate) => candidate.id === id)
    return restaurant ? restaurantName(restaurant) : '?'
  }

  return (
    <aside className="side-panel side-panel--slim" aria-labelledby="order-panel-title">
      <h2 className="side-panel__title" id="order-panel-title">
        {t('orders.title')}
        <span className="side-panel__count" aria-label={t('orders.count', { count: pending.length })}>
          {pending.length}
        </span>
      </h2>
      {(delivered > 0 || cancelled > 0) && (
        <p className="side-panel__meta">
          {delivered > 0 && <span data-testid="delivered-count">{t('orders.delivered', { count: delivered })}</span>}
          {cancelled > 0 && <span data-testid="cancelled-count">{t('orders.cancelled', { count: cancelled })}</span>}
        </p>
      )}
      {pending.length === 0 ? (
        <p className="side-panel__empty">{orders.length === 0 ? t('orders.empty') : t('orders.allAssigned')}</p>
      ) : (
        <ol className="side-panel__list">
          {pending.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              nowSec={nowSec}
              restaurantName={nameOf(order.restaurantId)}
              selected={order.id === selectedOrderId}
              onSelect={selectOrder}
            />
          ))}
        </ol>
      )}
    </aside>
  )
}
