import { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** True while the system asks for reduced motion. */
function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => globalThis.matchMedia?.(REDUCED_MOTION).matches ?? false)
  useEffect(() => {
    const query = globalThis.matchMedia?.(REDUCED_MOTION)
    if (!query) return
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

/**
 * Applies the settings to the whole page: the text scale as --text-scale, the color-blind palette and reduced
 * motion (from the setting or the system) as attributes the stylesheets read.
 */
export function useApplySettings(): void {
  const textScale = useSettingsStore((state) => state.textScale)
  const colorblind = useSettingsStore((state) => state.colorblind)
  const reducedSetting = useSettingsStore((state) => state.reducedMotion)
  const reducedSystem = useSystemReducedMotion()

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--text-scale', String(textScale))
    root.dataset.palette = colorblind ? 'colorblind' : 'default'
    root.dataset.motion = reducedSetting || reducedSystem ? 'reduced' : 'full'
  }, [textScale, colorblind, reducedSetting, reducedSystem])
}
