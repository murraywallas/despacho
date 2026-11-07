import { useEffect } from 'react'

interface Shortcuts {
  onTogglePause: () => void
  /** Keys 1–9 pick the rider with that number. */
  onPickRider: (riderNumber: number) => void
  /** Escape drops the selected order. */
  onCancelSelection: () => void
}

function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/** Matches the number keys on the main row and on the numeric keypad. */
const RIDER_KEY = /^(?:Digit|Numpad)([1-9])$/

/**
 * Space pauses and resumes (even when a button has focus), 1–9 pick a rider, Escape drops the selection.
 * Typing in a text field is left alone.
 */
export function useKeyboardShortcuts({ onTogglePause, onPickRider, onCancelSelection }: Shortcuts): void {
  useEffect(() => {
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
  }, [onTogglePause, onPickRider, onCancelSelection])
}
