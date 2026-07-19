import { useCallback, useEffect, useState } from 'react'

// Generischer GET-Hook für die /api-Endpunkte, mit optionalem Auto-Refresh.
export function useApi<T>(url: string, intervalMs?: number) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Fehler')
      setData((await res.json()) as T)
      setError(null)
    } catch {
      setError('Gerade nicht verfügbar.')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    setLoading(true)
    load()
    if (!intervalMs) return
    const t = setInterval(load, intervalMs)
    return () => clearInterval(t)
  }, [load, intervalMs])

  return { data, loading, error, reload: load }
}
