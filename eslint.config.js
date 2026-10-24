import js from '@eslint/js';
import solid from 'eslint-plugin-solid/configs/typescript';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    ...solid,
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      'tools/**/*.ts',
      'e2e/**/*.ts',
      'vite.config.ts',
      'playwright.config.ts',
      'eslint.config.js',
    ],
    languageOptions: { globals: globals.node },
  },
);
