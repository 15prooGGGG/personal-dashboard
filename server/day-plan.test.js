import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDayPlan, nextWake, eventKind } from './day-plan.js'
import { countsForPlanning } from './calendar-priority.js'

const H = 3600000
// Montag 19.10.2026, 06:00 Berlin (= 04:00 UTC)
const MONDAY_6 = new Date('2026-10-19T04:00:00Z')

const L = (period, start, end, subject, type = 'lesson') => ({ period, start, end, type, subject, room: 'G3' })
const MONDAY = [
  L(1, '07:40', '08:25', 'Religion'),
  L(2, '08:30', '09:15', 'Religion'),
  L(3, '09:30', '10:15', 'Mathe'),
  L(4, '10:20', '11:05', 'Mathe'),
  L(5, '11:20', '12:05', 'Mathe'),
  L(6, '12:10', '12:55', 'Chemie'),
  L(7, '13:00', '14:00', 'Mittagspause', 'break'),
  L(8, '14:00', '14:45', 'Deutsch'),
  L(9, '14:45', '15:30', 'Deutsch')
]
// Mo–Fr gleicher Plan, Wochenende frei
const lessonsOn = (d) => {
  const wd = new Date(`${d}T12:00:00Z`).getUTCDay()
  return wd >= 1 && wd <= 5 ? { week: 'A', lessons: MONDAY } : null
}
const sleep = (recovery = 70, deficitMs = 0) => ({
  baselineMs: 8 * H,
  tonightMs: 8 * H + Math.min(deficitMs, H),
  deficitMs,
  efficiency: 0.9,
  recovery
})
const ev = (title, start, end, calendar = 'Privat') => ({ title, start, end, calendar, allDay: false })
const entfall = (date, ...lessons) => ({
  days: [{ date, infos: [], entries: lessons.map((l) => ({ lesson: String(l), kind: 'Entfall', subject: 'x' })) }]
})

test('Schultag: Aufstehen 70 min vor der 1. Stunde, Schlafenszeit aus dem WHOOP-Bedarf', () => {
  const p = buildDayPlan({ now: MONDAY_6, lessonsOn, sleep: sleep(), days: 3 })
  const mo = p.days[0]
  assert.equal(mo.schoolDay, true)
  assert.equal(mo.wake.time, '06:30')
  // Dienstag wieder 06:30 → 8 h / 0,9 = 8 h 53 min im Bett → 21:35
  assert.equal(mo.bedtime.time, '21:35')
  assert.deepEqual(
    mo.blocks.filter((b) => b.kind === 'school').map((b) => `${b.startTime}-${b.endTime} ${b.title}`),
    ['07:40-09:15 Religion', '09:30-12:05 Mathe', '12:10-12:55 Chemie', '14:00-15:30 Deutsch']
  )
  assert.ok(mo.blocks.some((b) => b.kind === 'break' && b.title === 'Mittagspause'))
})

test('Familienkalender zählt nur mit „Lauri“ im Titel', () => {
  assert.equal(countsForPlanning({ title: 'Hautarzt', calendar: 'Familienkalender Stenger' }), false)
  assert.equal(countsForPlanning({ title: 'Lauri Zahnarzt', calendar: 'Familienkalender Stenger' }), true)
  assert.equal(countsForPlanning({ title: 'Hautarzt', calendar: 'Privat' }), true)
  const p = buildDayPlan({
    now: MONDAY_6,
    lessonsOn,
    sleep: sleep(),
    days: 2,
    events: [ev('Hautarzt', '2026-10-19T12:00:00Z', '2026-10-19T13:00:00Z', 'Familienkalender Stenger')]
  })
  assert.equal(p.ignoredFamilyEvents, 1)
  assert.equal(p.warnings.length, 0)
})

test('Warner: Termin in der Schulzeit, Kollision mit Gym und Lernzeit', () => {
  const p = buildDayPlan({
    now: MONDAY_6,
    lessonsOn,
    sleep: sleep(),
    days: 4,
    events: [
      // Di 15:00–16:00 Berlin → überschneidet Unterricht bis 15:30 + Heimweg
      ev('Zahnarzt', '2026-10-20T13:00:00Z', '2026-10-20T14:00:00Z'),
      // Mi: Gym 17:30–19:30 und Termin 18:00–19:00
      ev('Oberkörper Training', '2026-10-21T15:30:00Z', '2026-10-21T17:30:00Z', 'Gym Trainingsplan'),
      ev('Geburtstag Max', '2026-10-21T16:00:00Z', '2026-10-21T17:00:00Z')
    ],
    studyBlocks: [{ date: '2026-10-22', start: '16:30', end: '18:00', title: 'Mathe: Analysis' }],
    exams: []
  })
  const texts = p.warnings.map((w) => `${w.date} ${w.with}`)
  assert.ok(texts.includes('2026-10-20 school'), texts.join(', '))
  assert.ok(texts.includes('2026-10-21 gym'), texts.join(', '))
  // Do: noch ohne Termin → keine Warnung; Lernblock steht aber im Plan
  assert.ok(p.days[3].blocks.some((b) => b.kind === 'study' && b.title === 'Mathe: Analysis'))
  assert.equal(p.warnings.find((w) => w.date === '2026-10-20').level, 'soon')
})

test('Lernblock-Kollision wird erkannt', () => {
  const p = buildDayPlan({
    now: MONDAY_6,
    lessonsOn,
    sleep: sleep(),
    days: 2,
    events: [ev('Friseur', '2026-10-20T15:00:00Z', '2026-10-20T16:00:00Z')],
    studyBlocks: [{ date: '2026-10-20', start: '16:30', end: '18:00', title: 'Chemie' }]
  })
  assert.ok(p.warnings.some((w) => w.with === 'study'))
})

