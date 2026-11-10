/** A key drawn on a button, so shortcuts are visible where they apply. Screen readers get aria-keyshortcuts instead. */
export function Keycap({ label }: { label: string }) {
  return (
    <kbd className="keycap" aria-hidden="true">
      {label}
    </kbd>
  )
}
