import { useCallback, useState } from 'react'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { useSoundStore } from '../store/soundStore'
import { MapView } from './MapView'
import { OrderPanel } from './OrderPanel'
import { RadioFeed } from './RadioFeed'
import { ResultsScreen } from './ResultsScreen'
import { RiderPanel } from './RiderPanel'
import { SelectionBar } from './SelectionBar'
import { ShortcutLegend } from './ShortcutLegend'
import { TopBar } from './TopBar'
import { useGameLoop } from './useGameLoop'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useRadio } from './useRadio'

/** The shift being played: top bar, orders, map, riders, and the results when the clock runs out. */
export function ShiftScreen() {
  const map = useShiftStore((state) => state.map)
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const riders = useShiftStore((state) => state.riders)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const finished = useShiftStore((state) => state.clock.finished)
  const paused = useShiftStore((state) => state.clock.paused)
  const tick = useShiftStore((state) => state.tick)
  const togglePause = useShiftStore((state) => state.togglePause)
  const selectOrder = useShiftStore((state) => state.selectOrder)
  const pickRider = useShiftStore((state) => state.pickRider)
  const callCustomer = useShiftStore((state) => state.callCustomer)
  const selectNextOrder = useShiftStore((state) => state.selectNextOrder)
  const toggleMute = useSoundStore((state) => state.toggleMute)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const toggleShortcuts = useCallback(() => setShowShortcuts((shown) => !shown), [])
  // Esc closes the legend first; with the legend closed, it drops the selection.
  const cancel = useCallback(() => {
    if (showShortcuts) setShowShortcuts(false)
    else selectOrder(null)
  }, [showShortcuts, selectOrder])

  useGameLoop(tick)
  useRadio()
  useKeyboardShortcuts({
    onTogglePause: togglePause,
    onPickRider: pickRider,
    onCancelSelection: cancel,
    onCallCustomer: callCustomer,
    onToggleMute: toggleMute,
    onToggleShortcuts: toggleShortcuts,
    onMoveOrder: selectNextOrder,
    enabled: !finished,
  })

  return (
    <div className={`shift-screen${paused && !finished ? ' shift-screen--paused' : ''}`}>
      <TopBar onShowShortcuts={toggleShortcuts} />
      <div className="shift-screen__body" inert={finished}>
        <OrderPanel />
        <main className="shift-screen__map" aria-label={t('shift.mapArea')}>
          <SelectionBar />
          <RadioFeed />
          <MapView map={map} orders={orders} riders={riders} selectedOrderId={selectedOrderId} />
        </main>
        <RiderPanel />
      </div>
      {showShortcuts && !finished && <ShortcutLegend onClose={() => setShowShortcuts(false)} />}
      {finished && <ResultsScreen />}
    </div>
  )
}
