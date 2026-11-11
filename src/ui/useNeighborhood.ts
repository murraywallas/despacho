import { neighborhoodOf } from '../game/levels'
import { useShiftStore } from '../store/shiftStore'

/** The neighborhood of the shift being played. */
export function useNeighborhood(): string {
  return neighborhoodOf(useShiftStore((state) => state.levelId))
}
