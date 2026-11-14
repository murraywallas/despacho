import { BatteryCharging, BatteryFull, BatteryLow, BatteryMedium } from 'lucide-react'
import { prototype, vehicles } from '../game/balance'
import { batteryShare, fullBatteryM, isLowBattery } from '../game/battery'
import type { Rider } from '../game/riders'
import { t } from '../i18n'

const ICON_SIZE = 14
const PERCENT = 100
/** Above this share the icon shows a full battery; between low and this, half. */
const FULL_ICON_ABOVE = 0.6

/**
 * The battery of a rider's electric vehicle: icon and percent, marked when it runs low (the color is never the only
 * sign: the text says it too). Nothing for vehicles without a battery.
 */
export function RiderBattery({ rider }: { rider: Rider }) {
  const share = batteryShare(rider, fullBatteryM(vehicles[rider.vehicle]?.rangeKm))
  if (share === undefined) return null
  const percent = Math.round(share * PERCENT)
  const charging = rider.status === 'charging'
  const low = isLowBattery(rider, share, prototype.riders.lowBatteryPct ?? 0)
  const Icon = charging ? BatteryCharging : low ? BatteryLow : share > FULL_ICON_ABOVE ? BatteryFull : BatteryMedium
  const label = t(low ? 'riders.batteryLow' : 'riders.battery', { percent })
  return (
    <span className={`rider-battery${low ? ' rider-battery--low' : ''}`} title={label} data-testid="rider-battery" data-low={low}>
      <Icon size={ICON_SIZE} aria-hidden />
      <span aria-hidden>{t('riders.batteryPercent', { percent })}</span>
      <span className="visually-hidden">{label}</span>
    </span>
  )
}
