import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Eigene Ablage, damit der Test nie data/ai-coach.json überschreibt.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-coach-'))
const { buildPrompt, runCoach, currentAdvice } = await import('./ai-coach.js')
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

const fakeClient = (advice, calls = []) => ({
  beta: {
    messages: {
      create: async (req) => {
        calls.push(req)
        return { stop_reason: 'end_turn', model: req.model, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: JSON.stringify(advice) }] }
      }
    }
  }
})
const advice = (wake) => ({ headline: 'Normal aufstehen', decision: 'normal', wake, bedtime: '21:30', reasoning: 'x', actions: ['a'], confidence: 'hoch' })

test('Abends: Zieltag ist morgen, späteste Weckzeit aus der 1. Stunde', () => {
  const { facts, latest } = buildPrompt({ mode: 'evening', plan, history: { days: [] }, now: NOW })
  assert.match(facts.zieltag.datum, /Montag 2026-10-19/)
  assert.equal(latest, 6 * 60 + 30)
  assert.equal(facts.spätesteWeckzeit, '06:30')
})

test('Claude darf die späteste Weckzeit nicht überschreiten', async () => {
  const calls = []
  const entry = await runCoach({ mode: 'evening', plan, history: { days: [] }, now: NOW, anthropic: fakeClient(advice('07:30'), calls) })
  assert.equal(entry.wake, '06:30')
  assert.match(entry.corrected, /06:30/)
  assert.equal(entry.forDate, '2026-10-19')
  // Fallback auf Ersatzmodell und strukturierte Ausgabe sind gesetzt
  assert.equal(calls[0].fallbacks, 'default')
  assert.equal(calls[0].output_config.format.type, 'json_schema')
})

test('Frühere Weckzeit bleibt, Ablage wird für den Zieltag gefunden', async () => {
  await runCoach({ mode: 'evening', plan, history: { days: [] }, now: NOW, anthropic: fakeClient(advice('06:00')) })
  const cur = currentAdvice(plan)
  assert.equal(cur.evening.wake, '06:00')
  assert.equal(cur.morning, null)
})

test('Signal-Text', () => {
  const text = aiMessage({ mode: 'evening', wake: '06:30', headline: 'Normal aufstehen', reasoning: 'Weil.', actions: ['Licht', 'Wasser'] })
  assert.equal(text, '🌙 Morgen: Wecker 06:30 – Normal aufstehen\nWeil.\n• Licht\n• Wasser')
})
