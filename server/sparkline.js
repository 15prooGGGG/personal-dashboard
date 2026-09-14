// ===========================================================================
// Kursverläufe für die Watchlist-Sparklines.
// ---------------------------------------------------------------------------
// Zwei Quellen, ein Muster: Aktien kommen von Yahoo (Finnhubs /stock/candle
// liegt hinter dem Bezahltarif), Krypto von CoinGecko. Beide holen ihre Punkte
// über createSparkCache und liefern am Ende dasselbe Format – eine Liste
// ausgedünnter Kurse, ältester zuerst.
// ===========================================================================

// Auf so viele Punkte wird eingedampft. Mehr Auflösung sieht man bei der
// Breite einer Zeilen-Sparkline nicht, kostet aber Bandbreite: Die Verläufe
// hängen an der Watchlist-Antwort, die alle 30 s neu geholt wird.
const TARGET_POINTS = 40

// Nachkommastellen sind je nach Wert völlig unterschiedlich (Aktie: 187,42 –
// Nischen-Coin: 0,00000341). Deshalb signifikante Stellen statt fester Rundung.
const round = (v) => Number(v.toPrecision(6))

// Gleichmäßig ausdünnen. Erster und letzter Punkt bleiben exakt erhalten –
// sonst könnte die Sparkline in eine andere Richtung zeigen als der
// Prozentwert daneben.
export function downsample(values, target = TARGET_POINTS) {
  const list = (values || []).filter((v) => Number.isFinite(v))
  if (list.length <= target) return list.map(round)

  const step = (list.length - 1) / (target - 1)
  return Array.from({ length: target }, (_, i) => round(list[Math.round(i * step)]))
}

// Cache nach dem Muster "stale-while-revalidate" ------------------------------
// Der 30-Sekunden-Poll der Watchlist darf nicht auf Yahoo oder CoinGecko
// warten – ein Wochen- oder Monatsverlauf ändert sich in der Zeit ohnehin
// kaum. Also: vorhandene Punkte sofort zurückgeben und veraltete im
// Hintergrund erneuern. Nur der allererste Abruf eines Symbols wartet.
//
// `load(key)` liefert die rohen Kurse; Ausdünnen und Fehlerbehandlung passiert
// hier, damit beide Quellen sich gleich verhalten.
export function createSparkCache(ttl, load) {
  const cache = new Map() // key -> { value: number[]|null, ts }
  const inFlight = new Map()

  function refresh(key) {
    if (inFlight.has(key)) return inFlight.get(key)

    const promise = (async () => {
      let value = null
      try {
        const points = downsample(await load(key))
        // Ein einzelner Punkt ergibt keine Linie.
        if (points.length > 1) value = points
      } catch (err) {
        // Auch den Fehlschlag cachen: Symbole, die die Quelle nicht kennt
        // (etwa Zweitnotierungen wie AAPL.MX), sollen nicht bei jedem Poll
        // erneut angefragt werden.
        console.error('sparkline error:', key, err.message)
      }
      cache.set(key, { value, ts: Date.now() })
      return value
    })().finally(() => inFlight.delete(key))

    inFlight.set(key, promise)
    return promise
  }

  return async function get(key) {
    const hit = cache.get(key)
    if (!hit) return refresh(key)
    if (Date.now() - hit.ts >= ttl) refresh(key) // im Hintergrund
    return hit.value
  }
}

// Verläufe altern langsam – zehn Minuten reichen für beide Quellen.
export const SPARK_TTL = 10 * 60 * 1000
