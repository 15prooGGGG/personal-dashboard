import { useEffect, useState } from 'react'
import type { Theme } from '../lib/useTheme.ts'
import { greeting, formatFullDate } from '../lib/time.ts'
import { SunIcon, MoonIcon } from './icons.tsx'

interface TopBarProps {
  theme: Theme
  onToggleTheme: () => void
  showExperimental: boolean
  onToggleExperimental: (v: boolean) => void
}

export default function TopBar({
  theme,
  onToggleTheme,
  showExperimental,
  onToggleExperimental
}: TopBarProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="topbar">
      <div>
        <h1 className="topbar__greeting">{greeting(now)}, Lauri</h1>
        <p className="topbar__date">{formatFullDate(now)}</p>
      </div>
      <div className="topbar__actions">
        <label className="iconbtn" title="Experimentelle Module ein-/ausblenden">
          <input
            type="checkbox"
            checked={showExperimental}
            onChange={(e) => onToggleExperimental(e.target.checked)}
          />
          <span>Experimente</span>
        </label>
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
