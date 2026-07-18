import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

// ---------------------------------------------------------------------------
// API-Routen
// Neue Backend-Endpunkte hier ergänzen (z. B. Wetter, Notizen, To-Dos …).
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// ---------------------------------------------------------------------------
// Statisches Frontend (Produktions-Build aus client/dist)
// ---------------------------------------------------------------------------
const clientDist = path.resolve(__dirname, '../client/dist')
const hasBuild = fs.existsSync(path.join(clientDist, 'index.html'))

if (hasBuild) {
  app.use(express.static(clientDist))

  // SPA-Fallback: alle nicht-API-Routen liefern index.html aus.
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
} else {
  app.get('/', (req, res) => {
    res
      .type('text/plain')
      .send(
        'Kein Frontend-Build gefunden. Bitte "npm run build" ausführen ' +
          '(oder im Dev-Modus "npm run dev" nutzen).'
      )
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Personal Dashboard läuft auf http://0.0.0.0:${PORT}`)
})
