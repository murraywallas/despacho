import { locale, t } from '../i18n'

/** "1.296 kr"; with signed, "+396 kr" or "−410 kr". Whole kroner, in the format of the language ("1,296 kr" in English). */
export function formatKr(amountKr: number, signed = false): string {
  const whole = Math.round(amountKr)
  const amount = Math.abs(whole).toLocaleString(locale())
  const sign = whole < 0 ? '−' : signed && whole > 0 ? '+' : ''
  return t('money.kr', { amount: `${sign}${amount}` })
}
