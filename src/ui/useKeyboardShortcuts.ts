import { useEffect } from 'react'

interface Shortcuts {
  onTogglePause: () => void
}

function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/** Space pauses and resumes, even when a button has focus. Typing in a text field is left alone. */
export function useKeyboardShortcuts({ onTogglePause }: Shortcuts): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTextField(event.target)) return
      // Stops the page from scrolling and a focused button from also reacting to Space.
      event.preventDefault()
      if (!event.repeat) onTogglePause()
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
  }, [onTogglePause])
}
