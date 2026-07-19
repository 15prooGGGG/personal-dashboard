// ===========================================================================
// Kursquelle: Yahoo Finance (kostenlos, ~15 Min verzögert)
// ---------------------------------------------------------------------------
// Kapselt Session-Handling (Cookie + Crumb) und Caching. Yahoo blockt Abrufe
// ohne gültige Session mit HTTP 429 – daher holen wir einmalig Cookie+Crumb
// und cachen sie. Quotes werden 60 s, Verläufe 10 min zwischengespeichert,
// um das Rate-Limit zu schonen.
//
// SPÄTERER WECHSEL auf einen bezahlten Echtzeit-Anbieter (EODHD, Twelve Data):
// nur fetchQuotes()/fetchHistory() ersetzen – die API-Routen bleiben gleich.
// ===========================================================================

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// Watchlist – hier Symbole ergänzen/ändern (Yahoo-Schreibweise, .DE = Xetra).
export const WATCHLIST = [
  { symbol: 'NDX1.DE', name: 'Nordex SE', short: 'Nordex' },
  { symbol: 'SXRV.DE', name: 'iShares Nasdaq 100', short: 'Nasdaq 100' },
  { symbol: 'EUNL.DE', name: 'iShares Core MSCI World', short: 'MSCI World' }
]

const SESSION_TTL = 30 * 60 * 1000
let session = null // { cookie, crumb, ts }

async function getSession(force = false) {
  if (!force && session && Date.now() - session.ts < SESSION_TTL) return session

  const res = await fetch('https://fc.yahoo.com/', { headers: { 'User-Agent': UA } })
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : []
  const cookie = setCookies.map((c) => c.split(';')[0]).join('; ')

  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie }
  })
  const crumb = (await crumbRes.text()).trim()
  if (!crumb || crumb.length > 40) throw new Error('Yahoo-Crumb konnte nicht geholt werden')

  session = { cookie, crumb, ts: Date.now() }
  return session
}

// Kleiner TTL-Cache -----------------------------------------------------------
function makeCache(ttl) {
  const store = new Map()
  return {
    get(key) {
      const hit = store.get(key)
      if (hit && Date.now() - hit.ts < ttl) return hit.value
      return null
    },
    set(key, value) {
      store.set(key, { value, ts: Date.now() })
    }
  }
}
const quoteCache = makeCache(60 * 1000)
const historyCache = makeCache(10 * 60 * 1000)

async function yahoo(url) {
  const s = await getSession()
  let res = await fetch(url + (url.includes('?') ? '&' : '?') + 'crumb=' + encodeURIComponent(s.crumb), {
    headers: { 'User-Agent': UA, Cookie: s.cookie }
  })
  if (res.status === 401 || res.status === 403 || res.status === 429) {
    const s2 = await getSession(true)
    res = await fetch(url + (url.includes('?') ? '&' : '?') + 'crumb=' + encodeURIComponent(s2.crumb), {
      headers: { 'User-Agent': UA, Cookie: s2.cookie }
    })
  }
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`)
  return res.json()
}

// Aktuelle Kurse der Watchlist -----------------------------------------------
export async function fetchQuotes() {
  const cached = quoteCache.get('all')
  if (cached) return cached

  const symbols = WATCHLIST.map((w) => w.symbol)
  const data = await yahoo(
    'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + encodeURIComponent(symbols.join(','))
  )
  const bySymbol = new Map((data.quoteResponse?.result || []).map((q) => [q.symbol, q]))

  const result = WATCHLIST.map((w) => {
    const q = bySymbol.get(w.symbol) || {}
    return {
      symbol: w.symbol,
      name: w.name,
      short: w.short,
      price: q.regularMarketPrice ?? null,
      currency: q.currency ?? 'EUR',
      changePercent: q.regularMarketChangePercent ?? null,
      previousClose: q.regularMarketPreviousClose ?? null,
      marketTime: q.regularMarketTime ?? null,
      delayed: (q.quoteSourceName || '').toLowerCase().includes('delayed')
    }
  })
  quoteCache.set('all', result)
  return result
}

// Kursverlauf für den Chart ---------------------------------------------------
export async function fetchHistory(symbol, range = '1mo', interval = '1d') {
  const key = `${symbol}:${range}:${interval}`
  const cached = historyCache.get(key)
  if (cached) return cached

  const data = await yahoo(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`
  )
  const r = data.chart?.result?.[0]
  const ts = r?.timestamp || []
  const closes = r?.indicators?.quote?.[0]?.close || []
  const points = ts
    .map((t, i) => ({ t: t * 1000, close: closes[i] }))
    .filter((p) => p.close != null)
    .map((p) => ({ t: p.t, close: Math.round(p.close * 100) / 100 }))

  const out = { symbol, range, interval, currency: r?.meta?.currency ?? 'EUR', points }
  historyCache.set(key, out)
  return out
}
