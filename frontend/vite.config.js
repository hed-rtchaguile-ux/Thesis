import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.loca.lt'],
    hmr: false,
    proxy: {
      '/api': 'http://[::1]:5000',
    },
  },
})
