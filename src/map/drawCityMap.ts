import { positionOf, type CityMap } from '../game/cityMap'
import { STREET_KINDS, type LonLat } from '../game/streetGraph'
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

/** Something drawn on the map with a short label: a customer or a rider. */
export interface Marker {
  readonly position: LonLat
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
  readonly routes: readonly (readonly LonLat[])[]
  /** Restaurant and customer of the selected order, ringed with the selection accent. */
  readonly highlight?: { readonly restaurant: LonLat; readonly customer: LonLat }
}

/** Space around the area, in CSS pixels. */
const PADDING = 16
/** Marker and line sizes, in CSS pixels. */
const SIZE = {
  minorStreet: 1,
  majorStreet: 2.5,
  restaurant: 22,
  customer: 17,
  rider: 22,
  route: 3,
  highlightRadius: 17,
  highlightWidth: 2.5,
}
const MAJOR = STREET_KINDS.indexOf('major')

// Drawing 6,000 street stretches every frame is wasted work: they never move. They are drawn once per size
// and color theme on a canvas of their own, and copied under the moving parts.
let streetCache: { key: string; canvas: HTMLCanvasElement } | undefined

function drawStreets(
  context: CanvasRenderingContext2D,
  layout: MapLayout,
  map: CityMap,
  colors: MapColors,
  size: { width: number; height: number; ratio: number },
) {
  const key = `${map.network.streets.osmTimestamp}|${size.width}x${size.height}@${size.ratio}|${colors.street}`
  if (streetCache?.key !== key) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(size.width * size.ratio)
    canvas.height = Math.round(size.height * size.ratio)
    const streets = canvas.getContext('2d')
    if (!streets) return
    streets.setTransform(size.ratio, 0, 0, size.ratio, 0, 0)
    streets.strokeStyle = colors.street
    streets.lineCap = 'round'
    for (const major of [false, true]) {
      streets.lineWidth = major ? SIZE.majorStreet : SIZE.minorStreet
      streets.beginPath()
      for (const [a, b, , kind] of map.network.streets.edges) {
        if ((kind === MAJOR) !== major) continue
        const from = toCanvas(layout, positionOf(map, a))
        const to = toCanvas(layout, positionOf(map, b))
        streets.moveTo(from.x, from.y)
        streets.lineTo(to.x, to.y)
      }
      streets.stroke()
    }
    streetCache = { key, canvas }
  }
  context.drawImage(streetCache.canvas, 0, 0, size.width, size.height)
}

function drawRoutes(context: CanvasRenderingContext2D, layout: MapLayout, scene: MapScene, colors: MapColors) {
  context.strokeStyle = colors.rider
  context.lineWidth = SIZE.route
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.setLineDash([6, 5])
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
  context.lineWidth = SIZE.highlightWidth
  for (const point of [scene.highlight.restaurant, scene.highlight.customer]) {
    const { x, y } = toCanvas(layout, point)
    context.beginPath()
    context.arc(x, y, SIZE.highlightRadius, 0, Math.PI * 2)
    context.stroke()
  }
}

function drawLabel(context: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  context.font = `600 ${Math.round(size)}px system-ui, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = color
  context.fillText(text, x, y + 1)
}

/** Draws the whole map. width and height are in CSS pixels; ratio is the device pixel ratio. */
export function drawCityMap(
  context: CanvasRenderingContext2D,
  scene: MapScene,
  size: { width: number; height: number; ratio: number },
  colors: MapColors,
): void {
  const layout = computeLayout(size.width, size.height, scene.map.network.streets.bbox, PADDING)

  context.fillStyle = colors.background
  context.fillRect(0, 0, size.width, size.height)
  drawStreets(context, layout, scene.map, colors, size)
  drawRoutes(context, layout, scene, colors)
  drawHighlight(context, layout, scene, colors)

  const customerRadius = SIZE.customer / 2
  for (const customer of scene.customers) {
    const center = toCanvas(layout, customer.position)
    context.fillStyle = colors.customer
    context.beginPath()
    context.arc(center.x, center.y, customerRadius, 0, Math.PI * 2)
    context.fill()
    drawLabel(context, customer.label, center.x, center.y, customerRadius * 1.05, colors.customerInk)
  }

  for (const restaurant of scene.map.restaurants) {
    const center = toCanvas(layout, positionOf(scene.map, restaurant.node))
    context.fillStyle = colors.restaurant
    context.beginPath()
    context.roundRect(
      center.x - SIZE.restaurant / 2,
      center.y - SIZE.restaurant / 2,
      SIZE.restaurant,
      SIZE.restaurant,
      SIZE.restaurant * 0.2,
    )
    context.fill()
    drawLabel(context, restaurant.label, center.x, center.y, SIZE.restaurant * 0.6, colors.restaurantInk)
  }

  const riderHalf = SIZE.rider / 2
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
    context.lineWidth = 1.5
    context.strokeStyle = colors.background
    context.stroke()
    drawLabel(context, rider.label, center.x, center.y, riderHalf * 0.95, colors.riderInk)
  }
}
