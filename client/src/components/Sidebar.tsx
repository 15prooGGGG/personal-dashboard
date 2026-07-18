// Linke Navigationsleiste im Dashboard-Stil.
// Oben das "Dawn Horizon"-Signature-Band mit Begrüßung, Live-Uhr, Datum und
// Wetter-Glance; darunter die aus der Modul-Registry generierte Navigation.
import { useEffect, useState } from 'react'
import type { ModuleDef } from '../types.ts'
import { weather } from '../data/mock.ts'
import { dayPhase, greeting, formatClock, formatDate } from '../lib/time.ts'
import { WeatherIcon } from './icons.tsx'

interface SidebarProps {
  modules: ModuleDef[]
  activeId: string | null
}

export default function Sidebar({ modules, activeId }: SidebarProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const phase = dayPhase(now)

  return (
    <aside className="sidebar" data-phase={phase}>
      {/* Signature: Dawn Horizon */}
      <div className="dawn">
        <div className="dawn__sky" aria-hidden />
        <div className="dawn__content">
          <p className="dawn__greeting">{greeting(now)}</p>
          <p className="dawn__clock">{formatClock(now)}</p>
          <p className="dawn__date">{formatDate(now)}</p>
          <p className="dawn__weather">
            <WeatherIcon width={16} height={16} />
            <span>
              {weather.tempC}° · {weather.condition} · {weather.location}
            </span>
          </p>
        </div>
      </div>

      <nav className="nav" aria-label="Briefing-Module">
        <p className="nav__label">Briefing</p>
        <ul className="nav__list">
          {modules.map((m) => {
            const Icon = m.icon
            const active = activeId === m.id
            return (
              <li key={m.id}>
                <a
                  href={`#module-${m.id}`}
                  className={`nav__item ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                >
                  <span className="nav__icon">
                    <Icon width={18} height={18} />
                  </span>
                  <span className="nav__text">{m.title}</span>
                  {m.experimental && <span className="nav__dot" title="experimentell" />}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      <p className="sidebar__foot">Morgen-Briefing · v0.2</p>
    </aside>
  )
}
