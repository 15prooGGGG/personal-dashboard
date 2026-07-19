import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { fetchQuotes, fetchHistory, WATCHLIST } from './stocks.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

// ---------------------------------------------------------------------------
// API-Routen
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), uptime: process.uptime() })
})

// Aktuelle Kurse der Watchlist (echte, verzögerte Daten via Yahoo).
app.get('/api/stocks', async (req, res) => {
  try {
    res.json({ watchlist: WATCHLIST, quotes: await fetchQuotes() })
  } catch (err) {
    console.error('stocks error:', err.message)
    res.status(502).json({ error: 'Kurse konnten nicht geladen werden' })
  }
})

// Kursverlauf für den Chart. ?symbol=NDX1.DE&range=1mo&interval=1d
app.get('/api/stocks/history', async (req, res) => {
  const symbol = String(req.query.symbol || '')
  const allowed = new Set(WATCHLIST.map((w) => w.symbol))
  if (!allowed.has(symbol)) {
    return res.status(400).json({ error: 'Unbekanntes Symbol' })
  }
  try {
    const range = String(req.query.range || '1mo')
    const interval = String(req.query.interval || '1d')
    res.json(await fetchHistory(symbol, range, interval))
  } catch (err) {
    console.error('history error:', err.message)
    res.status(502).json({ error: 'Verlauf konnte nicht geladen werden' })
  }
})

// ---------------------------------------------------------------------------
// Statisches Frontend (Produktions-Build aus client/dist)
// ---------------------------------------------------------------------------
const clientDist = path.resolve(__dirname, '../client/dist')
const hasBuild = fs.existsSync(path.join(clientDist, 'index.html'))

if (hasBuild) {
  app.use(express.static(clientDist))
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
} else {
  app.get('/', (req, res) => {
    res
      .type('text/plain')
      .send('Kein Frontend-Build gefunden. Bitte "npm run build" ausführen (oder "npm run dev").')
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Personal Dashboard läuft auf http://0.0.0.0:${PORT}`)
})
