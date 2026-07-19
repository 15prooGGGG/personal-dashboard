// iCloud-Kalender via CalDAV (read-only). Zugangsdaten: Apple-ID + app-
// spezifisches Passwort (appleid.apple.com → Anmeldung & Sicherheit).
import { config, isConfigured } from '../config.js'

const TTL = 10 * 60 * 1000
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

    const start = new Date()
    const end = new Date(Date.now() + 14 * 86_400_000)
    const events = []

    for (const cal of calendars) {
      let objects = []
      try {
        objects = await client.fetchCalendarObjects({
          calendar: cal,
          timeRange: { start: start.toISOString(), end: end.toISOString() }
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
          const s = new Date(e.start)
          if (s < start || s > end) continue
          events.push({
            id: e.uid || k,
            title: e.summary || '(ohne Titel)',
            start: s.toISOString(),
            end: e.end ? new Date(e.end).toISOString() : null,
            location: e.location || '',
            allDay: e.datetype === 'date'
          })
        }
      }
    }

    events.sort((a, b) => new Date(a.start) - new Date(b.start))
    const value = { configured: true, events: events.slice(0, 15) }
    cache = { value, ts: Date.now() }
    return value
  } catch (err) {
    return { configured: true, error: err.message, events: [] }
  }
}
