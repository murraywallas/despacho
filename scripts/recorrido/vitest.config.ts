import { defineConfig } from 'vitest/config'

// `npm run recorrido`: the balance bot plays the whole game and prints its report (not part of `npm run test`).
export default defineConfig({
  test: {
    include: ['tests/unit/recorrido.report.ts'],
    testTimeout: 1_800_000,
    silent: false,
  },
})
