// ===========================================================================
// Wochenroutine nach der Schule (mit Lauri abgestimmt am 17.10.2026):
//   - Gym direkt nach der Schule als Reset (Fahrrad 10 min), dann essen,
//     dann lernen, Arbeit in die Lücke danach (flexibel, hohe Priorität: Geld).
//   - Lernzeit richtet sich nach der Länge des Schultags; vor Klausuren mehr.
//   - Abends spätestens 21:00 Schluss mit Lernen und Arbeit.
//   - Wochenende: entspannt, aber produktiv – Arbeit, Training, etwas Lernen.
//     Termine aus dem Kalender (Einladungen usw.) haben immer Vorrang.
//
// Welche Einheit an welchem Tag liegt (Upper/Lower, Läufe, Arme/Schultern),
// klärt die Gym-/Ernährungs-Session – hier stehen bis dahin Platzhalter.
// Der Kalender „Gym Trainingsplan“ ist veraltet und wird ignoriert, solange
// diese Routine aktiv ist.
// ===========================================================================

export const ROUTINE = {
  ignoreCalendars: /gym trainingsplan/i,
  // Training je Woche und Wochentag (null = Ruhetag)
  training: {
    A: { Montag: 'gym', Dienstag: 'run', Mittwoch: 'arms', Donnerstag: null, Freitag: 'gym', Samstag: 'gym', Sonntag: 'run' },
    B: { Montag: 'gym', Dienstag: 'gym', Mittwoch: 'arms', Donnerstag: null, Freitag: 'run', Samstag: 'gym', Sonntag: 'run' }
  },
  sessions: {
    gym: { title: 'Gym', min: 75 },
    arms: { title: 'Gym: Arme & Schultern', min: 60 },
    run: { title: 'Laufen', min: 40 }
  },
  bikeMin: 10,
  mealMin: 30,
  // Lernzeit nach Schulschluss: bis 13:00 → 2 h, bis 15:30 → 75 min, länger → 30 min
  study: [
    { until: '13:00', min: 120 },
    { until: '15:30', min: 75 },
    { until: '24:00', min: 30 }
  ],
  // Klausur in den nächsten Tagen: mindestens so viel Lernzeit (lange Tage: 60)
  exam: { withinDays: 5, min: 120, longDayMin: 60 },
  dayEnd: '21:00',
  // Arbeit an Schultagen höchstens 3 h am Stück – danach ist Feierabend.
  workMaxMin: 180,
  minBlock: 30,
  // Freie Tage: ab Aufstehen + 1 h; Training am Nachmittag
  free: {
    startAfterWakeMin: 60,
    trainingAt: '14:30',
    Samstag: [{ kind: 'work', title: 'Arbeiten', min: 180 }],
    Sonntag: [
      { kind: 'study', title: 'Lernen', min: 90, examMin: 150 },
      { kind: 'study', title: 'Woche planen', at: '18:00', min: 15 }
    ],
    // Ferien-/freie Wochentage
    other: [{ kind: 'work', title: 'Arbeiten', min: 180 }]
  }
}

const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}
const overlap = (a, b) => a.start < b.end && b.start < a.end

/**
 * Längstes Stück von [start, end), das keinen der belegten Blöcke schneidet.
 */
function fit(start, end, busy) {
  let pieces = [{ start, end }]
  for (const b of busy) {
    pieces = pieces.flatMap((p) =>
      overlap(p, b) ? [{ start: p.start, end: b.start }, { start: b.end, end: p.end }].filter((x) => x.end > x.start) : [p]
    )
  }
  return pieces.sort((a, b) => b.end - b.start - (a.end - a.start))[0] ?? null
}

/**
 * Routine-Blöcke für einen Tag.
 * @param {object} p
 * @param {object} p.routine     ROUTINE (oder Testvariante)
 * @param {string} p.weekday     „Montag“ …
 * @param {string|null} p.week   'A' | 'B'
 * @param {number|null} p.schoolEnd  Minuten, Ende des echten Unterrichts
 * @param {number} p.wake
 * @param {number} p.bed
 * @param {object|null} p.exam        nächste Klausur innerhalb von exam.withinDays (nicht heute)
 * @param {boolean} p.examTomorrow
 * @param {boolean} p.hasOwnPlan      Lern-/Arbeitsblöcke aus study-blocks.json vorhanden
 * @param {Array}   p.planned         Blöcke des Klausur-Lernplans an diesem Tag [{start,end}]
 * @param {boolean} p.studyAsWindow   Lernzeit als freies Fenster („Lernzeit“) – darin
 *                                    verteilt der Klausur-Lernplan seine Blöcke
 * @param {boolean} p.hasGym          eigener Gym-Termin im Kalender
 * @param {Array}   p.busy            Kalendertermine [{start,end}] – haben Vorrang
 * @returns {{ blocks: Array, gymAfterSchool: boolean }}
 */
