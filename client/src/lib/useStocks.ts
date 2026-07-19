import { useCallback, useEffect, useState } from 'react'
import type { Quote, History } from '../types.ts'

interface StocksState {
  quotes: Quote[]
  loading: boolean
  error: string | null
}

// Lädt die aktuellen Kurse vom Backend (/api/stocks) und aktualisiert sie
// alle 60 s. Fehler werden sauber weitergereicht (kein stiller Ausfall).
export function useStocks() {
  const [state, setState] = useState<StocksState>({ quotes: [], loading: true, error: null })

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/stocks')
      if (!res.ok) throw new Error('Fehler')
      const data = await res.json()
      setState({ quotes: data.quotes ?? [], loading: false, error: null })
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Kurse gerade nicht verfügbar.' }))
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  return { ...state, reload: load }
}

// Lädt den Kursverlauf für ein Symbol/Zeitraum (/api/stocks/history).
export function useHistory(symbol: string, range: string, interval: string) {
  const [history, setHistory] = useState<History | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetch(`/api/stocks/history?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`)
      .then((r) => {
        if (!r.ok) throw new Error('Fehler')
        return r.json()
      })
      .then((data: History) => {
        if (active) {
          setHistory(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setError('Verlauf nicht verfügbar.')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [symbol, range, interval])

  return { history, loading, error }
}
