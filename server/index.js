import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { fetchQuotes, fetchHistory, fetchSparkline, WATCHLIST } from './stocks.js'
import { isConfigured } from './config.js'
import { fetchNews } from './integrations/news.js'
import { fetchCalendarEvents } from './integrations/calendar.js'
import { fetchImportantMails } from './integrations/mail.js'
import { getTodos, addTodo, setDone, deleteTodo } from './todos-store.js'
import { getVault } from './integrations/obsidian.js'
import { getStundenplan } from './stundenplan.js'
import { PDF_PATH, isConfigured as loesungsbuchReady, search as searchLoesungsbuch } from './loesungsbuch.js'
// fetchQuotes heißt in beiden Kursmodulen gleich – hier umbenennen, damit klar
// bleibt, welche Quelle gemeint ist (stocks.js = Yahoo, finnhub.js = Watchlist).
import {
  searchSymbols,
  fetchQuotes as fetchFinnhubQuotes,
  isConfigured as finnhubReady
} from './integrations/finnhub.js'
import { searchCoins, fetchCoinQuotes, fetchCoinSparkline } from './integrations/coingecko.js'
import { getWatchlist, addSymbol, removeSymbol } from './watchlist-store.js'
import { checkSignal, fetchLinkQr } from './integrations/signal.js'
import {
  fetchSubstitutions,
  fetchSubstitutionsHtml,
  findSchools,
  getStatus as schulportalStatus,
  isConfigured as schulportalReady
} from './integrations/schulportal.js'
import { setupNotifications, sendTestDigest, sendTestPlan, listJobs } from './notify/index.js'
import { buildDigest } from './notify/market.js'
import { buildPlanMessage } from './notify/plan.js'

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

