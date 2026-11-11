import { X } from 'lucide-react'
import { useEffect } from 'react'
import { levelIds } from '../game/balance'
import { t, type TextKey } from '../i18n'
import { useProgressStore } from '../store/progressStore'
import { useScreenStore } from '../store/screenStore'
import { useShiftStore } from '../store/shiftStore'

/** The guide teaches this many dispatches, then goes away for good. */
const DISPATCHES_TAUGHT = 2

type Step = 'wait' | 'pickOrder' | 'pickRider'

const STEP_TEXT: Record<Step, TextKey> = {
  wait: 'guide.wait',
  pickOrder: 'guide.pickOrder',
  pickRider: 'guide.pickRider',
}

/**
 * The guided first shift: in the first level, the first time, short bubbles teach the first two dispatches (pick
 * an order, pick a rider), then go away. It can be skipped and never comes back.
 */
export function FirstShiftGuide() {
  const guideDone = useProgressStore((state) => state.guideDone)
  const finishGuide = useProgressStore((state) => state.finishGuide)
  const fromBriefing = useScreenStore((state) => state.fromBriefing)
  const levelId = useShiftStore((state) => state.levelId)
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const selectedOrderId = useShiftStore((state) => state.selectedOrderId)
  const finished = useShiftStore((state) => state.clock.finished)
  const active = fromBriefing && !guideDone && levelId === levelIds[0] && !finished
  const dispatched = orders.filter((order) => order.status !== 'pending' && order.status !== 'cancelled').length

  useEffect(() => {
    if (active && dispatched >= DISPATCHES_TAUGHT) finishGuide()
  }, [active, dispatched, finishGuide])

  if (!active || dispatched >= DISPATCHES_TAUGHT) return null
  const pending = orders.some((order) => order.status === 'pending')
  const step: Step = !pending ? 'wait' : selectedOrderId ? 'pickRider' : 'pickOrder'

  return (
    <aside className={`guide guide--${step} floating-panel`} role="note" aria-live="polite" data-testid="guide">
      <p className="guide__step">{t('guide.progress', { done: dispatched + 1, total: DISPATCHES_TAUGHT })}</p>
      <p className="guide__text">{t(STEP_TEXT[step])}</p>
      <button type="button" className="guide__skip" onClick={finishGuide}>
        <X size={14} aria-hidden />
        {t('guide.skip')}
      </button>
    </aside>
  )
}
