import { LANGUAGES, t } from '../i18n'
import { useSettingsStore } from '../store/settingsStore'
import { useLanguage } from './useLanguage'

/** EN / ES: the language of the game, remembered in this browser. Each option says its name in its own language. */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const shown = useLanguage()
  const pick = useSettingsStore((state) => state.setLanguage)
  return (
    <div className={`segmented language-switch ${className}`} role="group" aria-label={t('language.label')} data-testid="language-switch">
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          className="segmented__option"
          aria-pressed={language === shown}
          aria-label={t(`language.${language}`)}
          lang={language}
          onClick={() => pick(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
