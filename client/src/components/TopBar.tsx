import { useEffect, useState } from 'react'
import type { Theme } from '../lib/useTheme.ts'
import type { Quote } from '../types.ts'
import { greeting, formatFullDate } from '../lib/time.ts'
import { formatPercent, deltaClass } from '../lib/format.ts'
import { SunIcon, MoonIcon } from './icons.tsx'

interface TopBarProps {
  theme: Theme
  onToggleTheme: () => void
  quotes: Quote[]
}

// Xetra-Handelszeiten (Mo–Fr, 09:00–17:30). Bewertung nach lokaler Zeit
// (der Nutzer ist in Deutschland ≈ Börsenzeit).
function marketOpen(now: Date): boolean {
  const day = now.getDay()
  const mins = now.getHours() * 60 + now.getMinutes()
  return day >= 1 && day <= 5 && mins >= 9 * 60 && mins < 17 * 60 + 30
}

export default function TopBar({ theme, onToggleTheme, quotes }: TopBarProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const clock = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const open = marketOpen(now)

  const withPct = quotes.filter((q) => q.changePercent != null)
  const avg = withPct.length
    ? withPct.reduce((s, q) => s + (q.changePercent as number), 0) / withPct.length
    : null

  return (
    <header className="banner">
      <div className="banner__scrim" aria-hidden />
      <div className="banner__content">
        <div className="banner__info">
          <h1 className="banner__greeting">{greeting(now)}, Lauri</h1>
          <p className="banner__sub">
            <span className="data">{clock}</span> · {formatFullDate(now)}
          </p>
          <div className="banner__meta">
            <span className="statuspill">
              <span className={`statuspill__dot ${open ? 'is-open' : ''}`} />
              {open ? 'Xetra offen' : 'Börse geschlossen'}
            </span>
            {avg != null && (
              <span className={`banner__balance data ${deltaClass(avg)}`}>Watchlist {formatPercent(avg)}</span>
            )}
          </div>
        </div>
        <button
          className="banner__toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}
        >
          {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
        </button>
      </div>
    </header>
  )
}
