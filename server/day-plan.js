// ===========================================================================
// Tagesplan: setzt für heute und die nächsten Tage zusammen, wann Lauri
// aufsteht, Unterricht hat, trainiert, lernt und schlafen geht – und warnt,
// wenn ein Termin die Routine sprengt.
//
// Quellen (alle als Eingabe, damit die Funktion ohne Netz testbar bleibt):
//   - Stundenplan (lessonsOn) und Vertretungsplan (Entfall, Unterrichtsfrei)
//   - eigene Kalender (Familienkalender nur mit „Lauri“ im Titel)
//   - WHOOP-Schlafbedarf und Recovery (sleepNeed aus whoop-coach.js)
//   - Klausurplan und Lernblöcke
//
// Lernblöcke (Schnittstelle für den Klausur-Lernplan): data/study-blocks.json
//   [{ "date": "2026-10-19", "start": "16:00", "end": "17:30",
//      "title": "Mathe: Analysis", "kind": "study" }]
// kind darf auch "work" sein (Arbeit). Sie erscheinen als Blöcke im Plan und
// werden bei den Kollisions-Warnern mitgeprüft.
//
// Zeiten sind Minuten ab Mitternacht des jeweiligen Tages (Europe/Berlin);
// Schlaf nach Mitternacht liegt über 1440.
// ===========================================================================

import { MORNING, SCHOOL_BREAKS } from './stundenplan-config.js'
import { countsForPlanning } from './calendar-priority.js'
import { routineFor } from './week-routine.js'

const TZ = 'Europe/Berlin'
const DAY = 1440
const H = 60
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

// Ohne Stundenplan-Daten gilt die übliche 1. Stunde.
const DEFAULT_FIRST = 7 * H + 40
const MORNING_MIN = MORNING.routineMin + MORNING.commuteMin
// An freien Tagen höchstens 2 h später aufstehen als an Schultagen (vor
// einem Schultag 1,5 h – Lauri: am Wochenende gegen 8–9 Uhr) – sonst kippt
// der Rhythmus bis Montag.
const FREE_LATER = 2 * H
const FREE_LATER_BEFORE_SCHOOL = 1.5 * H
// Frühestens so zu Bett – alles davor ist Theorie.
const EARLIEST_BED = 20 * H + 30
const DEFAULT_NEED_MS = 8 * 3600000

