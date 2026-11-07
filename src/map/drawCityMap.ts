import type { CityMap } from '../game/cityMap'
import type { Point } from '../game/grid'
import { computeLayout, toCanvas } from './layout'

export interface MapColors {
  background: string
  street: string
  restaurant: string
  restaurantInk: string
  customer: string
  customerInk: string
}

/** A customer waiting for an order, drawn as a circle with the order number. */
export interface CustomerMarker {
  readonly position: Point
  readonly label: string
}

/** Space around the grid, in CSS pixels. */
const PADDING = 32
/** Street width relative to the block length. */
const STREET_WIDTH_RATIO = 0.12
/** Restaurant marker size relative to the block length. */
const RESTAURANT_SIZE_RATIO = 0.55
/** Customer marker diameter relative to the block length. */
const CUSTOMER_SIZE_RATIO = 0.42

/** Draws the grid, the customers and the restaurants. width and height are in CSS pixels. */
export function drawCityMap(
  context: CanvasRenderingContext2D,
  map: CityMap,
  customers: readonly CustomerMarker[],
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

  const customerRadius = (layout.spacing * CUSTOMER_SIZE_RATIO) / 2
  context.font = `600 ${Math.round(customerRadius * 0.95)}px system-ui, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const customer of customers) {
    const center = toCanvas(layout, customer.position)
    context.fillStyle = colors.customer
    context.beginPath()
    context.arc(center.x, center.y, customerRadius, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = colors.customerInk
    context.fillText(customer.label, center.x, center.y + 1)
  }

  const markerSize = layout.spacing * RESTAURANT_SIZE_RATIO
  context.font = `600 ${Math.round(markerSize * 0.55)}px system-ui, sans-serif`
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
