import type { Point } from '../game/grid'

/** Where the grid sits inside the canvas, in CSS pixels. */
export interface MapLayout {
  /** Distance between two neighbouring intersections. Same on both axes, so the map never stretches. */
  readonly spacing: number
  /** Position of intersection (0, 0). */
  readonly originX: number
  readonly originY: number
}

/** Fits a square grid of `gridSize` streets per side in the middle of the canvas, leaving `padding` around it. */
export function computeLayout(width: number, height: number, gridSize: number, padding: number): MapLayout {
  const side = Math.max(0, Math.min(width, height) - 2 * padding)
  const spacing = gridSize > 1 ? side / (gridSize - 1) : 0
  return {
    spacing,
    originX: (width - side) / 2,
    originY: (height - side) / 2,
  }
}

/** Canvas position of an intersection. */
export function toCanvas(layout: MapLayout, point: Point): { x: number; y: number } {
  return {
    x: layout.originX + point.x * layout.spacing,
    y: layout.originY + point.y * layout.spacing,
  }
}
