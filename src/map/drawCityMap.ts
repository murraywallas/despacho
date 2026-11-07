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
  /** Accent of the selected order: its card, its restaurant and its customer share it. */
  selected: string
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
  /** Trips of assigned orders (rider → restaurant → customer), drawn as lines under the markers. */
  readonly routes: readonly (readonly Point[])[]
  /** Restaurant and customer of the selected order, ringed with the selection accent. */
  readonly highlight?: { readonly restaurant: Point; readonly customer: Point }
}

/** Space around the grid, in CSS pixels. */
const PADDING = 32
/** Sizes relative to the length of one block. */
const STREET_WIDTH_RATIO = 0.12
const RESTAURANT_SIZE_RATIO = 0.55
const CUSTOMER_SIZE_RATIO = 0.42
const RIDER_SIZE_RATIO = 0.5
const ROUTE_WIDTH_RATIO = 0.07
const HIGHLIGHT_RADIUS_RATIO = 0.44
const HIGHLIGHT_WIDTH_RATIO = 0.08

function drawRoutes(context: CanvasRenderingContext2D, layout: MapLayout, scene: MapScene, colors: MapColors) {
  context.strokeStyle = colors.rider
  context.lineWidth = Math.max(2, layout.spacing * ROUTE_WIDTH_RATIO)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.setLineDash([layout.spacing * 0.18, layout.spacing * 0.14])
  for (const route of scene.routes) {
    if (route.length < 2) continue
    context.beginPath()
    route.forEach((point, index) => {
      const { x, y } = toCanvas(layout, point)
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()
  }
  context.setLineDash([])
}

function drawHighlight(context: CanvasRenderingContext2D, layout: MapLayout, scene: MapScene, colors: MapColors) {
  if (!scene.highlight) return
  context.strokeStyle = colors.selected
  context.lineWidth = Math.max(2, layout.spacing * HIGHLIGHT_WIDTH_RATIO)
  for (const point of [scene.highlight.restaurant, scene.highlight.customer]) {
    const { x, y } = toCanvas(layout, point)
    context.beginPath()
    context.arc(x, y, layout.spacing * HIGHLIGHT_RADIUS_RATIO, 0, Math.PI * 2)
    context.stroke()
  }
}

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
  drawRoutes(context, layout, scene, colors)
  drawHighlight(context, layout, scene, colors)

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
