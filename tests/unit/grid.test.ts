import { describe, expect, test } from 'vitest'
import { prototype } from '../../src/game/balance'
import { createCityMap, placeRestaurants } from '../../src/game/cityMap'
import { createGrid, neighbors, shortestRoute, type Point } from '../../src/game/grid'
import { createRandom } from '../../src/game/random'

const grid = createGrid(10)

/** Each step of a route moves exactly one block along a street. */
function movesAlongStreets(points: readonly Point[]): boolean {
  return points.slice(1).every((point, index) => {
    const before = points[index]
    return Math.abs(point.x - before.x) + Math.abs(point.y - before.y) === 1
  })
}

describe('camino más corto', () => {
  test('mismo punto: cero cuadras', () => {
    const route = shortestRoute(grid, { x: 3, y: 3 }, { x: 3, y: 3 })
    expect(route.points).toEqual([{ x: 3, y: 3 }])
    expect(route.blocks).toBe(0)
  })

  test('en línea recta', () => {
    const route = shortestRoute(grid, { x: 1, y: 4 }, { x: 6, y: 4 })
    expect(route.blocks).toBe(5)
    expect(route.points).toHaveLength(6)
    expect(route.points.every((point) => point.y === 4)).toBe(true)
  })

  test('en diagonal va por las calles, sin cortar camino', () => {
    const route = shortestRoute(grid, { x: 2, y: 2 }, { x: 5, y: 6 })
    expect(route.blocks).toBe(3 + 4)
    expect(movesAlongStreets(route.points)).toBe(true)
    expect(route.points[0]).toEqual({ x: 2, y: 2 })
    expect(route.points.at(-1)).toEqual({ x: 5, y: 6 })
  })

  test('esquinas opuestas', () => {
    const route = shortestRoute(grid, { x: 0, y: 0 }, { x: 9, y: 9 })
    expect(route.blocks).toBe(18)
    expect(movesAlongStreets(route.points)).toBe(true)
  })

  test('falla si un punto está fuera de la grilla', () => {
    expect(() => shortestRoute(grid, { x: 0, y: 0 }, { x: 10, y: 0 })).toThrow('fuera de la grilla')
  })

  test('una esquina tiene 2 vecinos y el centro tiene 4', () => {
    expect(neighbors(grid, { x: 0, y: 0 })).toHaveLength(2)
    expect(neighbors(grid, { x: 5, y: 5 })).toHaveLength(4)
  })
})

describe('azar con semilla', () => {
  test('la misma semilla da los mismos restaurantes', () => {
    const first = placeRestaurants(grid, 4, createRandom(7))
    const second = placeRestaurants(grid, 4, createRandom(7))
    expect(first).toEqual(second)
  })

  test('otra semilla da otro mapa', () => {
    const first = placeRestaurants(grid, 4, createRandom(7))
    const other = placeRestaurants(grid, 4, createRandom(8))
    expect(other).not.toEqual(first)
  })
})

describe('mapa del prototipo', () => {
  const map = createCityMap(prototype.grid.size, prototype.grid.restaurants, createRandom(prototype.seed))

  test('usa el tamaño y la cantidad de restaurantes de balance.json', () => {
    expect(map.grid.size).toBe(prototype.grid.size)
    expect(map.restaurants).toHaveLength(prototype.grid.restaurants)
  })

  test('los restaurantes están en esquinas distintas dentro de la grilla', () => {
    const spots = new Set(map.restaurants.map((r) => `${r.position.x},${r.position.y}`))
    expect(spots.size).toBe(map.restaurants.length)
    for (const restaurant of map.restaurants) {
      expect(restaurant.position.x).toBeLessThan(map.grid.size)
      expect(restaurant.position.y).toBeLessThan(map.grid.size)
    }
  })

  test('los restaurantes se llaman A, B, C…', () => {
    expect(map.restaurants.map((r) => r.label)).toEqual(['A', 'B', 'C', 'D'].slice(0, map.restaurants.length))
  })
})
