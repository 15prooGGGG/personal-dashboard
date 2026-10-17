import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTopics, setTopic, scheduleStudy } from './study-plan.js'

const md = `# Lernplan
- [x] Ableitung
- [ ] Integral
- [ ]
* [ ] Altklausur`

test('Themen: Checkliste lesen, leere Zeilen ignorieren', () => {
  assert.deepEqual(parseTopics(md), [
    { text: 'Ableitung', done: true },
    { text: 'Integral', done: false },
    { text: 'Altklausur', done: false }
  ])
})

test('Themen: n-tes Thema abhaken, Rest bleibt gleich', () => {
  const next = setTopic(md, 2, true)
  assert.equal(next.split('\n')[4], '* [x] Altklausur')
  assert.equal(setTopic(next, 0, false).split('\n')[1], '- [ ] Ableitung')
})

// Tag mit einer freien Lücke 14:00–20:00, Schlafenszeit 22:00
const day = (date, free = [[14 * 60, 20 * 60]]) => ({
  date,
  wake: { min: 6 * 60 + 30 },
  bedtime: { min: 22 * 60 },
  blocks: free.map(([start, end]) => ({ kind: 'free', start, end }))
})
const plan = (dates) => ({ today: dates[0], nowMin: 8 * 60, days: dates.map((d) => day(d)) })
const dates = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']

test('Verteilung: GK gleichmäßig bis zum Vorabend, Vorabend nur kurz', () => {
  const exams = [{ date: '2026-10-23', subject: 'Englisch', kind: 'GK' }]
  const { blocks, summary } = scheduleStudy({ plan: plan(dates), exams })
  assert.ok(!blocks.some((b) => b.date === '2026-10-23'), 'kein Block am Klausurtag')
  const eve = blocks.filter((b) => b.date === '2026-10-22')
  assert.equal(eve.length, 1)
  assert.equal(eve[0].title, 'Englisch: kurz wiederholen')
  assert.equal(eve[0].start, '14:10')
  assert.equal(eve[0].end, '14:55')
  const total = summary[0].plannedMin
  assert.ok(total >= 4 * 60 - 15 && total <= 4 * 60, `geplant ${total}`)
  for (const b of blocks) assert.ok(b.start >= '14:10' && b.end <= '19:50')
})

test('Verteilung: gestrichene Zeit ist belegt, Block rutscht dahinter', () => {
  const exams = [{ date: '2026-10-21', subject: 'Englisch', kind: 'GK' }]
  const skipped = [{ date: '2026-10-19', start: '14:10', end: '16:10' }]
  const { blocks } = scheduleStudy({ plan: plan(dates), exams, state: { blocks: [], skipped } })
  const first = blocks.find((b) => b.date === '2026-10-19')
  assert.ok(first.start >= '16:20', first.start)
})

test('Verteilung: vergangene Blöcke zählen aufs Budget', () => {
  const exams = [{ date: '2026-10-23', subject: 'Englisch', kind: 'GK' }]
  const done = [{ examId: '2026-10-23-englisch', date: '2026-10-18', start: '10:00', end: '13:00', title: 'Englisch' }]
  const { summary } = scheduleStudy({ plan: plan(dates), exams, state: { blocks: done, skipped: [] } })
  assert.equal(summary[0].doneMin, 180)
  assert.ok(summary[0].plannedMin <= 60)
})

test('Verteilung: Themen landen der Reihe nach in den Blöcken', () => {
  const exams = [{ date: '2026-10-23', subject: 'Mathematik', kind: 'LK + GK' }]
  const topics = [{ text: 'A', done: true }, { text: 'B', done: false }, { text: 'C', done: false }]
  const { blocks } = scheduleStudy({ plan: plan(dates), exams, topicsOf: () => topics })
  const titles = blocks.map((b) => b.title)
  assert.equal(titles[0], 'Mathe: B')
  assert.ok(titles.includes('Mathe: C'))
  assert.ok(!titles.some((t) => t.includes(': A')))
})
