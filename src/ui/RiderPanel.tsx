import { Bike } from 'lucide-react'
import type { Rider, RiderStatus } from '../game/riders'
import { t, type TextKey } from '../i18n'
import { useShiftStore } from '../store/shiftStore'

const ICON_SIZE = 16

const STATUS_TEXT: Record<RiderStatus, TextKey> = {
  idle: 'riders.status.idle',
  toRestaurant: 'riders.status.toRestaurant',
  atKitchen: 'riders.status.atKitchen',
  toCustomer: 'riders.status.toCustomer',
}

const VEHICLE_TEXT: Record<string, TextKey | undefined> = {
  bike: 'vehicles.bike',
}

function RiderCard({ rider }: { rider: Rider }) {
  const vehicleKey = VEHICLE_TEXT[rider.vehicle]
  return (
    <li className={`rider-card rider-card--${rider.status}`} data-testid="rider-card">
      <span className="rider-card__badge" aria-hidden>
        {rider.number}
      </span>
      <div className="rider-card__body">
        <span className="rider-card__name">{t('riders.name', { number: rider.number })}</span>
        <span className="rider-card__vehicle">
          <Bike size={ICON_SIZE} aria-hidden />
          {vehicleKey ? t(vehicleKey) : rider.vehicle}
        </span>
        <span className="rider-card__status">{t(STATUS_TEXT[rider.status])}</span>
      </div>
    </li>
  )
}

export function RiderPanel() {
  const riders = useShiftStore((state) => state.riders)
  const idle = riders.filter((rider) => rider.status === 'idle').length

  return (
    <aside className="side-panel" aria-labelledby="rider-panel-title">
      <h2 className="side-panel__title" id="rider-panel-title">
        {t('riders.title')}
        <span className="side-panel__count" aria-label={t('riders.idleCount', { idle, total: riders.length })}>
          {idle}/{riders.length}
        </span>
      </h2>
      <ol className="side-panel__list">
        {riders.map((rider) => (
          <RiderCard key={rider.id} rider={rider} />
        ))}
      </ol>
    </aside>
  )
}
