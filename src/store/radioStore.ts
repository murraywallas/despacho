import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RadioItem } from '../game/radio'
import { browserStorage } from './safeStorage'

/** Lines kept in memory; the radio shows only the newest few. */
const KEPT = 30

export interface RadioEntry {
  readonly id: number
  readonly item: RadioItem
}

interface RadioState {
  entries: readonly RadioEntry[]
  /** The player hid the radio (remembered between games). */
  hidden: boolean
  add: (items: readonly RadioItem[]) => void
  clear: () => void
  toggleHidden: () => void
}

let nextId = 1

/** The event radio of the shift being played. */
export const useRadioStore = create<RadioState>()(
  persist(
    (set) => ({
      entries: [],
      hidden: false,
      add: (items) =>
        set((state) => ({
          entries: [...state.entries, ...items.map((item) => ({ id: nextId++, item }))].slice(-KEPT),
        })),
      clear: () => set({ entries: [] }),
      toggleHidden: () => set((state) => ({ hidden: !state.hidden })),
    }),
    { name: 'despacho-radio', storage: browserStorage, partialize: (state) => ({ hidden: state.hidden }) },
  ),
)
