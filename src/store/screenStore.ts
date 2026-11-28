import { create } from 'zustand'

/**
 * title: the first screen. levels: the neighborhood's levels. briefing: what's coming, before a shift. garage: the
 * fleet. shift: playing.
 */
export type Screen = 'title' | 'levels' | 'briefing' | 'garage' | 'shift'

interface ScreenState {
  screen: Screen
  /** Level shown in the briefing. */
  briefingLevelId: string | null
  showLevels: () => void
  /** Play, on the title screen: opens the neighborhoods (and the title doesn't show again until the browser tab closes). */
  play: () => void
  showBriefing: (levelId: string) => void
  /** The garage of the level in the briefing. */
  showGarage: () => void
  showShift: () => void
  /** The shift was started from the briefing (not from a link): the first one can show the guide. */
  fromBriefing: boolean
  startFromBriefing: () => void
}

const TITLE_SEEN = 'despacho-title-seen'

/** Whether this browser tab already went past the title (a reload goes straight to the neighborhoods). */
function titleSeen(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(TITLE_SEEN) === '1'
  } catch {
    return false
  }
}

export const useScreenStore = create<ScreenState>()((set) => ({
  screen: titleSeen() ? 'levels' : 'title',
  briefingLevelId: null,
  showLevels: () => set({ screen: 'levels' }),
  play: () => {
    try {
      globalThis.sessionStorage?.setItem(TITLE_SEEN, '1')
    } catch {
      // Without storage the title just shows again after a reload.
    }
    set({ screen: 'levels' })
  },
  showBriefing: (levelId) => set({ screen: 'briefing', briefingLevelId: levelId }),
  showGarage: () => set({ screen: 'garage' }),
  showShift: () => set({ screen: 'shift', fromBriefing: false }),
  fromBriefing: false,
  startFromBriefing: () => set({ screen: 'shift', fromBriefing: true }),
}))
