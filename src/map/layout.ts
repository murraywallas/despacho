import type { LonLat, StreetGraphFile } from '../game/streetGraph'

/** Where the area sits inside the canvas, in CSS pixels. */
export interface MapLayout {
  /** Pixels per degree of longitude and of latitude: different, so a meter is the same length both ways. */
  readonly pxPerLon: number
  readonly pxPerLat: number
  /** Canvas position of the area's north-west corner. */
  readonly originX: number
  readonly originY: number
  readonly west: number
  readonly north: number
}

/** Fits the area's box in the middle of the canvas, leaving `padding` around it, without stretching it. */
export function computeLayout(
  width: number,
  height: number,
  bbox: StreetGraphFile['bbox'],
  padding: number,
): MapLayout {
  const [south, west, north, east] = bbox
  // A degree of longitude is shorter than one of latitude, by the cosine of the latitude.
  const lonShrink = Math.cos((((south + north) / 2) * Math.PI) / 180)
  const spanX = (east - west) * lonShrink
  const spanY = north - south
  const pxPerLat = Math.max(0, Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY))
  const pxPerLon = pxPerLat * lonShrink
  return {
    pxPerLon,
    pxPerLat,
    originX: (width - (east - west) * pxPerLon) / 2,
    originY: (height - spanY * pxPerLat) / 2,
    west,
    north,
  }
}

/** Canvas position of a point of the map. */
export function toCanvas(layout: MapLayout, [lon, lat]: LonLat): { x: number; y: number } {
  return {
    x: layout.originX + (lon - layout.west) * layout.pxPerLon,
    y: layout.originY + (layout.north - lat) * layout.pxPerLat,
  }
}
