import PageSection from '../components/PageSection.tsx'
import NotConnected from '../components/NotConnected.tsx'
import { CalendarIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'
import type { CalendarEvent } from '../types.ts'

interface CalendarResponse {
  configured: boolean
  events: CalendarEvent[]
  error?: string
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000
  )
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Morgen'
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
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
  else {
    // Nach Tag gruppieren.
    const groups = new Map<string, CalendarEvent[]>()
    for (const ev of data.events) {
      const key = dayLabel(ev.start)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(ev)
    }
    body = (
      <div className="card">
        {[...groups.entries()].map(([day, events]) => (
          <div key={day} className="daygroup">
            <div className="daygroup__label">{day}</div>
            <ul className="list">
              {events.map((ev) => (
                <li className="row" key={ev.id}>
                  <span className="row__time data">
                    {ev.allDay
                      ? 'ganztägig'
                      : new Date(ev.start).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                  </span>
                  <span className="row__main">
                    <span className="row__title">{ev.title}</span>
                    {ev.location && <span className="muted"> · {ev.location}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  return (
    <PageSection title="Kalender" icon={CalendarIcon} note="iCloud · nächste 14 Tage">
      {body}
    </PageSection>
  )
}
