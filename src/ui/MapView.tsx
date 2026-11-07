import { useEffect, useMemo, useRef } from 'react'
import { positionOf, type CityMap } from '../game/cityMap'
import { restaurantOf } from '../game/dispatch'
import { remainingRoute, riderDisplayPosition } from '../game/movement'
import type { Order } from '../game/orders'
import type { Rider } from '../game/riders'
import { t } from '../i18n'
import { drawCityMap, type MapColors, type MapScene } from '../map/drawCityMap'

function readColors(element: HTMLElement): MapColors {
  const style = getComputedStyle(element)
  const color = (name: string) => style.getPropertyValue(name).trim()
  return {
    background: color('--map-bg'),
    street: color('--map-street'),
    restaurant: color('--map-restaurant'),
    restaurantInk: color('--map-restaurant-ink'),
    customer: color('--map-customer'),
    customerInk: color('--map-customer-ink'),
    rider: color('--map-rider'),
    riderInk: color('--map-rider-ink'),
    selected: color('--selected'),
  }
}

interface MapViewProps {
  map: CityMap
  orders: readonly Order[]
  riders: readonly Rider[]
  selectedOrderId: string | null
}

function buildScene(map: CityMap, orders: readonly Order[], riders: readonly Rider[], selectedId: string | null) {
  const selected = orders.find((order) => order.id === selectedId)
  const routes = riders.filter((rider) => rider.trip).map((rider) => remainingRoute(map, rider))
  return {
    map,
    customers: orders
      .filter((order) => order.status !== 'delivered' && order.status !== 'cancelled')
      .map((order) => ({ position: positionOf(map, order.customer), label: String(order.number) })),
    riders: riders.map((rider) => ({ position: riderDisplayPosition(map, rider), label: String(rider.number) })),
    routes,
    highlight: selected
      ? { restaurant: positionOf(map, restaurantOf(map, selected).node), customer: positionOf(map, selected.customer) }
      : undefined,
  } satisfies MapScene
}

/** The map canvas. Fills its container and redraws when what it shows, its size or the color theme change. */
export function MapView({ map, orders, riders, selectedOrderId }: MapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scene = useMemo(
    () => buildScene(map, orders, riders, selectedOrderId),
    [map, orders, riders, selectedOrderId],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      drawCityMap(context, scene, { width, height, ratio }, readColors(canvas))
    }

    draw()
    const resize = new ResizeObserver(draw)
    resize.observe(canvas)
    const theme = window.matchMedia('(prefers-color-scheme: dark)')
    theme.addEventListener('change', draw)
    return () => {
      resize.disconnect()
      theme.removeEventListener('change', draw)
    }
  }, [scene])

  return (
    <canvas
      ref={canvasRef}
      className="map-view"
      role="img"
      aria-label={t('map.description', {
        restaurants: map.restaurants.length,
        riders: scene.riders.length,
        customers: scene.customers.length,
      })}
    />
  )
}
