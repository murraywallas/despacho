import { useEffect } from 'react'
import { levelIds, progression } from './game/balance'
import { isUnlocked } from './game/levels'
import { useProgressStore } from './store/progressStore'
import { useScreenStore } from './store/screenStore'
import { useShiftStore } from './store/shiftStore'
import { BriefingScreen } from './ui/BriefingScreen'
import { LevelSelect } from './ui/LevelSelect'
import { ShiftScreen } from './ui/ShiftScreen'
import { useRecordProgress } from './ui/useRecordProgress'
import { useSounds } from './ui/useSounds'

/** `?level=<id>` opens that level straight away, if it is unlocked (handy to share or test a level). */
const LEVEL_PARAM = 'level'

export default function App() {
  const screen = useScreenStore((state) => state.screen)
  useSounds()
  useRecordProgress()

  useEffect(() => {
    const levelId = new URLSearchParams(window.location.search).get(LEVEL_PARAM)
    if (!levelId || !levelIds.includes(levelId)) return
    if (!isUnlocked(levelIds, useProgressStore.getState().best, levelId, progression.unlockAvgRating)) return
    useShiftStore.getState().startLevel(levelId)
    useScreenStore.getState().showShift()
  }, [])

  if (screen === 'shift') return <ShiftScreen />
  if (screen === 'briefing') return <BriefingScreen />
  return <LevelSelect />
}
