import { locale } from '../i18n'

/** Average stars with one decimal ("4,3" in Spanish, "4.3" in English), or a dash when there are none yet. */
export function formatRating(average: number | undefined): string {
  if (average === undefined) return '–'
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(average)
}