test('Entfall 1.–2. Stunde, müde → länger schlafen', () => {
  // Sonntagabend: Plan für Montag ist „morgen“
  const now = new Date('2026-10-18T18:00:00Z')
  const p = buildDayPlan({ now, lessonsOn, sleep: sleep(30), substitutions: entfall('19.10.2026', 1, 2), days: 3 })
  const mo = p.days[1]
  assert.equal(mo.school.start, '09:30')
  assert.equal(mo.wake.time, '08:20')
  assert.equal(mo.notes[0].kind, 'sleep-in')
  assert.ok(mo.blocks.some((b) => b.kind === 'cancelled'))
  // Coaching bekommt die Weckzeit für morgen
  assert.deepEqual(nextWake(p), { minutes: 8 * 60 + 20, kind: 'Schultag', date: '2026-10-19' })
})

test('Entfall 1.–2. Stunde, erholt und Klausur naht → früh aufstehen und lernen', () => {
  const now = new Date('2026-10-18T18:00:00Z')
  const p = buildDayPlan({
    now,
    lessonsOn,
    sleep: sleep(80),
    substitutions: entfall('19.10.2026', '1 - 2'),
    exams: [{ date: '2026-10-21', subject: 'Mathematik', kind: 'Klausur' }],
    days: 3
  })
  const mo = p.days[1]
  assert.equal(mo.wake.time, '06:30')
  assert.equal(mo.notes[0].kind, 'study-early')
  const study = mo.blocks.find((b) => b.kind === 'study')
  assert.equal(`${study.startTime}-${study.endTime}`, '07:15-09:05')
})

test('Früher Schluss: Gym kann vorrutschen', () => {
  const p = buildDayPlan({
    now: MONDAY_6,
    lessonsOn,
    sleep: sleep(),
    substitutions: entfall('19.10.2026', 8, 9),
    events: [ev('Unterkörper Training', '2026-10-19T15:30:00Z', '2026-10-19T17:30:00Z', 'Gym Trainingsplan')],
    days: 2
  })
  const mo = p.days[0]
  assert.equal(mo.school.end, '12:55')
  const note = mo.notes.find((n) => n.kind === 'early-end')
  assert.match(note.title, /12:55 statt 15:30/)
  assert.match(note.detail, /ab 13:50/)
  // Mittagspause nach dem letzten echten Unterricht fällt weg
  assert.ok(!mo.blocks.some((b) => b.title === 'Mittagspause'))
  // Entfall-Block zerschneidet die freie Zeit nicht
  assert.ok(mo.blocks.some((b) => b.kind === 'free' && b.startTime === '13:20' && b.endTime === '17:30'))
})

test('Ferien und Wochenende: Rhythmus halten, vor Schultag nur 1 h später', () => {
  // Fr 16.10. (Herbstferien) bis Mo 19.10.
  const p = buildDayPlan({ now: new Date('2026-10-16T08:00:00Z'), lessonsOn, sleep: sleep(), days: 4 })
  assert.deepEqual(
    p.days.map((d) => `${d.weekday} ${d.schoolDay} ${d.wake.time}`),
    ['Freitag false 08:30', 'Samstag false 08:30', 'Sonntag false 07:30', 'Montag true 06:30']
  )
  assert.equal(p.days[0].breakName, 'Herbstferien')
  // Sonntagabend früh ins Bett für Montag 06:30
  assert.equal(p.days[2].bedtime.time, '21:35')
})

test('Termin-Arten', () => {
  assert.equal(eventKind({ title: 'Unterkörper Training ', calendar: 'Gym Trainingsplan' }), 'gym')
  assert.equal(eventKind({ title: 'Restday', calendar: 'Gym Trainingsplan' }), 'rest')
  assert.equal(eventKind({ title: 'Schicht', calendar: 'Arbeiten für Lauri' }), 'work')
  assert.equal(eventKind({ title: 'Shah Klavier', calendar: 'Privat' }), 'event')
})

test('Kurze Lücken im Schultag heißen Pause, Umstellungs-Hinweis nur einmal', () => {
  const p = buildDayPlan({
    now: new Date('2026-10-16T08:00:00Z'),
    lessonsOn,
    sleep: { ...sleep(), habitualBedMin: 26 * 60 },
    days: 4
  })
  const mo = p.days[3]
  assert.ok(mo.blocks.some((b) => b.kind === 'break' && b.title === 'Pause' && b.startTime === '09:15'))
  const shifts = p.days.flatMap((d) => d.notes).filter((n) => n.kind === 'shift')
  assert.equal(shifts.length, 1)
  assert.match(shifts[0].title, /statt gewohnt 02:00/)
})

test('Klausur aus dem Klausurplan nicht doppelt als Kalender-Chip', () => {
  const p = buildDayPlan({
    now: MONDAY_6,
    lessonsOn,
    sleep: sleep(),
    days: 1,
    events: [{ title: 'Klausur: Mathe', start: '2026-10-19T00:00:00Z', end: '2026-10-20T00:00:00Z', allDay: true, calendar: 'Schule' }],
    exams: [{ date: '2026-10-19', subject: 'Mathematik', kind: 'LK' }]
  })
  assert.deepEqual(p.days[0].chips, [{ kind: 'exam', title: 'Klausur Mathematik (LK)' }])
})
