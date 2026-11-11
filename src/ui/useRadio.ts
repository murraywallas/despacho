import { useEffect } from 'react'
import { prototype } from '../game/balance'
import { radioBetween } from '../game/radio'
import { useRadioStore } from '../store/radioStore'
import { useShiftStore } from '../store/shiftStore'

/** Feeds the event radio from the shift. A new shift (or "Jugar otra vez") starts with an empty radio. */
export function useRadio(): void {
  useEffect(() => {
    useRadioStore.getState().clear()
    return useShiftStore.subscribe((state, previous) => {
      if (state.clock.elapsedSec < previous.clock.elapsedSec) {
        useRadioStore.getState().clear()
        return
      }
      if (state.orderQueue === previous.orderQueue && state.clock.elapsedSec === previous.clock.elapsedSec) return
      const items = radioBetween(
        { orders: previous.orderQueue.orders, riders: previous.riders, nowSec: previous.clock.elapsedSec },
        { orders: state.orderQueue.orders, riders: state.riders, nowSec: state.clock.elapsedSec },
        prototype.heat,
      )
      if (items.length > 0) useRadioStore.getState().add(items)
    })
  }, [])
}
