import { ArrowLeft, Plus, RotateCcw, UserPlus, X } from 'lucide-react'
import { levels, vehicles } from '../game/balance'
import { neighborhoodOf } from '../game/levels'
import { t } from '../i18n'
import { useScreenStore } from '../store/screenStore'
import { formatKr } from './formatKr'
import { BackdropMap } from './BackdropMap'
import { levelName, mapLightOf, PANEL_INSET } from './levelText'
import { RiderSkill } from './RiderSkill'
import { useGarage, vehicleCostKr } from './useGarage'
import { VEHICLE_TEXT, VehicleIcon } from './VehicleIcon'
import './garage.css'
import './levels.css'

function vehicleName(vehicle: string): string {
  const key = VEHICLE_TEXT[vehicle]
  return key ? t(key) : vehicle
}

/** Before a shift: the vehicle of each rider, how many go out and hiring one more. Back to the briefing when done. */
export function GarageScreen() {
  const levelId = useScreenStore((state) => state.briefingLevelId)
  if (!levelId || !levels[levelId]) return null
  return <Garage levelId={levelId} />
}

function Garage({ levelId }: { levelId: string }) {
  const showBriefing = useScreenStore((state) => state.showBriefing)
  const garage = useGarage(levelId)
  const { fleet, rules } = garage
  const change = (index: number, vehicle: string) => garage.setFleet(fleet.map((each, at) => (at === index ? vehicle : each)))
  const remove = (index: number) => garage.setFleet(fleet.filter((_, at) => at !== index))
  const add = () => garage.setFleet([...fleet, garage.suggested[fleet.length] ?? rules.vehicles[0]])
  const isSuggested = fleet.join() === garage.suggested.join()

  return (
    <main className="levels" aria-labelledby="garage-title">
      <BackdropMap leftInset={PANEL_INSET} light={mapLightOf(levelId)} neighborhood={neighborhoodOf(levelId)} />
      <section className="levels__panel floating-panel garage" data-testid="garage">
        <p className="levels__app">{t('garage.eyebrow')}</p>
        <h1 className="levels__title" id="garage-title">
          {levelName(levelId)}
        </h1>
        <p className="levels__intro">{t('garage.intro', { max: rules.maxRiders })}</p>

        <dl className="garage__money">
          <div>
            <dt>{t('results.money.total')}</dt>
            <dd data-testid="garage-money">{formatKr(garage.moneyKr)}</dd>
          </div>
          <div>
            <dt>{t('garage.cost')}</dt>
            <dd data-testid="garage-cost">{formatKr(garage.costKr)}</dd>
          </div>
          <div>
            <dt>{t('garage.hired')}</dt>
            <dd data-testid="garage-hired">{garage.hired}</dd>
          </div>
        </dl>

        {garage.struck.map((vehicle) => (
          <p key={vehicle} className="garage__warning" data-testid="garage-strike">
            {t('garage.strike', { vehicle: vehicleName(vehicle).toLocaleLowerCase('es') })}
          </p>
        ))}

        <ol className="garage__fleet" data-testid="garage-fleet">
          {fleet.map((vehicle, index) => {
            const row = vehicles[vehicle]
            const label = t('riders.name', { number: index + 1 })
            return (
              <li key={index} className="garage__rider">
                <span className="briefing__badge" aria-hidden>
                  {index + 1}
                </span>
                <VehicleIcon vehicle={vehicle} size={18} aria-hidden />
                <select
                  className="garage__select"
                  value={vehicle}
                  onChange={(event) => change(index, event.target.value)}
                  aria-label={t('garage.vehicleOf', { rider: label })}
                  data-testid="garage-vehicle"
                >
                  {rules.vehicles.map((option) => (
                    <option key={option} value={option}>
                      {t('garage.option', { vehicle: vehicleName(option), cost: formatKr(vehicleCostKr(option)) })}
                    </option>
                  ))}
                  {garage.struck.map((option) => (
                    <option key={option} value={option} disabled>
                      {t('garage.optionStruck', { vehicle: vehicleName(option) })}
                    </option>
                  ))}
                </select>
                {row && (
                  <span className="briefing__rider-stats">
                    {t('briefing.vehicleStats', { speed: row.speedKmh, capacity: row.capacity })}
                  </span>
                )}
                <button
                  type="button"
                  className="garage__icon-button"
                  onClick={() => remove(index)}
                  disabled={fleet.length <= 1}
                  aria-label={t('garage.remove', { rider: label })}
                >
                  <X size={14} aria-hidden />
                </button>
                <RiderSkill place={index} label={label} />
              </li>
            )
          })}
        </ol>

        <div className="garage__tools">
          {fleet.length < rules.maxRiders && (
            <button type="button" className="briefing__back" onClick={add}>
              <Plus size={16} aria-hidden />
              {t('garage.add')}
            </button>
          )}
          {!isSuggested && (
            <button type="button" className="briefing__back" onClick={() => garage.setFleet(garage.suggested)}>
              <RotateCcw size={16} aria-hidden />
              {t('garage.suggested')}
            </button>
          )}
        </div>

        {garage.canHireHere && (
          <div className="garage__hire">
            <p>{t('garage.hireNote', { count: levels[levelId].fleet.length })}</p>
            <button
              type="button"
              className="briefing__back"
              onClick={garage.hire}
              disabled={garage.moneyKr < garage.hireKr}
              data-testid="garage-hire"
            >
              <UserPlus size={16} aria-hidden />
              {t('garage.hire', { cost: formatKr(garage.hireKr) })}
            </button>
          </div>
        )}

        {!garage.canStart && (
          <p className="garage__warning" role="status" data-testid="garage-warning">
            {t('garage.tooExpensive')}
          </p>
        )}
        {garage.canStart && garage.costKr > garage.moneyKr && (
          <p className="garage__warning" role="status">
            {t('garage.onCredit')}
          </p>
        )}

        <div className="briefing__actions">
          <button type="button" className="briefing__start" onClick={() => showBriefing(levelId)} autoFocus>
            <ArrowLeft size={16} aria-hidden />
            {t('garage.done')}
          </button>
        </div>
      </section>
    </main>
  )
}
