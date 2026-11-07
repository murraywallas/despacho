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

interface OrderCardProps {
  order: Order
  nowSec: number
  restaurantLabel: string
  selected: boolean
  onSelect: (orderId: string) => void
}

function OrderCard({ order, nowSec, restaurantLabel, selected, onSelect }: OrderCardProps) {
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
          <span className="order-card__status">
            {selected ? t('orders.status.selected') : t('orders.status.pending')}
          </span>
        </span>
        <span className="order-card__restaurant">
          <Store size={ICON_SIZE} aria-hidden />
          {t('orders.restaurant', { label: restaurantLabel })}
        </span>
        <span className="order-card__deadline">
          <DeadlineIcon urgency={urgency} />
          <span className="order-card__time">{left > 0 ? formatClock(left) : t('orders.late')}</span>
          {urgency === 'urgent' && <span className="order-card__tag">{t('orders.urgent')}</span>}
        </span>
      </button>
    </li>
  )
}

/** Orders waiting for a rider. Clicking one selects it; then a rider gets it (RiderPanel or keys 1–9). */
export function OrderPanel() {
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const restaurants = useShiftStore((state) => state.map.restaurants)
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const selectOrder = useShiftStore((state) => state.selectOrder)
  const pending = orders.filter((order) => order.status === 'pending')
  const delivered = orders.filter((order) => order.status === 'delivered').length
  const cancelled = orders.filter((order) => order.status === 'cancelled').length
  const labelOf = (id: string) => restaurants.find((restaurant) => restaurant.id === id)?.label ?? '?'

  return (
    <aside className="side-panel" aria-labelledby="order-panel-title">
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
        <>
          <p className="side-panel__hint">{selectedOrderId ? t('orders.hintPickRider') : t('orders.hintPickOrder')}</p>
          <ol className="side-panel__list">
            {pending.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                nowSec={nowSec}
                restaurantLabel={labelOf(order.restaurantId)}
                selected={order.id === selectedOrderId}
                onSelect={selectOrder}
              />
            ))}
          </ol>
        </>
      )}
    </aside>
  )
}
