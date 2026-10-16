// Sammelt alle Quellen für den Tagesplan (jede darf ausfallen – dann plant
// der Tagesplan ohne sie) und rechnet Tagesplan + Schlaf-Coaching zusammen,
// damit Startseite und Schlaf-Tab dieselbe Weckzeit nennen.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isConfigured } from './config.js'
import { fetchCalendarOccurrences } from './integrations/calendar.js'
import { fetchSubstitutions, isConfigured as schulportalReady } from './integrations/schulportal.js'
import { fetchWhoopHistory } from './integrations/whoop.js'
import { buildCoaching, sleepNeed } from './whoop-coach.js'
import { getExams } from './exams.js'
import { lessonsOn } from './stundenplan.js'
import { buildDayPlan, nextWake } from './day-plan.js'
import { getTodos } from './todos-store.js'
import { runCoach } from './ai-coach.js'

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
  const plan = buildDayPlan({
    now,
    lessonsOn,
    events: cal.events ?? [],
    substitutions: subs,
    sleep: sleepNeed(whoopDays),
    exams: getExams(now).exams ?? [],
    studyBlocks: loadStudyBlocks()
  })
  const coaching = whoopDays.length
    ? buildCoaching({ days: whoopDays, events: cal.events ?? [], now, wake: nextWake(plan) })
    : null
  return { plan, coaching, history }
}

// KI-Coach mit frischem Kontext laufen lassen (abends: morgen, morgens: heute).
export async function runAiCoach(mode, now = new Date()) {
  const { plan, history } = await buildPlanContext(now)
  const todos = (() => {
    try {
      const t = getTodos()
      return Array.isArray(t) ? t : (t.todos ?? [])
    } catch {
      return []
    }
  })()
  return runCoach({ mode, plan, history, todos, exams: getExams(now).exams ?? [], now })
}
