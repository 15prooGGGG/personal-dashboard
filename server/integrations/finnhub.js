// ===========================================================================
// Finnhub (finnhub.io) – Symbolsuche und Echtzeitkurse.
// ---------------------------------------------------------------------------
// Läuft bewusst serverseitig: Der API-Key bleibt in der .env und erreicht das
// Frontend nie. Das Frontend spricht nur /api/finnhub/* bzw. /api/watchlist an.
//
// FREE-TIER-GRENZEN (Stand der Einrichtung):
//   - 60 Anfragen pro Minute. /quote kann nur EIN Symbol pro Anfrage.
//   - Realtime nur für US-Börsen. Deutsche Symbole (.DE) liefern meist 0 –
//     dafür bleibt die bestehende Yahoo-Sektion "Märkte" zuständig.
//
// WARUM POLLING UND KEIN WEBSOCKET:
//   wss://ws.finnhub.io verlangt den Token in der URL – im Browser wäre der
//   Key damit wieder offen. Serverseitig ginge es, aber der Free-Tier-Stream
//   liefert nur einzelne Trades von US-Aktien: außerhalb der US-Handelszeiten
//   kommt gar nichts, und für ein Morgen-Briefing ist genau dann der letzte
//   Schlusskurs interessant. /quote liefert den zuverlässig. Der Cache unten
//   deckelt die Last unabhängig davon, wie viele Geräte das Dashboard offen
//   haben.
// ===========================================================================
import { config } from '../config.js'

const BASE = 'https://finnhub.io/api/v1'

const QUOTE_TTL = 20 * 1000 // Kurse: 20 s frisch halten
const SEARCH_TTL = 60 * 60 * 1000 // Suchtreffer ändern sich praktisch nie

const quoteCache = new Map() // symbol -> { value, ts }
const searchCache = new Map() // query  -> { value, ts }
const inFlight = new Map() // symbol -> Promise (verhindert Doppelabrufe)

export const isConfigured = () => Boolean(config.finnhub.apiKey)

// Gemeinsamer Abruf mit Timeout und sprechenden Fehlern -----------------------
async function finnhub(endpoint, params) {
  if (!isConfigured()) throw new Error('FINNHUB_API_KEY fehlt')

  const url = new URL(BASE + endpoint)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('token', config.finnhub.apiKey)

  const res = await fetch(url, { signal: AbortSignal.timeout(9000) })

  if (res.status === 401) throw new Error('Finnhub-Key ungültig')
  if (res.status === 429) throw new Error('Finnhub-Limit erreicht (60/min)')
  if (res.status === 403) throw new Error('Im Free-Tier nicht verfügbar')
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`)

  return res.json()
}

// Symbolsuche (/search) -------------------------------------------------------
// Liefert Aktien, ETFs, Fonds, Krypto … je nach Treffer.
export async function searchSymbols(query) {
  const q = String(query || '').trim()
  if (q.length < 2) return { query: q, results: [] }

  const key = q.toLowerCase()
  const hit = searchCache.get(key)
  if (hit && Date.now() - hit.ts < SEARCH_TTL) return hit.value

  const data = await finnhub('/search', { q })

  const results = (data.result || [])
    // Finnhub liefert für dieselbe Firma viele Börsenplätze. Symbole mit Punkt
    // sind Zweitnotierungen (z. B. AAPL.MX) – die spart der Free-Tier ohnehin
    // aus, deshalb zuerst die primären Notierungen zeigen.
    .filter((r) => r.symbol && r.description)
    .map((r) => ({
      symbol: r.symbol,
      display: r.displaySymbol || r.symbol,
      name: r.description,
      type: r.type || '',
      source: 'finnhub'
    }))
    .sort((a, b) => Number(a.symbol.includes('.')) - Number(b.symbol.includes('.')))
    .slice(0, 12)

  const value = { query: q, results }
  searchCache.set(key, { value, ts: Date.now() })
  return value
}

// Einzelkurs (/quote) ---------------------------------------------------------
// Antwortfelder: c=aktuell, d=Änderung, dp=Änderung %, h=Hoch, l=Tief,
// o=Eröffnung, pc=Vortagesschluss, t=Zeitstempel (s).
export async function fetchQuote(symbol) {
  const sym = String(symbol || '').trim().toUpperCase()
  if (!sym) throw new Error('Symbol fehlt')

  const hit = quoteCache.get(sym)
  if (hit && Date.now() - hit.ts < QUOTE_TTL) return hit.value

  // Fragen mehrere Clients gleichzeitig, reicht ein einziger Abruf.
  if (inFlight.has(sym)) return inFlight.get(sym)

  const promise = (async () => {
    const q = await finnhub('/quote', { symbol: sym })
    // Unbekannte Symbole beantwortet Finnhub mit lauter Nullen statt 404.
    const known = Number(q.c) > 0
    const value = {
      symbol: sym,
      price: known ? q.c : null,
      change: known ? q.d ?? null : null,
      changePercent: known ? q.dp ?? null : null,
      high: known ? q.h ?? null : null,
      low: known ? q.l ?? null : null,
      open: known ? q.o ?? null : null,
      previousClose: known ? q.pc ?? null : null,
      marketTime: q.t || null,
      // Free-Tier liefert nur US-Börsen; CoinGecko rechnet dagegen in EUR.
      // Jeder Kurs führt seine Währung mit, damit das Frontend nicht raten muss.
      currency: 'USD'
    }
    quoteCache.set(sym, { value, ts: Date.now() })
    return value
  })().finally(() => inFlight.delete(sym))

  inFlight.set(sym, promise)
  return promise
}

// Kurse für mehrere Symbole ---------------------------------------------------
// Free-Tier kann /quote nicht bündeln – ein Abruf je Symbol. Einzelne Fehler
// dürfen die restliche Watchlist nicht mitreißen.
export async function fetchQuotes(symbols) {
  const settled = await Promise.allSettled(symbols.map(fetchQuote))
  return settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          symbol: symbols[i],
          price: null,
          change: null,
          changePercent: null,
          high: null,
          low: null,
          open: null,
          previousClose: null,
          marketTime: null,
          currency: 'USD',
          error: r.reason?.message || 'Kurs nicht verfügbar'
        }
  )
}
