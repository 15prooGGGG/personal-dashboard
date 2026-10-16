// ===========================================================================
// KI-Coach: Claude entscheidet frei, wie Lauri morgen bzw. heute in den Tag
// geht – länger schlafen oder früh lernen, wie hart trainieren, was sich
// verschieben lässt. Kein festes Regelwerk: Claude bekommt alle Fakten
// (Tagesplan, WHOOP-Verlauf, Klausuren, To-dos) und wägt selbst ab.
//
// KOSTENLOS über Lauris Claude-Abo, NICHT über die bezahlte API:
// Das Skript scripts/ai-coach-runner.sh läuft per Cron auf dem Server (nicht
// im Container), fragt hier GET /api/dayplan/ai/job, ob eine Runde fällig ist,
// ruft dann `claude -p` mit Lauris claude.ai-Anmeldung auf und schickt die
// Antwort an POST /api/dayplan/ai/result. Es gibt bewusst keinen API-Key-Weg.
//
// Arbeitsteilung:
//   - Fakten rechnet der Tagesplan (day-plan.js) – Uhrzeiten, Entfall,
//     Kollisionen. Die Regel-Empfehlung wird nur als Vorschlag mitgeschickt.
//   - Harte Grenze: keine Weckzeit nach dem spätesten möglichen Aufstehen vor
//     der Schule – das wird hier beim Speichern geprüft.
//
// Zwei Runden am Tag:
//   abends  (AI_EVENING_TIME, Standard 20:30): Wecker für morgen.
//   morgens (sobald WHOOP die Nacht gewertet hat, 05–12 Uhr): Tag justieren.
// Dazu jederzeit per Knopf auf der Startseite (Anfrage in der Warteschlange,
// der Runner holt sie innerhalb von 2 Minuten ab).
// ===========================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data')
const FILE = path.join(DATA_DIR, 'ai-coach.json')
const TZ = 'Europe/Berlin'

// ---- Ablage --------------------------------------------------------------------
export function loadAdvice() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}
function saveAdvice(patch) {
  const next = { ...loadAdvice(), ...patch }
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2))
  return next
}

