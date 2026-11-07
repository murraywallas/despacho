import { useEffect, useRef } from 'react'
import type { CityMap } from '../game/cityMap'
import { t } from '../i18n'
import { drawCityMap, type MapColors } from '../map/drawCityMap'

function readColors(element: HTMLElement): MapColors {
  const style = getComputedStyle(element)
  return {
    background: style.getPropertyValue('--map-bg').trim(),
    street: style.getPropertyValue('--map-street').trim(),
    restaurant: style.getPropertyValue('--map-restaurant').trim(),
    restaurantInk: style.getPropertyValue('--map-restaurant-ink').trim(),
  }
}

/** The map canvas. Fills its container and redraws when the container or the color theme changes. */
export function MapView({ map }: { map: CityMap }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
      drawCityMap(context, map, width, height, readColors(canvas))
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
  }, [map])

  return (
    <canvas
      ref={canvasRef}
      className="map-view"
      role="img"
      aria-label={t('map.description', { size: map.grid.size, restaurants: map.restaurants.length })}
    />
  )
}
