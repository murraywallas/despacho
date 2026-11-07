import { createGrid, samePoint, type Grid, type Point } from './grid'
import { randomInt, type Random } from './random'

export interface Restaurant {
  /** "r1", "r2"… */
  readonly id: string
  /** Short label drawn on the map: "A", "B"… */
  readonly label: string
  readonly position: Point
}

export interface CityMap {
  readonly grid: Grid
  readonly restaurants: readonly Restaurant[]
}

const FIRST_LABEL = 'A'.charCodeAt(0)

/** Picks `count` different intersections for the restaurants. */
export function placeRestaurants(grid: Grid, count: number, random: Random): Restaurant[] {
  if (count > grid.size * grid.size) {
    throw new Error(`No entran ${count} restaurantes en una grilla de ${grid.size}×${grid.size}.`)
  }
  const restaurants: Restaurant[] = []
  while (restaurants.length < count) {
    const position = { x: randomInt(random, grid.size), y: randomInt(random, grid.size) }
    if (restaurants.some((restaurant) => samePoint(restaurant.position, position))) continue
    const number = restaurants.length + 1
    restaurants.push({
      id: `r${number}`,
      label: String.fromCharCode(FIRST_LABEL + number - 1),
      position,
    })
  }
  return restaurants
}

export function createCityMap(size: number, restaurantCount: number, random: Random): CityMap {
  const grid = createGrid(size)
  return { grid, restaurants: placeRestaurants(grid, restaurantCount, random) }
}
