/**
 * The fake city of the prototype: a square grid of streets. Riders move along streets,
 * from intersection to intersection, never diagonally.
 */

/** An intersection, by column (x) and row (y), both from 0 to size - 1. */
export interface Point {
  readonly x: number
  readonly y: number
}

export interface Grid {
  /** Streets per side: the grid has size × size intersections. */
  readonly size: number
}

export interface Route {
  /** Intersections from start to end, both included. */
  readonly points: readonly Point[]
  /** Length in blocks (one block = the street between two neighbouring intersections). */
  readonly blocks: number
}

const STEPS: readonly Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

export function createGrid(size: number): Grid {
  return { size }
}

export function isInside(grid: Grid, point: Point): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < grid.size && point.y < grid.size
}

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

/** Intersections one block away along a street. */
export function neighbors(grid: Grid, point: Point): Point[] {
  return STEPS.map((step) => ({ x: point.x + step.x, y: point.y + step.y })).filter((next) =>
    isInside(grid, next),
  )
}

const keyOf = (point: Point) => `${point.x},${point.y}`

/**
 * Shortest route along the streets (breadth-first search). Every street is open for now;
 * closed streets (events) will plug in here later.
 */
export function shortestRoute(grid: Grid, from: Point, to: Point): Route {
  if (!isInside(grid, from) || !isInside(grid, to)) {
    throw new Error(`Punto fuera de la grilla: ${keyOf(from)} → ${keyOf(to)}`)
  }

  const previous = new Map<string, Point | null>([[keyOf(from), null]])
  const queue: Point[] = [from]
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]
    if (samePoint(current, to)) break
    for (const next of neighbors(grid, current)) {
      if (previous.has(keyOf(next))) continue
      previous.set(keyOf(next), current)
      queue.push(next)
    }
  }

  const points: Point[] = []
  for (let step: Point | null | undefined = to; step; step = previous.get(keyOf(step))) {
    points.unshift(step)
  }
  return { points, blocks: points.length - 1 }
}
