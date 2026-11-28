import type { Page } from '@playwright/test'

/**
 * Opens the game and goes past the title screen with Play, to the neighborhoods (#138). After the first Play the
 * tab remembers it and opens straight on the neighborhoods.
 */
export async function openLevels(page: Page): Promise<void> {
  await page.goto('/')
  const title = page.getByTestId('title-screen')
  await page.locator('[data-testid="title-screen"], [data-testid="level-card"]').first().waitFor()
  if (await title.isVisible()) await title.getByRole('button', { name: /^(Jugar|Play)$/ }).click()
}
