import { useCallback } from 'react'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { useSoundStore } from '../store/soundStore'
import { MapView } from './MapView'
import { OrderPanel } from './OrderPanel'
import { ResultsScreen } from './ResultsScreen'
import { RiderPanel } from './RiderPanel'
import { SelectionBar } from './SelectionBar'
import { TopBar } from './TopBar'
import { useGameLoop } from './useGameLoop'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

/** The shift being played: top bar, orders, map, riders, and the results when the clock runs out. */
export function ShiftScreen() {
  const map = useShiftStore((state) => state.map)
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const riders = useShiftStore((state) => state.riders)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const finished = useShiftStore((state) => state.clock.finished)
  const tick = useShiftStore((state) => state.tick)
  const togglePause = useShiftStore((state) => state.togglePause)
  const selectOrder = useShiftStore((state) => state.selectOrder)
  const pickRider = useShiftStore((state) => state.pickRider)
  const callCustomer = useShiftStore((state) => state.callCustomer)
  const toggleMute = useSoundStore((state) => state.toggleMute)
  const cancelSelection = useCallback(() => selectOrder(null), [selectOrder])

  useGameLoop(tick)
  useKeyboardShortcuts({
    onTogglePause: togglePause,
    onPickRider: pickRider,
    onCancelSelection: cancelSelection,
    onCallCustomer: callCustomer,
    onToggleMute: toggleMute,
    enabled: !finished,
  })

  return (
    <div className="shift-screen">
      <TopBar />
      <div className="shift-screen__body" inert={finished}>
        <OrderPanel />
        <main className="shift-screen__map" aria-label={t('shift.mapArea')}>
          <SelectionBar />
          <MapView map={map} orders={orders} riders={riders} selectedOrderId={selectedOrderId} />
        </main>
        <RiderPanel />
      </div>
      {finished && <ResultsScreen />}
    </div>
  )
}
