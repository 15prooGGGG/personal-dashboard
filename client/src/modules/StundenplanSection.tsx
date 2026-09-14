import { useState } from 'react'
import PageSection from '../components/PageSection.tsx'
import { TimetableIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'

interface Lesson {
  type: 'lesson' | 'break' | 'free'
  period: number
  start: string | null
  end: string | null
  subject?: string | null
  course?: string | null
  teacher?: string | null
  room?: string | null
  note?: string | null
}
type Cell = Omit<Lesson, 'period' | 'start' | 'end'> | null

interface Plan {
  configured: boolean
  reason?: string
  meta?: { title?: string }
  days: string[]
  weeks: Record<string, Record<string, Record<string, Cell>>>
  times: Record<string, [string, string]>
  week: 'A' | 'B' | null
  weekKnown: boolean
  day: string | null
  today: Lesson[]
  current: number | null
  next: number | null
}

export default function StundenplanSection() {
  const { data, loading, error } = useApi<Plan>('/api/stundenplan', 10 * 60 * 1000)
  const [shown, setShown] = useState<'A' | 'B' | null>(null)

  if (loading) {
    return (
      <PageSection title="Stundenplan" icon={TimetableIcon}>
        <div className="state">Lädt …</div>
      </PageSection>
    )
  }
  if (error || !data?.configured) {
    return (
      <PageSection title="Stundenplan" icon={TimetableIcon}>
        <div className="setup">
          <p className="setup__lead">Noch kein Stundenplan aufgebaut.</p>
          <p className="muted">
            Die PDFs liegen im Vault unter <code>07 Anhänge</code>. Einmalig einlesen mit{' '}
            <code>node scripts/build-stundenplan.js</code>.
          </p>
        </div>
      </PageSection>
    )
  }

  const week = shown ?? data.week ?? 'A'
  const grid = data.weeks[week] ?? {}
  const periods = Object.keys(grid)
    .filter((k) => k !== '__footer')
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <PageSection
      title="Stundenplan"
      icon={TimetableIcon}
      note={data.weekKnown ? `aktuell ${data.week}-Woche` : 'A/B-Woche nicht hinterlegt'}
    >
      <div className="bento">
        {/* Heute */}
        <article className="card">
          <div className="card__head">
            <h3 className="card__title">{data.day ? `Heute · ${data.day}` : 'Heute'}</h3>
            {data.day && data.week && <span className="sec__note">{data.week}-Woche</span>}
          </div>
          {!data.day ? (
            <div className="state">Heute ist schulfrei.</div>
          ) : data.today.length === 0 ? (
            <div className="state">Keine Stunden eingetragen.</div>
          ) : (
            <ul className="rows">
              {data.today.map((l) => (
                <li
                  className={`row tt-row ${l.period === data.current ? 'is-now' : ''} ${
                    l.type !== 'lesson' ? 'is-muted' : ''
                  }`}
                  key={l.period}
                >
                  <span className="tt-time">
                    <span className="tt-time__num">{l.period}.</span>
                    {l.start && <span className="tt-time__clock">{l.start}</span>}
                  </span>
                  <div className="row__main">
                    <div className="row__title">
                      {l.type === 'break' ? 'Mittagspause' : l.subject ?? '–'}
                    </div>
                    {l.type === 'lesson' && (l.room || l.teacher) && (
                      <div className="row__meta">
                        {[l.room, l.teacher].filter(Boolean).join(' · ')}
                        {l.note ? ` · ${l.note}` : ''}
                      </div>
                    )}
                  </div>
                  {l.period === data.current && <span className="cd is-soon">jetzt</span>}
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* Ganze Woche */}
        <article className="card bento__wide">
          <div className="card__head">
            <h3 className="card__title">Woche</h3>
            <div className="seg" role="group" aria-label="Woche wählen">
              {(['A', 'B'] as const).map((w) => (
                <button
                  key={w}
                  className={w === week ? 'is-active' : ''}
                  onClick={() => setShown(w)}
                  aria-pressed={w === week}
                >
                  {w}-Woche
                </button>
              ))}
            </div>
          </div>
          <div className="tt-scroll">
            <table className="tt">
              <thead>
                <tr>
                  <th scope="col" className="tt__corner">Std.</th>
                  {data.days.map((d) => (
                    <th scope="col" key={d} className={d === data.day ? 'is-today' : ''}>
                      {d.slice(0, 2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p}>
                    <th scope="row" className="tt__period">
                      <span className="tt-time__num">{p}</span>
                      {data.times[String(p)] && (
                        <span className="tt-time__clock">{data.times[String(p)][0]}</span>
                      )}
                    </th>
                    {data.days.map((d) => {
                      const c = grid[String(p)]?.[d]
                      const isNow = d === data.day && p === data.current && week === data.week
                      if (!c) return <td key={d} className="tt__free">–</td>
                      if (c.type === 'break')
                        return <td key={d} className="tt__break">Pause</td>
                      return (
                        <td key={d} className={`tt__lesson ${isNow ? 'is-now' : ''}`}>
                          <span className="tt__subject">{c.subject}</span>
                          {c.room && <span className="tt__room">{c.room}</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </PageSection>
  )
}