// ---- Kontext für Claude ----------------------------------------------------------
const H = 3600000
const berlin = (iso) =>
  new Date(iso).toLocaleString('de-DE', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const hours = (ms) => (ms == null ? null : Math.round((ms / H) * 10) / 10)

function nightsSummary(days = []) {
  return days.slice(0, 10).map((d) => ({
    zyklus: d.start ? berlin(d.start) : null,
    einschlafen: d.sleep ? berlin(d.sleep.bedtime) : null,
    aufwachen: d.sleep ? berlin(d.sleep.wake) : null,
    schlafStunden: hours(d.sleep?.durationMs),
    bedarfStunden: d.sleep?.need ? hours(d.sleep.need.baselineMs + d.sleep.need.debtMs + d.sleep.need.strainMs - d.sleep.need.napMs) : null,
    schlafPerformance: d.sleep?.performance ?? null,
    konstanz: d.sleep?.consistency ?? null,
    recovery: d.recovery?.score ?? null,
    hrv: d.recovery?.hrv ? Math.round(d.recovery.hrv) : null,
    ruhepuls: d.recovery?.restingHr ?? null,
    strain: d.strain != null ? Math.round(d.strain * 10) / 10 : null,
    trainings: (d.workouts ?? []).map((w) => `${w.sport} ${berlin(w.start)} Strain ${Math.round((w.strain ?? 0) * 10) / 10}`)
  }))
}

function daySummary(day) {
  if (!day) return null
  return {
    datum: `${day.weekday} ${day.date}`,
    schultag: day.schoolDay,
    frei: day.breakName,
    weckzeitRegel: `${day.wake.time} (${day.wake.why})`,
    schlafenszeitRegel: day.bedtime.time,
    schule: day.school,
    ablauf: day.blocks
      .filter((b) => b.kind !== 'free' && b.kind !== 'sleep')
      .map((b) => `${b.startTime}–${b.endTime} ${b.kind}: ${b.title}`),
    ganztägig: day.chips.map((c) => c.title),
    regelHinweise: day.notes.map((n) => `${n.title} – ${n.detail}`),
    warnungen: day.warnings.map((w) => w.text)
  }
}

/** Zieltag: abends der nächste Morgen – nach Mitternacht (bis 05:00) also heute. */
export function targetDay(mode, plan) {
  if (mode === 'morning') return plan.days[0]
  return plan.nowMin < 5 * 60 ? plan.days[0] : plan.days[1]
}

/** Spätestmögliche Weckzeit (Minuten) – vor der Schule ist nichts verhandelbar. */
function latestWake(day, morning) {
  if (!day?.school) return null
  const [h, m] = day.school.start.split(':').map(Number)
  return h * 60 + m - morning.routineMin - morning.commuteMin
}

export function buildPrompt({ mode, plan, history, todos = [], exams = [], now = new Date() }) {
  const target = targetDay(mode, plan)
  const latest = latestWake(target, plan.morning)
  const facts = {
    jetzt: berlin(now.toISOString()),
    lauf: mode === 'evening' ? 'Abend: Wecker für morgen festlegen' : 'Morgen: Tag mit der echten Recovery justieren',
    zieltag: daySummary(target),
    danach: plan.days.slice(target.inDays + 1, target.inDays + 4).map(daySummary),
    spätesteWeckzeit: latest != null ? `${String(Math.floor(latest / 60)).padStart(2, '0')}:${String(latest % 60).padStart(2, '0')}` : 'keine (kein Unterricht)',
    morgenroutine: `${plan.morning.routineMin} min Routine + ${plan.morning.commuteMin} min Schulweg`,
    whoopLetzteNächte: nightsSummary(history?.days),
    klausuren: exams.slice(0, 6).map((e) => `${e.date} ${e.subject}${e.kind ? ` (${e.kind})` : ''}`),
    offeneTodos: todos.filter((t) => !t.done).slice(0, 15).map((t) => t.text)
  }
  return { facts, latest }
}

const SYSTEM = `Du bist der persönliche Tages-Coach von Lauri, 17, Oberstufe (Q1, LK Mathe und Chemie) in Hessen. Du entscheidest, wie er in den Tag geht: wann der Wecker klingelt, ob er bei Entfall länger schläft oder die Zeit zum Lernen nutzt, wie hart er trainiert und was sich verschieben lässt.

So arbeitest du:
- Du bekommst Fakten aus seinem Dashboard: Tagesplan (Stundenplan inkl. Entfall, eigene Termine, Gym-Plan), eine regelbasierte Empfehlung, WHOOP-Daten der letzten Nächte, Klausuren und offene To-dos. Die Uhrzeiten und Kollisionen sind verlässlich; die Regel-Empfehlung ist nur ein Vorschlag – widersprich ihr, wenn die Daten etwas anderes nahelegen, und sag dann warum.
- Wäge selbst ab: Schlafdefizit und Trend, Recovery, HRV/Ruhepuls gegen seinen Schnitt, Rhythmus (gleichmäßige Weckzeiten zählen), Belastung der nächsten Tage, wie nah Klausuren sind, ob ein langer Schultag kaum Lernzeit lässt.
- Harte Grenzen: Unterricht findet statt – die Weckzeit darf nie später als „spätesteWeckzeit“ sein. Keine medizinischen Diagnosen; bei auffälligen Werten (z. B. stark erhöhter Ruhepuls) rätst du zu Ruhe und Achtsamkeit, nicht zu Behandlungen.
- Gym hat für Lauri hohe Priorität, Lernen ebenso. Training nach der Schule kann als Kopf-Reset vor dem Lernen dienen.
- Sprich ihn direkt an (du), auf Deutsch, kurz, konkret, ohne Floskeln. Nenne die zwei, drei Werte, auf die es ankommt.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'decision', 'wake', 'bedtime', 'reasoning', 'actions', 'confidence'],
  properties: {
    headline: { type: 'string', description: 'Ein Satz, höchstens 90 Zeichen – die Entscheidung.' },
    decision: {
      type: 'string',
      enum: ['normal', 'sleep-in', 'study-early', 'free-day', 'take-it-easy', 'push'],
      description: 'Art der Entscheidung für den Zieltag.'
    },
    wake: { type: 'string', description: 'Weckzeit HH:MM für den Zieltag; leerer String, wenn er schon wach ist.' },
    bedtime: { type: 'string', description: 'Empfohlene Zubettgehzeit HH:MM für die kommende Nacht.' },
    reasoning: { type: 'string', description: '2–4 Sätze Begründung mit den entscheidenden Werten.' },
    actions: { type: 'array', items: { type: 'string' }, description: '2–4 konkrete Schritte für den Tag.' },
    confidence: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] }
  }
}

const toMin = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

const toHm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const localNow = (now) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const g = (t) => p.find((x) => x.type === t)?.value
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: Number(g('hour')) * 60 + Number(g('minute')) }
}

/** Welche Runde ist jetzt fällig? Handanfrage geht vor. */
export function dueMode({ now = new Date(), plan, history, store = loadAdvice(), eveningTime = '20:30' }) {
  if (store.request?.mode) return store.request.mode
  const here = localNow(now)
  const evening = toMin(eveningTime)
  const lateNight = here.minutes < 5 * 60
  if ((here.minutes >= evening || lateNight) && store.evening?.forDate !== targetDay('evening', plan)?.date) return 'evening'
  if (here.minutes >= 5 * 60 && here.minutes <= 12 * 60 && store.morning?.forDate !== here.date) {
    // Erst wenn WHOOP die Nacht gewertet hat (Recovery da, heute aufgewacht).
    const d = history?.days?.[0]
    const woke = d?.sleep?.wake && localNow(new Date(d.sleep.wake)).date === here.date
    if (d?.recovery && woke) return 'morning'
  }
  return null
}

/** Auftrag für den Runner: System-Prompt, Fakten, Schema. */
export function buildJob({ mode, plan, history, todos, exams, now = new Date() }) {
  const { facts } = buildPrompt({ mode, plan, history, todos, exams, now })
  return {
    mode,
    system: SYSTEM,
    prompt: `Fakten (JSON):\n${JSON.stringify(facts, null, 1)}\n\nEntscheide jetzt und antworte im vorgegebenen JSON-Format.`,
    schema: SCHEMA
  }
}

/** Antwort des Runners prüfen und ablegen. */
export function saveResult({ mode, plan, advice, meta = {}, now = new Date() }) {
  for (const k of ['headline', 'decision', 'reasoning', 'confidence']) {
    if (typeof advice?.[k] !== 'string' || !advice[k]) throw new Error(`Antwort ohne ${k}`)
  }
  const target = targetDay(mode, plan)
  const latest = latestWake(target, plan.morning)
  const entry = {
    headline: advice.headline,
    decision: advice.decision,
    wake: advice.wake || null,
    bedtime: advice.bedtime || null,
    reasoning: advice.reasoning,
    actions: Array.isArray(advice.actions) ? advice.actions.slice(0, 5).map(String) : [],
    confidence: advice.confidence
  }
  // Harte Grenze: nie nach dem spätesten Aufstehen vor der Schule.
  const wakeMin = toMin(entry.wake)
  if (latest != null && wakeMin != null && wakeMin > latest) {
    entry.wake = toHm(latest)
    entry.corrected = `Weckzeit auf ${toHm(latest)} korrigiert – sonst wäre die Schule nicht zu schaffen.`
  }
  const full = { ...entry, mode, forDate: target?.date ?? null, createdAt: now.toISOString(), model: meta.model ?? null }
  const store = loadAdvice()
  saveAdvice({ [mode]: full, request: store.request?.mode === mode ? null : store.request })
  return full
}

/** Knopf auf der Startseite: Runde anfragen, der Runner holt sie ab. */
export function requestRun(mode, now = new Date()) {
  return saveAdvice({ request: { mode, at: now.toISOString() } }).request
}

/** Runner meldet sich (für „ist eingerichtet?“ auf der Startseite). */
export function markRunnerSeen(now = new Date()) {
  saveAdvice({ runnerSeenAt: now.toISOString() })
}

/** Die für jetzt passende Einschätzung: morgens die Morgen-, sonst die Abendrunde. */
export function currentAdvice(plan) {
  const all = loadAdvice()
  const today = plan?.today
  const tomorrow = plan?.days?.[1]?.date
  const morning = all.morning?.forDate === today ? all.morning : null
  const evening = all.evening && [today, tomorrow].includes(all.evening.forDate) ? all.evening : null
  // Eingerichtet = der Runner hat sich in den letzten 10 Minuten gemeldet.
  const configured = Boolean(all.runnerSeenAt && Date.now() - Date.parse(all.runnerSeenAt) < 10 * 60 * 1000)
  return { configured, morning, evening, request: all.request ?? null }
}
