// ===========================================================================
// KI-Coach: Claude entscheidet frei, wie Lauri morgen bzw. heute in den Tag
// geht – länger schlafen oder früh lernen, wie hart trainieren, was sich
// verschieben lässt. Kein festes Regelwerk: Claude bekommt alle Fakten
// (Tagesplan, WHOOP-Verlauf, Klausuren, To-dos) und wägt selbst ab.
//
// Arbeitsteilung:
//   - Fakten rechnet der Tagesplan (day-plan.js) – Uhrzeiten, Entfall,
//     Kollisionen. Die sind nachprüfbar und bleiben regelbasiert.
//   - Die Abwägung macht Claude. Die Regel-Empfehlung wird mitgeschickt,
//     Claude darf ihr widersprechen.
//   - Harte Grenze: Claude kann keine Weckzeit nach dem spätesten möglichen
//     Aufstehen vor der Schule setzen – das wird serverseitig geprüft.
//
// Zwei Läufe am Tag:
//   abends  (AI_EVENING_TIME, Standard 20:30): Wecker für morgen entscheiden.
//           Die Recovery von morgen kennt noch niemand – Grundlage sind
//           Schlafdefizit, Verlauf und was morgen ansteht.
//   morgens (sobald WHOOP die Nacht gewertet hat): Tag mit echter Recovery
//           justieren – Training, Lernen, Pausen.
//
// Ergebnis liegt in data/ai-coach.json, die Startseite zeigt es an.
// ===========================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { config } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data')
const FILE = path.join(DATA_DIR, 'ai-coach.json')
const TZ = 'Europe/Berlin'

export const isConfigured = () => Boolean(config.ai.apiKey)

let client = null
const getClient = () => (client ??= new Anthropic({ apiKey: config.ai.apiKey }))

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

/** Spätestmögliche Weckzeit (Minuten) – vor der Schule ist nichts verhandelbar. */
function latestWake(day, morning) {
  if (!day?.school) return null
  const [h, m] = day.school.start.split(':').map(Number)
  return h * 60 + m - morning.routineMin - morning.commuteMin
}

export function buildPrompt({ mode, plan, history, todos = [], exams = [], now = new Date() }) {
  // Abends geht es um morgen, morgens um heute (nach Mitternacht ist „morgen“
  // schon heute – der Tagesplan zählt Tage ab dem Kalenderdatum).
  const target = mode === 'evening' ? plan.days[1] : plan.days[0]
  const latest = latestWake(target, plan.morning)
  const facts = {
    jetzt: berlin(now.toISOString()),
    lauf: mode === 'evening' ? 'Abend: Wecker für morgen festlegen' : 'Morgen: Tag mit der echten Recovery justieren',
    zieltag: daySummary(target),
    danach: plan.days.slice(mode === 'evening' ? 2 : 1, mode === 'evening' ? 5 : 4).map(daySummary),
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

/** Claude fragen. Liefert den gespeicherten Eintrag zurück. */
export async function runCoach({ mode, plan, history, todos, exams, now = new Date(), anthropic = null }) {
  if (!anthropic && !isConfigured()) throw new Error('ANTHROPIC_API_KEY fehlt')
  const { facts, latest } = buildPrompt({ mode, plan, history, todos, exams, now })

  const response = await (anthropic ?? getClient()).beta.messages.create({
    model: config.ai.model,
    max_tokens: 16000,
    // Bei einer Ablehnung durch die Sicherheitsfilter springt serverseitig
    // automatisch ein passendes Ersatzmodell ein.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Fakten (JSON):\n${JSON.stringify(facts, null, 1)}` }]
  })

  if (response.stop_reason === 'refusal') throw new Error('Claude hat die Anfrage abgelehnt')
  if (response.stop_reason === 'max_tokens') throw new Error('Antwort abgeschnitten')
  const text = response.content.find((b) => b.type === 'text')?.text
  const advice = JSON.parse(text)
  if (!advice.wake) advice.wake = null

  // Harte Grenze nachprüfen: nie nach dem spätesten Aufstehen vor der Schule.
  const wakeMin = toMin(advice.wake)
  if (latest != null && wakeMin != null && wakeMin > latest) {
    advice.wake = facts.spätesteWeckzeit
    advice.corrected = `Weckzeit auf ${facts.spätesteWeckzeit} korrigiert – sonst wäre die Schule nicht zu schaffen.`
  }

  const target = mode === 'evening' ? plan.days[1] : plan.days[0]
  const entry = {
    ...advice,
    mode,
    forDate: target?.date ?? null,
    createdAt: now.toISOString(),
    model: response.model,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens }
  }
  saveAdvice({ [mode]: entry })
  return entry
}

/** Die für jetzt passende Einschätzung: morgens die Morgen-, sonst die Abendrunde. */
export function currentAdvice(plan) {
  const all = loadAdvice()
  const today = plan?.today
  const tomorrow = plan?.days?.[1]?.date
  const morning = all.morning?.forDate === today ? all.morning : null
  const evening = all.evening && [today, tomorrow].includes(all.evening.forDate) ? all.evening : null
  return { configured: isConfigured(), morning, evening }
}
