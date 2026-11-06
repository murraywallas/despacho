import { t } from './i18n'

export default function App() {
  return (
    <main className="splash">
      <h1>{t('app.title')}</h1>
      <p>{t('app.tagline')}</p>
    </main>
  )
}
