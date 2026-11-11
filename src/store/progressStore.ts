import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { recordResult, type Progress } from '../game/levels'
import { browserStorage } from './safeStorage'

interface ProgressState {
  /** Best average stars of each level finished. */
  best: Progress
  /** Shifts finished in this browser, of any level (the first ones show how-to hints). */
  played: number
  /** The player finished (or skipped) the guided first shift. */
  guideDone: boolean
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
      finishGuide: () => set({ guideDone: true }),
      record: (levelId, average) =>
        set((state) => ({ best: recordResult(state.best, levelId, average), played: state.played + 1 })),
    }),
    {
      name: 'despacho-progress',
      storage: browserStorage,
      partialize: (state) => ({ best: state.best, played: state.played, guideDone: state.guideDone }),
    },
  ),
)
