import { useEffect, useMemo, useRef } from 'react'
import type { CityMap } from '../game/cityMap'
import type { Order } from '../game/orders'
import { t } from '../i18n'
import { drawCityMap, type CustomerMarker, type MapColors } from '../map/drawCityMap'

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
  }
}

interface MapViewProps {
  map: CityMap
  orders: readonly Order[]
}

/** The map canvas. Fills its container and redraws when the orders, the size or the color theme change. */
export function MapView({ map, orders }: MapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const customers = useMemo<CustomerMarker[]>(
    () => orders.map((order) => ({ position: order.customer, label: String(order.number) })),
    [orders],
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
      drawCityMap(context, map, customers, width, height, readColors(canvas))
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
  }, [map, customers])

  return (
    <canvas
      ref={canvasRef}
      className="map-view"
      role="img"
      aria-label={t('map.description', {
        size: map.grid.size,
        restaurants: map.restaurants.length,
        customers: customers.length,
      })}
    />
  )
}
