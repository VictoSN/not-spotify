import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

// Read the app version from the Tauri config so it's always a single source of truth.
const tauriConf = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'src-tauri/tauri.conf.json'), 'utf-8'),
)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // These hosts remain independent browser origins while sharing this build.
    allowedHosts: ['.localhost'],
  },
  preview: {
    allowedHosts: ['.localhost'],
  },
  build: {
    rolldownOptions: {
      checks: {
        invalidAnnotation: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(tauriConf.version),
  },
})
