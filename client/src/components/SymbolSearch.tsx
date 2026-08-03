import { useState } from 'react'
import type { SymbolHit } from '../types.ts'
import { typeLabel } from '../lib/finnhub.ts'
import { useSymbolSearch } from '../lib/useWatchlist.ts'

// Suchfeld mit Live-Trefferliste. Die Anfrage geht erst kurz nach dem letzten
// Tastendruck raus (Debounce in useSymbolSearch) – das schont das Free-Tier-
// Limit von 60 Anfragen/Minute.
export default function SymbolSearch({
  onAdd,
  isInList
}: {
  onAdd: (hit: SymbolHit) => void
  isInList: (symbol: string) => boolean
}) {
  const [query, setQuery] = useState('')
  const { results, searching, error, notConfigured } = useSymbolSearch(query)
  const trimmed = query.trim()

  return (
    <div className="search">
      <form className="search__form" onSubmit={(e) => e.preventDefault()} role="search">
        <span className="search__icon" aria-hidden="true">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m16.5 16.5 4 4" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Aktie, ETF oder Krypto suchen – Ticker oder Name …"
          aria-label="Wertpapier suchen"
          autoComplete="off"
        />
        {trimmed && (
          <button type="button" className="search__clear" onClick={() => setQuery('')} aria-label="Suche leeren">
            ×
          </button>
        )}
      </form>

      {notConfigured ? null : trimmed.length === 0 ? null : trimmed.length < 2 ? (
        <p className="search__hint">Mindestens zwei Zeichen eingeben.</p>
      ) : error ? (
        <p className="search__hint">{error}</p>
      ) : searching && results.length === 0 ? (
        <p className="search__hint">Sucht …</p>
      ) : results.length === 0 ? (
        <p className="search__hint">Keine Treffer für „{trimmed}“.</p>
      ) : (
        <ul className="rows search__results">
          {results.map((hit) => {
            const added = isInList(hit.symbol)
            return (
              <li className="row" key={hit.symbol}>
                <span className="search__sym num">{hit.display}</span>
                <div className="row__main">
                  <div className="row__title">{hit.name}</div>
                  <div className="row__meta">{typeLabel(hit.type)}</div>
                </div>
                <button
                  className={`btn btn--sm ${added ? 'is-added' : ''}`}
                  onClick={() => onAdd(hit)}
                  disabled={added}
                >
                  {added ? 'Auf der Watchlist' : 'Hinzufügen'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
