// Nachrichten via öffentliche RSS-Feeds (keine Zugangsdaten nötig).
import { config } from '../config.js'

const TTL = 10 * 60 * 1000
const cache = new Map()
let Parser

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
  const results = await Promise.allSettled(feeds.map((url) => parser.parseURL(url)))

  const items = []
  const seen = new Set()
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    // Feed-Titel sind oft lange Slogans ("tagesschau.de - die erste Adresse …")
    // – auf den Namen vor dem ersten Trennzeichen kürzen.
    const source = (r.value.title || '').split(/\s[-–|]\s/)[0].trim()
    for (const it of r.value.items || []) {
      const title = (it.title || '').trim()
      const key = title.toLowerCase()
      if (!title || seen.has(key)) continue
      seen.add(key)
      items.push({
        id: it.guid || it.link || title,
        title,
        source,
        url: it.link || '#',
        publishedAt: it.isoDate || it.pubDate || null
      })
    }
  }
  items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))

  const value = { items: items.slice(0, 12) }
  cache.set(key, { value, ts: Date.now() })
  return value
}
