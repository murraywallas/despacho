import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { economy } from '../game/balance'
import { recordResult, type Progress } from '../game/levels'
import { browserStorage } from './safeStorage'

interface ProgressState {
  /** Best average stars of each level finished. */
  best: Progress
  /** Shifts finished in this browser, of any level (the first ones show how-to hints). */
  played: number
  /** The player finished (or skipped) the guided first shift. */
  guideDone: boolean
  /** Money saved between shifts, in kr. Can go below zero after a bad shift. */
  moneyKr: number
  /** Adds a shift's profit (or loss) to the money. */
  earn: (profitKr: number) => void
  /** Saves a finished shift; only a better result replaces the old one. */
  record: (levelId: string, average: number) => void
  finishGuide: () => void
}

/** The player's progress through the levels, remembered in this browser. */
export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      best: {},
      played: 0,
      guideDone: false,
      moneyKr: economy.startingKr,
      earn: (profitKr) => set((state) => ({ moneyKr: state.moneyKr + profitKr })),
      finishGuide: () => set({ guideDone: true }),
      record: (levelId, average) =>
        set((state) => ({ best: recordResult(state.best, levelId, average), played: state.played + 1 })),
    }),
    {
      name: 'despacho-progress',
      storage: browserStorage,
      partialize: (state) => ({
        best: state.best,
        played: state.played,
        guideDone: state.guideDone,
        moneyKr: state.moneyKr,
      }),
    },
  ),
)
