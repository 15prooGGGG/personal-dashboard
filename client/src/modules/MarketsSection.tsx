import { useState } from 'react'
import PriceChart from '../components/PriceChart.tsx'
import type { Quote } from '../types.ts'
import { formatCurrency, formatPercent, deltaClass } from '../lib/format.ts'

export const RANGES = [
  { key: '1M', range: '1mo', interval: '1d' },
  { key: '3M', range: '3mo', interval: '1d' },
  { key: '6M', range: '6mo', interval: '1d' },
  { key: '1J', range: '1y', interval: '1wk' }
] as const

export const DEFAULT_SYMBOL = 'NDX1.DE'

interface MarketsSectionProps {
  quotes: Quote[]
  loading: boolean
  error: string | null
  reload: () => void
}

export default function MarketsSection({ quotes, loading, error, reload }: MarketsSectionProps) {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL)
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]['key']>('1M')
  const range = RANGES.find((r) => r.key === rangeKey)!
  const selected = quotes.find((q) => q.symbol === symbol)

  const stand = selected?.marketTime
    ? new Date(selected.marketTime * 1000).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null

  if (error) {
    return (
      <section className="sec">
        <div className="sec__head">
          <h2 className="sec__title">Märkte</h2>
        </div>
        <div className="state">
          {error}
          <button className="retry" onClick={reload}>
            Erneut versuchen
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="sec">
      <div className="sec__head">
        <h2 className="sec__title">Märkte</h2>
        <span className="sec__note">{stand ? `verzögert · Stand ${stand}` : 'verzögert'}</span>
      </div>

      <div className="tiles">
        {loading && quotes.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <div className="tile" key={i}>
                <div className="skel" style={{ height: 11, width: '50%' }} />
                <div className="skel" style={{ height: 24, width: '72%', margin: '9px 0 8px' }} />
                <div className="skel" style={{ height: 11, width: '34%' }} />
              </div>
            ))
          : quotes.map((q) => (
              <button
                key={q.symbol}
                className={`tile ${q.symbol === symbol ? 'is-active' : ''}`}
                onClick={() => setSymbol(q.symbol)}
                aria-pressed={q.symbol === symbol}
              >
                <div className="tile__label">{q.short}</div>
                <div className="tile__value">{q.price != null ? formatCurrency(q.price, q.currency) : '–'}</div>
                <div className={`tile__delta ${deltaClass(q.changePercent)}`}>
                  {q.changePercent != null ? formatPercent(q.changePercent) : ''}
                </div>
              </button>
            ))}
      </div>

      <div className="card">
        <div className="hero__top">
          <div>
            <div className="hero__name">{selected?.name ?? ''}</div>
            <div className="hero__value">
              <span className="hero__price">
                {selected?.price != null ? formatCurrency(selected.price, selected.currency) : '–'}
              </span>
              {selected?.changePercent != null && (
                <span className={`delta ${deltaClass(selected.changePercent)}`}>
                  {formatPercent(selected.changePercent)}
                </span>
              )}
            </div>
          </div>
          <div className="seg" role="group" aria-label="Zeitraum">
            {RANGES.map((r) => (
              <button
                key={r.key}
                className={r.key === rangeKey ? 'is-active' : ''}
                onClick={() => setRangeKey(r.key)}
                aria-pressed={r.key === rangeKey}
              >
                {r.key}
              </button>
            ))}
          </div>
        </div>

        <PriceChart symbol={symbol} range={range.range} interval={range.interval} />
      </div>
    </section>
  )
}
