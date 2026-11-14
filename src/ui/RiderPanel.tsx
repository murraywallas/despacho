import { useMemo } from 'react'
import { prototype } from '../game/balance'
import { hasBatteryFor, tripMeters } from '../game/battery'
import { capacityOf } from '../game/dispatch'
import { ordersOf } from '../game/movement'
import type { Rider } from '../game/riders'
import { freeAtSec, rankByDelivery } from '../game/stops'
import { t } from '../i18n'
import { usePointerStore } from '../store/pointerStore'
import { useProgressStore } from '../store/progressStore'
import { selectedOrderIds, speedsAt, useShiftStore } from '../store/shiftStore'
import { RiderCard } from './RiderCard'
import { useAttention } from './useAttention'

/** The how-to hint under the title shows during the first shifts only; then the player knows. */
const HINT_SHIFTS = 2

/**
 * The fleet. A free rider can be picked first (then an order on the map), or after an order: then free riders
 * are sorted by how soon the food would reach the customer with them, and clicking one assigns the order. Busy
 * riders go last.
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
  const attention = useAttention()
  const refusal = useShiftStore((state) => state.refusal)
  // When each busy rider is free again: the data for "wait for the bike, or send the skateboard now?".
  const freeInSecOf = (rider: Rider) => {
    const at = freeAtSec(map, rider, orders, speedsAt(nowSec), nowSec, prototype.riders.rechargeSec ?? 0)
    return at === undefined ? undefined : Math.max(0, at - nowSec)
  }
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  // A picked-up order can't change hands; an assigned one is being reassigned.
  const onTheWay = selectedOrder?.status === 'pickedUp'
  const idle = riders.filter((rider) => rider.status === 'idle').length

  const count = selectedOrder ? 1 + addedOrderIds.length : 0
  const ranked = useMemo(() => {
    if (!selectedOrder || onTheWay) return []
    // Reassigning costs the order part of its deadline: "late" is judged against what will be left.
    const first =
      selectedOrder.status === 'assigned'
        ? { ...selectedOrder, deadlineAtSec: selectedOrder.deadlineAtSec - prototype.tools.reassignPenaltySec }
        : selectedOrder
    const added = addedOrderIds.flatMap((id) => orders.find((order) => order.id === id) ?? [])
    return rankByDelivery(map, riders, [first, ...added], speedsAt(nowSec), nowSec)
  }, [map, riders, orders, selectedOrder, addedOrderIds, onTheWay, nowSec])
  const deliveryOf = new Map(ranked.map((entry) => [entry.rider.id, { inSec: entry.deliverAtSec - nowSec, late: entry.late }]))
  const fits = (rider: Rider) => capacityOf(rider.vehicle) >= Math.max(1, count)
  // Free and big enough, but the battery won't last the trip (rider, restaurant and every customer).
  const pickedTrip = selectedOrder ? [selectedOrder, ...addedOrderIds.flatMap((id) => orders.find((order) => order.id === id) ?? [])] : []
  const lacksBattery = (rider: Rider) =>
    rider.batteryM !== undefined && pickedTrip.length > 0 && !hasBatteryFor(rider, tripMeters(map, rider, pickedTrip))
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
        // Free and big enough, but with no way to get there: still listed, without an estimate.
        ...riders.filter((rider) => rider.status === 'idle' && fits(rider) && !deliveryOf.has(rider.id)),
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
            delivery={deliveryOf.get(rider.id)}
            trip={ordersOf(rider, orders)}
            orders={orders}
            nowSec={nowSec}
            canPick={rider.status === 'idle' && fits(rider) && !onTheWay}
            tooSmallFor={rider.status === 'idle' && !fits(rider) && !onTheWay ? count : undefined}
            noBattery={rider.status === 'idle' && fits(rider) && !onTheWay && lacksBattery(rider)}
            attention={attention.has(rider.id)}
            freeInSec={rider.status === 'idle' ? undefined : freeInSecOf(rider)}
            canTry={count > 0 && !onTheWay}
            refusal={refusal?.riderId === rider.id ? refusal : undefined}
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
