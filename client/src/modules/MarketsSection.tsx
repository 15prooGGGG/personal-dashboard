import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipProps } from 'recharts'
import { useHistory } from '../lib/useStocks.ts'
import type { Quote } from '../types.ts'
import { formatCurrency, formatPercent, formatDateShort, deltaClass } from '../lib/format.ts'

const RANGES = [
  { key: '1M', range: '1mo', interval: '1d' },
  { key: '3M', range: '3mo', interval: '1d' },
  { key: '6M', range: '6mo', interval: '1d' },
  { key: '1J', range: '1y', interval: '1wk' }
] as const

const DEFAULT_SYMBOL = 'NDX1.DE'

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const ts = p.payload.t as number
  return (
    <div className="tt">
      <div className="tt__date">{new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}</div>
      <div className="tt__val data">{formatCurrency(p.value as number, (p.payload.currency as string) || 'EUR')}</div>
    </div>
  )
}

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
  const { history, loading: histLoading, error: histError } = useHistory(symbol, range.range, range.interval)

  const selected = quotes.find((q) => q.symbol === symbol)
  const lastUpdate = selected?.marketTime
    ? new Date(selected.marketTime * 1000).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null

  const chartData = (history?.points ?? []).map((p) => ({ ...p, currency: history?.currency }))

  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">Märkte</h2>
        <span className="section__note">
          {selected?.delayed ? 'Kurse verzögert' : 'Kurse'}
          {lastUpdate ? ` · Stand ${lastUpdate}` : ''}
        </span>
      </div>

      {error ? (
        <div className="state">
          {error}
          <button className="retry" onClick={reload}>
            Erneut versuchen
          </button>
        </div>
      ) : (
        <>
          <div className="kpis">
            {loading && quotes.length === 0
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div className="kpi" key={i}>
                    <div className="skeleton" style={{ height: 12, width: '55%' }} />
                    <div className="skeleton" style={{ height: 26, width: '70%', margin: '8px 0 6px' }} />
                    <div className="skeleton" style={{ height: 12, width: '35%' }} />
                  </div>
                ))
              : quotes.map((q) => (
                  <button
                    key={q.symbol}
                    className={`kpi ${q.symbol === symbol ? 'is-active' : ''}`}
                    onClick={() => setSymbol(q.symbol)}
                    aria-pressed={q.symbol === symbol}
                  >
                    <div className="kpi__label">{q.short}</div>
                    <div className="kpi__price data">
                      {q.price != null ? formatCurrency(q.price, q.currency) : '–'}
                    </div>
                    <div className={`kpi__delta data ${deltaClass(q.changePercent)}`}>
                      {q.changePercent != null ? formatPercent(q.changePercent) : ''}
                    </div>
                  </button>
                ))}
          </div>

          <div className="chartcard">
            <div className="chartcard__head">
              <span className="chartcard__name">{selected ? selected.name : ''}</span>
              <div className="segmented" role="group" aria-label="Zeitraum">
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

            {selected && (
              <div className="chartcard__meta">
                <span className="chartcard__price data">{formatCurrency(selected.price ?? 0, selected.currency)}</span>
                <span className={`data ${deltaClass(selected.changePercent)}`}>
                  {selected.changePercent != null ? formatPercent(selected.changePercent) : ''}
                </span>
              </div>
            )}

            {histError ? (
              <div className="chart-empty">{histError}</div>
            ) : histLoading || chartData.length === 0 ? (
              <div className="chart-empty">Verlauf lädt …</div>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="fillAccent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="t"
                      tickFormatter={(t) => formatDateShort(t as number)}
                      tick={{ fontSize: 11, fill: 'var(--muted)' }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: 'var(--muted)' }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                      tickFormatter={(v) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v as number)}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-strong)' }} />
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      fill="url(#fillAccent)"
                      activeDot={{ r: 4, strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