// Stundenplan (aus den Vault-PDFs vorgebaut, siehe scripts/build-stundenplan.js).
app.get('/api/stundenplan', (req, res) => {
  try {
    res.json(getStundenplan())
  } catch (err) {
    console.error('stundenplan error:', err.message)
    res.status(500).json({ configured: false, reason: 'error' })
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

// --- Mathe-Lösungsbuch (PDF + OCR-Index Seite/Aufgabe → PDF-Seite) ---------
app.get('/api/loesungsbuch', (req, res) => {
  res.json({ configured: loesungsbuchReady() })
})

app.get('/api/loesungsbuch/pdf', (req, res) => {
  if (!loesungsbuchReady()) return res.status(404).end()
  res.sendFile(PDF_PATH)
})

// ?seite=39&nr=3
app.get('/api/loesungsbuch/search', (req, res) => {
  if (!loesungsbuchReady()) return res.json({ configured: false })
  const seite = parseInt(req.query.seite, 10)
  const nr = parseInt(req.query.nr, 10)
  if (!Number.isInteger(seite) || !Number.isInteger(nr)) {
    return res.status(400).json({ configured: true, error: 'Seite und Nr. angeben' })
  }
  const hit = searchLoesungsbuch(seite, nr)
  if (!hit) return res.json({ configured: true, found: false })
  res.json({ configured: true, found: true, ...hit })
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

// --- Watchlist (Aktien via Finnhub, Krypto via CoinGecko) -------------------
// Beide Quellen liefern getrennte Listen. Würde man sie einfach aneinander-
// hängen, läge bei "bitcoin" der eigentliche Coin hinter einem Dutzend
// Bitcoin-nahen Aktien. Deshalb quellenübergreifend nach Treffergüte sortieren:
// exaktes Kürzel vor exaktem Namen vor Präfix-Treffern vor dem Rest.
function rankHits(hits, query) {
  const q = String(query || '').trim().toLowerCase()

  const score = (hit) => {
    const sym = (hit.display || hit.symbol).toLowerCase()
    const name = (hit.name || '').toLowerCase()
    if (sym === q) return 0
    if (name === q) return 1
    if (sym.startsWith(q)) return 2
    if (name.startsWith(q)) return 3
    return 4
  }

  return hits
    .map((hit, i) => ({ hit, rank: score(hit), i }))
    // i als Tiebreaker: innerhalb gleicher Güte bleibt die Reihenfolge der
    // Quelle erhalten (die ist schon nach Relevanz bzw. Marktkapitalisierung).
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, 14)
    .map((x) => x.hit)
}


// Symbolsuche für das Suchfeld: fragt beide Quellen parallel ab. ?q=bitcoin
// Fällt eine Quelle aus, liefert die andere trotzdem Treffer.
app.get('/api/finnhub/search', async (req, res) => {
  const q = req.query.q
  const [stocks, coins] = await Promise.allSettled([
    finnhubReady() ? searchSymbols(q) : Promise.resolve({ results: [] }),
    searchCoins(q)
  ])

  if (stocks.status === 'rejected') console.error('finnhub search error:', stocks.reason?.message)
  if (coins.status === 'rejected') console.error('coingecko search error:', coins.reason?.message)

  const results = rankHits(
    [
      ...(stocks.status === 'fulfilled' ? stocks.value.results : []),
      ...(coins.status === 'fulfilled' ? coins.value : [])
    ],
    q
  )

  // Nur wenn beide Quellen versagen, ist es ein echter Fehler.
  if (results.length === 0 && stocks.status === 'rejected' && coins.status === 'rejected') {
    return res
      .status(502)
      .json({ configured: true, error: stocks.reason?.message || 'Suche fehlgeschlagen', results: [] })
  }

  res.json({ configured: finnhubReady(), query: String(q || '').trim(), results })
})

// Gespeicherte Watchlist samt aktuellen Kursen (aus beiden Quellen).
app.get('/api/watchlist', async (req, res) => {
  const entries = getWatchlist()
  // Krypto braucht keinen Key – die Watchlist ist also auch ohne Finnhub nutzbar.
  if (!finnhubReady() && entries.length === 0) {
    return res.json({ configured: false, items: [] })
  }
  if (entries.length === 0) return res.json({ configured: true, items: [] })

  const stockSymbols = entries.filter((e) => e.source === 'finnhub').map((e) => e.symbol)
  const coinIds = entries.filter((e) => e.source === 'coingecko').map((e) => e.symbol)

  const [stocks, coins, sparks] = await Promise.allSettled([
    stockSymbols.length && finnhubReady() ? fetchFinnhubQuotes(stockSymbols) : Promise.resolve([]),
    coinIds.length ? fetchCoinQuotes(coinIds) : Promise.resolve([]),
    // Kursverläufe für die Sparklines. Beide Caches liefern vorhandene Punkte
    // sofort und erneuern veraltete im Hintergrund – der 30-s-Poll wartet also
    // nur beim allerersten Mal auf die Quelle.
    Promise.all([
      ...stockSymbols.map(async (s) => [s, await fetchSparkline(s)]),
      ...coinIds.map(async (id) => [id, await fetchCoinSparkline(id)])
    ])
  ])

  if (coins.status === 'rejected') console.error('coingecko quotes error:', coins.reason?.message)

  const quotes = [
    ...(stocks.status === 'fulfilled' ? stocks.value : []),
    ...(coins.status === 'fulfilled' ? coins.value : [])
  ]
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]))
  const sparkBySymbol = new Map(sparks.status === 'fulfilled' ? sparks.value : [])

  res.json({
    configured: true,
    items: entries.map((e) => {
      const quote = bySymbol.get(e.symbol)
      if (quote) {
        const spark = sparkBySymbol.get(e.symbol) || null
        // Die Zeitspanne unterscheidet sich je Quelle (Yahoo liefert Tages-,
        // CoinGecko Stundenwerte) – ohne Beschriftung wäre im Frontend nicht
        // klar, worüber die Linie läuft.
        const sparkRange = e.source === 'coingecko' ? '7 Tage' : '1 Monat'
        return { ...e, ...quote, spark, sparkRange: spark ? sparkRange : null }
      }
      // Kein Kurs: die Quelle ist gerade ausgefallen oder nicht eingerichtet.
      const reason =
        e.source === 'finnhub' && !finnhubReady()
          ? 'Finnhub-Key fehlt'
          : e.source === 'coingecko' && coins.status === 'rejected'
            ? coins.reason?.message
            : 'Kurs nicht verfügbar'
      return { ...e, price: null, changePercent: null, error: reason }
    })
  })
})

app.post('/api/watchlist', (req, res) => {
  const { entry, added, error } = addSymbol(req.body || {})
  if (error) return res.status(400).json({ error })
  res.status(added ? 201 : 200).json(entry)
})

app.delete('/api/watchlist/:symbol', (req, res) => {
  removeSymbol(req.params.symbol, req.query.source)
  res.status(204).end()
})

// --- Vertretungsplan (Schulportal Hessen) -----------------------------------
app.get('/api/substitutions', async (req, res) => {
  if (!schulportalReady()) return res.json({ configured: false, days: [], total: 0 })
  try {
    res.json(await fetchSubstitutions({ force: req.query.force === '1' }))
  } catch (err) {
    console.error('substitutions error:', err.message)
    res.status(502).json({ configured: true, error: err.message, days: [], total: 0 })
  }
})

// Status ohne Abruf – zeigt auch, ob die Anmeldung wegen Fehlversuchs ruht.
app.get('/api/substitutions/status', (req, res) => {
  res.json(schulportalStatus())
})

// Rohes HTML zum Nachjustieren des Parsers, falls das Portal sein Markup
// ändert. Nur im Klartext, nur lokal abrufbar – es enthält persönliche Daten.
app.get('/api/substitutions/raw', async (req, res) => {
  if (!schulportalReady()) return res.status(400).type('text/plain').send('Nicht eingerichtet')
  try {
    res.type('text/plain').send(await fetchSubstitutionsHtml())
  } catch (err) {
    res.status(502).type('text/plain').send(err.message)
  }
})

// Einrichtungshilfe: Schul-ID über den Namen finden. ?q=goethe
app.get('/api/substitutions/schools', async (req, res) => {
  try {
    res.json({ schools: await findSchools(req.query.q) })
  } catch (err) {
    res.status(502).json({ error: err.message, schools: [] })
  }
})

// --- Push-Nachrichten (Signal) ----------------------------------------------
// Status: erreichbar? Gerät gekoppelt? Welche Jobs laufen wann?
app.get('/api/notify', async (req, res) => {
  res.json({ ...(await checkSignal()), jobs: listJobs() })
})

// Vorschau des Briefings im Browser – verschickt nichts.
app.get('/api/notify/preview', async (req, res) => {
  try {
    res.type('text/plain').send(await buildDigest())
  } catch (err) {
    console.error('digest preview error:', err.message)
    res.status(500).type('text/plain').send('Briefing konnte nicht gebaut werden: ' + err.message)
  }
})

// Kopplungs-QR als Bild. Jeder Aufruf startet einen neuen Kopplungsversuch,
// der alte verfällt damit.
app.get('/api/notify/signal/qr', async (req, res) => {
  try {
    const { contentType, body } = await fetchLinkQr(req.query.name || 'Dashboard')
    res.set('Content-Type', contentType).set('Cache-Control', 'no-store').send(body)
  } catch (err) {
    console.error('signal qr error:', err.message)
    res.status(502).type('text/plain').send(err.message)
  }
})

// Einrichtungsseite: zeigt den QR groß an – zum Aufrufen auf einem ZWEITEN
// Gerät (Laptop), damit man ihn mit dem Handy scannen kann.
app.get('/signal-setup', (req, res) => {
  res.type('html').set('Cache-Control', 'no-store').send(`<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Signal koppeln</title>
<style>
  body{font-family:system-ui,sans-serif;background:#e8eae3;color:#14161a;margin:0;
       min-height:100vh;display:grid;place-items:center;padding:24px}
  .card{background:#fff;border-radius:20px;padding:28px;max-width:460px;text-align:center;
        box-shadow:0 10px 30px -18px rgba(0,0,0,.4)}
  h1{font-size:1.2rem;margin:0 0 4px}
  p{color:#6f746c;font-size:.9rem;line-height:1.5;margin:0 0 18px}
  img{width:100%;max-width:320px;border-radius:12px;background:#fff}
  ol{text-align:left;font-size:.9rem;line-height:1.7;color:#3c4048;padding-left:20px}
  button{margin-top:16px;padding:11px 18px;border-radius:12px;border:1px solid #14161a;
         background:#14161a;color:#fff;font:inherit;font-weight:600;cursor:pointer}
  code{background:#f2f3ee;padding:2px 6px;border-radius:6px;font-size:.85em}
  @media(prefers-color-scheme:dark){body{background:#0d0f0c;color:#f1f3ec}
    .card{background:#1c1f1a;box-shadow:none}ol{color:#d3d7cc}code{background:#23261f}}
</style></head><body><div class="card">
<h1>Signal koppeln</h1>
<p>Diese Seite auf einem <strong>zweiten Gerät</strong> öffnen (Laptop) und mit
dem Handy scannen. Einen QR-Code kann man nicht mit demselben Gerät scannen,
auf dem er angezeigt wird.</p>
<img id="qr" src="/api/notify/signal/qr" alt="QR-Code zum Koppeln">
<ol>
  <li>Am Handy: <strong>Signal → Einstellungen → Gekoppelte Geräte</strong></li>
  <li><strong>Neues Gerät koppeln</strong> antippen</li>
  <li>Diesen Code scannen</li>
</ol>
<p>Der Code läuft nach wenigen Minuten ab. Danach neu laden.</p>
<button onclick="document.getElementById('qr').src='/api/notify/signal/qr?t='+Date.now()">
  Neuen Code erzeugen</button>
<p style="margin-top:18px">Danach <code>SIGNAL_NUMBER</code> in die <code>.env</code>.</p>
</div></body></html>`)
})

// Vorschau der Vertretungsplan-Nachricht, so wie sie bei Signal ankäme.
app.get('/api/notify/plan/preview', async (req, res) => {
  try {
    res.type('text/plain').send(await buildPlanMessage())
  } catch (err) {
    console.error('plan preview error:', err.message)
    res.status(502).type('text/plain').send('Vertretungsplan-Nachricht fehlgeschlagen: ' + err.message)
  }
})

// Testnachrichten wirklich verschicken. ?type=plan für den Vertretungsplan.
app.post('/api/notify/test', async (req, res) => {
  try {
    await (req.query.type === 'plan' ? sendTestPlan() : sendTestDigest())
    res.json({ sent: true })
  } catch (err) {
    console.error('signal test error:', err.message)
    res.status(502).json({ sent: false, error: err.message })
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
  setupNotifications()
})
