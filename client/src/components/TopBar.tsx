import { useEffect, useState } from 'react'
import type { Theme } from '../lib/useTheme.ts'
import { greeting, formatFullDate } from '../lib/time.ts'
import { SunIcon, MoonIcon } from './icons.tsx'

interface TopBarProps {
  theme: Theme
  onToggleTheme: () => void
}

// Xetra-Handelszeiten (Mo–Fr, 09:00–17:30), bewertet nach lokaler Zeit.
function marketOpen(now: Date): boolean {
  const day = now.getDay()
  const mins = now.getHours() * 60 + now.getMinutes()
  return day >= 1 && day <= 5 && mins >= 540 && mins < 1050
}

export default function TopBar({ theme, onToggleTheme }: TopBarProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const open = marketOpen(now)
  const clock = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  return (
    <header className="head">
      <div>
        <h1 className="head__greeting">{greeting(now)}, Lauri</h1>
        <p className="head__date">
          {formatFullDate(now)} · {clock} Uhr
        </p>
      </div>
      <div className="head__actions">
        <span className="statuspill">
          <span className={`statuspill__dot ${open ? 'is-open' : ''}`} />
          {open ? 'Börse offen' : 'Börse geschlossen'}
        </span>
        <button
          className="iconbtn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}
        >
          {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
        </button>
      </div>
    </header>
  )
}
