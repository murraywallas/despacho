import { useEffect } from 'react'

interface Shortcuts {
  onTogglePause: () => void
  /** Keys 1–9 pick the rider with that number. */
  onPickRider: (riderNumber: number) => void
  /** Escape drops the selected order. */
  onCancelSelection: () => void
  /** L calls the customer of the selected order. */
  onCallCustomer: () => void
  /** M turns the sound off and on. */
  onToggleMute: () => void
  /** Off while the results screen is up, so Space and Enter reach its button. */
  enabled?: boolean
}

// Inputs that take no typing: shortcuts still work while one has focus (the volume slider, say).
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button'])

function isTextField(target: EventTarget | null): boolean {
  return (
    (target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)) ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/** Matches the number keys on the main row and on the numeric keypad. */
const RIDER_KEY = /^(?:Digit|Numpad)([1-9])$/

/**
 * Space pauses and resumes (even when a button has focus), 1–9 pick a rider, L calls the customer, M mutes,
 * Escape drops the selection. Typing in a text field is left alone.
 */
export function useKeyboardShortcuts({
  onTogglePause,
  onPickRider,
  onCancelSelection,
  onCallCustomer,
  onToggleMute,
  enabled = true,
}: Shortcuts): void {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextField(event.target) || event.ctrlKey || event.metaKey || event.altKey) return

      if (event.code === 'Space') {
        // Stops the page from scrolling and a focused button from also reacting to Space.
        event.preventDefault()
        if (!event.repeat) onTogglePause()
        return
      }
      const riderKey = RIDER_KEY.exec(event.code)
      if (riderKey && !event.repeat) {
        onPickRider(Number(riderKey[1]))
        return
      }
      if (event.code === 'KeyL' && !event.repeat) {
        onCallCustomer()
        return
      }
      if (event.code === 'KeyM' && !event.repeat) {
        onToggleMute()
        return
      }
      if (event.key === 'Escape') onCancelSelection()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTextField(event.target)) event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [onTogglePause, onPickRider, onCancelSelection, onCallCustomer, onToggleMute, enabled])
}
