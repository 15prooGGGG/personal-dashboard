// ===========================================================================
// Klausur-Lernplan: Themen je Klausur + automatisch verteilte Lernblöcke.
// ---------------------------------------------------------------------------
// Themen: Je Klausur legt das Dashboard im Vault eine Notiz
//   „03 Bereiche/Schule & Abitur/Lernpläne/Lernplan <Fach> <TT.MM.JJJJ>.md“
// an. Lauri trägt die Themen dort als Checkliste ein („- [ ] Integral“);
// abgehakte Punkte zählen als Fortschritt. Abhaken geht auch im Dashboard –
// dann schreibt der Server die Notiz zurück (nur dieser Ordner ist im
// Container beschreibbar, siehe docker-compose.yml).
//
// Blöcke: Rückwärts von der Klausur – LK ≈ 8 h in den 10 Tagen davor, GK ≈ 4 h
// in 7 Tagen. Verteilt wird gleichmäßig auf die verbleibenden Tage, nur in
// freie Lücken des Tagesplans (Freistunden zählen), höchstens 2 Blöcke und
// 3 h pro Tag, am Vorabend nur eine kurze Wiederholung. Gestrichene Blöcke
// gelten als belegt, die Zeit rutscht in die nächste freie Lücke.
// Vergangene Blöcke werden in data/study-plan.json gemerkt und zählen als
// gelernt – so bleibt das Budget über die Tage stimmig.
// ===========================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VAULT_DIR = process.env.VAULT_DIR || path.resolve(__dirname, '../vault')
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data')
const STATE_FILE = path.join(DATA_DIR, 'study-plan.json')
export const NOTE_DIR = path.join('03 Bereiche', 'Schule & Abitur', 'Lernpläne')

const H = 60
export const RULES = {
  LK: { budgetMin: 8 * H, windowDays: 10, topicsDays: 14 },
  GK: { budgetMin: 4 * H, windowDays: 7, topicsDays: 10 }
}
const MAX_PER_DAY = 2
const MAX_MIN_PER_DAY = 3 * H
const BLOCK_MAX = 2 * H
const BLOCK_MIN = 45
const EVE_MIN = 45 // Vorabend: nur kurz wiederholen
const BUFFER = 10 // Luft zu Schule, Gym, Terminen
const WIND_DOWN = 30 // vor der Schlafenszeit nicht mehr lernen
const AFTER_WAKE = H // an freien Tagen erst nach dem Wachwerden
const NOTE_AHEAD_DAYS = 28 // so früh wird die Themen-Notiz angelegt

const SHORT = { Mathematik: 'Mathe', Politikwissenschaft: 'Powi', Religionslehre: 'Reli' }
export const shortName = (s) => SHORT[s] ?? s
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const examId = (e) => `${e.date}-${slug(e.subject)}`
export const levelOf = (e) => (/LK/i.test(e.kind) ? 'LK' : 'GK')
const ddmm = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`
const addDays = (d, n) => {
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10)
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const clock = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}
const ceil5 = (m) => Math.ceil(m / 5) * 5
const floor5 = (m) => Math.floor(m / 5) * 5
const floor15 = (m) => Math.floor(m / 15) * 15

// ---- Themen-Notizen ----------------------------------------------------------
export const notePath = (e) => path.join(NOTE_DIR, `Lernplan ${e.subject} ${ddmm(e.date)}${e.date.slice(0, 4)}.md`)

const TASK = /^(\s*[-*]\s+\[)( |x|X)(\]\s+)(.*\S)\s*$/
const HEADING = /^#{2,6}\s+(.+?)\s*$/
// Überschriften unter „## Themen“ gliedern die Liste in Abschnitte – die
// landen als Lernblock-Thema im Plan (statt einzelner Spiegelstriche).
export function parseTopics(md) {
  let section = null
  const out = []
  for (const line of md.split('\n')) {
    const h = line.match(HEADING)
    if (h) {
      section = /^themen$/i.test(h[1]) ? null : h[1]
      continue
    }
    const m = line.match(TASK)
    if (m) out.push({ text: m[4].trim(), done: m[2] !== ' ', section })
  }
  return out
}

/** Setzt das n-te Thema (Zählung wie parseTopics) auf erledigt/offen. */
export function setTopic(md, index, done) {
  let n = -1
  return md
    .split('\n')
    .map((l) => {
      const m = l.match(TASK)
      if (!m || ++n !== index) return l
      return `${m[1]}${done ? 'x' : ' '}${m[3]}${m[4]}`
    })
    .join('\n')
}

function noteTemplate(e) {
  const r = RULES[levelOf(e)]
  return `---
tags: [schule, lernplan]
klausur: ${e.date}
fach: ${e.subject}
kurs: ${e.kind}
---

# Lernplan ${e.subject} ${ddmm(e.date)}

Klausur am ${ddmm(e.date)}${e.date.slice(0, 4)} (${e.kind}). Themen als Checkliste eintragen, eine Zeile pro Thema.
Das Dashboard zählt abgehakte Punkte als Fortschritt und schreibt sie in die Lernblöcke.
Themen bis ${ddmm(addDays(e.date, -r.topicsDays))} eintragen.

