import { CircleAlert, CloudRain, Construction, Megaphone, Wind, type LucideIcon } from 'lucide-react'
import { activeEvents, type ShiftEvent } from '../game/shiftEvents'
import { levelEvents, useShiftStore } from '../store/shiftStore'
import { eventEffect, eventName } from './eventText'

const ICONS: Readonly<Record<string, LucideIcon>> = { rain: CloudRain, wind: Wind, marathon: Construction, strike: Megaphone }
/** The icon of an event (an alert for one without its own). */
export function EventIcon({ event, size }: { event: string; size: number }) {
  const Icon = ICONS[event] ?? CircleAlert
  return <Icon size={size} aria-hidden />
}

/** The events going on now, in the top bar next to the light: a chip each, with what it does on hover. */
export function EventNotices() {
  const nowSec = useShiftStore((state) => state.clock.elapsedSec)
  // Recomputed on each tick: cheap, and an event starting mid-shift shows up right away.
  const active: ShiftEvent[] = activeEvents(levelEvents(), nowSec)
  return (
    <span className="event-notices" role="status" aria-live="polite">
      {active.map((event) => (
        <span
          key={event.id}
          className="event-notice"
          data-testid="event-notice"
          title={eventEffect(event)}
          aria-label={`${eventName(event.event)}: ${eventEffect(event)}`}
        >
          <EventIcon event={event.event} size={14} />
          {eventName(event.event)}
        </span>
      ))}
    </span>
  )
}
