// ===========================================================================
// Stundenplan: liest die per scripts/build-stundenplan.js aus den Vault-PDFs
// erzeugte JSON und reichert sie um Uhrzeiten, A/B-Woche und "läuft gerade"
// an. Reines Nachschlagen – kein PDF-Parsing zur Laufzeit.
// ===========================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PERIOD_TIMES, WEEK_REFERENCE } from './stundenplan-config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data')
const FILE = path.join(DATA_DIR, 'stundenplan.json')

let cache = null

function load() {
  if (cache) return cache
  if (!fs.existsSync(FILE)) return null
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    return cache
  } catch {
    return null
  }
}

// ISO-Kalenderwoche (Montag als Wochenstart).
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

// A oder B für ein Datum – abgeleitet aus der Referenzwoche in der Konfig.
export function weekFor(date) {
  if (!WEEK_REFERENCE?.date) return null
  const ref = new Date(WEEK_REFERENCE.date + 'T12:00:00')
  const samePartity = (isoWeek(date) - isoWeek(ref)) % 2 === 0
  const other = WEEK_REFERENCE.week === 'A' ? 'B' : 'A'
  return samePartity ? WEEK_REFERENCE.week : other
}

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

function minutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Stunden eines Tages mit Uhrzeiten, leere Randstunden abgeschnitten.
function lessonsFor(plan, week, dayName) {
  const grid = plan.weeks?.[week]
  if (!grid) return []
  const periods = Object.keys(grid)
    .filter((k) => k !== '__footer')
    .map(Number)
    .sort((a, b) => a - b)

  const rows = periods.map((p) => {
    const cell = grid[String(p)]?.[dayName] ?? null
    const [start, end] = PERIOD_TIMES[p] || []
    return { period: p, start: start ?? null, end: end ?? null, ...(cell || { type: 'free' }) }
  })

  // Vor der ersten und nach der letzten Stunde nichts anzeigen.
  const first = rows.findIndex((r) => r.type === 'lesson')
  const last = rows.map((r) => r.type === 'lesson').lastIndexOf(true)
  return first === -1 ? [] : rows.slice(first, last + 1)
}

export function getStundenplan(now = new Date()) {
  const plan = load()
  if (!plan) return { configured: false, reason: 'missing' }

  const week = weekFor(now)
  const dayName = DAY_NAMES[now.getDay()]
  const isSchoolDay = plan.days.includes(dayName)
  const today = week && isSchoolDay ? lessonsFor(plan, week, dayName) : []

  // Welche Stunde läuft gerade / kommt als Nächstes?
  const nowMin = now.getHours() * 60 + now.getMinutes()
  let current = null
  let next = null
  for (const l of today) {
    if (l.start && l.end && nowMin >= minutes(l.start) && nowMin < minutes(l.end)) current = l.period
    if (!next && l.start && minutes(l.start) > nowMin && l.type === 'lesson') next = l.period
  }

  return {
    configured: true,
    meta: plan.meta,
    days: plan.days,
    weeks: plan.weeks,
    times: PERIOD_TIMES,
    week,
    weekKnown: Boolean(week),
    day: isSchoolDay ? dayName : null,
    today,
    current,
    next,
    generatedAt: plan.generatedAt
  }
}
