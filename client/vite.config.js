import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In der Entwicklung läuft das Frontend auf 5173 und leitet /api an das
// Express-Backend (Port 3000) weiter. Im Produktionsbuild liefert Express
// die statischen Dateien aus client/dist selbst aus.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
