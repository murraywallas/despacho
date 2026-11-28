import { defineConfig, devices } from '@playwright/test'

// Varias carpetas del repo (worktrees) pueden correr la suite a la vez: PW_PORT elige otro puerto.
const port = Number(process.env.PW_PORT ?? 4173)
const baseURL = `http://localhost:${port}`

// Tests en el navegador: solo Chromium (más rápido), en los dos anchos que tiene que soportar el juego.
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Cada navegador dibuja el mapa (WebGL por software, sin GPU) a 60 cuadros por segundo, y los tests con reloj
  // falso simulan minutos de turno cuadro por cuadro: con más workers se pelean por la CPU, todo va de 3 a 12
  // veces más lento y los tests caen por timeout. Con 4 alcanza para que la suite entre en su tiempo.
  workers: 4,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // The game starts in the browser's language: the tests play in Spanish (language.spec.ts tries English).
    locale: 'es-AR',
  },
  projects: [
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'desktop-1024',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: baseURL,
    // Siempre un build nuevo de esta carpeta: reusar un servidor ya abierto en el puerto podía probar el código de
    // otra carpeta. Si el puerto está ocupado, la corrida falla al arrancar en vez de probar lo que no es.
    // PW_REUSE_SERVER=1 lo reusa a propósito (por ejemplo, con un `npm run preview` propio ya corriendo).
    reuseExistingServer: Boolean(process.env.PW_REUSE_SERVER),
    timeout: 120_000,
  },
})
