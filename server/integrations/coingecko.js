// ===========================================================================
// CoinGecko – Kryptokurse für die Watchlist.
// ---------------------------------------------------------------------------
// Finnhub gibt im Free-Tier keine Coin-Kurse her (nur Aktien mit Krypto-Bezug
// wie GBTC). CoinGecko schließt die Lücke: öffentliche API, KEIN Key nötig.
//
// Zwei Eigenheiten gegenüber Finnhub:
//   - Kurse in EUR statt USD (Crypto handelt 24/7 weltweit, EUR ist hier die
//     nützlichere Anzeige). Deshalb führt jeder Kurs seine Währung selbst mit.
//   - Es gibt keinen "Vortagesschluss", sondern rollierende 24-Stunden-Werte.
//     previousClose rechnen wir daraus zurück, damit die Anzeige einheitlich
//     bleibt.
//
// Identifiziert wird ein Coin über die CoinGecko-ID ("bitcoin"), nicht über
// das Kürzel – Kürzel sind nicht eindeutig (mehrere Coins heißen "BTC").
// ===========================================================================

import { createSparkCache, SPARK_TTL } from '../sparkline.js'

const BASE = 'https://api.coingecko.com/api/v3'

const QUOTE_TTL = 30 * 1000
const SEARCH_TTL = 60 * 60 * 1000

let quoteCache = { ids: '', value: [], ts: 0 }
const searchCache = new Map()

async function coingecko(endpoint, params) {
  const url = new URL(BASE + endpoint)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(9000)
  })

  if (res.status === 429) throw new Error('CoinGecko-Limit erreicht')
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
  return res.json()
}

// Coin-Suche ------------------------------------------------------------------
export async function searchCoins(query) {
  const q = String(query || '').trim()
  if (q.length < 2) return []

  const key = q.toLowerCase()
  const hit = searchCache.get(key)
  if (hit && Date.now() - hit.ts < SEARCH_TTL) return hit.value

  const data = await coingecko('/search', { query: q })

  // Nach Marktkapitalisierung sortiert – ohne Rang (Nischen-Coins) ans Ende.
  const value = (data.coins || [])
    .sort((a, b) => (a.market_cap_rank ?? 9999) - (b.market_cap_rank ?? 9999))
    .slice(0, 6)
    .map((c) => ({
      symbol: c.id,
      display: (c.symbol || c.id).toUpperCase(),
      name: c.name,
      type: 'Crypto',
      source: 'coingecko'
    }))

  searchCache.set(key, { value, ts: Date.now() })
  return value
}

// Kurse ------------------------------------------------------------------------
// Anders als Finnhub kann CoinGecko alle Coins in EINEM Aufruf liefern – die
// gesamte Krypto-Watchlist kostet also nur eine Anfrage.
export async function fetchCoinQuotes(ids) {
  if (ids.length === 0) return []

  const key = [...ids].sort().join(',')
  if (quoteCache.ids === key && Date.now() - quoteCache.ts < QUOTE_TTL) {
    return quoteCache.value
  }

  const data = await coingecko('/coins/markets', {
    vs_currency: 'eur',
    ids: key,
    price_change_percentage: '24h'
  })

  const value = data.map((c) => ({
    symbol: c.id,
    price: c.current_price ?? null,
    change: c.price_change_24h ?? null,
    changePercent: c.price_change_percentage_24h ?? null,
    high: c.high_24h ?? null,
    low: c.low_24h ?? null,
    open: null, // Crypto handelt durchgehend – es gibt keine Eröffnung.
    previousClose:
      c.current_price != null && c.price_change_24h != null
        ? c.current_price - c.price_change_24h
        : null,
    marketTime: c.last_updated ? Math.floor(Date.parse(c.last_updated) / 1000) : null,
    currency: 'EUR'
  }))

  quoteCache = { ids: key, value, ts: Date.now() }
  return value
}

// Kursverlauf für die Sparkline -------------------------------------------------
// NICHT über sparkline=true an /coins/markets: Das Feld sparkline_in_7d liefert
// USD, egal welche vs_currency angefragt wurde. Zusammen mit einem EUR-Kurs
// wären Linie und Zahl daneben aus verschiedenen Welten – bei einem flachen
// Coin kann allein die Wechselkursbewegung die Richtung umdrehen.
//
// /market_chart kostet eine Anfrage je Coin, rechnet dafür in EUR. Bei 7 Tagen
// liefert CoinGecko automatisch Stundenwerte.
export const fetchCoinSparkline = createSparkCache(SPARK_TTL, async (id) => {
  const data = await coingecko(`/coins/${encodeURIComponent(id)}/market_chart`, {
    vs_currency: 'eur',
    days: '7'
  })
  return (data.prices || []).map(([, price]) => price)
})
