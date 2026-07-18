import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Reine Frontend-App. Im Dev-Modus läuft Vite auf 5173; /api ist für später
// vorgesehen (echte Datenquellen) und wird ans Backend auf 3000 weitergeleitet.
// Im Produktionsbuild liefert der kleine Express-Server client/dist aus.
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
