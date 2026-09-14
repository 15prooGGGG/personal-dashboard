import { useState } from 'react'
import PageSection from '../components/PageSection.tsx'
import NotConnected from '../components/NotConnected.tsx'
import SymbolSearch from '../components/SymbolSearch.tsx'
import Sparkline from '../components/Sparkline.tsx'
import { StarIcon } from '../components/icons.tsx'
import { typeLabel } from '../lib/finnhub.ts'
import { useWatchlist } from '../lib/useWatchlist.ts'
import { formatCurrency, formatPercent, deltaClass } from '../lib/format.ts'
import type { WatchlistEntry } from '../types.ts'

// Dasselbe Kürzel kann in beiden Quellen vorkommen – erst Quelle + Symbol
// zusammen identifizieren einen Eintrag eindeutig.
const key = (e: WatchlistEntry) => `${e.source}:${e.symbol}`

// Aktien notieren in USD, Krypto in EUR – die Währung kommt pro Kurs mit.
function fmt(value: number | null | undefined, currency = 'USD') {
  return value != null ? formatCurrency(value, currency) : '–'
}

// Aufgeklappte Detailzeile. Krypto handelt durchgehend, hat also keine
// Eröffnung und rollierende 24-Stunden-Werte statt Tageswerten.
function Details({ entry }: { entry: WatchlistEntry }) {
  const crypto = entry.source === 'coingecko'
  const fields = crypto
    ? ([
        ['Hoch 24 h', entry.high],
        ['Tief 24 h', entry.low],
        ['vor 24 h', entry.previousClose]
      ] as const)
    : ([
        ['Eröffnung', entry.open],
        ['Tageshoch', entry.high],
        ['Tagestief', entry.low],
        ['Vortag', entry.previousClose]
      ] as const)

  return (
    <>
      {entry.spark && entry.spark.length > 1 && (
        <div className="wl__chart">
          <Sparkline points={entry.spark} range={entry.sparkRange} wide />
          <span className="wl__chart-note">Verlauf · {entry.sparkRange}</span>
        </div>
      )}
      <div className="wl__details">
        {fields.map(([label, value]) => (
          <div className="wl__detail" key={label}>
            <span className="wl__detail-label">{label}</span>
            <span className="wl__detail-value num">{fmt(value, entry.currency)}</span>
          </div>
        ))}
      </div>
    </>
  )
}

export default function WatchlistSection() {
  const { items, configured, loading, error, add, remove } = useWatchlist()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!configured) {
    return (
      <PageSection title="Watchlist" icon={StarIcon}>
        <NotConnected
          name="Finnhub"
          steps={[
            'Kostenlos registrieren auf finnhub.io/register.',
            'Im Finnhub-Dashboard den API-Key kopieren.',
            'Key in die .env eintragen und den Container neu starten.'
          ]}
          envVars={['FINNHUB_API_KEY']}
        />
      </PageSection>
    )
  }

  const note = items.length > 0 ? `${items.length} Werte · Kurse alle 30 s` : undefined

  return (
    <PageSection title="Watchlist" icon={StarIcon} note={note}>
      <div className="card">
        <SymbolSearch
          onAdd={add}
          isInList={(hit) => items.some((i) => i.symbol === hit.symbol && i.source === hit.source)}
        />
      </div>

      <div className="card wl__card">
        {error && <div className="state">{error}</div>}

        {loading && items.length === 0 ? (
          <div className="state">Lädt …</div>
        ) : items.length === 0 ? (
          <div className="state">
            Noch nichts beobachtet. Such oben nach einem Wert und füg ihn hinzu.
          </div>
        ) : (
          <ul className="rows">
            {items.map((entry) => {
              // Verglichen wird derselbe Schlüssel, der auch gesetzt wird –
              // sonst bleibt die Detailzeile immer zu.
              const open = expanded === key(entry)
              return (
                <li key={key(entry)}>
                  <div className="wl">
                    <button
                      className="wl__main"
                      onClick={() => setExpanded(open ? null : key(entry))}
                      aria-expanded={open}
                    >
                      <span className="wl__sym num">{entry.display}</span>
                      <span className="wl__text">
                        <span className="row__title">{entry.name}</span>
                        <span className="row__meta">
                          {entry.error ? entry.error : typeLabel(entry.type)}
                        </span>
                      </span>
                      <Sparkline points={entry.spark} range={entry.sparkRange} />
                      <span className="wl__price num">{fmt(entry.price, entry.currency)}</span>
                      <span className={`wl__delta num ${deltaClass(entry.changePercent)}`}>
                        {entry.changePercent != null ? formatPercent(entry.changePercent) : ''}
                      </span>
                    </button>
                    <button
                      className="todo__del"
                      onClick={() => remove(entry)}
                      aria-label={`${entry.name} von der Watchlist entfernen`}
                    >
                      ×
                    </button>
                  </div>
                  {open && <Details entry={entry} />}
                </li>
              )
            })}
          </ul>
        )}

        <p className="todohint">
          Kurse von Finnhub (Free-Tier: Echtzeit für US-Börsen). Die Auswahl liegt auf dem
          Server – auf jedem Gerät dieselbe Liste.
        </p>
      </div>
    </PageSection>
  )
}
