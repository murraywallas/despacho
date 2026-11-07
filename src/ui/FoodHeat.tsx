import { Snowflake, Thermometer } from 'lucide-react'
import { prototype } from '../game/balance'
import type { Order } from '../game/orders'
import { heatOf, isCold } from '../game/rating'
import { t } from '../i18n'

const ICON_SIZE = 16

/**
 * Heat of an order's food once the kitchen has it ready: a number and a thermometer, or a snowflake once it is cold.
 * Used on the order cards (food waiting for a rider) and on the rider cards (food on its way).
 */
export function FoodHeat({ order, nowSec }: { order: Order; nowSec: number }) {
  const heat = Math.round(heatOf(order, nowSec, prototype.heat))
  const cold = isCold(heat, prototype.heat)
  const label = t(cold ? 'riders.heatCold' : 'riders.heatLabel', { heat, max: prototype.heat.start })
  return (
    <span
      className={`food-heat${cold ? ' food-heat--cold' : ''}`}
      data-testid="food-heat"
      role="img"
      aria-label={label}
      title={label}
    >
      {cold ? <Snowflake size={ICON_SIZE} aria-hidden /> : <Thermometer size={ICON_SIZE} aria-hidden />}
      {t('riders.heat', { heat })}
    </span>
  )
}
