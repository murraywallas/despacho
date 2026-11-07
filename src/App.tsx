import { t } from './i18n'
import { useShiftStore } from './store/shiftStore'
import { MapView } from './ui/MapView'
import { TopBar } from './ui/TopBar'
import { useGameLoop } from './ui/useGameLoop'
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts'

export default function App() {
  const map = useShiftStore((state) => state.map)
  const tick = useShiftStore((state) => state.tick)
  const togglePause = useShiftStore((state) => state.togglePause)

  useGameLoop(tick)
  useKeyboardShortcuts({ onTogglePause: togglePause })

  return (
    <div className="shift-screen">
      <TopBar />
      <main className="shift-screen__map" aria-label={t('shift.mapArea')}>
        <MapView map={map} />
      </main>
    </div>
  )
}
