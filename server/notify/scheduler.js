// ===========================================================================
// Kleiner Zeitplaner für die Push-Nachrichten – bewusst ohne Zusatzpaket.
// ---------------------------------------------------------------------------
// Ein Ticker alle 30 s prüft, welche Jobs fällig sind. Das reicht völlig: die
// feinste Auflösung hier ist eine Minute.
//
// Zwei Eigenheiten, die Ärger vermeiden:
//   1. Zeiten werden IMMER in Europe/Berlin gerechnet, egal in welcher Zone
//      der Container läuft (Docker-Images sind meist UTC). Sonst käme das
//      "7-Uhr-Briefing" im Sommer um 9.
//   2. Der letzte Lauf wird auf Platte gemerkt. Startet der Container um 7:01
//      neu, kommt das Briefing nicht ein zweites Mal.
// ===========================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data')
const FILE = path.join(DATA_DIR, 'notify-state.json')
const TZ = 'Europe/Berlin'

const TICK_MS = 30 * 1000

// Ortszeit in Berlin, unabhängig von der Zeitzone des Containers.
export function berlinNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date)

  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: days[get('weekday')] ?? 0,
    // Tagesschlüssel, um "heute schon gelaufen?" zu beantworten.
    date: `${get('year')}-${get('month')}-${get('day')}`
  }
}

// Zustand (letzte Läufe) -------------------------------------------------------
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

function saveState(state) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2))
  } catch (err) {
    console.error('notify state error:', err.message)
  }
}

let state = loadState()

export function getState() {
  return state
}

export function patchState(patch) {
  state = { ...state, ...patch }
  saveState(state)
}

// Job-Registry -----------------------------------------------------------------
const jobs = []

// Täglich zu einer festen Uhrzeit. days: Wochentage (0 = So), Standard Mo–Fr.
//
// grace: Wie lange nach der Uhrzeit darf noch nachgeholt werden? Startet der
// Container um 7:10 neu, soll das 6:45-Briefing noch kommen – um 14 Uhr aber
// nicht mehr. Ein Morgen-Briefing am Nachmittag ist schlimmer als keins: man
// liest es als aktuellen Stand.
export function daily({ name, at, days = [1, 2, 3, 4, 5], grace = 120, run }) {
  const [hour, minute] = at.split(':').map(Number)
  jobs.push({ name, type: 'daily', hour, minute, days, grace, run })
}

// Alle N Minuten, optional nur innerhalb eines Zeitfensters (Berliner Zeit).
export function every({ name, minutes, from, to, days = [1, 2, 3, 4, 5], run }) {
  jobs.push({ name, type: 'interval', minutes, from, to, days, run })
}

function inWindow(now, from, to) {
  if (!from || !to) return true
  const mins = now.hour * 60 + now.minute
  const [fh, fm] = from.split(':').map(Number)
  const [th, tm] = to.split(':').map(Number)
  return mins >= fh * 60 + fm && mins <= th * 60 + tm
}

async function runJob(job, key) {
  try {
    await job.run()
    patchState({ [job.name]: key })
  } catch (err) {
    // Fehlgeschlagene Jobs NICHT als gelaufen markieren – beim nächsten Tick
    // (bzw. am nächsten Tag) wird es erneut versucht.
    console.error(`notify job "${job.name}" fehlgeschlagen:`, err.message)
  }
}

function tick() {
  const now = berlinNow()

  for (const job of jobs) {
    if (!job.days.includes(now.weekday)) continue

    if (job.type === 'daily') {
      const key = `${now.date} ${String(job.hour).padStart(2, '0')}:${String(job.minute).padStart(2, '0')}`
      if (state[job.name] === key) continue

      const delay = now.hour * 60 + now.minute - (job.hour * 60 + job.minute)
      if (delay < 0) continue // noch nicht so weit

      if (delay <= job.grace) {
        runJob(job, key)
      } else {
        // Zu spät zum Nachholen: als erledigt abhaken, damit es nicht später
        // am Tag doch noch losgeht, und einmal vermerken.
        patchState({ [job.name]: key })
        console.log(`notify job "${job.name}" übersprungen (${delay} min zu spät).`)
      }
    } else {
      if (!inWindow(now, job.from, job.to)) continue
      const last = Number(state[job.name]) || 0
      if (Date.now() - last >= job.minutes * 60 * 1000) runJob(job, Date.now())
    }
  }
}

let timer = null

export function startScheduler() {
  if (timer || jobs.length === 0) return
  timer = setInterval(tick, TICK_MS)
  // Nicht den Prozess am Leben halten, falls der Server sonst beenden würde.
  timer.unref?.()
  console.log(`Benachrichtigungen aktiv: ${jobs.map((j) => j.name).join(', ')}`)
}

export function listJobs() {
  return jobs.map((j) => ({
    name: j.name,
    type: j.type,
    at: j.type === 'daily' ? `${String(j.hour).padStart(2, '0')}:${String(j.minute).padStart(2, '0')}` : null,
    minutes: j.minutes ?? null,
    window: j.from ? `${j.from}–${j.to}` : null,
    lastRun: state[j.name] ?? null
  }))
}
