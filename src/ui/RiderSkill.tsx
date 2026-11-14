import { GraduationCap } from 'lucide-react'
import { experience } from '../game/balance'
import { levelOf, levelProgress, speedBonusOf } from '../game/experience'
import { t } from '../i18n'
import { useProgressStore } from '../store/progressStore'
import { formatKr } from './formatKr'

const PERCENT = 100

/**
 * A rider's experience in the garage: level, how far into it, the speed it gives, and a course to go up one level.
 * place is the rider's place among the hired (rider 1 is place 0).
 */
export function RiderSkill({ place, label }: { place: number; label: string }) {
  const xp = useProgressStore((state) => state.xp[place] ?? 0)
  const moneyKr = useProgressStore((state) => state.moneyKr)
  const train = useProgressStore((state) => state.train)
  const level = levelOf(xp, experience)
  const top = level >= experience.maxLevel
  const bonus = Math.round(speedBonusOf(level, experience) * PERCENT)
  const progress = levelProgress(xp, experience)
  return (
    <span className="rider-skill" data-testid="rider-skill">
      <span className="rider-skill__level" data-testid="rider-level">
        {t('garage.level', { level })}
        {bonus > 0 && <span className="rider-skill__bonus">{t('garage.levelBonus', { bonus })}</span>}
      </span>
      <span
        className="rider-skill__bar"
        role="progressbar"
        aria-label={t('garage.levelProgress', { rider: label })}
        aria-valuemin={0}
        aria-valuemax={PERCENT}
        aria-valuenow={Math.round(progress * PERCENT)}
      >
        <span style={{ width: `${progress * PERCENT}%` }} />
      </span>
      {!top && (
        <button
          type="button"
          className="rider-skill__course"
          onClick={() => train(place)}
          disabled={moneyKr < experience.trainingKr}
          aria-label={t('garage.courseLabel', { rider: label, cost: formatKr(experience.trainingKr) })}
          data-testid="rider-course"
        >
          <GraduationCap size={14} aria-hidden />
          {t('garage.course', { cost: formatKr(experience.trainingKr) })}
        </button>
      )}
    </span>
  )
}
