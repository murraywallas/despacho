import { Play } from 'lucide-react'
import { t } from '../i18n'
import { useScreenStore } from '../store/screenStore'
import { LanguageSwitch } from './LanguageSwitch'
import { TitleMap } from './TitleMap'
import './title.css'

/** The first screen: Copenhagen already busy behind the title, then Play opens the neighborhoods. */
export function TitleScreen() {
  const play = useScreenStore((state) => state.play)
  return (
    <main className="title" aria-labelledby="title-name" data-testid="title-screen">
      <TitleMap />
      <div className="title__shade" aria-hidden />
      <section className="title__card floating-panel">
        <div className="title__top">
          <p className="title__eyebrow">{t('title.eyebrow')}</p>
          <LanguageSwitch />
        </div>
        <h1 className="title__name" id="title-name">
          {t('app.title')}
        </h1>
        <p className="title__tagline">{t('title.tagline')}</p>
        <button type="button" className="title__play" onClick={play} autoFocus>
          <Play size={18} aria-hidden />
          {t('title.play')}
        </button>
      </section>
    </main>
  )
}
