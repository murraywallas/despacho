/** Space the floating panels take over each edge of the map, from the layout tokens in src/styles/tokens.css. */
export interface Insets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

function tokenPx(style: CSSStyleDeclaration, name: string): number {
  const value = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) ? value : 0
}

/** The part of the map the panels cover, plus `extra` pixels on every side. */
export function panelInsets(element: Element, extra = 0): Insets {
  const style = getComputedStyle(element)
  return {
    top: tokenPx(style, '--topbar-h') + extra,
    right: tokenPx(style, '--panel-right-w') + extra,
    bottom: extra,
    left: tokenPx(style, '--panel-left-w') + extra,
  }
}
