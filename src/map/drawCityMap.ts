import type { CityMap } from '../game/cityMap'
import { computeLayout, toCanvas } from './layout'

export interface MapColors {
  background: string
  street: string
  restaurant: string
  restaurantInk: string
}

/** Space around the grid, in CSS pixels. */
const PADDING = 32
/** Street width relative to the block length. */
const STREET_WIDTH_RATIO = 0.12
/** Restaurant marker size relative to the block length. */
const RESTAURANT_SIZE_RATIO = 0.55

/** Draws the grid and the restaurants. width and height are in CSS pixels. */
export function drawCityMap(
  context: CanvasRenderingContext2D,
  map: CityMap,
  width: number,
  height: number,
  colors: MapColors,
): void {
  const layout = computeLayout(width, height, map.grid.size, PADDING)
  const last = map.grid.size - 1

  context.fillStyle = colors.background
  context.fillRect(0, 0, width, height)

  context.strokeStyle = colors.street
  context.lineWidth = Math.max(1, layout.spacing * STREET_WIDTH_RATIO)
  context.lineCap = 'round'
  context.beginPath()
  for (let line = 0; line <= last; line++) {
    const rowStart = toCanvas(layout, { x: 0, y: line })
    const rowEnd = toCanvas(layout, { x: last, y: line })
    context.moveTo(rowStart.x, rowStart.y)
    context.lineTo(rowEnd.x, rowEnd.y)
    const columnStart = toCanvas(layout, { x: line, y: 0 })
    const columnEnd = toCanvas(layout, { x: line, y: last })
    context.moveTo(columnStart.x, columnStart.y)
    context.lineTo(columnEnd.x, columnEnd.y)
  }
  context.stroke()

  const markerSize = layout.spacing * RESTAURANT_SIZE_RATIO
  context.font = `600 ${Math.round(markerSize * 0.55)}px system-ui, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const restaurant of map.restaurants) {
    const center = toCanvas(layout, restaurant.position)
    context.fillStyle = colors.restaurant
    context.beginPath()
    context.roundRect(center.x - markerSize / 2, center.y - markerSize / 2, markerSize, markerSize, markerSize * 0.2)
    context.fill()
    context.fillStyle = colors.restaurantInk
    context.fillText(restaurant.label, center.x, center.y + 1)
  }
}
