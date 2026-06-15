import { defineConfig } from 'vitest/config'
import path from 'path'

// Kept separate from vite.config.ts: passing the vite-8 plugin types through
// vitest's bundled-vite defineConfig triggers a type-overload clash. The smoke
// tests are logic-only (no JSX render), so no React plugin is needed here.
// When component tests are added, register @vitejs/plugin-react in a `plugins`
// array (cast as needed to sidestep the cross-version plugin typing).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
