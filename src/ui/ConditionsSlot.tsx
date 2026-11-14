import { Moon, Sun, Sunset } from 'lucide-react'
import type { MapLight } from '../map/nightStyle'
import { t, type TextKey } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { EventNotices } from './EventNotices'
import { mapLightOf } from './levelText'

const ICONS: Record<MapLight, typeof Sun> = { noon: Sun, dusk: Sunset, night: Moon }
const LIGHT_TEXT: Record<MapLight, TextKey> = {
  noon: 'conditions.noon',
  dusk: 'conditions.dusk',
  night: 'conditions.night',
}

/**
 * The shift's conditions, in the top bar: the light of the level (noon, dusk, night) and the events going on
 * (rain…), so the player always looks at the same spot for them.
 */
export function ConditionsSlot() {
  const light = mapLightOf(useShiftStore((state) => state.levelId))
  const Icon = ICONS[light]
  return (
    <>
      <span className="conditions" data-testid="conditions" title={`${t('conditions.title')}: ${t(LIGHT_TEXT[light])}`}>
        <Icon size={14} aria-hidden />
        <span className="conditions__label">{t(LIGHT_TEXT[light])}</span>
      </span>
      <EventNotices />
    </>
  )
}
