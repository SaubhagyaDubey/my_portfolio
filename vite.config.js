import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { apiDev } from './scripts/api-dev.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiDev()],
})
