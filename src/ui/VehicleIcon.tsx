import { Bike, Motorbike, Scooter, type LucideProps } from 'lucide-react'
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

/** An inline skate seen from the side: the boot and its row of wheels, in the Lucide style. */
function Rollers({ size = 24, strokeWidth = 2, ...props }: LucideProps) {
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
      <path d="M5 3h5v7l6.5 2c1.8.5 3 2 3 3.8V16H5z" />
      <path d="M5 16h14.5" />
      <circle cx="7" cy="19.5" r="1.5" />
      <circle cx="12" cy="19.5" r="1.5" />
      <circle cx="17" cy="19.5" r="1.5" />
    </svg>
  )
}

/** A cargo bike seen from the side: the box in front, over a small wheel, in the Lucide style. */
function CargoBike({ size = 24, strokeWidth = 2, ...props }: LucideProps) {
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
      <rect x="2" y="8" width="8" height="6" rx="1" />
      <circle cx="5" cy="18.5" r="2" />
      <circle cx="18.5" cy="17.5" r="3" />
      <path d="M7 18.5h5l3-7h-4" />
      <path d="M12 18.5 18.5 17.5 16 9h2.5" />
    </svg>
  )
}

const ICONS: Record<string, (props: LucideProps) => React.ReactNode> = {
  bike: Bike,
  cargo_bike: CargoBike,
  skateboard: Skateboard,
  e_scooter: Scooter,
  rollers: Rollers,
  motorcycle: Motorbike,
}

/** Visible names, by vehicle id of the Vehículos tab. */
export const VEHICLE_TEXT: Record<string, TextKey | undefined> = {
  bike: 'vehicles.bike',
  cargo_bike: 'vehicles.cargo_bike',
  skateboard: 'vehicles.skateboard',
  e_scooter: 'vehicles.e_scooter',
  rollers: 'vehicles.rollers',
  motorcycle: 'vehicles.motorcycle',
}

/** The icon of a vehicle (a bike for one without its own). */
export function VehicleIcon({ vehicle, ...props }: LucideProps & { vehicle: string }) {
  const Icon = ICONS[vehicle] ?? Bike
  return <Icon {...props} />
}
