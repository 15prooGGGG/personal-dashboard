// ===========================================================================
// Inhalte für die Signal-Nachrichten: Morgen-Briefing und Kursalarme.
// ---------------------------------------------------------------------------
// WAS HIER "ANALYSE" HEISST: beschreibende Kennzahlen aus den echten Kursen –
// Tagesveränderung, Position innerhalb der Tagesspanne, größter Bewegungs-
// treiber, Verhältnis Gewinner/Verlierer. KEINE Prognosen, keine Kauf- oder
// Verkaufssignale. Alles hier ist nachrechenbar; nichts ist geraten.
// ===========================================================================
import { config } from '../config.js'
import { getWatchlist } from '../watchlist-store.js'
import { fetchQuotes as fetchStockQuotes, isConfigured as finnhubReady } from '../integrations/finnhub.js'
import { fetchCoinQuotes } from '../integrations/coingecko.js'
import { fetchNews } from '../integrations/news.js'
import { getState, patchState, berlinNow } from './scheduler.js'

const num = (v, currency) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2
  }).format(v)

const pct = (v) => {
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v))} %`
}

// Kurse für die gesamte Watchlist, quellenübergreifend ------------------------
export async function loadWatchlistQuotes() {
  const entries = getWatchlist()
  if (entries.length === 0) return []

  const stockSymbols = entries.filter((e) => e.source === 'finnhub').map((e) => e.symbol)
  const coinIds = entries.filter((e) => e.source === 'coingecko').map((e) => e.symbol)

  const [stocks, coins] = await Promise.allSettled([
    stockSymbols.length && finnhubReady() ? fetchStockQuotes(stockSymbols) : Promise.resolve([]),
    coinIds.length ? fetchCoinQuotes(coinIds) : Promise.resolve([])
  ])

  const quotes = [
    ...(stocks.status === 'fulfilled' ? stocks.value : []),
    ...(coins.status === 'fulfilled' ? coins.value : [])
  ]
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]))

  return entries
    .map((e) => ({ ...e, ...(bySymbol.get(e.symbol) || {}) }))
    .filter((e) => e.price != null)
}

// Wo steht der Kurs innerhalb der Tagesspanne? 0 % = Tagestief, 100 % = Hoch.
function rangePosition(q) {
  if (q.high == null || q.low == null || q.high === q.low || q.price == null) return null
  return Math.round(((q.price - q.low) / (q.high - q.low)) * 100)
}

// Morgen-Briefing --------------------------------------------------------------
export async function buildDigest() {
  const now = berlinNow()
  const heute = new Date().toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: 'numeric',
    month: 'long'
  })

  const lines = [`Marktbriefing · ${heute}`, '']

  const quotes = await loadWatchlistQuotes()

  if (quotes.length === 0) {
    lines.push('Keine Werte auf der Watchlist – im Dashboard welche hinzufügen.')
  } else {
    const sorted = [...quotes].sort(
      (a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0)
    )

    // Kein Ausrichten per Leerzeichen: Signal rendert proportional, Spalten
    // würden trotzdem verrutschen und nur seltsame Lücken erzeugen.
    for (const q of sorted) {
      const arrow = (q.changePercent ?? 0) >= 0 ? '▲' : '▼'
      lines.push(
        `${arrow} ${q.display} · ${num(q.price, q.currency)} · ${q.changePercent != null ? pct(q.changePercent) : '–'}`
      )
    }

    const up = quotes.filter((q) => (q.changePercent ?? 0) > 0).length
    const down = quotes.filter((q) => (q.changePercent ?? 0) < 0).length
    lines.push('', `${up} im Plus, ${down} im Minus.`)

    const mover = sorted[0]
    if (mover?.changePercent != null) {
      const pos = rangePosition(mover)
      lines.push(
        `Größte Bewegung: ${mover.name} ${pct(mover.changePercent)}` +
          (pos != null ? ` (bei ${pos} % der Tagesspanne).` : '.')
      )
    }
  }

  // Finanznachrichten aus den bereits konfigurierten RSS-Feeds.
  try {
    const news = await fetchNews('finance')
    const items = (news.items || []).slice(0, 5)
    if (items.length) {
      lines.push('', 'Finanznews')
      for (const it of items) lines.push(`• ${it.title}${it.source ? ` (${it.source})` : ''}`)
    }
  } catch (err) {
    console.error('digest news error:', err.message)
  }

  // Nur erwähnen, wenn der Morgen tatsächlich früh ist – sonst wirkt es falsch.
  if (now.hour < 12) lines.push('', 'Guten Morgen.')

  return lines.join('\n')
}

// Kursalarme --------------------------------------------------------------------
// Meldet, sobald ein Wert die Schwelle reißt – und danach erst wieder, wenn er
// eine weitere volle Schwellenstufe zurücklegt. Ohne diese Stufenlogik würde
// ein Wert, der um die Schwelle herum pendelt, im Minutentakt pushen.
export async function buildAlerts() {
  const threshold = config.notify.alertPercent
  if (!threshold || threshold <= 0) return null

  const quotes = await loadWatchlistQuotes()
  const now = berlinNow()
  const state = getState()
  const seen = state.alertSteps || {}
  const next = {}
  const hits = []

  for (const q of quotes) {
    const change = q.changePercent
    if (change == null) continue

    const step = Math.trunc(Math.abs(change) / threshold)
    const key = `${q.source}:${q.symbol}`
    // Richtung mit im Schlüssel: ein Dreher von +3 % auf −3 % ist neu.
    const marker = `${now.date}:${change >= 0 ? 'up' : 'down'}:${step}`

    if (step >= 1) {
      next[key] = marker
      if (seen[key] !== marker) hits.push(q)
    }
  }

  if (hits.length === 0) {
    // Stufen trotzdem fortschreiben, damit ein Tageswechsel sauber zurücksetzt.
    patchState({ alertSteps: { ...seen, ...next } })
    return null
  }

  const lines = [`Kursalarm (ab ${pct(threshold).replace('+', '')})`, '']
  for (const q of hits) {
    const arrow = q.changePercent >= 0 ? '▲' : '▼'
    const pos = rangePosition(q)
    lines.push(
      `${arrow} ${q.name} (${q.display})`,
      `   ${num(q.price, q.currency)}  ${pct(q.changePercent)}` +
        (pos != null ? `  ·  ${pos} % der Tagesspanne` : '')
    )
  }

  patchState({ alertSteps: { ...seen, ...next } })
  return lines.join('\n')
}
