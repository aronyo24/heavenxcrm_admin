import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// HeavenXCRM Developer Control Center (internal). Separate app from the
// company CRM (../heavenxcrm_web); same design system.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5175,
    allowedHosts: ['.localhost'],
    // Host header is kept so Django sees a Control Center host
    // (localhost / control.localhost are allowed in DEBUG).
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
})
