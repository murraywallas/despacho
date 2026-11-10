import { useMemo } from 'react'
import { capacityOf, rankRiders } from '../game/dispatch'
import { ordersOf } from '../game/movement'
import type { Rider } from '../game/riders'
import { t } from '../i18n'
import { usePointerStore } from '../store/pointerStore'
import { useProgressStore } from '../store/progressStore'
import { selectedOrderIds, settings, useShiftStore } from '../store/shiftStore'
import { RiderCard } from './RiderCard'

/** The how-to hint under the title shows during the first shifts only; then the player knows. */
const HINT_SHIFTS = 2

/**
 * The fleet. A free rider can be picked first (then an order on the map), or after an order: then free riders
 * are sorted by how soon they reach its restaurant (ETA) and clicking one assigns the order. Busy riders go last.
 */
export function RiderPanel() {
  const map = useShiftStore((state) => state.map)
  const riders = useShiftStore((state) => state.riders)
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const addedOrderIds = useShiftStore((state) => state.addedOrderIds)
  const selectedRiderId = useShiftStore((state) => state.selectedRiderId)
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const pickRider = useShiftStore((state) => state.pickRider)
  const selectOrder = useShiftStore((state) => state.selectOrder)
  const dispatchByDrop = useShiftStore((state) => state.dispatchByDrop)
  const draggedOrderId = usePointerStore((state) => state.draggedOrderId)
  const played = useProgressStore((state) => state.played)
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  // A picked-up order can't change hands; an assigned one is being reassigned.
  const onTheWay = selectedOrder?.status === 'pickedUp'
  const idle = riders.filter((rider) => rider.status === 'idle').length

  const count = selectedOrder ? 1 + addedOrderIds.length : 0
  const ranked = useMemo(
    () => (selectedOrder && !onTheWay ? rankRiders(map, riders, selectedOrder, settings.movement.metersPerSec, count) : []),
    [map, riders, selectedOrder, onTheWay, count],
  )
  const etaOf = new Map(ranked.map((entry) => [entry.rider.id, entry.etaSec]))
  const fits = (rider: Rider) => capacityOf(rider.vehicle) >= Math.max(1, count)
  // Dragging an order: free riders whose vehicle carries the trip (the whole batch, if the order is in it).
  const draggedCount =
    draggedOrderId && selectedOrderIds({ selectedOrderId, addedOrderIds }).includes(draggedOrderId) ? count : 1
  const canTakeDragged = (rider: Rider) => rider.status === 'idle' && capacityOf(rider.vehicle) >= draggedCount
  const hint = onTheWay
    ? t('riders.hintOnTheWay')
    : selectedOrder?.status === 'assigned'
      ? t('riders.hintReassign', { number: selectedOrder.number })
      : selectedOrder
        ? t('riders.hintByEta')
        : selectedRiderId
          ? t('riders.hintPickedRider')
          : played < HINT_SHIFTS
            ? t('riders.hintPickFirst')
            : null
  // Free riders by ETA first; then free ones whose vehicle is too small for the trip; busy ones last.
  const ordered = selectedOrder && !onTheWay
    ? [
        ...ranked.map((entry) => entry.rider),
        ...riders.filter((rider) => rider.status === 'idle' && !fits(rider)),
        ...riders.filter((rider) => rider.status !== 'idle'),
      ]
    : riders

  return (
    <aside className="side-panel" aria-labelledby="rider-panel-title">
      <h2 className="side-panel__title" id="rider-panel-title">
        {t('riders.title')}
        <span className="side-panel__count" aria-label={t('riders.idleCount', { idle, total: riders.length })}>
          {idle}/{riders.length}
        </span>
      </h2>
      {hint && <p className="side-panel__hint">{hint}</p>}
      <ol className="side-panel__list">
        {ordered.map((rider) => (
          <RiderCard
            key={rider.id}
            rider={rider}
            etaSec={etaOf.get(rider.id)}
            trip={ordersOf(rider, orders)}
            orders={orders}
            nowSec={nowSec}
            canPick={rider.status === 'idle' && fits(rider) && !onTheWay}
            tooSmallFor={rider.status === 'idle' && !fits(rider) && !onTheWay ? count : undefined}
            selected={rider.id === selectedRiderId}
            dropTarget={draggedOrderId ? canTakeDragged(rider) : undefined}
            onPick={pickRider}
            onReassign={selectOrder}
            onDropOrder={dispatchByDrop}
          />
        ))}
      </ol>
    </aside>
  )
}
