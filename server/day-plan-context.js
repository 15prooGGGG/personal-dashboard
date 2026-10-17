// Sammelt alle Quellen für den Tagesplan (jede darf ausfallen – dann plant
// der Tagesplan ohne sie) und rechnet Tagesplan + Schlaf-Coaching zusammen,
// damit Startseite und Schlaf-Tab dieselbe Weckzeit nennen.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isConfigured, config } from './config.js'
import { fetchCalendarOccurrences } from './integrations/calendar.js'
import { fetchSubstitutions, isConfigured as schulportalReady } from './integrations/schulportal.js'
import { fetchWhoopHistory } from './integrations/whoop.js'
import { buildCoaching, sleepNeed } from './whoop-coach.js'
import { getExams } from './exams.js'
import { lessonsOn } from './stundenplan.js'
import { buildDayPlan, nextWake } from './day-plan.js'
import { ROUTINE } from './week-routine.js'
import { getTodos } from './todos-store.js'
import { buildStudyPlan } from './study-plan.js'
import { buildJob, dueMode, loadAdvice } from './ai-coach.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data')
const STUDY_FILE = path.join(DATA_DIR, 'study-blocks.json')

function loadStudyBlocks() {
  try {
    const raw = JSON.parse(fs.readFileSync(STUDY_FILE, 'utf8'))
    return Array.isArray(raw) ? raw : (raw.blocks ?? [])
  } catch {
    return []
  }
}

const soft = (p, fallback) => p.catch(() => fallback)

export async function buildPlanContext(now = new Date()) {
  const [cal, subs, history] = await Promise.all([
    isConfigured.calendar ? soft(fetchCalendarOccurrences(), { events: [] }) : { events: [] },
    schulportalReady() ? soft(fetchSubstitutions(), null) : null,
    soft(fetchWhoopHistory(), { connected: false })
  ])
  const whoopDays = history?.connected ? history.days : []
  const exams = getExams(now).exams ?? []
  const input = {
    now,
    lessonsOn,
    events: cal.events ?? [],
    substitutions: subs,
    sleep: sleepNeed(whoopDays),
    exams,
    routine: ROUTINE
  }
  // Erst ohne Klausur-Lernblöcke rechnen (freie Lücken finden – die Routine
  // hält dafür ihre Lernzeit als Fenster frei), dann den Lernplan hineinsetzen.
  // Eigene Blöcke aus study-blocks.json gelten immer.
  const manual = loadStudyBlocks()
  const base = buildDayPlan({ ...input, studyBlocks: manual, routineStudyAsWindow: true })
  let study = null
  try {
    study = buildStudyPlan({ plan: base, exams })
  } catch (err) {
    console.error('study plan error:', err.message)
  }
  const plan = study
    ? buildDayPlan({ ...input, studyBlocks: [...manual, ...study.blocks.map((b) => ({ date: b.date, start: b.start, end: b.end, title: b.title, kind: 'study', auto: true }))] })
    : buildDayPlan({ ...input, studyBlocks: manual })
  const coaching = whoopDays.length
    ? buildCoaching({ days: whoopDays, events: cal.events ?? [], now, wake: nextWake(plan) })
    : null
  return { plan, coaching, history, study }
}

// Auftrag für den KI-Runner (scripts/ai-coach-runner.sh): fällige Runde oder
// die erzwungene (?mode=). Ohne fällige Runde: { due: null }.
export async function aiJob(forceMode = null, now = new Date()) {
  const { plan, history } = await buildPlanContext(now)
  const mode = forceMode ?? dueMode({ now, plan, history, store: loadAdvice(), eveningTime: config.ai.eveningTime })
  if (!mode) return { due: null }
  let todos = []
  try {
    todos = getTodos()
  } catch {
    todos = []
  }
  return { due: mode, ...buildJob({ mode, plan, history, todos, exams: getExams(now).exams ?? [], now }) }
}
