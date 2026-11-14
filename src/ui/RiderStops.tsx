import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { useState } from 'react'
import type { Order } from '../game/orders'
import type { Rider } from '../game/riders'
import { stopEtas } from '../game/stops'
import { t } from '../i18n'
import { speedsAt, useShiftStore } from '../store/shiftStore'
import { gameMinutes } from './formatClock'
import { gameTime } from './gameTime'

const ICON_SIZE = 14

function moved(ids: readonly string[], from: number, to: number): string[] {
  const next = [...ids]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * The stops of a rider's trip, in delivery order, with the minutes until each customer. Drag a stop (or use its
 * arrows) to change the order: the last customer waits the most.
 */
export function RiderStops({ rider, orders, nowSec }: { rider: Rider; orders: readonly Order[]; nowSec: number }) {
  const map = useShiftStore((state) => state.map)
  const reorder = useShiftStore((state) => state.reorderStops)
  const [dragging, setDragging] = useState<number | null>(null)
  const ids = rider.orderIds ?? []
  if (ids.length < 2) return null

  const etas = new Map(stopEtas(map, rider, orders, speedsAt(nowSec), nowSec).map((eta) => [eta.orderId, eta.atSec]))
  const numberOf = (id: string) => orders.find((order) => order.id === id)?.number ?? '?'
  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return
    reorder(rider.number, moved(ids, from, to))
  }

  return (
    <ol className="rider-stops" aria-label={t('riders.stops', { number: rider.number })}>
      {ids.map((id, index) => {
        const eta = etas.get(id)
        const number = numberOf(id)
        return (
          <li
            key={id}
            className={`rider-stops__stop${dragging === index ? ' rider-stops__stop--dragging' : ''}`}
            data-testid="rider-stop"
            draggable
            onDragStart={(event) => {
              setDragging(index)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', String(index))
            }}
            onDragEnd={() => setDragging(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              move(Number(event.dataTransfer.getData('text/plain')), index)
              setDragging(null)
            }}
          >
            <GripVertical size={ICON_SIZE} aria-hidden className="rider-stops__grip" />
            <span className="rider-stops__number">{t('riders.stop', { position: index + 1, number })}</span>
            {eta !== undefined && (
              <span className="rider-stops__eta">
                {t('riders.eta', { minutes: gameMinutes(Math.max(0, eta - nowSec), gameTime) })}
              </span>
            )}
            <button
              type="button"
              className="rider-stops__move hit-area"
              onClick={() => move(index, index - 1)}
              disabled={index === 0}
              aria-label={t('riders.stopUp', { number })}
            >
              <ArrowUp size={ICON_SIZE} aria-hidden />
            </button>
            <button
              type="button"
              className="rider-stops__move hit-area"
              onClick={() => move(index, index + 1)}
              disabled={index === ids.length - 1}
              aria-label={t('riders.stopDown', { number })}
            >
              <ArrowDown size={ICON_SIZE} aria-hidden />
            </button>
          </li>
        )
      })}
    </ol>
  )
}
