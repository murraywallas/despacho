import { useCallback } from 'react'
import { t } from './i18n'
import { useShiftStore } from './store/shiftStore'
import { MapView } from './ui/MapView'
import { OrderPanel } from './ui/OrderPanel'
import { ResultsScreen } from './ui/ResultsScreen'
import { RiderPanel } from './ui/RiderPanel'
import { TopBar } from './ui/TopBar'
import { useGameLoop } from './ui/useGameLoop'
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts'

export default function App() {
  const map = useShiftStore((state) => state.map)
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const riders = useShiftStore((state) => state.riders)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const finished = useShiftStore((state) => state.clock.finished)
  const tick = useShiftStore((state) => state.tick)
  const togglePause = useShiftStore((state) => state.togglePause)
  const selectOrder = useShiftStore((state) => state.selectOrder)
  const assignSelectedTo = useShiftStore((state) => state.assignSelectedTo)
  const cancelSelection = useCallback(() => selectOrder(null), [selectOrder])

  useGameLoop(tick)
  useKeyboardShortcuts({
    onTogglePause: togglePause,
    onPickRider: assignSelectedTo,
    onCancelSelection: cancelSelection,
    enabled: !finished,
  })

  return (
    <div className="shift-screen">
      <TopBar />
      <div className="shift-screen__body" inert={finished}>
        <OrderPanel />
        <main className="shift-screen__map" aria-label={t('shift.mapArea')}>
          <MapView map={map} orders={orders} riders={riders} selectedOrderId={selectedOrderId} />
        </main>
        <RiderPanel />
      </div>
      {finished && <ResultsScreen />}
    </div>
  )
}
