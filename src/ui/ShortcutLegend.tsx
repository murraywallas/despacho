import { X } from 'lucide-react'
import { t, type TextKey } from '../i18n'
import { Keycap } from './Keycap'

/** Every shortcut of the shift, in the order a player meets them. */
const SHORTCUTS: readonly { keys: readonly string[]; text: TextKey }[] = [
  { keys: ['␣'], text: 'shortcuts.pause' },
  { keys: ['↑', '↓'], text: 'shortcuts.nextOrder' },
  { keys: ['1', '…', '9'], text: 'shortcuts.rider' },
  { keys: [t('shortcuts.dragKey')], text: 'shortcuts.drag' },
  { keys: ['⇧', t('shortcuts.click')], text: 'shortcuts.addOrder' },
  { keys: ['L'], text: 'shortcuts.call' },
  { keys: ['M'], text: 'shortcuts.mute' },
  { keys: ['Esc'], text: 'shortcuts.cancel' },
  { keys: ['?'], text: 'shortcuts.legend' },
]

/** The shortcut legend (key ?). It doesn't stop the game: the clock keeps running behind it. */
export function ShortcutLegend({ onClose }: { onClose: () => void }) {
  return (
    <section className="shortcut-legend floating-panel" role="dialog" aria-modal="false" aria-labelledby="shortcuts-title">
      <header className="shortcut-legend__header">
        <h2 className="shortcut-legend__title" id="shortcuts-title">
          {t('shortcuts.title')}
        </h2>
        <button type="button" className="shortcut-legend__close" onClick={onClose} aria-label={t('shortcuts.close')}>
          <X size={16} aria-hidden />
        </button>
      </header>
      <dl className="shortcut-legend__list">
        {SHORTCUTS.map((shortcut) => (
          <div className="shortcut-legend__row" key={shortcut.text}>
            <dt className="shortcut-legend__keys">
              {shortcut.keys.map((key) => (
                <Keycap key={key} label={key} />
              ))}
            </dt>
            <dd className="shortcut-legend__text">{t(shortcut.text)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
