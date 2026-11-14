import { useMemo } from 'react'
import { prototype } from '../game/balance'
import { needsAttention } from '../game/attention'
import { useShiftStore } from '../store/shiftStore'

/**
 * Riders the game points at right now: they just went free and the player hasn't used or picked them, and either
 * orders are waiting or it happened a moment ago. By rider id.
 */
export function useAttention(): ReadonlySet<string> {
  const freeSince = useShiftStore((state) => state.freeSince)
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  const waiting = useShiftStore((state) => state.orderQueue.orders.filter((order) => order.status === 'pending').length)
  const highlightSec = prototype.tools.freeHighlightSec ?? 0
  const ids = Object.keys(freeSince)
    .filter((id) => needsAttention(freeSince, id, nowSec, waiting, highlightSec))
    .sort()
    .join(',')
  // The same set while the same riders stand out, so cards and markers don't redo their work every tick.
  return useMemo(() => new Set(ids ? ids.split(',') : []), [ids])
}
