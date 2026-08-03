import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { fetchQuotes, fetchHistory, WATCHLIST } from './stocks.js'
import { isConfigured } from './config.js'
import { fetchNews } from './integrations/news.js'
import { fetchCalendarEvents } from './integrations/calendar.js'
import { fetchImportantMails } from './integrations/mail.js'
import { getTodos, addTodo, setDone, deleteTodo } from './todos-store.js'
import { getVault } from './integrations/obsidian.js'
// fetchQuotes heißt in beiden Kursmodulen gleich – hier umbenennen, damit klar
// bleibt, welche Quelle gemeint ist (stocks.js = Yahoo, finnhub.js = Watchlist).
import {
  searchSymbols,
  fetchQuotes as fetchFinnhubQuotes,
  isConfigured as finnhubReady
} from './integrations/finnhub.js'
import { getWatchlist, addSymbol, removeSymbol } from './watchlist-store.js'

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

// Übersicht, welche Dienste verbunden sind (ohne Zugangsdaten preiszugeben).
app.get('/api/services', (req, res) => {
  res.json({
    calendar: isConfigured.calendar,
    mail: isConfigured.mail,
    news: true,
    watchlist: isConfigured.finnhub
  })
})

// News / Finanznews via RSS. ?type=world|finance
app.get('/api/news', async (req, res) => {
  try {
    const type = req.query.type === 'finance' ? 'finance' : 'world'
    res.json(await fetchNews(type))
  } catch (err) {
    console.error('news error:', err.message)
    res.status(502).json({ error: 'News konnten nicht geladen werden' })
  }
})

// Obsidian-Vault (nur lesend, per Syncthing gespiegelt).
app.get('/api/vault', (req, res) => {
  try {
    res.json(getVault())
  } catch (err) {
    console.error('vault error:', err.message)
    res.status(500).json({ configured: false, reason: 'error' })
  }
})

// Kalender / Mail liefern selbst einen { configured, ... }-Status.
app.get('/api/calendar', async (req, res) => {
  res.json(await fetchCalendarEvents())
})
app.get('/api/mail', async (req, res) => {
  res.json(await fetchImportantMails())
})

// Eigene To-Do-Liste (serverseitig gespeichert).
app.get('/api/todos', (req, res) => {
  res.json({ todos: getTodos() })
})
app.post('/api/todos', (req, res) => {
  const text = String(req.body?.text || '').trim()
  if (!text) return res.status(400).json({ error: 'Text fehlt' })
  res.status(201).json(addTodo(text))
})
app.patch('/api/todos/:id', (req, res) => {
  const todo = setDone(req.params.id, Boolean(req.body?.done))
  if (!todo) return res.status(404).json({ error: 'Nicht gefunden' })
  res.json(todo)
})
app.delete('/api/todos/:id', (req, res) => {
  deleteTodo(req.params.id)
  res.status(204).end()
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

// --- Watchlist (Finnhub) ----------------------------------------------------
// Symbolsuche für das Suchfeld. ?q=apple
app.get('/api/finnhub/search', async (req, res) => {
  if (!finnhubReady()) return res.json({ configured: false, results: [] })
  try {
    const data = await searchSymbols(req.query.q)
    res.json({ configured: true, ...data })
  } catch (err) {
    console.error('finnhub search error:', err.message)
    res.status(502).json({ configured: true, error: err.message, results: [] })
  }
})

// Gespeicherte Watchlist samt aktuellen Kursen.
app.get('/api/watchlist', async (req, res) => {
  const entries = getWatchlist()
  if (!finnhubReady()) return res.json({ configured: false, items: [] })
  if (entries.length === 0) return res.json({ configured: true, items: [] })

  try {
    const quotes = await fetchFinnhubQuotes(entries.map((e) => e.symbol))
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]))
    res.json({
      configured: true,
      items: entries.map((e) => ({ ...e, ...(bySymbol.get(e.symbol) || {}) }))
    })
  } catch (err) {
    console.error('watchlist error:', err.message)
    res.status(502).json({ configured: true, error: err.message, items: [] })
  }
})

app.post('/api/watchlist', (req, res) => {
  const { entry, added, error } = addSymbol(req.body || {})
  if (error) return res.status(400).json({ error })
  res.status(added ? 201 : 200).json(entry)
})

app.delete('/api/watchlist/:symbol', (req, res) => {
  removeSymbol(req.params.symbol)
  res.status(204).end()
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
