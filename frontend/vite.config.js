import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api to Flask so the browser can call relative URLs during local dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
