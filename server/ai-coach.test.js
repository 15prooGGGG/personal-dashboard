import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Eigene Ablage, damit der Test nie data/ai-coach.json überschreibt.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-coach-'))
const { buildPrompt, buildJob, dueMode, saveResult, requestRun, markRunnerSeen, currentAdvice, loadAdvice } = await import('./ai-coach.js')
const { buildDayPlan } = await import('./day-plan.js')
const { aiMessage } = await import('./notify/index.js')

const lessonsOn = (d) => {
  const wd = new Date(`${d}T12:00:00Z`).getUTCDay()
  return wd >= 1 && wd <= 5
    ? { week: 'A', lessons: [{ period: 1, start: '07:40', end: '08:25', type: 'lesson', subject: 'Mathe', course: 'm1', teacher: 'VOG' }] }
    : null
}
// Sonntagabend 20:30 Berlin → Zieltag Montag 19.10.
const NOW = new Date('2026-10-18T18:30:00Z')
const plan = buildDayPlan({ now: NOW, lessonsOn, days: 4, sleep: { baselineMs: 8 * 3600000, tonightMs: 8 * 3600000, deficitMs: 0, efficiency: 0.9, recovery: 60 } })

const advice = (wake) => ({ headline: 'Normal aufstehen', decision: 'normal', wake, bedtime: '21:30', reasoning: 'x', actions: ['a'], confidence: 'hoch' })

test('Abends: Zieltag ist morgen, späteste Weckzeit aus der 1. Stunde', () => {
  const { facts, latest } = buildPrompt({ mode: 'evening', plan, history: { days: [] }, now: NOW })
  assert.match(facts.zieltag.datum, /Montag 2026-10-19/)
  assert.equal(latest, 6 * 60 + 30)
  assert.equal(facts.spätesteWeckzeit, '06:30')
})

test('Claude darf die späteste Weckzeit nicht überschreiten', () => {
  const entry = saveResult({ mode: 'evening', plan, advice: advice('07:30'), meta: { model: 'sonnet' }, now: NOW })
  assert.equal(entry.wake, '06:30')
  assert.match(entry.corrected, /06:30/)
  assert.equal(entry.forDate, '2026-10-19')
})

test('Frühere Weckzeit bleibt, Ablage wird für den Zieltag gefunden', () => {
  saveResult({ mode: 'evening', plan, advice: advice('06:00'), now: NOW })
  const cur = currentAdvice(plan)
  assert.equal(cur.evening.wake, '06:00')
  assert.equal(cur.morning, null)
  assert.equal(cur.configured, false) // Runner hat sich noch nicht gemeldet
  markRunnerSeen()
  assert.equal(currentAdvice(plan).configured, true)
})

test('Unvollständige Antwort wird abgelehnt', () => {
  assert.throws(() => saveResult({ mode: 'evening', plan, advice: { wake: '06:00' }, now: NOW }), /ohne headline/)
})

test('Fällig: abends ab 20:30, wenn für morgen noch nichts da ist; Handanfrage geht vor', () => {
  const at = (iso) => new Date(iso)
  assert.equal(dueMode({ now: at('2026-10-18T17:00:00Z'), plan, history: { days: [] }, store: {} }), null) // 19:00
  assert.equal(dueMode({ now: NOW, plan, history: { days: [] }, store: {} }), 'evening')
  assert.equal(dueMode({ now: NOW, plan, history: { days: [] }, store: { evening: { forDate: '2026-10-19' } } }), null)
  assert.equal(dueMode({ now: at('2026-10-18T10:00:00Z'), plan, history: { days: [] }, store: { request: { mode: 'morning' } } }), 'morning')
  // Morgens erst, wenn WHOOP die Nacht von heute gewertet hat
  const morningPlan = buildDayPlan({ now: at('2026-10-19T05:00:00Z'), lessonsOn, days: 3 })
  const scored = { days: [{ recovery: { score: 60 }, sleep: { wake: '2026-10-19T04:35:00Z' } }] }
  assert.equal(dueMode({ now: at('2026-10-19T05:00:00Z'), plan: morningPlan, history: scored, store: {} }), 'morning')
  assert.equal(dueMode({ now: at('2026-10-19T05:00:00Z'), plan: morningPlan, history: { days: [{ recovery: null }] }, store: {} }), null)
})

test('Nach Mitternacht meint die Abendrunde den heutigen Morgen', () => {
  const night = buildDayPlan({ now: new Date('2026-10-18T23:30:00Z'), lessonsOn, days: 3 }) // Mo 01:30
  const { facts } = buildPrompt({ mode: 'evening', plan: night, history: { days: [] }, now: new Date('2026-10-18T23:30:00Z') })
  assert.match(facts.zieltag.datum, /Montag 2026-10-19/)
  assert.equal(dueMode({ now: new Date('2026-10-18T23:30:00Z'), plan: night, history: { days: [] }, store: { evening: { forDate: '2026-10-19' } } }), null)
})

test('Handanfrage wird nach der Antwort gelöscht; Auftrag enthält Schema', () => {
  requestRun('morning', NOW)
  assert.equal(loadAdvice().request.mode, 'morning')
  saveResult({ mode: 'morning', plan, advice: advice(''), now: NOW })
  assert.equal(loadAdvice().request, null)
  const job = buildJob({ mode: 'evening', plan, history: { days: [] }, now: NOW })
  assert.equal(job.schema.type, 'object')
  assert.match(job.prompt, /spätesteWeckzeit/)
})

test('Signal-Text', () => {
  const text = aiMessage({ mode: 'evening', wake: '06:30', headline: 'Normal aufstehen', reasoning: 'Weil.', actions: ['Licht', 'Wasser'] })
  assert.equal(text, '🌙 Morgen: Wecker 06:30 – Normal aufstehen\nWeil.\n• Licht\n• Wasser')
})