export function clock(min) {
  const m = ((Math.round(min) % DAY) + DAY) % DAY
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}
const durText = (min) => {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`
}

// ISO-Zeitpunkt → Berliner Datum + Minuten
function local(iso) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(iso))
  const g = (t) => p.find((x) => x.type === t)?.value
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: Number(g('hour')) * 60 + Number(g('minute')) }
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const weekdayOf = (dateStr) => WEEKDAYS[new Date(`${dateStr}T12:00:00Z`).getUTCDay()]
const deDate = (dateStr) => dateStr.split('-').reverse().join('.')
const overlap = (a, b) => a.start < b.end && b.start < a.end

// ---- Termine einordnen --------------------------------------------------------
const GYM = /training|gym|workout|kraft|oberkörper|unterkörper|push|pull|legs?\b/i
const REST = /restday|rest day|ruhetag/i
const WORK = /arbeit|schicht|job\b|minijob/i
const NO_SCHOOL = /ferien|unterrichtsfrei|feiertag|brückentag|beweglicher ferientag/i
const WEEK_MARK = /^[AB]-Woche\b/i
const EXAM = /klausur|prüfung|klassenarbeit/i

export function eventKind(ev) {
  const cal = ev.calendar || ''
  if (/gym|training/i.test(cal) || GYM.test(ev.title)) return REST.test(ev.title) ? 'rest' : 'gym'
  if (/arbeit/i.test(cal) || WORK.test(ev.title)) return 'work'
  return 'event'
}

// Vertretungsplan: welche Stunden entfallen an diesem Tag?
// Das Portal zeigt die ganze Stufe („12 Q“) – ein Eintrag gilt nur, wenn
// Lehrerkürzel oder Kurs zu Lauris Stunde passen (z. B. Entfall „d05/BGT“
// betrifft ihn nicht, er hat Deutsch d06 bei KER). Ohne beides: zählt.
const CANCEL = /entfall|ausfall|fällt|eva\b|selbststudium|freisetzung/i
const norm = (v) => String(v ?? '').trim().toLowerCase()
export function entryMatchesLesson(entry, lesson) {
  const teachers = [...String(entry.teacher ?? '').matchAll(/\(([^)]+)\)/g)].map((m) => norm(m[1]))
  if (!teachers.length && entry.teacher) teachers.push(norm(entry.teacher))
  const subjects = [entry.subject, entry.subjectOld].map(norm).filter(Boolean)
  if (!teachers.length && !subjects.length) return true
  const own = norm(lesson.teacher).split('/').filter(Boolean)
  if (teachers.some((t) => own.includes(t))) return true
  return subjects.includes(norm(lesson.course))
}
function cancelledPeriods(subDay, lessons) {
  const out = new Map() // period → Grund
  if (!subDay) return out
  for (const e of subDay.entries ?? []) {
    if (!CANCEL.test(e.kind ?? '')) continue
    // „8 - 9“ oder „8“
    const nums = String(e.lesson ?? '').match(/\d+/g)?.map(Number) ?? []
    const [a, b = a] = nums
    for (let p = a; p <= b; p++) {
      const lesson = lessons.find((l) => l.period === p && l.type === 'lesson')
      if (lesson && entryMatchesLesson(e, lesson)) out.set(p, e.kind)
    }
  }
  // Tagesinfo „Unterrichtsfrei“ – mit Zahl: ab dieser Stunde frei.
  for (const info of subDay.infos ?? []) {
    const text = [info.title, ...(info.lines ?? [])].join(' ')
    if (!/unterrichtsfrei/i.test(text)) continue
    const n = Number(/(\d+)\s*\.?\s*(?:Std|Stunde)/i.exec(text)?.[1] ?? NaN)
    for (const l of lessons) if (Number.isNaN(n) || l.period > n) out.set(l.period, 'Unterrichtsfrei')
  }
  return out
}

/** Stunden → Blöcke (Doppelstunden zusammengefasst, Entfall getrennt). */
function lessonBlocks(lessons, cancelled) {
  const out = []
  for (const l of lessons) {
    if (!l.start || !l.end) continue
    if (l.type === 'break') {
      if (l.subject) out.push({ kind: 'break', title: l.subject, start: toMin(l.start), end: toMin(l.end), from: l.period, to: l.period })
      continue
    }
    if (l.type !== 'lesson') continue
    const isOff = cancelled.has(l.period)
    const kind = isOff ? 'cancelled' : 'school'
    const prev = out[out.length - 1]
    if (prev && prev.kind === kind && prev.subject === l.subject && prev.to + 1 === l.period) {
      prev.end = toMin(l.end)
      prev.to = l.period
      continue
    }
    out.push({
      kind,
      title: isOff ? `${l.subject ?? 'Unterricht'} entfällt` : l.subject ?? 'Unterricht',
      subject: l.subject ?? 'Unterricht',
      room: l.room ?? '',
      start: toMin(l.start),
      end: toMin(l.end),
      from: l.period,
      to: l.period
    })
  }
  // Pausen nur zwischen echtem Unterricht anzeigen.
  const real = out.filter((b) => b.kind === 'school')
  const first = real[0]?.start ?? Infinity
  const last = real[real.length - 1]?.end ?? -Infinity
  return out.filter((b) => b.kind !== 'break' || (b.start >= first && b.end <= last))
}

const periodsText = (b) => (b.from === b.to ? `${b.from}. Std.` : `${b.from}.–${b.to}. Std.`)

/**
 * @param {object} input
 * @param {Date}     [input.now]
 * @param {number}   [input.days]          wie viele Tage (inkl. heute)
 * @param {Function} input.lessonsOn       (YYYY-MM-DD) → { week, lessons } | null
 * @param {Array}    [input.events]        Kalendertermine (fetchCalendarOccurrences)
 * @param {object}   [input.substitutions] /api/substitutions
 * @param {object}   [input.sleep]         sleepNeed() aus whoop-coach.js
 * @param {Array}    [input.exams]         [{ date, subject, kind }]
 * @param {Array}    [input.studyBlocks]   [{ date, start, end, title, kind }]
 * @param {object}   [input.routine]       ROUTINE aus week-routine.js (null = ohne Routine)
 * @param {boolean}  [input.routineStudyAsWindow] Lernzeit der Routine als freies Fenster (für den Klausur-Lernplan)
 */
export function buildDayPlan({
  now = new Date(),
  days = 8,
  lessonsOn,
  events = [],
  substitutions = null,
  sleep = null,
  exams = [],
  studyBlocks = [],
  routine = null,
  routineStudyAsWindow = false
}) {
  const here = local(now.toISOString())
  const today = here.date
  // Veraltete Kalender (z. B. „Gym Trainingsplan“) ersetzt die Routine.
  const own = events.filter(countsForPlanning).filter((e) => !routine?.ignoreCalendars?.test(e.calendar ?? ''))
  const ignored = events.length - events.filter(countsForPlanning).length
  const eff = sleep?.efficiency ?? 0.9
  const subFor = (d) => substitutions?.days?.find((x) => x.date === deDate(d)) ?? null

  // ---- 1. Tagesgerüst: Unterricht, Entfall, Ferien ----------------------------
  function frame(d) {
    const allDay = own.filter((e) => e.allDay && local(e.start).date <= d && d < (e.end ? local(e.end).date : addDays(local(e.start).date, 1)))
    const breakName =
      SCHOOL_BREAKS.find((b) => b.from <= d && d <= b.to)?.name ??
      allDay.find((e) => NO_SCHOOL.test(e.title))?.title.trim() ??
      null
    const sched = breakName ? null : lessonsOn?.(d) ?? null
    const lessons = sched?.lessons ?? []
    const cancelled = cancelledPeriods(subFor(d), lessons)
    const blocks = lessonBlocks(lessons, cancelled)
    const all = blocks.filter((b) => b.kind === 'school' || b.kind === 'cancelled')
    const real = blocks.filter((b) => b.kind === 'school')
    return {
      date: d,
      week: sched?.week ?? null,
      breakName,
      allDay,
      lessonBlocks: blocks,
      hasPlan: all.length > 0,
      regFirst: all[0]?.start ?? null,
      regLast: all[all.length - 1]?.end ?? null,
      first: real[0]?.start ?? null,
      last: real[real.length - 1]?.end ?? null,
      cancelled
    }
  }

  const frames = []
  for (let i = 0; i <= days; i++) frames.push(frame(addDays(today, i)))
  const regularWake = (frames.find((f) => f.regFirst != null)?.regFirst ?? DEFAULT_FIRST) - MORNING_MIN

  const examSoon = (d, within) =>
    exams.find((e) => {
      const n = daysBetween(d, e.date)
      return n >= 0 && n <= within
    }) ?? null
  const studyOn = (d) =>
    studyBlocks
      .filter((b) => b.date === d && b.start && b.end)
      .map((b) => ({ kind: b.kind === 'work' ? 'work' : 'study', title: b.title || 'Lernen', start: toMin(b.start), end: toMin(b.end), source: 'plan' }))

  // ---- 2. Weckzeit je Tag, inkl. Entfall-Entscheidung ---------------------------
  function wakeFor(f, i) {
    if (f.first != null) {
      const regWake = f.regFirst - MORNING_MIN
      const gained = f.first - f.regFirst
      if (gained < 45) return { wake: f.first - MORNING_MIN, why: `1. Stunde ${clock(f.first)}`, late: null }
      // Erste Stunden fallen aus: länger schlafen oder die Zeit nutzen?
      const late = lateStartAdvice(f, i, gained)
      const wake = late.choice === 'study' ? regWake : f.first - MORNING_MIN
      return { wake, why: late.choice === 'study' ? `früh lernen, Unterricht ab ${clock(f.first)}` : `Unterricht erst ab ${clock(f.first)}`, late }
    }
    // Frei (Wochenende, Ferien oder alles entfällt).
    const next = frames.slice(i + 1).find((x) => x.first != null)
    const beforeSchool = next && next.date === addDays(f.date, 1)
    return {
      wake: regularWake + (beforeSchool ? FREE_LATER_BEFORE_SCHOOL : FREE_LATER),
      why: beforeSchool ? 'morgen ist Schule – Rhythmus halten' : 'freier Tag, Rhythmus halten',
      late: null
    }
  }

  function lateStartAdvice(f, i, gained) {
    const rec = sleep?.recovery ?? null
    const deficit = (sleep?.deficitMs ?? 0) / 60000
    const exam = examSoon(f.date, 4)
    const planned = studyOn(f.date).length > 0
    const cancelledText = f.lessonBlocks.filter((b) => b.kind === 'cancelled' && b.end <= f.first).map(periodsText).join(', ')
    const base = { gainedMin: gained, from: clock(f.regFirst), to: clock(f.first), periods: cancelledText }
    // Für Tage nach morgen gibt es noch keine Recovery – Entscheidung am Vorabend.
    if (i > 1 || rec == null) {
      return {
        ...base,
        choice: exam ? 'study' : 'sleep',
        decided: false,
        title: `${cancelledText} entfällt – Unterricht erst ab ${clock(f.first)}`,
        detail: exam
          ? `${exam.subject} am ${weekdayOf(exam.date)}: die ${durText(gained)} eher zum Lernen nutzen. Endgültig am Vorabend mit deiner Recovery.`
          : `Die Entscheidung (länger schlafen oder lernen) fällt am Vorabend mit deiner Recovery.`
      }
    }
    const tired = rec < 34 || deficit >= 60
    const choice = tired ? 'sleep' : exam || planned ? 'study' : rec < 67 || deficit >= 30 ? 'sleep' : 'study'
    const why = [`Recovery ${rec} %`, deficit >= 15 ? `${durText(deficit)} Schlafdefizit` : null, exam ? `${exam.subject} am ${weekdayOf(exam.date)}` : null]
      .filter(Boolean)
      .join(' · ')
    return {
      ...base,
      choice,
      decided: true,
      title:
        choice === 'sleep'
          ? `Länger schlafen: Aufstehen ${clock(f.first - MORNING_MIN)} statt ${clock(f.regFirst - MORNING_MIN)}`
          : `Früh aufstehen und ${durText(gained - MORNING.commuteMin)} lernen`,
      detail:
        choice === 'sleep'
          ? tired
            ? `${cancelledText} entfällt. Dein Körper braucht den Schlaf mehr als die Lernzeit (${why}).`
            : `${cancelledText} entfällt und es drängt nichts – nimm den Schlaf mit (${why}).`
          : `${cancelledText} entfällt. Du bist erholt genug – die Zeit bis ${clock(f.first)} ist ruhige Lernzeit (${why}).`,
      basis: why
    }
  }

  const wakes = frames.map((f, i) => wakeFor(f, i))

  // ---- 3. Tage zusammensetzen ----------------------------------------------------
  const out = []
  const warnings = []
  let shiftShown = false // Umstellungs-Hinweis nur am ersten betroffenen Tag
  for (let i = 0; i < days; i++) {
    const f = frames[i]
    const d = f.date
    const w = wakes[i]
    const nextWake = wakes[i + 1].wake + DAY
    const needMs = i === 0 && sleep?.tonightMs ? sleep.tonightMs : sleep?.baselineMs ?? DEFAULT_NEED_MS
    const inBed = needMs / 60000 / eff
    const bed = Math.max(EARLIEST_BED, Math.round((nextWake - inBed) / 5) * 5)
    const expectedSleep = (nextWake - bed) * eff

    const blocks = []
    // Morgen
    if (f.first != null) {
      const leave = f.first - MORNING.commuteMin
      if (w.late?.choice === 'study') {
        blocks.push({ kind: 'morning', title: 'Morgenroutine', start: w.wake, end: w.wake + MORNING.routineMin })
        blocks.push({ kind: 'study', title: 'Lernen statt Schlaf', start: w.wake + MORNING.routineMin, end: leave, source: 'entfall' })
      } else {
        blocks.push({ kind: 'morning', title: 'Morgenroutine', start: w.wake, end: leave })
      }
      blocks.push({ kind: 'commute', title: 'Schulweg', start: leave, end: f.first })
    }
    // Unterricht (Entfall nur innerhalb des Schultags oder als Hinweis davor/danach)
    for (const b of f.lessonBlocks) {
      blocks.push({
        kind: b.kind,
        title: b.title,
        start: b.start,
        end: b.end,
        info: b.kind === 'break' ? `${clock(b.start)}–${clock(b.end)}` : `${b.room ? `${b.room} · ` : ''}${periodsText(b)}`
      })
    }
    // Kalender: zeitgebundene eigene Termine an diesem Tag
    const timed = own
      .filter((e) => !e.allDay && e.end)
      .map((e) => {
        const s = local(e.start)
        const en = local(e.end)
        const start = s.date === d ? s.minutes : daysBetween(d, s.date) * DAY + s.minutes
        const end = en.date === d ? en.minutes : daysBetween(d, en.date) * DAY + en.minutes
        return { e, start, end }
      })
      .filter((x) => x.end > 0 && x.start < DAY)
      .map(({ e, start, end }) => ({ kind: eventKind(e), title: e.title.trim(), start: Math.max(0, start), end: Math.min(DAY + 6 * H, end), calendar: e.calendar, source: 'calendar' }))
    // Wochenroutine: Gym, Essen, Lernen, Arbeit – Kalendertermine haben Vorrang.
    let routineBlocks = []
    if (routine) {
      const nextExam = exams.filter((e) => {
        const n = daysBetween(d, e.date)
        return n >= 1 && n <= (routine.exam?.withinDays ?? 5)
      }).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
      routineBlocks = routineFor({
        routine,
        weekday: weekdayOf(d),
        week: f.week,
        schoolEnd: f.last,
        wake: w.wake,
        bed,
        exam: nextExam,
        examTomorrow: exams.some((e) => e.date === addDays(d, 1)),
        hasOwnPlan: studyBlocks.some((b) => b.date === d && !b.auto),
        planned: studyBlocks.filter((b) => b.date === d && b.auto && b.start && b.end).map((b) => ({ start: toMin(b.start), end: toMin(b.end) })),
        studyAsWindow: routineStudyAsWindow,
        hasGym: timed.some((b) => b.kind === 'gym'),
        busy: [...timed.filter((b) => b.kind !== 'rest'), ...studyOn(d)],
        homeMin: MORNING.commuteMin
      })
    }
    if (f.last != null) blocks.push({ kind: 'commute', title: 'Heimweg', start: f.last, end: f.last + MORNING.commuteMin })

    blocks.push(...timed)
    blocks.push(...routineBlocks)
    blocks.push(...studyOn(d))

    // Schlaf: Rest der letzten Nacht und die kommende Nacht
    blocks.push({ kind: 'sleep', title: 'Schlaf', start: 0, end: w.wake, info: `Aufstehen ${clock(w.wake)}` })
    blocks.push({ kind: 'sleep', title: 'Schlaf', start: bed, end: nextWake, info: `Ziel ${durText(needMs / 60000)} · Wecker ${clock(nextWake)}` })

    // Freie Zeit: Lücken zwischen Aufstehen und Schlafenszeit. Innerhalb des
    // Schultags heißen kurze Lücken „Pause“, lange „Freistunde“. Entfall
    // blockiert nichts – er liegt nur als Markierung im Plan.
    const busy = blocks.filter((b) => b.kind !== 'sleep' && b.kind !== 'cancelled').sort((a, b) => a.start - b.start)
    let cursor = w.wake
    const free = []
    const gap = (start, end) => {
      const inSchool = f.first != null && start >= f.first && end <= f.last
      if (inSchool) free.push(end - start >= 45 ? { kind: 'free', title: 'Freistunde', start, end } : { kind: 'break', title: 'Pause', start, end })
      else free.push({ kind: 'free', title: 'Frei', start, end })
    }
    for (const b of busy) {
      if (b.start - cursor >= 10) gap(cursor, b.start)
      cursor = Math.max(cursor, b.end)
    }
    if (bed - cursor >= 15) gap(cursor, bed)
    blocks.push(...free)
    blocks.sort((a, b) => a.start - b.start || (a.kind === 'sleep' ? -1 : 1))

    // ---- Hinweise und Warner ---------------------------------------------------
    const notes = []
    const dayWarn = []
    const label = i === 0 ? 'Heute' : i === 1 ? 'Morgen' : weekdayOf(d)
    const warn = (text, extra = {}) => dayWarn.push({ date: d, label, inDays: i, level: i <= 2 ? 'soon' : 'ahead', text, ...extra })

    // Umstellung vom Ferienrhythmus: Schlafenszeit liegt weit vor der gewohnten.
    const habit = sleep?.habitualBedMin ?? null
    if (habit != null && !shiftShown && i <= 3 && habit - bed >= 90) {
      shiftShown = true
      notes.push({
        kind: 'shift',
        title: `Rhythmus umstellen: ${clock(bed)} statt gewohnt ${clock(habit)}`,
        detail: `Zuletzt bist du meist gegen ${clock(habit)} eingeschlafen. Der Hebel ist der Wecker, nicht das Bett: ${clock(nextWake)} aufstehen, gleich Tageslicht, kein Koffein nach 14 Uhr – dann wirst du jeden Abend früher müde. Kommst du nicht zur Ruhe, lieber wach lesen als wälzen.`
      })
    }
    if (w.late) notes.push({ kind: w.late.choice === 'sleep' ? 'sleep-in' : 'study-early', ...w.late })
    if (f.last != null && f.regLast != null && f.regLast - f.last >= 45) {
      const gym = [...timed, ...routineBlocks].find((b) => b.kind === 'gym' && b.start >= f.last)
      const home = f.last + MORNING.commuteMin
      const cancelledText = f.lessonBlocks.filter((b) => b.kind === 'cancelled' && b.start >= f.last).map(periodsText).join(', ')
      notes.push({
        kind: 'early-end',
        title: `Früher Schluss: ${clock(f.last)} statt ${clock(f.regLast)}`,
        detail: gym?.source === 'routine'
          ? `${cancelledText} entfällt. ${gym.title} rutscht mit nach vorn (ab ${clock(gym.start)}) – danach bleibt mehr Abend zum Lernen.`
          : gym
          ? `${cancelledText} entfällt. ${gym.title} kann von ${clock(gym.start)} auf ab ${clock(home + 30)} vorrutschen – danach bleibt mehr Abend zum Lernen.`
          : `${cancelledText} entfällt. ${durText(f.regLast - f.last)} mehr Nachmittag – Lernen oder Training können nach vorn rutschen.`
      })
    }
    if (f.hasPlan && f.first == null) {
      notes.push({ kind: 'no-school', title: 'Heute fällt der ganze Unterricht aus', detail: 'Rhythmus trotzdem halten: Aufstehen wie an freien Tagen, Zeit fürs Lernen nutzen.' })
    }
    // Freistunden mitten am Tag
    for (const b of f.lessonBlocks) {
      if (b.kind === 'cancelled' && f.first != null && b.start > f.first && b.end < f.last) {
        notes.push({ kind: 'gap', title: `Freistunde ${clock(b.start)}–${clock(b.end)}`, detail: `${periodsText(b)} entfällt – gute Lücke für Hausaufgaben oder Vokabeln.` })
      }
    }

    const school = f.first != null ? { start: f.first - MORNING.commuteMin, end: f.last + MORNING.commuteMin } : null
    const gyms = [...timed, ...routineBlocks].filter((b) => b.kind === 'gym')
    const studies = blocks.filter((b) => b.kind === 'study')
    for (const ev of timed.filter((b) => b.kind !== 'gym')) {
      const when = `${clock(ev.start)}–${clock(ev.end)}`
      if (school && overlap(ev, school)) {
        warn(`„${ev.title}“ (${when}) liegt in der Schulzeit – Unterricht bis ${clock(f.last)}, plus Heimweg.`, { with: 'school', event: ev.title })
      }
      for (const g of gyms) {
        if (overlap(ev, g)) warn(`„${ev.title}“ (${when}) kollidiert mit ${g.title} (${clock(g.start)}–${clock(g.end)}) – Training verschieben?`, { with: 'gym', event: ev.title })
      }
      for (const s of studies) {
        if (overlap(ev, s)) warn(`„${ev.title}“ (${when}) frisst Lernzeit (${s.title}, ${clock(s.start)}–${clock(s.end)}).`, { with: 'study', event: ev.title })
      }
      if (ev.end > bed) warn(`„${ev.title}“ endet um ${clock(ev.end)} – nach deiner Schlafenszeit ${clock(bed)}.`, { with: 'sleep', event: ev.title })
    }
    for (const g of gyms) {
      if (school && g.source !== 'routine' && overlap(g, school)) warn(`${g.title} (${clock(g.start)}) beginnt vor Schulschluss + Heimweg (${clock(school.end)}).`, { with: 'school', event: g.title })
      if (g.end > bed) warn(`${g.title} endet um ${clock(g.end)} – nach deiner Schlafenszeit ${clock(bed)}.`, { with: 'sleep', event: g.title })
    }
    // Hartes Training am Abend vor einer Klausur
    const examTomorrow = exams.find((e) => e.date === addDays(d, 1))
    if (examTomorrow && gyms.length) {
      warn(`Morgen ${examTomorrow.subject} – ${gyms[0].title} heute eher locker halten oder verschieben.`, { with: 'exam', event: gyms[0].title })
    }
    warnings.push(...dayWarn)

    const chips = [
      ...f.allDay
        .filter((e) => !WEEK_MARK.test(e.title.trim()) && !NO_SCHOOL.test(e.title))
        // Klausuren kommen aus dem Klausurplan, sonst stünden sie doppelt da.
        .filter((e) => !(EXAM.test(e.title) && exams.some((x) => x.date === d)))
        .map((e) => ({ kind: EXAM.test(e.title) ? 'exam' : eventKind(e), title: e.title.trim() })),
      ...exams.filter((e) => e.date === d).map((e) => ({ kind: 'exam', title: `Klausur ${e.subject}${e.kind ? ` (${e.kind})` : ''}` }))
    ]

    out.push({
      date: d,
      label,
      weekday: weekdayOf(d),
      inDays: i,
      week: f.week,
      schoolDay: f.first != null,
      breakName: f.breakName,
      wake: { time: clock(w.wake), min: w.wake, why: w.why },
      bedtime: {
        time: clock(bed),
        min: bed,
        sleepTargetMs: Math.round(needMs),
        expectedSleepMs: Math.round(expectedSleep * 60000),
        nextWake: clock(nextWake)
      },
      school: f.first != null ? { start: clock(f.first), end: clock(f.last), regularStart: clock(f.regFirst), regularEnd: clock(f.regLast) } : null,
      blocks: blocks.map((b) => ({ ...b, startTime: clock(b.start), endTime: clock(b.end) })),
      chips,
      notes,
      warnings: dayWarn
    })
  }

  return {
    generatedAt: now.toISOString(),
    today,
    nowMin: here.minutes,
    morning: { ...MORNING, regularWake: clock(regularWake) },
    ignoredFamilyEvents: ignored,
    days: out,
    warnings
  }
}

/** Weckzeit nach jetzt – für das Schlaf-Coaching („bis wann ins Bett?“). */
export function nextWake(plan) {
  if (!plan?.days?.length) return null
  const [d0, d1] = plan.days
  // Vor dem Aufstehen heute zählt noch die heutige Weckzeit.
  const day = plan.nowMin < d0.wake.min ? d0 : d1 ?? d0
  return { minutes: day.wake.min, kind: day.schoolDay ? 'Schultag' : day.weekday, date: day.date }
}
