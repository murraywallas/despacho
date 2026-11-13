import { capacityOf } from '../game/dispatch'
import type { Order } from '../game/orders'
import { isReady } from '../game/rating'
import type { Rider, RiderStatus } from '../game/riders'
import { t, type TextKey } from '../i18n'
import { usePointerStore } from '../store/pointerStore'
import { DeliveryEta } from './DeliveryEta'
import { FoodHeat } from './FoodHeat'
import { gameMinutes } from './formatClock'
import { gameTime } from './gameTime'
import { RiderStops } from './RiderStops'
import { VEHICLE_TEXT, VehicleIcon } from './VehicleIcon'

const ICON_SIZE = 16
/** Type of the drag data, so drops from outside the game are ignored. */
export const RIDER_DRAG_TYPE = 'application/x-despacho-rider'

const STATUS_TEXT: Record<RiderStatus, TextKey> = {
  idle: 'riders.status.idle',
  toRestaurant: 'riders.status.toRestaurant',
  atKitchen: 'riders.status.atKitchen',
  toCustomer: 'riders.status.toCustomer',
}

export interface RiderCardProps {
  rider: Rider
  /**
   * When the selected order would reach its customer with this rider (seconds from now, and whether that is after
   * the deadline); undefined when nothing is selected or the rider is busy.
   */
  delivery?: { readonly inSec: number; readonly late: boolean }
  /** The rider's orders, in delivery order. */
  trip: readonly Order[]
  orders: readonly Order[]
  nowSec: number
  /** Free riders can be picked; with orders picked, picking one gives them the orders. */
  canPick: boolean
  /** Free, but the vehicle doesn't carry that many orders. */
  tooSmallFor?: number
  selected: boolean
  /** While an order is dragged: true if dropping it here dispatches it, false if this rider can't take it. */
  dropTarget?: boolean
  onPick: (riderNumber: number) => void
  /** Picks one of this rider's orders (still at the restaurant) to give it to someone else. */
  onReassign: (orderId: string) => void
  /** An order was dropped on this rider. */
  onDropOrder: (orderId: string, riderNumber: number) => void
}

/**
 * One row of the fleet, in columns: key (1–9), vehicle and load, what they're doing, and when the selected order
 * would reach its customer with them. A free rider can be dragged onto an order, and an order dropped on them.
 */
export function RiderCard(props: RiderCardProps) {
  const { rider, delivery, trip, orders, nowSec, canPick, tooSmallFor, selected, dropTarget, onPick } = props
  const dragRider = usePointerStore((state) => state.dragRider)
  const draggedOrderId = usePointerStore((state) => state.draggedOrderId)
  const reassignable = trip.filter((stop) => stop.status === 'assigned')
  const vehicleKey = VEHICLE_TEXT[rider.vehicle]
  const order = trip[0]
  const capacity = capacityOf(rider.vehicle)
  const free = rider.status === 'idle'
  const dropClass = dropTarget === undefined ? '' : dropTarget ? ' rider-card--drop' : ' rider-card--no-drop'

  return (
    <li data-testid="rider-card" data-rider-number={rider.number}>
      <button
        type="button"
        className={`rider-card rider-card--${rider.status}${selected ? ' rider-card--selected' : ''}${dropClass}`}
        disabled={!canPick && !draggedOrderId}
        aria-disabled={!canPick}
        aria-pressed={selected}
        onClick={() => canPick && onPick(rider.number)}
        aria-keyshortcuts={String(rider.number)}
        draggable={free}
        onDragStart={(event) => {
          event.dataTransfer.setData(RIDER_DRAG_TYPE, String(rider.number))
          event.dataTransfer.effectAllowed = 'move'
          dragRider(rider.id)
        }}
        onDragEnd={() => dragRider(null)}
        onDragOver={(event) => {
          if (dropTarget) event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          usePointerStore.getState().dragOrder(null)
          if (dropTarget && draggedOrderId) props.onDropOrder(draggedOrderId, rider.number)
        }}
      >
        <span className="rider-card__badge" aria-hidden>
          {rider.number}
        </span>
        <span className="rider-card__body">
          <span className="visually-hidden">{t('riders.name', { number: rider.number })} · </span>
          <span className="rider-card__vehicle">
            <VehicleIcon vehicle={rider.vehicle} size={ICON_SIZE} aria-hidden />
            <span className="rider-card__vehicle-name">{vehicleKey ? t(vehicleKey) : rider.vehicle}</span>
            <span className="rider-card__load" title={t('riders.capacityTitle', { count: capacity })}>
              {t('riders.load', { count: trip.length, capacity })}
            </span>
          </span>
          <span className="rider-card__status">
            {t(STATUS_TEXT[rider.status])}
            {trip.length === 1 && ` · ${t('riders.carrying', { number: order.number })}`}
            {trip.length > 1 && ` · ${t('riders.carryingMany', { count: trip.length })}`}
            {rider.status === 'atKitchen' && rider.trip && (
              <span className="rider-card__kitchen">
                {t('riders.kitchenLeft', { minutes: gameMinutes(rider.trip.kitchenLeftSec, gameTime) })}
              </span>
            )}
          </span>
          {order && isReady(order, nowSec) && <FoodHeat order={order} nowSec={nowSec} />}
          {tooSmallFor !== undefined && <span className="rider-card__note">{t('riders.tooSmall', { count: tooSmallFor })}</span>}
        </span>
        {delivery && <DeliveryEta className="rider-card__eta" inSec={delivery.inSec} late={delivery.late} />}
      </button>
      {reassignable.length > 0 && (
        <div className="rider-card__tools">
          {reassignable.map((stop) => (
            <button
              key={stop.id}
              type="button"
              className="rider-card__reassign hit-area"
              onClick={() => props.onReassign(stop.id)}
              aria-label={t('riders.reassignLabel', { number: stop.number })}
            >
              {t('riders.reassign', { number: stop.number })}
            </button>
          ))}
        </div>
      )}
      <RiderStops rider={rider} orders={orders} nowSec={nowSec} />
    </li>
  )
}
