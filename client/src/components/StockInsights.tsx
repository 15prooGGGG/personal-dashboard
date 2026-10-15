import { useApi } from '../lib/useApi.ts'
import { formatCurrency } from '../lib/format.ts'
import { relativeTime } from '../lib/time.ts'
import { ChevronRightIcon } from './icons.tsx'

// ===========================================================================
// Unter dem Kurs-Chart: Marktdaten (Yahoo) und aktuelle Meldungen zum Wert
// (Google News), beides von /api/stocks/insights.
// ===========================================================================

interface Details {
  name: string
  exchange: string | null
  currency: string
  quoteType: string | null
  price: number | null
  open: number | null
  dayLow: number | null
  dayHigh: number | null
  previousClose: number | null
  volume: number | null
  avgVolume: number | null
  yearLow: number | null
  yearHigh: number | null
  marketCap: number | null
  pe: number | null
  forwardPe: number | null
  avg50: number | null
  avg200: number | null
}
interface Insights {
  symbol: string
  query: string
  details: Details | null
  news: { id: string; title: string; source: string; url: string; publishedAt: string | null }[]
}

const compact = (v: number | null) =>
  v == null ? '–' : new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 2 }).format(v)
const num = (v: number | null, digits = 1) =>
  v == null ? '–' : v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`

/** Spanne mit Markierung, wo der Kurs gerade steht. */
function RangeBar({ label, low, high, price, currency }: { label: string; low: number | null; high: number | null; price: number | null; currency: string }) {
  if (low == null || high == null || price == null || high <= low) return null
  const p = Math.max(0, Math.min(1, (price - low) / (high - low)))
  return (
    <div className="si-range">
      <div className="si-range__head">
        <span>{label}</span>
        <span className="num">{Math.round(p * 100)} %</span>
      </div>
      <div className="si-range__track" role="img" aria-label={`${label}: Kurs bei ${Math.round(p * 100)} % der Spanne`}>
        <span className="si-range__fill" style={{ width: `${p * 100}%` }} />
        <span className="si-range__dot" style={{ left: `${p * 100}%` }} />
      </div>
      <div className="si-range__ends num">
        <span>{formatCurrency(low, currency)}</span>
        <span>{formatCurrency(high, currency)}</span>
      </div>
    </div>
  )
}

export default function StockInsights({ symbol, label }: { symbol: string; label: string }) {
  const { data, loading, error } = useApi<Insights>(`/api/stocks/insights?symbol=${encodeURIComponent(symbol)}`, 10 * 60 * 1000)
  const d = data?.symbol === symbol ? data.details : null
  const news = data?.symbol === symbol ? data.news : []
  const cur = d?.currency ?? 'EUR'

  const facts: [string, string][] = d
    ? [
        ['Eröffnung', d.open != null ? formatCurrency(d.open, cur) : '–'],
        ['Vortag', d.previousClose != null ? formatCurrency(d.previousClose, cur) : '–'],
        ['Volumen', `${compact(d.volume)}${d.avgVolume ? ` · ⌀ ${compact(d.avgVolume)}` : ''}`],
        ...(d.marketCap != null ? ([['Börsenwert', `${compact(d.marketCap)} €`]] as [string, string][]) : []),
        ...(d.pe != null ? ([['KGV', `${num(d.pe)}${d.forwardPe ? ` · erw. ${num(d.forwardPe)}` : ''}`]] as [string, string][]) : []),
        ...(d.price != null && d.avg50 ? ([['50-Tage-Linie', `${formatCurrency(d.avg50, cur)} (${pct((d.price / d.avg50 - 1) * 100)})`]] as [string, string][]) : []),
        ...(d.price != null && d.avg200 ? ([['200-Tage-Linie', `${formatCurrency(d.avg200, cur)} (${pct((d.price / d.avg200 - 1) * 100)})`]] as [string, string][]) : [])
      ]
    : []

  return (
    <div className="si">
      <article className="card si-card">
        <div className="card__head">
          <h3 className="card__title">Marktdaten</h3>
          {d?.exchange && <span className="sec__note">{d.exchange}</span>}
        </div>
        {!d ? (
          <div className="state">{loading ? 'Lädt …' : error ?? 'Keine Marktdaten verfügbar.'}</div>
        ) : (
          <>
            <RangeBar label="Heute" low={d.dayLow} high={d.dayHigh} price={d.price} currency={cur} />
            <RangeBar label="52 Wochen" low={d.yearLow} high={d.yearHigh} price={d.price} currency={cur} />
            <dl className="si-facts">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd className="num">{v}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </article>

      <article className="card si-card">
        <div className="card__head">
          <h3 className="card__title">Meldungen zu {label}</h3>
          <span className="sec__note">letzte 14 Tage</span>
        </div>
        {news.length === 0 ? (
          <div className="state">{loading ? 'Lädt …' : 'Keine aktuellen Meldungen gefunden.'}</div>
        ) : (
          <ul className="rows">
            {news.map((n) => (
              <li key={n.id}>
                <a className="news" href={n.url} target="_blank" rel="noopener noreferrer">
                  <span className="news__main">
                    <span className="news__title">{n.title}</span>
                    <span className="news__meta">
                      {n.source}
                      {n.publishedAt ? ` · ${relativeTime(n.publishedAt)}` : ''}
                    </span>
                  </span>
                  <ChevronRightIcon className="news__chev" width={15} height={15} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  )
}
