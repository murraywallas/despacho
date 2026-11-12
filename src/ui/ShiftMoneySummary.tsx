import { t } from '../i18n'
import type { ShiftMoney } from '../game/money'
import { formatKr } from './formatKr'

interface ShiftMoneyProps {
  readonly money: ShiftMoney
  /** Money saved after this shift; missing for the prototype shift, which doesn't keep money. */
  readonly totalKr?: number
}

/** The results' money: what the deliveries paid, what the fleet cost, the profit and the money saved. */
export function ShiftMoneySummary({ money, totalKr }: ShiftMoneyProps) {
  const rows = [
    { key: 'pay', label: t('results.money.pay'), value: formatKr(money.payKr, true) },
    { key: 'tips', label: t('results.money.tips'), value: formatKr(money.tipsKr, true) },
    { key: 'cost', label: t('results.money.cost'), value: formatKr(-money.costKr, true) },
  ]
  return (
    <div className="results__money" data-testid="results-money">
      <h3 className="results__lost-title">{t('results.money.title')}</h3>
      <dl className="results__money-list">
        {rows.map((row) => (
          <div key={row.key} className="results__money-row" data-testid={`money-${row.key}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
        <div
          className={`results__money-row results__money-row--profit${money.profitKr < 0 ? ' results__money-row--loss' : ''}`}
          data-testid="money-profit"
        >
          <dt>{t(money.profitKr < 0 ? 'results.money.loss' : 'results.money.profit')}</dt>
          <dd>{formatKr(money.profitKr, true)}</dd>
        </div>
        {totalKr !== undefined && (
          <div className="results__money-row" data-testid="money-total">
            <dt>{t('results.money.total')}</dt>
            <dd>{formatKr(totalKr)}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
