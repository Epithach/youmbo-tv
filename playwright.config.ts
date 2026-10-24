import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout : l'app tourne en mode `mock` (faux serveur Xtream
 * intégré à Vite) et Playwright la pilote au clavier, comme une télécommande.
 * Aucun vrai fournisseur n'est contacté.
 */
const PORT = 5180;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev:mock',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
