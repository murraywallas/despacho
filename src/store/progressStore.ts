import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { recordResult, type Progress } from '../game/levels'
import { browserStorage } from './safeStorage'

interface ProgressState {
  /** Best average stars of each level finished. */
  best: Progress
  /** Saves a finished shift; only a better result replaces the old one. */
  record: (levelId: string, average: number) => void
}

/** The player's progress through the levels, remembered in this browser. */
export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      best: {},
      record: (levelId, average) => set((state) => ({ best: recordResult(state.best, levelId, average) })),
    }),
    { name: 'despacho-progress', storage: browserStorage, partialize: (state) => ({ best: state.best }) },
  ),
)
