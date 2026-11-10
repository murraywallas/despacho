import { Bike, Scooter, type LucideProps } from 'lucide-react'
import type { TextKey } from '../i18n'

/** A skateboard seen from the side, drawn in the same style as the Lucide icons (24 × 24, round strokes). */
function Skateboard({ size = 24, strokeWidth = 2, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 11c0 1.5 1 2.5 2.5 2.5h15c1.5 0 2.5-1 2.5-2.5" />
      <circle cx="7" cy="17.5" r="1.75" />
      <circle cx="17" cy="17.5" r="1.75" />
    </svg>
  )
}

const ICONS: Record<string, (props: LucideProps) => React.ReactNode> = {
  bike: Bike,
  skateboard: Skateboard,
  e_scooter: Scooter,
}

/** Visible names, by vehicle id of the Vehículos tab. */
export const VEHICLE_TEXT: Record<string, TextKey | undefined> = {
  bike: 'vehicles.bike',
  skateboard: 'vehicles.skateboard',
  e_scooter: 'vehicles.e_scooter',
}

/** The icon of a vehicle (a bike for one without its own). */
export function VehicleIcon({ vehicle, ...props }: LucideProps & { vehicle: string }) {
  const Icon = ICONS[vehicle] ?? Bike
  return <Icon {...props} />
}
