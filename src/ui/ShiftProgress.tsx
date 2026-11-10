import { balanceFor } from '../game/levels'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { formatGameTime } from './formatClock'
import { gameTimeOf } from './levelText'

const PERCENT = 100

/** A thin bar along the bottom of the top bar: how much of the shift has passed, with the rush hour marked. */
export function ShiftProgress() {
  const elapsedSec = useShiftStore((state) => state.clock.elapsedSec)
  const durationSec = useShiftStore((state) => state.clock.durationSec)
  const levelId = useShiftStore((state) => state.levelId)
  const { peakFromSec, peakToSec } = balanceFor(levelId).orders
  const share = (sec: number) => Math.min(PERCENT, Math.max(0, (sec / durationSec) * PERCENT))
  const time = gameTimeOf(levelId)
  const done = Math.round(share(elapsedSec))

  return (
    <div
      className="shift-progress"
      role="progressbar"
      aria-label={t('topbar.progressLabel')}
      aria-valuemin={0}
      aria-valuemax={PERCENT}
      aria-valuenow={done}
      aria-valuetext={t('topbar.progressValue', { percent: done })}
    >
      {peakFromSec !== undefined && peakToSec !== undefined && (
        <span
          className="shift-progress__peak"
          style={{ left: `${share(peakFromSec)}%`, width: `${share(peakToSec) - share(peakFromSec)}%` }}
          title={t('topbar.peak', { from: formatGameTime(peakFromSec, time), to: formatGameTime(peakToSec, time) })}
        />
      )}
      <span className="shift-progress__fill" style={{ transform: `scaleX(${share(elapsedSec) / PERCENT})` }} />
    </div>
  )
}
