import type { CityMap } from '../game/cityMap'
import type { Point } from '../game/grid'
import { computeLayout, toCanvas, type MapLayout } from './layout'

export interface MapColors {
  background: string
  street: string
  restaurant: string
  restaurantInk: string
  customer: string
  customerInk: string
  rider: string
  riderInk: string
}

/** Something drawn on an intersection with a short label: a customer or a rider. */
export interface Marker {
  readonly position: Point
  readonly label: string
}

/** Everything the map shows. Each kind has its own shape, so they are told apart without color. */
export interface MapScene {
  readonly map: CityMap
  /** Customers waiting for an order: circles with the order number. */
  readonly customers: readonly Marker[]
  /** Riders: diamonds with the rider number. */
  readonly riders: readonly Marker[]
}

/** Space around the grid, in CSS pixels. */
const PADDING = 32
/** Sizes relative to the length of one block. */
const STREET_WIDTH_RATIO = 0.12
const RESTAURANT_SIZE_RATIO = 0.55
const CUSTOMER_SIZE_RATIO = 0.42
const RIDER_SIZE_RATIO = 0.5

function drawStreets(context: CanvasRenderingContext2D, layout: MapLayout, size: number, colors: MapColors) {
  const last = size - 1
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
}

function drawLabel(context: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  context.font = `600 ${Math.round(size)}px system-ui, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = color
  context.fillText(text, x, y + 1)
}

/** Draws the whole map. width and height are in CSS pixels. */
export function drawCityMap(
  context: CanvasRenderingContext2D,
  scene: MapScene,
  width: number,
  height: number,
  colors: MapColors,
): void {
  const layout = computeLayout(width, height, scene.map.grid.size, PADDING)

  context.fillStyle = colors.background
  context.fillRect(0, 0, width, height)
  drawStreets(context, layout, scene.map.grid.size, colors)

  const customerRadius = (layout.spacing * CUSTOMER_SIZE_RATIO) / 2
  for (const customer of scene.customers) {
    const center = toCanvas(layout, customer.position)
    context.fillStyle = colors.customer
    context.beginPath()
    context.arc(center.x, center.y, customerRadius, 0, Math.PI * 2)
    context.fill()
    drawLabel(context, customer.label, center.x, center.y, customerRadius * 0.95, colors.customerInk)
  }

  const restaurantSize = layout.spacing * RESTAURANT_SIZE_RATIO
  for (const restaurant of scene.map.restaurants) {
    const center = toCanvas(layout, restaurant.position)
    context.fillStyle = colors.restaurant
    context.beginPath()
    context.roundRect(
      center.x - restaurantSize / 2,
      center.y - restaurantSize / 2,
      restaurantSize,
      restaurantSize,
      restaurantSize * 0.2,
    )
    context.fill()
    drawLabel(context, restaurant.label, center.x, center.y, restaurantSize * 0.55, colors.restaurantInk)
  }

  const riderHalf = (layout.spacing * RIDER_SIZE_RATIO) / 2
  for (const rider of scene.riders) {
    const center = toCanvas(layout, rider.position)
    context.beginPath()
    context.moveTo(center.x, center.y - riderHalf)
    context.lineTo(center.x + riderHalf, center.y)
    context.lineTo(center.x, center.y + riderHalf)
    context.lineTo(center.x - riderHalf, center.y)
    context.closePath()
    context.fillStyle = colors.rider
    context.fill()
    context.lineWidth = Math.max(1, riderHalf * 0.15)
    context.strokeStyle = colors.background
    context.stroke()
    drawLabel(context, rider.label, center.x, center.y, riderHalf * 0.9, colors.riderInk)
  }
}
