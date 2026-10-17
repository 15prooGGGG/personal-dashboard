import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDayPlan, nextWake, eventKind, entryMatchesLesson } from './day-plan.js'
import { countsForPlanning } from './calendar-priority.js'
import { ROUTINE } from './week-routine.js'

const H = 3600000
// Montag 19.10.2026, 06:00 Berlin (= 04:00 UTC)
const MONDAY_6 = new Date('2026-10-19T04:00:00Z')

const L = (period, start, end, subject, type = 'lesson', course = subject.slice(0, 2).toLowerCase() + '06', teacher = 'KER') => ({ period, start, end, type, subject, room: 'G3', course, teacher })
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
  days: [{ date, infos: [], entries: lessons.map((l) => ({ lesson: String(l), kind: 'Entfall', teacher: 'Köcher (KER)', subject: 'x' })) }]
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
    ['Freitag false 08:30', 'Samstag false 08:30', 'Sonntag false 08:00', 'Montag true 06:30']
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

test('Entfall gilt nur für eigene Kurse (Lehrerkürzel oder Kurs)', () => {
  const deutsch = { period: 8, type: 'lesson', subject: 'Deutsch', course: 'd06', teacher: 'KER' }
  // Echter Fall 19.10.2026: Stufen-Eintrag für d05 bei BGT – nicht Lauris Kurs
  assert.equal(entryMatchesLesson({ teacher: 'Baumgärtner (BGT)', subject: 'd05', kind: 'Entfall' }, deutsch), false)
  assert.equal(entryMatchesLesson({ teacher: 'Köcher (KER)', subject: 'd06', kind: 'Entfall' }, deutsch), true)
  assert.equal(entryMatchesLesson({ teacher: '', subject: 'D06', kind: 'Entfall' }, deutsch), true)
  assert.equal(entryMatchesLesson({ kind: 'Entfall' }, deutsch), true)
  assert.equal(entryMatchesLesson({ teacher: 'Muster (COU)' }, { ...deutsch, teacher: 'COU/MUP' }), true)
  const p = buildDayPlan({
    now: MONDAY_6,
    lessonsOn,
    sleep: sleep(),
    days: 1,
    substitutions: { days: [{ date: '19.10.2026', infos: [], entries: [8, 9].map((l) => ({ lesson: String(l), kind: 'Entfall', teacher: 'Baumgärtner (BGT)', subject: 'd05' })) }] }
  })
  assert.equal(p.days[0].school.end, '15:30')
  assert.ok(!p.days[0].blocks.some((b) => b.kind === 'cancelled'))
})

// ---- Wochenroutine ------------------------------------------------------------
const routineList = (day) => day.blocks.filter((b) => b.source === 'routine' && b.title !== 'Feierabend').map((b) => `${b.startTime}-${b.endTime} ${b.title}`)

test('Routine: Gym direkt nach der Schule, dann Essen, Lernen, Arbeit bis höchstens 21:00', () => {
  const p = buildDayPlan({ now: MONDAY_6, lessonsOn, sleep: sleep(), days: 2, routine: ROUTINE })
  const mo = p.days[0]
  assert.deepEqual(routineList(mo), [
    '15:30-15:40 Zum Gym',
    '15:40-16:55 Gym',
    '16:55-17:05 Heimweg',
    '17:05-17:35 Essen & Runterkommen',
    '17:35-18:50 Lernen',
    '19:05-21:00 Arbeiten'
  ])
  assert.ok(mo.blocks.some((b) => b.title === 'Feierabend' && b.startTime === '21:00'))
  // Kein zusätzlicher 25-min-Heimweg ab Schulschluss, kein Warner „vor Schulschluss“
  assert.equal(mo.blocks.filter((b) => b.title === 'Heimweg').length, 1)
  assert.equal(mo.warnings.length, 0)
})

test('Routine: veralteter Kalender „Gym Trainingsplan“ wird ersetzt, andere Termine haben Vorrang', () => {
  const p = buildDayPlan({
    now: MONDAY_6,
    lessonsOn,
    sleep: sleep(),
    days: 1,
    routine: ROUTINE,
    events: [
      ev('Oberkörper Training', '2026-10-19T16:30:00Z', '2026-10-19T18:00:00Z', 'Gym Trainingsplan'),
      ev('Nachhilfe', '2026-10-19T16:00:00Z', '2026-10-19T17:00:00Z') // 18:00–19:00
    ]
  })
  const mo = p.days[0]
  assert.ok(!mo.blocks.some((b) => b.title === 'Oberkörper Training'))
  // Nachhilfe 18:00–19:00: Lernen rutscht dahinter, Arbeit füllt den Rest bis 21:00
  assert.deepEqual(routineList(mo).slice(4), ['19:00-20:15 Lernen', '20:30-21:00 Arbeiten'])
})

