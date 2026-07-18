// Leiser Markt-Ticker im Kopf des Content-Bereichs. Informiert (mono, gedämpft),
// dekoriert nicht. Bewegung wird bei prefers-reduced-motion per CSS deaktiviert.
import type { Stock } from '../types.ts'

export default function Ticker({ items }: { items: Stock[] }) {
  // Inhalt wird verdoppelt, damit die Endlos-Schleife lückenlos läuft.
  const loop = [...items, ...items]

  return (
    <div className="ticker" aria-label="Marktüberblick Watchlist" role="marquee">
      <div className="ticker__track">
        {loop.map((s, i) => {
          const up = s.changePercent >= 0
          return (
            <span className="ticker__item" key={`${s.symbol}-${i}`} aria-hidden={i >= items.length}>
              <span className="ticker__sym">{s.symbol}</span>
              <span className={`ticker__delta ${up ? 'is-up' : 'is-down'}`}>
                {up ? '▲' : '▼'} {Math.abs(s.changePercent).toFixed(2)}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
