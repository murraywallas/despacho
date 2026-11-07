import { Bike, Snowflake, Thermometer } from 'lucide-react'
import { useMemo } from 'react'
import { prototype } from '../game/balance'
import { rankRiders } from '../game/dispatch'
import type { Order } from '../game/orders'
import { heatOf, isCold } from '../game/rating'
import type { Rider, RiderStatus } from '../game/riders'
import { t, type TextKey } from '../i18n'
import { useShiftStore } from '../store/shiftStore'

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
  canAssign: boolean
  onAssign: (riderNumber: number) => void
}

/** Heat of the food the rider carries: a number and a thermometer, or a snowflake once it is cold. */
function FoodHeat({ order, nowSec }: { order: Order; nowSec: number }) {
  const heat = Math.round(heatOf(order, nowSec, prototype.heat))
  const cold = isCold(heat, prototype.heat)
  const label = t(cold ? 'riders.heatCold' : 'riders.heatLabel', { heat, max: prototype.heat.start })
  return (
    <span
      className={`rider-card__heat${cold ? ' rider-card__heat--cold' : ''}`}
      data-testid="food-heat"
      role="img"
      aria-label={label}
      title={label}
    >
      {cold ? <Snowflake size={ICON_SIZE} aria-hidden /> : <Thermometer size={ICON_SIZE} aria-hidden />}
      {t('riders.heat', { heat })}
    </span>
  )
}

function RiderCard({ rider, etaSec, order, nowSec, canAssign, onAssign }: RiderCardProps) {
  const vehicleKey = VEHICLE_TEXT[rider.vehicle]
  return (
    <li data-testid="rider-card" data-rider-number={rider.number}>
      <button
        type="button"
        className={`rider-card rider-card--${rider.status}`}
        disabled={!canAssign}
        onClick={() => onAssign(rider.number)}
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
                {t('riders.kitchenLeft', { seconds: Math.ceil(rider.trip.kitchenLeftSec) })}
              </span>
            )}
          </span>
          {rider.status === 'toCustomer' && order && <FoodHeat order={order} nowSec={nowSec} />}
        </span>
        {etaSec !== undefined && (
          <span className="rider-card__eta">{t('riders.eta', { seconds: Math.ceil(etaSec) })}</span>
        )}
      </button>
    </li>
  )
}

/**
 * The fleet. With an order selected, free riders are sorted by how soon they reach its restaurant (ETA),
 * and clicking one assigns the order. Busy riders go last and can't be picked.
 */
export function RiderPanel() {
  const map = useShiftStore((state) => state.map)
  const riders = useShiftStore((state) => state.riders)
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const assignSelectedTo = useShiftStore((state) => state.assignSelectedTo)
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const idle = riders.filter((rider) => rider.status === 'idle').length

  const ranked = useMemo(
    () => (selectedOrder ? rankRiders(map, riders, selectedOrder, prototype.riders.speedBlocksPerSec) : []),
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
      {selectedOrder && <p className="side-panel__hint">{t('riders.hintByEta')}</p>}
      <ol className="side-panel__list">
        {ordered.map((rider) => (
          <RiderCard
            key={rider.id}
            rider={rider}
            etaSec={etaOf.get(rider.id)}
            order={orders.find((order) => order.id === rider.orderId)}
            nowSec={nowSec}
            canAssign={Boolean(selectedOrder) && rider.status === 'idle'}
            onAssign={assignSelectedTo}
          />
        ))}
      </ol>
    </aside>
  )
}
