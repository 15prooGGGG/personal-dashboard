// ===========================================================================
// Finnhub-Anbindung für das Frontend.
//
// WICHTIG: Hier steht KEIN API-Key. Der liegt als FINNHUB_API_KEY in der .env
// auf dem Server; dieses Modul spricht ausschließlich die eigenen /api-Routen
// an (server/index.js -> server/integrations/finnhub.js). Ein VITE_-Key würde
// beim Build ins Browser-Bundle wandern und wäre öffentlich lesbar.
// ===========================================================================
import type { SymbolHit, WatchlistEntry } from '../types.ts'

export interface SearchResponse {
  configured: boolean
  query?: string
  results: SymbolHit[]
  error?: string
}

export interface WatchlistResponse {
  configured: boolean
  items: WatchlistEntry[]
  error?: string
}

// Symbolsuche. `signal` erlaubt es, überholte Eingaben abzubrechen.
export async function searchSymbols(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  const res = await fetch(`/api/finnhub/search?q=${encodeURIComponent(query)}`, { signal })
  const data = (await res.json()) as SearchResponse
  if (!res.ok && !data.error) throw new Error('Suche fehlgeschlagen')
  return data
}

// Watchlist inkl. aktueller Kurse.
export async function fetchWatchlist(signal?: AbortSignal): Promise<WatchlistResponse> {
  const res = await fetch('/api/watchlist', { signal })
  const data = (await res.json()) as WatchlistResponse
  if (!res.ok && !data.error) throw new Error('Watchlist fehlgeschlagen')
  return data
}

export async function addToWatchlist(hit: SymbolHit): Promise<WatchlistEntry> {
  const res = await fetch('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: hit.symbol, name: hit.name, type: hit.type })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Konnte nicht hinzufügen')
  return data as WatchlistEntry
}

export async function removeFromWatchlist(symbol: string): Promise<void> {
  const res = await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Konnte nicht entfernen')
}

// Finnhub-Typbezeichnungen sind englisch und uneinheitlich ("Common Stock",
// "ETP", "REIT"). Für die Anzeige auf kurze deutsche Labels bringen.
const TYPE_LABELS: Record<string, string> = {
  'common stock': 'Aktie',
  'preferred stock': 'Vorzugsaktie',
  ads: 'ADR',
  adr: 'ADR',
  gdr: 'GDR',
  etp: 'ETF',
  etf: 'ETF',
  'closed-end fund': 'Fonds',
  'mutual fund': 'Fonds',
  'open-end fund': 'Fonds',
  reit: 'REIT',
  bond: 'Anleihe',
  crypto: 'Krypto',
  'digital currency': 'Krypto',
  warrant: 'Optionsschein',
  right: 'Bezugsrecht',
  unit: 'Unit'
}

export function typeLabel(type: string): string {
  const key = (type || '').trim().toLowerCase()
  if (!key) return 'Sonstige'
  return TYPE_LABELS[key] || type
}
