import { create } from 'zustand'

/** levels: the neighborhood's levels. briefing: what's coming, before a shift. shift: playing. */
export type Screen = 'levels' | 'briefing' | 'shift'

interface ScreenState {
  screen: Screen
  /** Level shown in the briefing. */
  briefingLevelId: string | null
  showLevels: () => void
  showBriefing: (levelId: string) => void
  showShift: () => void
}

export const useScreenStore = create<ScreenState>()((set) => ({
  screen: 'levels',
  briefingLevelId: null,
  showLevels: () => set({ screen: 'levels' }),
  showBriefing: (levelId) => set({ screen: 'briefing', briefingLevelId: levelId }),
  showShift: () => set({ screen: 'shift' }),
}))
