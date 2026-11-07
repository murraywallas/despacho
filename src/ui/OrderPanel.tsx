import { CircleAlert, Clock, Store, TriangleAlert } from 'lucide-react'
import { prototype } from '../game/balance'
import { timeLeftSec, urgencyOf, type Order, type Urgency } from '../game/orders'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { formatClock } from './formatClock'

const ICON_SIZE = 16

function DeadlineIcon({ urgency }: { urgency: Urgency }) {
  if (urgency === 'late') return <CircleAlert size={ICON_SIZE} aria-hidden />
  if (urgency === 'urgent') return <TriangleAlert size={ICON_SIZE} aria-hidden />
  return <Clock size={ICON_SIZE} aria-hidden />
}

function OrderCard({ order, nowSec, restaurantLabel }: { order: Order; nowSec: number; restaurantLabel: string }) {
  const urgency = urgencyOf(order, nowSec, prototype.orders.urgentBelowSec)
  const left = timeLeftSec(order, nowSec)

  return (
    <li className={`order-card order-card--${urgency}`} data-testid="order-card">
      <div className="order-card__header">
        <span className="order-card__number">{t('orders.number', { number: order.number })}</span>
        <span className="order-card__status">{t('orders.status.pending')}</span>
      </div>
      <div className="order-card__restaurant">
        <Store size={ICON_SIZE} aria-hidden />
        {t('orders.restaurant', { label: restaurantLabel })}
      </div>
      <div className="order-card__deadline">
        <DeadlineIcon urgency={urgency} />
        <span className="order-card__time">{left > 0 ? formatClock(left) : t('orders.late')}</span>
        {urgency === 'urgent' && <span className="order-card__tag">{t('orders.urgent')}</span>}
      </div>
    </li>
  )
}

export function OrderPanel() {
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const restaurants = useShiftStore((state) => state.map.restaurants)
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const labelOf = (id: string) => restaurants.find((restaurant) => restaurant.id === id)?.label ?? '?'

  return (
    <aside className="side-panel" aria-labelledby="order-panel-title">
      <h2 className="side-panel__title" id="order-panel-title">
        {t('orders.title')}
        <span className="side-panel__count" aria-label={t('orders.count', { count: orders.length })}>
          {orders.length}
        </span>
      </h2>
      {orders.length === 0 ? (
        <p className="side-panel__empty">{t('orders.empty')}</p>
      ) : (
        <ol className="side-panel__list">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} nowSec={nowSec} restaurantLabel={labelOf(order.restaurantId)} />
          ))}
        </ol>
      )}
    </aside>
  )
}
