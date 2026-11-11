import { ChefHat, CircleAlert, Clock, TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { prototype } from '../game/balance'
import { timeLeftSec, urgencyOf, type Order, type Urgency } from '../game/orders'
import { isReady } from '../game/rating'
import { t, type TextKey } from '../i18n'
import { usePointerStore } from '../store/pointerStore'
import { useShiftStore, waitingQueue } from '../store/shiftStore'
import { FoodHeat } from './FoodHeat'
import { gameMinutes } from './formatClock'
import { gameTime } from './gameTime'
import { restaurantName } from './restaurantName'
import { useNeighborhood } from './useNeighborhood'
import { RIDER_DRAG_TYPE } from './RiderCard'
import { SuggestedRider } from './SuggestedRider'

/** Type of the drag data when an order is dragged onto a rider. */
const ORDER_DRAG_TYPE = 'application/x-despacho-order'

const ICON_SIZE = 16

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
  onSelect: (orderId: string, add: boolean) => void
  /** A free rider (by number) was dropped on this order. */
  onDropRider: (orderId: string, riderNumber: number) => void
}

/** The urgency in words, next to the color and the icon: amber and red are easy to mix up. */
const URGENCY_TAG: Partial<Record<Urgency, TextKey>> = {
  urgent: 'orders.urgentTag',
  late: 'orders.lateTag',
}

/**
 * A compact order. The time left leads (it decides the triage), in green, amber or red with its icon; under it
 * the order number and restaurant, and the urgency in words when it matters.
 */
function OrderCard({ order, nowSec, restaurantName, selected, onSelect, onDropRider }: OrderCardProps) {
  const hoverOrder = usePointerStore((state) => state.hoverOrder)
  const dragOrder = usePointerStore((state) => state.dragOrder)
  const hovered = usePointerStore((state) => state.hoveredOrderId === order.id)
  const riderDragged = usePointerStore((state) => state.draggedRiderId !== null)
  const ref = useRef<HTMLButtonElement>(null)
  // Picked with the arrow keys (or on the map): keep it in view in a long queue.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selected])
  const urgency = urgencyOf(order, nowSec, prototype.orders.urgentBelowSec)
  const left = timeLeftSec(order, nowSec)
  const tag = left > 0 ? URGENCY_TAG[urgency] : undefined

  return (
    <li data-testid="order-card">
      <button
        ref={ref}
        type="button"
        className={`order-card order-card--${urgency}${selected ? ' order-card--selected' : ''}${hovered ? ' order-card--hovered' : ''}${riderDragged ? ' order-card--drop' : ''}`}
        aria-pressed={selected}
        onClick={(event) => onSelect(order.id, event.shiftKey)}
        onMouseEnter={() => hoverOrder(order.id)}
        onMouseLeave={() => hoverOrder(null)}
        onFocus={() => hoverOrder(order.id)}
        onBlur={() => hoverOrder(null)}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(ORDER_DRAG_TYPE, order.id)
          event.dataTransfer.effectAllowed = 'move'
          dragOrder(order.id)
        }}
        onDragEnd={() => dragOrder(null)}
        onDragOver={(event) => {
          if (riderDragged) event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          const riderNumber = Number(event.dataTransfer.getData(RIDER_DRAG_TYPE))
          usePointerStore.getState().dragRider(null)
          if (riderNumber > 0) onDropRider(order.id, riderNumber)
        }}
      >
        <span className="order-card__header">
          <span className="order-card__deadline">
            <DeadlineIcon urgency={urgency} />
            <span className="order-card__time">
              {left > 0 ? t('orders.minutesLeft', { minutes: gameMinutes(left, gameTime) }) : t('orders.late')}
            </span>
          </span>
          {isReady(order, nowSec) ? (
            <FoodHeat order={order} nowSec={nowSec} />
          ) : (
            <span className="order-card__cooking" role="img" aria-label={t('orders.cooking')} title={t('orders.cooking')}>
              <ChefHat size={ICON_SIZE} aria-hidden />
            </span>
          )}
        </span>
        <span className="order-card__restaurant">
          <span className="order-card__number">{t('orders.number', { number: order.number })}</span>
          <span className="order-card__name">{restaurantName}</span>
          {tag && <span className={`order-card__tag order-card__tag--${urgency}`}>{t(tag)}</span>}
        </span>
      </button>
      {urgency === 'urgent' && <SuggestedRider order={order} />}
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
  const neighborhood = useNeighborhood()
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const addedOrderIds = useShiftStore((state) => state.addedOrderIds)
  const selectOrder = useShiftStore((state) => state.selectOrder)
  const dispatchByDrop = useShiftStore((state) => state.dispatchByDrop)
  const pending = waitingQueue(orders)
  const delivered = orders.filter((order) => order.status === 'delivered').length
  const cancelled = orders.filter((order) => order.status === 'cancelled').length
  const nameOf = (id: string) => {
    const restaurant = restaurants.find((candidate) => candidate.id === id)
    return restaurant ? restaurantName(restaurant, neighborhood) : '?'
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
              selected={order.id === selectedOrderId || addedOrderIds.includes(order.id)}
              onSelect={selectOrder}
              onDropRider={dispatchByDrop}
            />
          ))}
        </ol>
      )}
    </aside>
  )
}
