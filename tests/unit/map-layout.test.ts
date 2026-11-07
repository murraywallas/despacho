import { describe, expect, test } from 'vitest'
import { distanceM, type StreetGraphFile } from '../../src/game/streetGraph'
import { computeLayout, toCanvas } from '../../src/map/layout'

// About 2.4 km north–south and 2.6 km east–west, like the Nørrebro area.
const bbox: StreetGraphFile['bbox'] = [55.6835, 12.525, 55.7055, 12.567]
const [south, west, north, east] = bbox

describe('ubicación del mapa en el canvas', () => {
  test('en un canvas ancho, el barrio ocupa todo el alto y queda centrado', () => {
    const layout = computeLayout(1400, 800, bbox, 20)
    const northWest = toCanvas(layout, [west, north])
    const southEast = toCanvas(layout, [east, south])
    expect(northWest.y).toBeCloseTo(20)
    expect(southEast.y).toBeCloseTo(780)
    expect(northWest.x + southEast.x).toBeCloseTo(1400)
  })

  test('en un canvas alto, ocupa todo el ancho y queda centrado', () => {
    const layout = computeLayout(600, 900, bbox, 20)
    const northWest = toCanvas(layout, [west, north])
    const southEast = toCanvas(layout, [east, south])
    expect(northWest.x).toBeCloseTo(20)
    expect(southEast.x).toBeCloseTo(580)
    expect(northWest.y + southEast.y).toBeCloseTo(900)
  })

  test('no se estira: un metro mide lo mismo de este a oeste que de norte a sur', () => {
    const layout = computeLayout(1000, 1000, bbox, 0)
    const widthPx = toCanvas(layout, [east, north]).x - toCanvas(layout, [west, north]).x
    const heightPx = toCanvas(layout, [west, south]).y - toCanvas(layout, [west, north]).y
    const middle = (south + north) / 2
    const widthM = distanceM([west, middle], [east, middle])
    const heightM = distanceM([west, south], [west, north])
    expect(widthPx / widthM).toBeCloseTo(heightPx / heightM, 2)
  })

  test('un canvas sin tamaño no da distancias negativas', () => {
    expect(computeLayout(0, 0, bbox, 20).pxPerLat).toBe(0)
  })
})
