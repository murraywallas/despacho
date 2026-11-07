import { Bike } from 'lucide-react'
import { useMemo } from 'react'
import { rankRiders } from '../game/dispatch'
import type { Order } from '../game/orders'
import { isReady } from '../game/rating'
import type { Rider, RiderStatus } from '../game/riders'
import { t, type TextKey } from '../i18n'
import { settings, useShiftStore } from '../store/shiftStore'
import { gameMinutes } from './formatClock'
import { gameTime } from './gameTime'
import { FoodHeat } from './FoodHeat'

const ICON_SIZE = 16

const STATUS_TEXT: Record<RiderStatus, TextKey> = {
  idle: 'riders.status.idle',
  toRestaurant: 'riders.status.toRestaurant',
  atKitchen: 'riders.status.atKitchen',
  toCustomer: 'riders.status.toCustomer',
}

const VEHICLE_TEXT: Record<string, TextKey | undefined> = {
  bike: 'vehicles.bike',
}

interface RiderCardProps {
  rider: Rider
  /** Seconds to the selected order's restaurant; undefined when nothing is selected or the rider is busy. */
  etaSec?: number
  order?: Order
  nowSec: number
  /** Free riders can be picked; with an order picked, picking one gives it the order. */
  canPick: boolean
  selected: boolean
  onPick: (riderNumber: number) => void
}

function RiderCard({ rider, etaSec, order, nowSec, canPick, selected, onPick }: RiderCardProps) {
  const vehicleKey = VEHICLE_TEXT[rider.vehicle]
  return (
    <li data-testid="rider-card" data-rider-number={rider.number}>
      <button
        type="button"
        className={`rider-card rider-card--${rider.status}${selected ? ' rider-card--selected' : ''}`}
        disabled={!canPick}
        aria-pressed={selected}
        onClick={() => onPick(rider.number)}
        aria-keyshortcuts={String(rider.number)}
      >
        <span className="rider-card__badge" aria-hidden>
          {rider.number}
        </span>
        <span className="rider-card__body">
          <span className="rider-card__name">{t('riders.name', { number: rider.number })}</span>
          <span className="rider-card__vehicle">
            <Bike size={ICON_SIZE} aria-hidden />
            {vehicleKey ? t(vehicleKey) : rider.vehicle}
          </span>
          <span className="rider-card__status">
            {t(STATUS_TEXT[rider.status])}
            {order && ` · ${t('riders.carrying', { number: order.number })}`}
            {rider.status === 'atKitchen' && rider.trip && (
              <span className="rider-card__kitchen">
                {t('riders.kitchenLeft', { minutes: gameMinutes(rider.trip.kitchenLeftSec, gameTime) })}
              </span>
            )}
          </span>
          {order && isReady(order, nowSec) && <FoodHeat order={order} nowSec={nowSec} />}
        </span>
        {etaSec !== undefined && (
          <span className="rider-card__eta">{t('riders.eta', { minutes: gameMinutes(etaSec, gameTime) })}</span>
        )}
      </button>
    </li>
  )
}

/**
 * The fleet. A free rider can be picked first (then an order on the map), or after an order: then free riders
 * are sorted by how soon they reach its restaurant (ETA) and clicking one assigns the order. Busy riders go last.
 */
export function RiderPanel() {
  const map = useShiftStore((state) => state.map)
  const riders = useShiftStore((state) => state.riders)
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const selectedRiderId = useShiftStore((state) => state.selectedRiderId)
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const pickRider = useShiftStore((state) => state.pickRider)
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const idle = riders.filter((rider) => rider.status === 'idle').length

  const ranked = useMemo(
    () => (selectedOrder ? rankRiders(map, riders, selectedOrder, settings.movement.metersPerSec) : []),
    [map, riders, selectedOrder],
  )
  const etaOf = new Map(ranked.map((entry) => [entry.rider.id, entry.etaSec]))
  const ordered = selectedOrder
    ? [...ranked.map((entry) => entry.rider), ...riders.filter((rider) => rider.status !== 'idle')]
    : riders

  return (
    <aside className="side-panel" aria-labelledby="rider-panel-title">
      <h2 className="side-panel__title" id="rider-panel-title">
        {t('riders.title')}
        <span className="side-panel__count" aria-label={t('riders.idleCount', { idle, total: riders.length })}>
          {idle}/{riders.length}
        </span>
      </h2>
      <p className="side-panel__hint">
        {selectedOrder ? t('riders.hintByEta') : selectedRiderId ? t('riders.hintPickedRider') : t('riders.hintPickFirst')}
      </p>
      <ol className="side-panel__list">
        {ordered.map((rider) => (
          <RiderCard
            key={rider.id}
            rider={rider}
            etaSec={etaOf.get(rider.id)}
            order={orders.find((order) => order.id === rider.orderId)}
            nowSec={nowSec}
            canPick={rider.status === 'idle'}
            selected={rider.id === selectedRiderId}
            onPick={pickRider}
          />
        ))}
      </ol>
    </aside>
  )
}
