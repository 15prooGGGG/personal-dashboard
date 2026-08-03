import { useState } from 'react'
import PageSection from '../components/PageSection.tsx'
import NotConnected from '../components/NotConnected.tsx'
import SymbolSearch from '../components/SymbolSearch.tsx'
import { StarIcon } from '../components/icons.tsx'
import { typeLabel } from '../lib/finnhub.ts'
import { useWatchlist } from '../lib/useWatchlist.ts'
import { formatCurrency, formatPercent, deltaClass } from '../lib/format.ts'
import type { WatchlistEntry } from '../types.ts'

// Finnhub liefert zum Kurs keine Währung mit. Im Free-Tier gibt es Kurse nur
// für US-Börsen, deshalb ist USD hier die richtige Annahme.
const CURRENCY = 'USD'

function fmt(value: number | null | undefined) {
  return value != null ? formatCurrency(value, CURRENCY) : '–'
}

// Aufgeklappte Detailzeile: die Tageswerte aus dem /quote-Endpunkt.
function Details({ entry }: { entry: WatchlistEntry }) {
  const fields = [
    ['Eröffnung', entry.open],
    ['Tageshoch', entry.high],
    ['Tagestief', entry.low],
    ['Vortag', entry.previousClose]
  ] as const

  return (
    <div className="wl__details">
      {fields.map(([label, value]) => (
        <div className="wl__detail" key={label}>
          <span className="wl__detail-label">{label}</span>
          <span className="wl__detail-value num">{fmt(value)}</span>
        </div>
      ))}
    </div>
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
        <SymbolSearch onAdd={add} isInList={(sym) => items.some((i) => i.symbol === sym)} />
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
              const open = expanded === entry.symbol
              return (
                <li key={entry.symbol}>
                  <div className="wl">
                    <button
                      className="wl__main"
                      onClick={() => setExpanded(open ? null : entry.symbol)}
                      aria-expanded={open}
                    >
                      <span className="wl__sym num">{entry.symbol}</span>
                      <span className="wl__text">
                        <span className="row__title">{entry.name}</span>
                        <span className="row__meta">
                          {entry.error ? entry.error : typeLabel(entry.type)}
                        </span>
                      </span>
                      <span className="wl__price num">{fmt(entry.price)}</span>
                      <span className={`wl__delta num ${deltaClass(entry.changePercent)}`}>
                        {entry.changePercent != null ? formatPercent(entry.changePercent) : ''}
                      </span>
                    </button>
                    <button
                      className="todo__del"
                      onClick={() => remove(entry.symbol)}
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
