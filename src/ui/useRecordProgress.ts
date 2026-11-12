import { useEffect } from 'react'
import { prototype } from '../game/balance'
import { averageRating } from '../game/rating'
import { useProgressStore } from '../store/progressStore'
import { useShiftStore } from '../store/shiftStore'
import { moneyOfShift } from './moneyOfShift'

/** When a level's shift ends, saves its stars (the best of each level is kept) and adds its profit to the money. */
export function useRecordProgress(): void {
  useEffect(
    () =>
      useShiftStore.subscribe((state, previous) => {
        if (!state.clock.finished || previous.clock.finished || state.levelId === null) return
        const average = averageRating(state.orderQueue.orders, prototype.heat, prototype.rating)
        if (average !== undefined) useProgressStore.getState().record(state.levelId, average)
        useProgressStore.getState().earn(moneyOfShift(state.orderQueue.orders, state.riders).profitKr)
      }),
    [],
  )
}