## Themen
- [ ]
`
}

/** Notiz anlegen, Datei-Besitzer wie der Ordner (Syncthing läuft als Nutzer). */
function writeNote(abs, text) {
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, text)
  try {
    const st = fs.statSync(path.dirname(abs))
    fs.chownSync(abs, st.uid, st.gid)
  } catch {
    // ohne Root-Rechte (lokal) egal
  }
}

function readNote(e, today, create) {
  const rel = notePath(e)
  const abs = path.join(VAULT_DIR, rel)
  if (!fs.existsSync(abs) && create && daysBetween(today, e.date) <= NOTE_AHEAD_DAYS) {
    try {
      writeNote(abs, noteTemplate(e))
    } catch (err) {
      console.error('study note create:', err.message)
    }
  }
  if (!fs.existsSync(abs)) return { rel, exists: false, topics: [] }
  return { rel, exists: true, topics: parseTopics(fs.readFileSync(abs, 'utf8')) }
}

export function toggleTopic(exam, index, done) {
  const abs = path.join(VAULT_DIR, notePath(exam))
  const md = fs.readFileSync(abs, 'utf8')
  const next = setTopic(md, index, done)
  if (next !== md) writeNote(abs, next)
  return parseTopics(next)
}

// ---- Zustand (vergangene + gestrichene Blöcke) --------------------------------
export function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    return { blocks: s.blocks ?? [], skipped: s.skipped ?? [] }
  } catch {
    return { blocks: [], skipped: [] }
  }
}
function saveState(state) {
  const text = JSON.stringify(state, null, 2)
  try {
    if (fs.existsSync(STATE_FILE) && fs.readFileSync(STATE_FILE, 'utf8') === text) return
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(STATE_FILE, text)
  } catch (err) {
    console.error('study state save:', err.message)
  }
}

export function setSkipped({ date, start, end, skip }) {
  const state = loadState()
  const same = (s) => s.date === date && s.start === start
  state.skipped = state.skipped.filter((s) => !same(s))
  if (skip) state.skipped.push({ date, start, end })
  saveState(state)
}

// ---- Verteilung ------------------------------------------------------------------
/** Freie Lücken eines Tages (Minuten), ohne Puffer, Gestrichenes und Vergangenes. */
function freeSlots(day, { nowMin, isToday, skipped }) {
  const bed = day.bedtime.min
  const busy = skipped.map((s) => ({ start: toMin(s.start), end: toMin(s.end) }))
  const out = []
  for (const b of day.blocks) {
    if (b.kind !== 'free') continue
    let start = b.start + BUFFER
    let end = Math.min(b.end - BUFFER, bed - WIND_DOWN)
    // Freier Tag: erste Lücke beginnt beim Aufwachen – erst mal ankommen.
    if (b.start <= day.wake.min) start = Math.max(start, day.wake.min + AFTER_WAKE)
    if (isToday) start = Math.max(start, nowMin + 15)
    // Gestrichene Zeiten herausschneiden
    let parts = [{ start, end }]
    for (const x of busy) {
      parts = parts.flatMap((p) =>
        x.end <= p.start || x.start >= p.end ? [p] : [{ start: p.start, end: x.start - BUFFER }, { start: x.end + BUFFER, end: p.end }]
      )
    }
    for (const p of parts) {
      const s = ceil5(p.start)
      const e = floor5(p.end)
      if (e - s >= 30) out.push({ start: s, end: e })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/**
 * @param {object} input
 * @param {object} input.plan    buildDayPlan() OHNE geplante Lernblöcke
 * @param {Array}  input.exams   getExams().exams
 * @param {object} [input.state] loadState()
 * @param {Function} [input.topicsOf] (exam) → [{ text, done }]
 */
export function scheduleStudy({ plan, exams, state = { blocks: [], skipped: [] }, topicsOf = () => [] }) {
  const today = plan.today
  const nowMin = plan.nowMin
  const isPast = (b) => b.date < today || (b.date === today && toMin(b.start) <= nowMin)
  // Was schon begonnen hat, bleibt stehen und zählt.
  const past = state.blocks.filter(isPast)
  const skipped = state.skipped.filter((s) => s.date >= today)

  const upcoming = exams.filter((e) => e.date > today).map((e) => ({ ...e, id: examId(e), level: levelOf(e) }))
  const slotsByDate = new Map()
  const usedByDate = new Map() // date → { n, min }
  for (const b of past.filter((b) => b.date === today)) {
    const u = usedByDate.get(today) ?? { n: 0, min: 0 }
    usedByDate.set(today, { n: u.n + 1, min: u.min + toMin(b.end) - toMin(b.start) })
  }
  for (const [i, day] of plan.days.entries()) {
    slotsByDate.set(day.date, freeSlots(day, { nowMin, isToday: i === 0, skipped: skipped.filter((s) => s.date === day.date) }))
  }

  const planned = []
  const summary = []
  for (const e of upcoming) {
    const r = RULES[e.level]
    const first = addDays(e.date, -r.windowDays)
    const doneMin = past.filter((b) => b.examId === e.id).reduce((a, b) => a + toMin(b.end) - toMin(b.start), 0)
    let remaining = Math.max(0, r.budgetMin - doneMin)
    const mine = []
    const open = topicsOf(e).filter((t) => !t.done)

    for (const day of plan.days) {
      const d = day.date
      if (d < first || d >= e.date || remaining <= 0) continue
      const daysLeft = daysBetween(d, e.date) // Tage bis zur Klausur inkl. heute
      const eve = daysLeft === 1
      let want = eve ? Math.min(remaining, EVE_MIN) : floor15(Math.max(BLOCK_MIN, remaining / daysLeft + 14))
      want = Math.min(want, remaining)
      const slots = slotsByDate.get(d) ?? []
      const used = usedByDate.get(d) ?? { n: 0, min: 0 }
      while (want >= 30 && used.n < MAX_PER_DAY && used.min < MAX_MIN_PER_DAY) {
        const room = Math.min(want, BLOCK_MAX, MAX_MIN_PER_DAY - used.min)
        const need = Math.min(room, eve ? 30 : BLOCK_MIN)
        const slot = slots.find((s) => s.end - s.start >= need)
        if (!slot) break
        const len = floor15(Math.min(room, slot.end - slot.start)) || slot.end - slot.start
        const block = { examId: e.id, date: d, start: clock(slot.start), end: clock(slot.start + len), eve }
        mine.push(block)
        slot.start += len + 15
        if (slot.end - slot.start < 30) slots.splice(slots.indexOf(slot), 1)
        used.n++
        used.min += len
        want -= len
        remaining -= len
      }
      usedByDate.set(d, used)
    }

    // Offene Abschnitte (ohne Abschnitte: einzelne Themen) der Reihe nach auf
    // die Blöcke aufteilen, Vorabend = Wiederholung.
    const study = mine.filter((b) => !b.eve)
    const units = open.some((t) => t.section) ? [...new Set(open.map((t) => t.section ?? 'Sonstiges'))] : open.map((t) => t.text)
    study.forEach((b, i) => {
      if (!units.length) return
      const from = Math.floor((i * units.length) / study.length)
      const to = Math.max(from + 1, Math.floor(((i + 1) * units.length) / study.length))
      b.topic = units.slice(from, to).join(' · ')
    })
    for (const b of mine) {
      if (b.eve) b.topic = 'kurz wiederholen'
      b.title = `${shortName(e.subject)}${b.topic ? `: ${b.topic}` : ''}`
    }
    planned.push(...mine)

    const horizonEnd = plan.days[plan.days.length - 1]?.date ?? today
    const plannedMin = mine.reduce((a, b) => a + toMin(b.end) - toMin(b.start), 0)
    summary.push({
      id: e.id,
      budgetMin: r.budgetMin,
      doneMin,
      plannedMin,
      // Fehlt nur, wenn die Klausur im sichtbaren Zeitraum liegt und es nicht reicht.
      missingMin: e.date <= addDays(horizonEnd, 1) ? Math.max(0, r.budgetMin - doneMin - plannedMin) : 0,
      windowStart: first
    })
  }

  const blocks = [...past.map((b) => ({ ...b, past: true })), ...planned].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  return { blocks, skipped, summary }
}

/** Alles für /api/studyplan und den Tagesplan. Legt fehlende Notizen an. */
export function buildStudyPlan({ plan, exams, create = true }) {
  const today = plan.today
  const notes = new Map()
  const noteOf = (e) => {
    const id = examId(e)
    if (!notes.has(id)) notes.set(id, readNote(e, today, create))
    return notes.get(id)
  }
  const state = loadState()
  const result = scheduleStudy({ plan, exams, state, topicsOf: (e) => noteOf(e).topics })
  // Gemerkt wird alles, was bis heute geplant war – morgen ist es Vergangenheit.
  saveState({
    blocks: result.blocks.filter((b) => b.date >= addDays(today, -60)).map(({ past, eve, ...b }) => b),
    skipped: result.skipped
  })

  const sum = new Map(result.summary.map((s) => [s.id, s]))
  const list = exams
    .filter((e) => e.date > today)
    .map((e) => {
      const id = examId(e)
      const level = levelOf(e)
      const note = noteOf(e)
      const topicsDue = addDays(e.date, -RULES[level].topicsDays)
      return {
        id,
        subject: e.subject,
        short: shortName(e.subject),
        kind: e.kind,
        level,
        date: e.date,
        inDays: daysBetween(today, e.date),
        note: note.rel,
        noteExists: note.exists,
        topics: note.topics,
        topicsDue,
        topicsLate: note.topics.length === 0 && today >= topicsDue,
        ...(sum.get(id) ?? { budgetMin: RULES[level].budgetMin, doneMin: 0, plannedMin: 0, missingMin: 0 })
      }
    })
  return {
    today,
    horizon: plan.days.map((d) => d.date),
    exams: list,
    blocks: result.blocks.map((b) => ({ ...b, id: `${b.date}T${b.start}`, past: !!b.past })),
    skipped: result.skipped
  }
}
