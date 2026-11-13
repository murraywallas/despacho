import { CircleAlert } from 'lucide-react'
import { t } from '../i18n'
import { gameMinutes } from './formatClock'
import { gameTime } from './gameTime'

interface DeliveryEtaProps {
  /** Seconds of play until the food reaches the customer. */
  inSec: number
  /** It would arrive after the deadline. */
  late: boolean
  className: string
}

/**
 * Minutes until the food reaches the customer with this rider: "14 min". When it would arrive late it turns red
 * with the same alert icon as a late order (the color is never the only sign), and says so to screen readers.
 */
export function DeliveryEta({ inSec, late, className }: DeliveryEtaProps) {
  const minutes = gameMinutes(inSec, gameTime)
  const label = t(late ? 'riders.deliveryLate' : 'riders.delivery', { minutes })
  return (
    <span className={`${className} delivery-eta${late ? ' delivery-eta--late' : ''}`} title={label} data-late={late}>
      {late && <CircleAlert size={12} aria-hidden />}
      <span aria-hidden>{t('riders.eta', { minutes })}</span>
      <span className="visually-hidden">{label}</span>
    </span>
  )
}
