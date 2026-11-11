import { useCallback, useRef, useState } from 'react'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { useSoundStore } from '../store/soundStore'
import { MapView } from './MapView'
import { OrderPanel } from './OrderPanel'
import { PauseMenu } from './PauseMenu'
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
  const pickRider = useShiftStore((state) => state.pickRider)
  const callCustomer = useShiftStore((state) => state.callCustomer)
  const selectNextOrder = useShiftStore((state) => state.selectNextOrder)
  const toggleMute = useSoundStore((state) => state.toggleMute)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  // The menu pauses the game; closing it only resumes if the menu was what paused it.
  const pausedByMenu = useRef(false)

  const openMenu = useCallback(() => {
    const { clock, togglePause: pause } = useShiftStore.getState()
    pausedByMenu.current = !clock.paused && !clock.finished
    if (pausedByMenu.current) pause()
    setShowShortcuts(false)
    setShowMenu(true)
  }, [])
  const closeMenu = useCallback(() => {
    setShowMenu(false)
    const { clock, togglePause: resume } = useShiftStore.getState()
    if (pausedByMenu.current && clock.paused) resume()
    pausedByMenu.current = false
  }, [])
  const toggleShortcuts = useCallback(() => setShowShortcuts((shown) => !shown), [])
  // Esc closes the legend first; then it drops the selection; with nothing picked, it opens the pause menu.
  const cancel = useCallback(() => {
    const state = useShiftStore.getState()
    if (showShortcuts) setShowShortcuts(false)
    else if (state.selectedOrderId || state.selectedRiderId) state.clearSelection()
    // A restaurant card open on the map closes with that same Esc (MapView): nothing else to do.
    else if (!document.querySelector('[data-testid="map-popup"]')) openMenu()
  }, [showShortcuts, openMenu])

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
    enabled: !finished && !showMenu,
  })

  return (
    <div className={`shift-screen${paused && !finished ? ' shift-screen--paused' : ''}`}>
      <TopBar onShowShortcuts={toggleShortcuts} onOpenMenu={openMenu} />
      <div className="shift-screen__body" inert={finished || showMenu}>
        <OrderPanel />
        <main className="shift-screen__map" aria-label={t('shift.mapArea')}>
          <SelectionBar />
          <RadioFeed />
          <MapView map={map} orders={orders} riders={riders} selectedOrderId={selectedOrderId} />
        </main>
        <RiderPanel />
      </div>
      {showShortcuts && !finished && <ShortcutLegend onClose={() => setShowShortcuts(false)} />}
      {showMenu && !finished && (
        <PauseMenu
          onClose={closeMenu}
          onShowShortcuts={() => {
            closeMenu()
            setShowShortcuts(true)
          }}
        />
      )}
      {finished && <ResultsScreen />}
    </div>
  )
}