test('Routine: vor der Klausur mehr Lernen, am Vortag nur Wiederholen und keine Arbeit', () => {
  const exams = [{ date: '2026-10-22', subject: 'Mathematik' }]
  const p = buildDayPlan({ now: MONDAY_6, lessonsOn, sleep: sleep(), days: 3, routine: ROUTINE, exams })
  const [mo, , mi] = p.days
  const s = mo.blocks.find((b) => b.kind === 'study')
  assert.equal(s.title, 'Lernen: Mathematik')
  assert.equal(s.end - s.start, 120)
  assert.ok(routineList(mi).includes('17:20-18:20 Wiederholen: Mathematik'))
  assert.ok(!mi.blocks.some((b) => b.kind === 'work'))
})

test('Routine: kurzer Schultag → 2 h Lernen, langer Tag → 30 min, Ruhetag ohne Gym', () => {
  const short = [MONDAY[0], MONDAY[1], MONDAY[2], MONDAY[3]] // bis 11:05
  const long = [...MONDAY, L(10, '15:45', '16:30', 'Sport'), L(11, '16:30', '17:15', 'Sport')]
  const lo = (d) => {
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay()
    return wd === 2 ? { week: 'B', lessons: short } : wd === 4 ? { week: 'B', lessons: long } : wd >= 1 && wd <= 5 ? { week: 'B', lessons: MONDAY } : null
  }
  const p = buildDayPlan({ now: MONDAY_6, lessonsOn: lo, sleep: sleep(), days: 4, routine: ROUTINE })
  const di = p.days[1]
  const doTag = p.days[3]
  const dur = (day) => day.blocks.filter((b) => b.kind === 'study').reduce((n, b) => n + b.end - b.start, 0)
  assert.equal(dur(di), 120)
  assert.equal(di.blocks.find((b) => b.kind === 'gym').startTime, '11:15')
  assert.ok(di.blocks.filter((b) => b.kind === 'work').every((b) => b.end - b.start <= 180))
  assert.equal(dur(doTag), 30)
  assert.ok(!doTag.blocks.some((b) => b.kind === 'gym'))
})

test('Routine: Wochenende – Samstag arbeiten + Gym, Sonntag lernen, laufen, Woche planen', () => {
  const SAT_8 = new Date('2026-10-24T06:00:00Z')
  const p = buildDayPlan({ now: SAT_8, lessonsOn, sleep: sleep(), days: 2, routine: ROUTINE })
  const [sa, so] = p.days
  assert.deepEqual(routineList(sa), ['09:30-12:30 Arbeiten', '14:30-15:45 Gym'])
  assert.deepEqual(routineList(so), ['09:00-10:30 Lernen', '14:30-15:10 Laufen', '18:00-18:15 Woche planen'])
})

test('Routine + Klausur-Lernplan: erst Lernzeit-Fenster, dann ersetzt der Lernplan das allgemeine Lernen', () => {
  const base = buildDayPlan({ now: MONDAY_6, lessonsOn, sleep: sleep(), days: 1, routine: ROUTINE, routineStudyAsWindow: true })
  const win = base.days[0].blocks.find((b) => b.title === 'Lernzeit')
  assert.equal(win.kind, 'free')
  assert.equal(`${win.startTime}-${win.endTime}`, '17:35-18:50')
  // Lernplan setzt 17:45–18:45 Mathe: kein zweites „Lernen“, Arbeit danach
  const p = buildDayPlan({
    now: MONDAY_6,
    lessonsOn,
    sleep: sleep(),
    days: 1,
    routine: ROUTINE,
    studyBlocks: [{ date: '2026-10-19', start: '17:45', end: '18:45', title: 'Mathe: Integral', kind: 'study', auto: true }]
  })
  const mo = p.days[0]
  assert.deepEqual(mo.blocks.filter((b) => b.kind === 'study').map((b) => b.title), ['Mathe: Integral'])
  assert.deepEqual(routineList(mo).slice(4), ['19:00-21:00 Arbeiten'])
})
