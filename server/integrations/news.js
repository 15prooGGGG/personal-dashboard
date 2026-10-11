// Nachrichten via öffentliche RSS-Feeds (keine Zugangsdaten nötig).
import { config } from '../config.js'

const TTL = 10 * 60 * 1000
const MAX_ITEMS = 40
// Ältere Meldungen fliegen raus (manche Feeds hängen tagelang hinterher).
const MAX_AGE = 48 * 60 * 60 * 1000
const cache = new Map()
let Parser

// Füllmeldungen der Sender (Eigenwerbung, Sendungs-Einträge wie nur
// "tagesschau") sind keine Nachrichten.
function isFiller(title) {
  if (title.split(/\s+/).length < 3) return true
  return /^(entdecken sie|aktuelle pressemitteilungen)|^tagesschau \d{1,2}[:.]\d{2}/i.test(title)
}

export async function fetchNews(type) {
  const key = type === 'finance' ? 'finance' : 'world'
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < TTL) return hit.value

  if (!Parser) Parser = (await import('rss-parser')).default
  const parser = new Parser({
    timeout: 9000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Morgen-Briefing RSS)' }
  })

  const feeds = key === 'finance' ? config.news.finance : config.news.world
  const results = await Promise.allSettled(feeds.map((f) => parser.parseURL(f.url)))

  // Je Quelle die eigenen Meldungen, neueste zuerst.
  const bySource = []
  const seen = new Set()
  const cutoff = Date.now() - MAX_AGE
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') {
      console.warn(`news: ${feeds[i].url} – ${r.reason?.message || r.reason}`)
      return
    }
    // Feed-Titel sind oft lange Slogans ("tagesschau.de - die erste Adresse …")
    // – ohne festen Namen auf den Teil vor dem ersten Trennzeichen kürzen.
    const source = feeds[i].name || (r.value.title || '').split(/\s[-–|]\s/)[0].trim()
    const list = []
    for (const it of r.value.items || []) {
      const title = (it.title || '').trim()
      const norm = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
      if (!title || seen.has(norm) || isFiller(title)) continue
      const publishedAt = it.isoDate || it.pubDate || null
      if (publishedAt && new Date(publishedAt).getTime() < cutoff) continue
      seen.add(norm)
      list.push({
        id: it.guid || it.link || title,
        title,
        source,
        url: it.link || '#',
        publishedAt
      })
    }
    list.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    if (list.length) bySource.push(list)
  })

  // Reihum mischen: erst die neueste Meldung jeder Quelle, dann die
  // zweitneueste usw. So kann ein Feed, der im Minutentakt veröffentlicht,
  // die anderen nicht verdrängen. Innerhalb einer Runde nach Zeit sortiert.
  const items = []
  for (let round = 0; items.length < MAX_ITEMS; round++) {
    const batch = bySource.map((l) => l[round]).filter(Boolean)
    if (batch.length === 0) break
    batch.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    items.push(...batch)
  }

  const value = {
    items: items.slice(0, MAX_ITEMS),
    sources: bySource.map((l) => l[0].source)
  }
  cache.set(key, { value, ts: Date.now() })
  return value
}
