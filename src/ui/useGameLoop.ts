import { useEffect } from 'react'

/**
 * Longest real time step taken in one frame. When the tab is hidden the browser stops animation
 * frames; this cap keeps the clock from jumping ahead when the player comes back.
 * A technical limit, not a game number.
 */
const MAX_FRAME_SEC = 0.25

/** Calls onTick with the real seconds since the previous frame, once per animation frame. */
export function useGameLoop(onTick: (dtSec: number) => void): void {
  useEffect(() => {
    let last = performance.now()
    let frame = 0
    const loop = (now: number) => {
      const dtSec = Math.min((now - last) / 1000, MAX_FRAME_SEC)
      last = now
      onTick(dtSec)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [onTick])
}
