// iCloud-Kalender via CalDAV (read-only). Liest die nächsten 14 Tage, löst
// wiederkehrende Termine (RRULE) in einzelne Termine auf und priorisiert:
// Schule → wiederkehrend → einmalig, dann nach Dringlichkeit (siehe
// calendar-priority.js). Jeder Termin trägt den Namen seines Kalenders –
// der Tagesplan braucht ihn, um Familientermine anderer auszublenden.
import { config, isConfigured } from '../config.js'
import { isSchoolEvent, classify, byPriorityThenUrgency } from '../calendar-priority.js'

const TTL = 10 * 60 * 1000
const WINDOW_DAYS = 14
let cache = null

// Alle Termine im Fenster, Wiederholungen einzeln aufgelöst (für den Tagesplan).
export async function fetchCalendarOccurrences() {
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
            allDay: e.datetype === 'date',
            calendar: cal.displayName || ''
          }

          if (e.rrule) {
            // Wiederkehrend: alle Fälligkeiten im Fenster. Einzeln verschobene
            // Termine (RECURRENCE-ID) ersetzen die reguläre Fälligkeit.
            let occurrences = []
            try {
              occurrences = e.rrule.between(new Date(now.getTime() - 86_400_000), end, true)
            } catch {
              occurrences = []
            }
            const exdates = e.exdate
              ? Object.values(e.exdate).map((d) => new Date(d).getTime())
              : []
            const durationMs = e.end ? new Date(e.end) - new Date(e.start) : 0
            for (const occ of occurrences) {
              const d = new Date(occ)
              if (exdates.includes(d.getTime())) continue
              const override = e.recurrences?.[d.toISOString().slice(0, 10)]
              const s0 = override?.start ? new Date(override.start) : d
              const e0 = override?.end
                ? new Date(override.end)
                : durationMs
                  ? new Date(s0.getTime() + durationMs)
                  : null
              if ((e0 ?? s0) < now) continue
              raw.push({
                ...base,
                title: override?.summary || base.title,
                start: s0.toISOString(),
                end: e0 ? e0.toISOString() : null,
                recurring: true
              })
            }
          } else {
            const s = new Date(e.start)
            const e0 = e.end ? new Date(e.end) : s
            // Laufende Termine (z. B. ganztägig heute) zählen mit.
            if (e0 < now || s > end) continue
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

    events.sort((a, b) => new Date(a.start) - new Date(b.start))

    const value = { configured: true, events }
    cache = { value, ts: Date.now() }
    return value
  } catch (err) {
    return { configured: true, error: err.message, events: [] }
  }
}

// Kalender-Bereich und Startseite: je Serie nur die nächste Fälligkeit,
// priorisiert, höchstens 20.
export async function fetchCalendarEvents() {
  const all = await fetchCalendarOccurrences()
  if (!all.events.length) return all
  const seen = new Set()
  const events = []
  for (const ev of all.events) {
    if (ev.recurring) {
      if (seen.has(ev.id)) continue
      seen.add(ev.id)
    }
    events.push(ev)
  }
  events.sort(byPriorityThenUrgency)
  return { ...all, events: events.slice(0, 20) }
}