export function routineFor({ routine, weekday, week, schoolEnd, wake, bed, exam = null, examTomorrow = false, hasOwnPlan = false, planned = [], studyAsWindow = false, hasGym = false, busy = [] }) {
  const R = routine
  const out = []
  const limit = Math.min(toMin(R.dayEnd), bed - 30)
  const taken = [...busy]
  const place = (kind, title, start, min, extra = {}) => {
    if (min <= 0) return null
    const cap = kind === 'commute' ? Infinity : limit
    const need = kind === 'commute' ? 1 : Math.min(R.minBlock, min)
    // Passt es nicht, hinter den störenden Termin rutschen.
    let slot = null
    for (let s = start; s < cap; ) {
      slot = fit(s, Math.min(s + min, cap), taken)
      if (slot && slot.end - slot.start >= need) break
      slot = null
      const block = taken.filter((b) => overlap({ start: s, end: s + min }, b)).sort((a, b) => a.start - b.start)[0]
      if (!block || kind === 'commute') break
      s = block.end
    }
    if (!slot) return null
    const b = { kind, title, start: slot.start, end: slot.end, source: 'routine', ...extra }
    out.push(b)
    taken.push(b)
    return b
  }
  // Nach Feierabend nichts mehr planen (auch kein Klausur-Lernblock).
  const closeDay = () => {
    const from = toMin(R.dayEnd)
    const piece = fit(from, bed, busy)
    if (bed - from >= 30 && piece) out.push({ kind: 'break', title: 'Feierabend', start: from, end: bed, source: 'routine' })
    return out
  }
  const sessionKey = hasGym ? null : R.training[week ?? 'A']?.[weekday] ?? null
  const session = sessionKey ? R.sessions[sessionKey] : null
  const examStudy = (title) => (exam ? `Lernen: ${exam.subject}` : title)
  // Lernen: im ersten Durchgang nur ein Fenster für den Klausur-Lernplan;
  // hat der Lernplan den Tag belegt, ersetzt er das allgemeine Lernen.
  const placeStudy = (title, start, min, extra = {}) => {
    if (planned.length) return null
    return studyAsWindow ? place('free', 'Lernzeit', start, min) : place('study', title, start, min, extra)
  }
  const afterPlanned = (t) => Math.max(t, ...planned.filter((b) => b.end > t).map((b) => b.end + 15))

  // ---- Schultag ----------------------------------------------------------------
  if (schoolEnd != null) {
    let t = schoolEnd
    let gymAfterSchool = false
    if (session) {
      // Fahrrad direkt von der Schule – ersetzt den Heimweg.
      const go = place('commute', 'Zum Gym', t, R.bikeMin)
      const g = go && go.start === t ? place('gym', session.title, go.end, session.min) : null
      if (g) {
        gymAfterSchool = true
        t = place('commute', 'Heimweg', g.end, R.bikeMin)?.end ?? g.end + R.bikeMin
      } else if (go) {
        out.splice(out.indexOf(go), 1)
        taken.splice(taken.indexOf(go), 1)
      }
    }
    if (!gymAfterSchool) t = schoolEnd + 25 // normaler Heimweg (Tagesplan)
    const meal = place('break', 'Essen & Runterkommen', t, R.mealMin)
    t = meal?.end ?? t

    if (!hasOwnPlan) {
      const tier = R.study.find((s) => schoolEnd <= toMin(s.until)) ?? R.study[R.study.length - 1]
      const long = tier === R.study[R.study.length - 1]
      let min = tier.min
      if (examTomorrow) min = 60
      else if (exam) min = Math.max(min, long ? R.exam.longDayMin : R.exam.min)
      const s = placeStudy(examTomorrow ? `Wiederholen: ${exam?.subject ?? 'Klausur'}` : examStudy('Lernen'), t, min, exam ? { info: `Klausur ${exam.subject}` } : {})
      t = s ? s.end + 15 : afterPlanned(t)
      // Vor der Klausur: kein Arbeiten, früh ins Bett.
      if (!examTomorrow) {
        const w = place('work', 'Arbeiten', t, Math.min(limit - t, R.workMaxMin ?? Infinity))
        t = w ? w.end : t
      }
    }
    return { blocks: closeDay(), gymAfterSchool }
  }

  // ---- Freier Tag (Wochenende, Ferien) -------------------------------------------
  let t = wake + R.free.startAfterWakeMin
  const plan = R.free[weekday] ?? R.free.other
  if (!hasOwnPlan) {
    for (const item of plan) {
      const min = exam && item.examMin ? item.examMin : item.min
      const title = item.kind === 'study' && item.title === 'Lernen' ? examStudy('Lernen') : item.title
      const b = item.kind === 'study' && item.title === 'Lernen' ? placeStudy(title, t, min) : place(item.kind, title, item.at ? toMin(item.at) : t, min)
      if (b && !item.at) t = b.end
    }
  }
  if (session) place('gym', session.title, Math.max(toMin(R.free.trainingAt), t), session.min)
  return { blocks: closeDay(), gymAfterSchool: false }
}
