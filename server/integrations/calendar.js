// iCloud-Kalender via CalDAV (read-only). Liest die nächsten 14 Tage, löst
// wiederkehrende Termine (RRULE) auf die nächste Fälligkeit auf und priorisiert:
// Schule → wiederkehrend → einmalig, dann nach Dringlichkeit (siehe
// calendar-priority.js).
import { config, isConfigured } from '../config.js'
import { isSchoolEvent, classify, byPriorityThenUrgency } from '../calendar-priority.js'

const TTL = 10 * 60 * 1000
const WINDOW_DAYS = 14
let cache = null

export async function fetchCalendarEvents() {
  if (!isConfigured.calendar) return { configured: false, events: [] }
  if (cache && Date.now() - cache.ts < TTL) return cache.value

  try {
    const { createDAVClient } = await import('tsdav')
    const ical = (await import('node-ical')).default

    const client = await createDAVClient({
      serverUrl: 'https://caldav.icloud.com',
      credentials: { username: config.calendar.username, password: config.calendar.password },
      authMethod: 'Basic',
      defaultAccountType: 'caldav'
    })

    let calendars = await client.fetchCalendars()
    if (config.calendar.calendarName) {
      const wanted = config.calendar.calendarName.toLowerCase()
      calendars = calendars.filter((c) => (c.displayName || '').toLowerCase().includes(wanted))
    }

    const now = new Date()
    const end = new Date(now.getTime() + WINDOW_DAYS * 86_400_000)
    const raw = []

    for (const cal of calendars) {
      let objects = []
      try {
        objects = await client.fetchCalendarObjects({
          calendar: cal,
          timeRange: { start: now.toISOString(), end: end.toISOString() }
        })
      } catch {
        continue
      }

      for (const obj of objects) {
        if (!obj.data) continue
        const parsed = ical.parseICS(obj.data)
        for (const k in parsed) {
          const e = parsed[k]
          if (e.type !== 'VEVENT' || !e.start) continue

          const base = {
            id: e.uid || k,
            title: e.summary || '(ohne Titel)',
            location: e.location || '',
            allDay: e.datetype === 'date'
          }

          if (e.rrule) {
            // Wiederkehrend: nächste Fälligkeit im Fenster bestimmen.
            let occurrences = []
            try {
              occurrences = e.rrule.between(now, end, true)
            } catch {
              occurrences = []
            }
            const exdates = e.exdate
              ? Object.values(e.exdate).map((d) => new Date(d).getTime())
              : []
            const next = occurrences
              .map((d) => new Date(d))
              .filter((d) => d >= now && !exdates.includes(d.getTime()))
              .sort((a, b) => a - b)[0]
            if (!next) continue
            const durationMs = e.end ? new Date(e.end) - new Date(e.start) : 0
            raw.push({
              ...base,
              start: next.toISOString(),
              end: durationMs ? new Date(next.getTime() + durationMs).toISOString() : null,
              recurring: true
            })
          } else {
            const s = new Date(e.start)
            if (s < now || s > end) continue
            raw.push({
              ...base,
              start: s.toISOString(),
              end: e.end ? new Date(e.end).toISOString() : null,
              recurring: false
            })
          }
        }
      }
    }

    // Duplikate (gleiche uid + Startzeit) entfernen.
    const seen = new Set()
    const events = []
    for (const ev of raw) {
      const key = `${ev.id}:${ev.start}`
      if (seen.has(key)) continue
      seen.add(key)
      const school = isSchoolEvent(ev.title, ev.location)
      const { priority, priorityLabel } = classify({ school, recurring: ev.recurring })
      events.push({ ...ev, school, priority, priorityLabel })
    }

    events.sort(byPriorityThenUrgency)

    const value = { configured: true, events: events.slice(0, 20) }
    cache = { value, ts: Date.now() }
    return value
  } catch (err) {
    return { configured: true, error: err.message, events: [] }
  }
}
