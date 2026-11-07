const ratingFormat = new Intl.NumberFormat('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Average stars with one decimal ("4,3"), or a dash when there are none yet. */
export function formatRating(average: number | undefined): string {
  return average === undefined ? '–' : ratingFormat.format(average)
}
