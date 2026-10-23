/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Staging: https://artemiivarta.github.io/pm-console/
  // Production (VITE_APP_ENV=production): https://artemiivarta.github.io/pm-console-app/
  base: process.env.VITE_APP_ENV === 'production' ? '/pm-console-app/' : '/pm-console/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
