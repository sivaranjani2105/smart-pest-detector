import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/smart-pest-detector/',
  server: {
    port: 5173,
    host: '0.0.0.0'
  }
})
