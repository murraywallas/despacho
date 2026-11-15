/**
 * Layout of the map on screen, in CSS pixels: keeping what matters out from under the panels and bars, and pins
 * that would cover each other apart. Pure, so it is tested without a browser.
 */

export interface Rect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/** A pin on screen: where its point is and how big its card is. */
export interface PinBox {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** How much one axis has to move for [from, to] to fit in [min, max]; the start wins when it doesn't fit. */
function shiftInto(from: number, to: number, min: number, max: number): number {
  if (from < min) return min - from
  if (to > max) return Math.max(max - to, min - from)
  return 0
}

/**
 * How far the map's content has to move (in pixels, right and down) so every target lies in the free part of the
 * screen. Zero when they all show already: the camera only moves when something picked is hidden. When they don't
 * all fit, the first one (the restaurant) wins.
 */
export function revealDelta(targets: readonly Rect[], free: Rect): { dx: number; dy: number } {
  if (targets.length === 0) return { dx: 0, dy: 0 }
  const first = targets[0]
  const box = targets.reduce<Rect>(
    (all, rect) => ({
      left: Math.min(all.left, rect.left),
      top: Math.min(all.top, rect.top),
      right: Math.max(all.right, rect.right),
      bottom: Math.max(all.bottom, rect.bottom),
    }),
    first,
  )
  const fits = box.right - box.left <= free.right - free.left && box.bottom - box.top <= free.bottom - free.top
  const shown = fits ? box : first
  return {
    dx: shiftInto(shown.left, shown.right, free.left, free.right),
    dy: shiftInto(shown.top, shown.bottom, free.top, free.bottom),
  }
}

/**
 * Sideways offsets that keep pins from covering each other: two cards that overlap are pushed apart, half each,
 * until there are `gap` pixels between them. Pins that don't overlap get no offset.
 */
export function spreadApart(pins: readonly PinBox[], gap: number): ReadonlyMap<string, number> {
  const offsets = new Map<string, number>()
  const sorted = [...pins].sort((a, b) => a.x - b.x || a.key.localeCompare(b.key))
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      const ax = a.x + (offsets.get(a.key) ?? 0)
      const bx = b.x + (offsets.get(b.key) ?? 0)
      const needX = (a.width + b.width) / 2 + gap
      const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) / 2
      if (!overlapY || bx - ax >= needX) continue
      const push = (needX - (bx - ax)) / 2
      offsets.set(a.key, (offsets.get(a.key) ?? 0) - push)
      offsets.set(b.key, (offsets.get(b.key) ?? 0) + push)
    }
  }
  return offsets
}
