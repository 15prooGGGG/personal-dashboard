import PageSection from '../components/PageSection.tsx'
import NotConnected from '../components/NotConnected.tsx'
import { CalendarIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'
import { countdownLabel, daysUntil } from '../lib/time.ts'
import type { CalendarEvent } from '../types.ts'

interface CalendarResponse {
  configured: boolean
  events: CalendarEvent[]
  error?: string
}

function whenLabel(ev: CalendarEvent): string {
  const d = new Date(ev.start)
  const day = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
  if (ev.allDay) return `${day} · ganztägig`
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

export default function CalendarSection() {
  const { data, loading, error } = useApi<CalendarResponse>('/api/calendar', 10 * 60 * 1000)

  let body
  if (loading) body = <div className="state">Lädt …</div>
  else if (error) body = <div className="state">{error}</div>
  else if (!data?.configured || data.error)
    body = (
      <NotConnected
        name="iCloud-Kalender"
        errorDetail={data?.error}
        steps={[
          'appleid.apple.com öffnen → Anmeldung & Sicherheit → App-spezifische Passwörter.',
          'Neues Passwort z. B. "Dashboard" erzeugen.',
          'Apple-ID (E-Mail) und das erzeugte Passwort unten eintragen.'
        ]}
        envVars={['ICLOUD_CALDAV_USERNAME', 'ICLOUD_CALDAV_APP_PASSWORD']}
      />
    )
  else if (data.events.length === 0)
    body = <div className="state">Keine Termine in den nächsten 14 Tagen.</div>
  else
    body = (
      <div className="card">
        <ul className="list">
          {data.events.map((ev) => (
            <li className="calrow" key={`${ev.id}-${ev.start}`}>
              <span className={`caltag caltag--p${ev.priority ?? 3}`}>{ev.priorityLabel}</span>
              <div className="calrow__main">
                <div className="row__title">{ev.title}</div>
                <div className="muted calrow__meta">
                  {whenLabel(ev)}
                  {ev.location ? ` · ${ev.location}` : ''}
                </div>
              </div>
              <span className={`calrow__cd data ${daysUntil(ev.start) <= 1 ? 'is-urgent' : ''}`}>
                {countdownLabel(ev.start)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <PageSection title="Kalender" icon={CalendarIcon} note="nach Priorität · nächste 14 Tage">
      {body}
    </PageSection>
  )
}
