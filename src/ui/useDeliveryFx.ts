import { useEffect, type RefObject } from 'react'
import { prototype } from '../game/balance'
import { positionOf, type CityMap } from '../game/cityMap'
import { deliveryMood } from '../game/radio'
import { ratingOf } from '../game/rating'
import { t } from '../i18n'
import { Marker, type MapLibreMap } from '../map/maplibre'
import { useShiftStore } from '../store/shiftStore'

const STEAM_WISPS = 3
/** The rider stands on the customer when delivering: the stars start above the rider's pin, in CSS pixels. */
const ABOVE_RIDER: [number, number] = [0, -40]

/**
 * The delivery moment: stars rise from the customer once, briefly. On time and warm: "+5 ★" with a little steam;
 * late or cold: the stars it got, without the celebration. The radio says it in words; this is decoration
 * (aria-hidden). Each effect removes itself when its animation ends.
 */
export function useDeliveryFx(instanceRef: RefObject<MapLibreMap | null>, ready: boolean, map: CityMap): void {
  useEffect(() => {
    const instance = instanceRef.current
    if (!instance || !ready) return
    const live = new Set<Marker>()

    const unsubscribe = useShiftStore.subscribe((state, previous) => {
      if (state.orderQueue === previous.orderQueue || state.clock.elapsedSec < previous.clock.elapsedSec) return
      const before = new Map(previous.orderQueue.orders.map((order) => [order.id, order.status]))
      for (const order of state.orderQueue.orders) {
        if (order.status !== 'delivered' || before.get(order.id) === 'delivered' || !before.has(order.id)) continue
        const mood = deliveryMood(order, prototype.heat)
        const stars = ratingOf(order, prototype.heat, prototype.rating) ?? 0
        const element = document.createElement('div')
        element.className = `delivery-fx delivery-fx--${mood}`
        element.setAttribute('aria-hidden', 'true')
        element.dataset.testid = 'delivery-fx'
        const label = document.createElement('span')
        label.className = 'delivery-fx__stars'
        label.textContent = mood === 'good' ? t('delivery.good', { stars }) : t('delivery.bad', { stars })
        element.append(label)
        if (mood === 'good') {
          for (let wisp = 0; wisp < STEAM_WISPS; wisp++) {
            const steam = document.createElement('span')
            steam.className = 'delivery-fx__steam'
            element.append(steam)
          }
        }
        const marker = new Marker({ element, anchor: 'bottom', offset: ABOVE_RIDER }).setLngLat([...positionOf(map, order.customer)]).addTo(instance)
        live.add(marker)
        // The label's animation is the longest: when it ends, the effect is done.
        label.addEventListener('animationend', () => {
          marker.remove()
          live.delete(marker)
        })
      }
    })

    return () => {
      unsubscribe()
      for (const marker of live) marker.remove()
      live.clear()
    }
  }, [instanceRef, ready, map])
}
