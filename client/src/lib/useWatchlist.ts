import { useCallback, useEffect, useState } from 'react'
import type { SymbolHit, WatchlistEntry } from '../types.ts'
import {
  addToWatchlist,
  fetchWatchlist,
  removeFromWatchlist,
  searchSymbols
} from './finnhub.ts'

// Kurse alle 30 s nachladen. Serverseitig sind sie 20 s gecacht – häufigeres
// Pollen erzeugt also nur Last, ohne frischere Zahlen zu liefern.
const REFRESH_MS = 30_000

// Wartezeit nach dem letzten Tastendruck, bevor gesucht wird.
const DEBOUNCE_MS = 350

interface WatchlistState {
  items: WatchlistEntry[]
  configured: boolean
  loading: boolean
  error: string | null
}

export function useWatchlist() {
  const [state, setState] = useState<WatchlistState>({
    items: [],
    configured: true,
    loading: true,
    error: null
  })

  const load = useCallback(async () => {
    try {
      const data = await fetchWatchlist()
      setState({
        items: data.items ?? [],
        configured: data.configured,
        loading: false,
        error: data.error ?? null
      })
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Kurse gerade nicht verfügbar.' }))
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  // Sofort einblenden (noch ohne Kurs), danach den echten Stand nachladen.
  const add = useCallback(
    async (hit: SymbolHit) => {
      try {
        const entry = await addToWatchlist(hit)
        setState((s) =>
          s.items.some((i) => i.symbol === entry.symbol && i.source === entry.source)
            ? s
            : { ...s, items: [...s.items, entry], error: null }
        )
        load()
      } catch (err) {
        setState((s) => ({ ...s, error: (err as Error).message }))
      }
    },
    [load]
  )

  // Optimistisch entfernen; schlägt der Aufruf fehl, holt ein Reload den
  // echten Stand zurück.
  const remove = useCallback(
    async (entry: WatchlistEntry) => {
      setState((s) => ({
        ...s,
        items: s.items.filter((i) => !(i.symbol === entry.symbol && i.source === entry.source))
      }))
      try {
        await removeFromWatchlist(entry)
      } catch {
        setState((s) => ({ ...s, error: 'Konnte nicht entfernen.' }))
        load()
      }
    },
    [load]
  )

  return { ...state, add, remove, reload: load }
}

interface SearchState {
  results: SymbolHit[]
  searching: boolean
  error: string | null
  notConfigured: boolean
}

// Debounced Symbolsuche: erst DEBOUNCE_MS nach dem letzten Tastendruck geht
// eine Anfrage raus, und eine überholte Anfrage wird abgebrochen – sonst kann
// eine langsame frühere Antwort die aktuelle überschreiben.
export function useSymbolSearch(query: string) {
  const [state, setState] = useState<SearchState>({
    results: [],
    searching: false,
    error: null,
    notConfigured: false
  })

  useEffect(() => {
    const q = query.trim()

    if (q.length < 2) {
      setState({ results: [], searching: false, error: null, notConfigured: false })
      return
    }

    setState((s) => ({ ...s, searching: true }))
    const controller = new AbortController()

    const timer = setTimeout(async () => {
      try {
        const data = await searchSymbols(q, controller.signal)
        setState({
          results: data.results ?? [],
          searching: false,
          error: data.error ?? null,
          notConfigured: data.configured === false
        })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setState({
          results: [],
          searching: false,
          error: 'Suche gerade nicht verfügbar.',
          notConfigured: false
        })
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return state
}
