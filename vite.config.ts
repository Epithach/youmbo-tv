import { defineConfig, loadEnv, type Plugin } from 'vite';
import solid from 'vite-plugin-solid';
import { devProxy } from './tools/dev-proxy.ts';

/**
 * Les TV Samsung les plus anciennes qu'on vise (Tizen 6, ~2021) embarquent
 * un moteur web équivalent à Chromium 76. Tout le JS et le CSS produits
 * doivent tourner dessus.
 */
const TV_TARGET = 'chrome76';

/**
 * Une app Tizen est servie en file://, où Chromium refuse les scripts
 * `type="module"`. On produit donc un seul bundle IIFE chargé en script classique.
 */
function classicScript(): Plugin {
  return {
    name: 'youmbo:classic-script',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(/<script type="module" crossorigin/g, '<script defer'),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    plugins: [solid(), devProxy({ defaultPlaylistUrl: env.M3U_URL }), classicScript()],
    build: {
      target: TV_TARGET,
      cssTarget: TV_TARGET,
      modulePreload: false,
      // Un seul bundle (hls.js + mpegts.js inclus) : ~900 Ko, acceptable sur TV.
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          format: 'iife',
          inlineDynamicImports: true,
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    },
  };
});
