// ===========================================================================
// Erholungs-Coach: leitet aus dem WHOOP-Verlauf (und dem Kalender) konkrete
// Empfehlungen für heute ab – plus EINEN Satz, was heute besser laufen kann
// als gestern. Bewusst regelbasiert statt KI: jede Empfehlung nennt die Werte,
// auf denen sie beruht, und ist damit nachprüfbar.
//
// Grundlage sind WHOOPs eigene Schwellen (Recovery grün ≥ 67, gelb 34–66,
// rot ≤ 33; Strain-Skala 0–21) und allgemein anerkannte Schlafhygiene.
// Keine medizinische Beratung.
// ===========================================================================

const TZ = 'Europe/Berlin'
const H = 3600000

// ---- Zeit-Helfer (immer in deutscher Ortszeit, der Container läuft in UTC) --
function localParts(iso) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23'
  }).formatToParts(new Date(iso))
  const get = (t) => parts.find((p) => p.type === t)?.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: get('weekday')
  }
}

export function clock(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function dur(ms) {
  const min = Math.round(Math.abs(ms) / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h}h ${String(m).padStart(2, '0')}`
}

// Zubettgeh-Zeiten liegen um Mitternacht – für Mittelwerte ab 18 Uhr zählen,
// sonst wäre der Schnitt aus 23:30 und 00:30 fälschlich 12:00.
const bedMinutes = (iso) => (localParts(iso).minutes - 18 * 60 + 1440) % 1440
const fromBedMinutes = (m) => m + 18 * 60

function median(arr) {
  const a = arr.filter((v) => v != null && !Number.isNaN(v)).sort((x, y) => x - y)
  if (!a.length) return null
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

const avg = (arr) => {
  const a = arr.filter((v) => v != null)
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
}

const isWeekend = (wd) => wd === 'Sat' || wd === 'Sun'
const fmt1 = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

// Prüfungen/Klausuren aus dem Kalender erkennen.
const EXAM = /klausur|prüfung|test\b|klassenarbeit|abitur|abi\b|theorieprüfung|referat|präsentation/i

/**
 * @param {object} input
 * @param {Array}  input.days     WHOOP-Zyklen, neueste zuerst (fetchWhoopHistory().days)
 * @param {Array}  [input.events] Kalendertermine ({ title, start, allDay })
 * @param {Date}   [input.now]
 * @param {object} [input.wake]   Weckzeit für morgen aus dem Tagesplan
 *                                ({ minutes, kind }) – an Schultagen aus dem
 *                                Stundenplan statt aus dem bisherigen Rhythmus.
 */
export function buildCoaching({ days, events = [], now = new Date(), wake = null }) {
  const today = days[0]
  const yesterday = days[1] ?? null
  if (!today) return { focus: null, recommendations: [], plan: null }

  const nights = days.filter((d) => d.sleep)
  const last = today.sleep
  const prev = yesterday?.sleep ?? null
  const rec = today.recovery
  const prevRec = yesterday?.recovery ?? null
  const window7 = days.slice(1, 8) // Vergleichsbasis ohne heute

  const base = {
    hrv: median(window7.map((d) => d.recovery?.hrv)),
    rhr: median(window7.map((d) => d.recovery?.restingHr)),
    resp: median(window7.map((d) => d.sleep?.respiratoryRate)),
    bed: median(nights.slice(1, 8).map((d) => bedMinutes(d.sleep.bedtime))),
    eff: avg(nights.slice(0, 7).map((d) => d.sleep.efficiency))
  }

  // ---- Plan für heute Nacht ------------------------------------------------
  // Aufwachzeit morgen: Median der letzten Schultage bzw. Wochenenden. Am
  // Wochenende höchstens 2 h später als an Schultagen – mehr "Social Jetlag"
  // verschiebt die innere Uhr und macht den Montag schwer.
  const nowParts = localParts(now.toISOString())
  const tomorrow = localParts(new Date(now.getTime() + 24 * H).toISOString())
  const wakeMin = (d) => localParts(d.sleep.wake).minutes
  const schoolNights = nights.filter((d) => !isWeekend(localParts(d.sleep.wake).weekday)).slice(0, 8)
  const weekendNights = nights.filter((d) => isWeekend(localParts(d.sleep.wake).weekday)).slice(0, 6)
  const schoolWake = median(schoolNights.map(wakeMin))
  const schoolBed = median(schoolNights.map((d) => bedMinutes(d.sleep.bedtime)))
  const weekendTomorrow = isWeekend(tomorrow.weekday)
  let wakeTarget = weekendTomorrow ? median(weekendNights.map(wakeMin)) : schoolWake
  if (weekendTomorrow && schoolWake != null) {
    wakeTarget = Math.min(wakeTarget ?? Infinity, schoolWake + 120)
  }
  wakeTarget ??= median(nights.slice(0, 8).map(wakeMin))
  if (wake?.minutes != null) wakeTarget = wake.minutes

  // Schlafbedarf: WHOOP-Grundbedarf + das, was letzte Nacht zum Bedarf fehlte
  // (höchstens 1 h auf einmal nachholen – realistischer als alles in einer Nacht).
  let plan = null
  if (last?.need && wakeTarget != null) {
    const needLast = last.need.baselineMs + last.need.debtMs + last.need.strainMs + last.need.napMs
    const deficit = Math.max(0, needLast - last.durationMs)
    const targetSleep = last.need.baselineMs + Math.min(deficit, H)
    const eff = (base.eff ?? 90) / 100
    // Zubettgehen in "Minuten ab 18 Uhr", damit Mitternacht kein Sprung ist.
    const wakeRel = wakeTarget + 24 * 60 - 18 * 60
    let bedRel = wakeRel - targetSleep / eff / 60000
    // Nicht mehr als 1 h von der gewohnten Schulnacht-Zeit abweichen – eine
    // Empfehlung, die man nicht einhalten kann, hilft nicht. Steht die
    // Weckzeit aber fest (Schule), zählt der Bedarf: dann ehrlich früher.
    if (schoolBed != null && wake?.minutes == null) bedRel = Math.min(Math.max(bedRel, schoolBed - 60), schoolBed + 60)
    // Mit Tagesplan-Weckzeit auf 5 min runden wie dort – sonst 22:05 vs. 22:06.
    if (wake?.minutes != null) bedRel = Math.round(bedRel / 5) * 5
    const expectedSleep = (wakeRel - bedRel) * 60000 * eff
    plan = {
      wake: clock(wakeTarget),
      wakeKind: wake?.kind ?? (weekendTomorrow ? 'Wochenende' : 'Schultag'),
      sleepTargetMs: Math.round(targetSleep),
      expectedSleepMs: Math.round(expectedSleep),
      bedtime: clock(fromBedMinutes(bedRel)),
      deficitMs: Math.round(deficit)
    }
  }

  // Termine heute/morgen mit Prüfungscharakter.
  const dayOf = (e) => localParts(e.start).date
  const examTomorrow = events.find((e) => EXAM.test(e.title) && dayOf(e) === tomorrow.date)
  const examToday = events.find((e) => EXAM.test(e.title) && dayOf(e) === nowParts.date)

  const recs = []
  const add = (r) => recs.push(r)

  // ---- 1. Belastung nach Recovery-Zone ---------------------------------------
  if (rec) {
    const yStrain = yesterday?.strain ?? null
    const heavyYesterday = yStrain != null && yStrain >= 15
    let title, detail, target
    if (rec.score >= 67) {
      target = heavyYesterday ? '12–14' : '14–17'
      title = heavyYesterday ? 'Training ja – aber nicht noch mal Vollgas' : 'Guter Tag für hartes Training'
      detail = heavyYesterday
        ? `Recovery ${rec.score} % ist grün, gestern lag der Strain aber schon bei ${fmt1(yStrain)}. Ziel-Strain heute ${target}.`
        : `Recovery ${rec.score} % ist grün – dein Körper verkraftet heute Intervalle oder schweres Krafttraining. Ziel-Strain ${target}.`
    } else if (rec.score >= 34) {
      target = '8–12'
      title = 'Moderat trainieren'
      detail = `Recovery ${rec.score} % ist gelb. Locker laufen, Technik oder Zone-2-Cardio statt Maximalbelastung. Ziel-Strain ${target}.`
    } else {
      target = 'unter 8'
      title = 'Aktive Erholung statt Training'
      detail = `Recovery ${rec.score} % ist rot. Spaziergang, Mobility oder Dehnen – hartes Training würde die Erholung weiter drücken. Ziel-Strain ${target}.`
    }
    add({ id: 'load', kind: 'training', title, detail, basis: `Recovery ${rec.score} %` + (yStrain != null ? ` · Strain gestern ${fmt1(yStrain)}` : '') })
  }

  // ---- 2. Training von gestern verarbeiten -----------------------------------
  const yWorkouts = yesterday?.workouts ?? []
  const hardWorkout = yWorkouts.find((w) => (w.strain ?? 0) >= 12)
  if (hardWorkout) {
    add({
      id: 'refuel',
      kind: 'training',
      title: 'Nach dem Training von gestern auftanken',
      detail: `${hardWorkout.sport} mit Strain ${fmt1(hardWorkout.strain)}: über den Tag verteilt eiweißreich essen, genug trinken und 10 Minuten Mobility für die beanspruchten Muskeln.`,
      basis: `${hardWorkout.sport} · Strain ${fmt1(hardWorkout.strain)}`
    })
  }

  // ---- 3. Zubettgehzeit / Schlafschuld --------------------------------------
  if (plan) {
    const reason = examTomorrow
      ? `Morgen steht „${examTomorrow.title}“ an – Schlaf ist die beste Vorbereitung.`
      : plan.deficitMs >= 30 * 60000
        ? `Letzte Nacht fehlten dir ${dur(plan.deficitMs)} zum Schlafbedarf.`
        : `So erreichst du deinen Schlafbedarf.`
    add({
      id: 'bedtime',
      kind: 'sleep',
      title: `Spätestens ${plan.bedtime} ins Bett`,
      detail:
        plan.expectedSleepMs >= plan.sleepTargetMs - 10 * 60000
          ? `${reason} Ziel: ${dur(plan.sleepTargetMs)} Schlaf bis ${plan.wake} (Aufwachen am ${plan.wakeKind}).`
          : `${reason} Mit Aufstehen um ${plan.wake} (${plan.wakeKind}) kommst du so auf etwa ${dur(plan.expectedSleepMs)} – voller Bedarf wären ${dur(plan.sleepTargetMs)}.`,
      basis: `Grundbedarf ${dur(last.need.baselineMs)} · Effizienz ⌀ ${Math.round(base.eff ?? 90)} %`
    })
  }

  // ---- 4. Rhythmus (Konstanz) -----------------------------------------------
  if (last?.consistency != null && last.consistency < 70 && base.bed != null) {
    const lastBed = bedMinutes(last.bedtime)
    add({
      id: 'rhythm',
      kind: 'sleep',
      title: 'Gleichmäßiger Rhythmus',
      detail: `Deine Schlafkonstanz liegt bei ${last.consistency} %. Letzte Nacht ${clock(fromBedMinutes(lastBed))} ins Bett, sonst meist gegen ${clock(fromBedMinutes(base.bed))}. Feste Zeiten (± 30 min, auch am Wochenende) steigern Recovery nachweislich.`,
      basis: `Konstanz ${last.consistency} %`
    })
  }

  // ---- 5. Stresssignale: HRV runter / Ruhepuls hoch / Atemfrequenz -----------
  if (rec && base.hrv && base.rhr) {
    const hrvDrop = (base.hrv - rec.hrv) / base.hrv
    const rhrUp = rec.restingHr - base.rhr
    if (hrvDrop >= 0.15 || rhrUp >= 5) {
      add({
        id: 'stress',
        kind: 'body',
        title: 'Körper steht unter Stress',
        detail: `HRV ${Math.round(rec.hrv)} ms (sonst ${Math.round(base.hrv)}), Ruhepuls ${Math.round(rec.restingHr)} (sonst ${Math.round(base.rhr)}). Viel Wasser, keine späten schweren Mahlzeiten, kein Koffein nach 14 Uhr, abends bewusst runterfahren.`,
        basis: 'HRV/Ruhepuls vs. 7-Tage-Median'
      })
    }
  }
  if (last?.respiratoryRate && base.resp && last.respiratoryRate - base.resp >= 1) {
    add({
      id: 'resp',
      kind: 'body',
      title: 'Atemfrequenz erhöht',
      detail: `${fmt1(last.respiratoryRate)} statt sonst ${fmt1(base.resp)} Atemzüge/min – das kann auf einen beginnenden Infekt hindeuten. Heute ruhig angehen und auf dich hören.`,
      basis: 'Atemfrequenz vs. 7-Tage-Median'
    })
  }

  // ---- 6. Schlafqualität ------------------------------------------------------
  if (last && (last.efficiency < 85 || last.disturbances >= 20 || last.awakeMs >= H)) {
    add({
      id: 'quality',
      kind: 'sleep',
      title: 'Ruhiger durchschlafen',
      detail: `${last.disturbances} Aufwacher und ${dur(last.awakeMs)} wach im Bett. Zimmer dunkel und kühl (ca. 18 °C), Handy 30 min vorher weg, 2–3 h vor dem Schlafen nichts Schweres essen.`,
      basis: `Effizienz ${Math.round(last.efficiency)} % · ${last.disturbances} Aufwacher`
    })
  }

  // ---- 7. Spätes Zubettgehen → Licht & Koffein -------------------------------
  if (last && bedMinutes(last.bedtime) >= 6 * 60 + 30) {
    add({
      id: 'late',
      kind: 'sleep',
      title: 'Früher müde werden',
      detail: `Letzte Nacht erst um ${clock(localParts(last.bedtime).minutes)} ins Bett. Morgens 10 Minuten Tageslicht, Koffein nur bis 14 Uhr und abends gedimmtes Licht verschieben die innere Uhr nach vorn.`,
      basis: `Einschlafen ${clock(localParts(last.bedtime).minutes)}`
    })
  }

  // ---- 8. Prüfung heute ------------------------------------------------------
  if (examToday) {
    add({
      id: 'exam',
      kind: 'day',
      title: `Heute: ${examToday.title}`,
      detail: 'Vorher etwas essen und trinken, kurz an die frische Luft. Nach der Prüfung eher leichte Bewegung statt hartem Training.',
      basis: 'Kalender'
    })
  }

  // ---- 9. Bewegung, falls Recovery gut aber wenig los ------------------------
  if (rec && rec.score >= 34 && yesterday?.steps != null && yesterday.steps < 6000) {
    add({
      id: 'steps',
      kind: 'day',
      title: 'Mehr Alltagsbewegung',
      detail: `Gestern ${yesterday.steps.toLocaleString('de-DE')} Schritte. Ein 30-Minuten-Spaziergang (am besten bei Tageslicht) hilft Schlaf und Recovery.`,
      basis: `${yesterday.steps.toLocaleString('de-DE')} Schritte gestern`
    })
  }

  return { focus: buildFocus({ today, yesterday, last, prev, rec, prevRec, base, plan }), recommendations: recs, plan, baseline: base }
}

// Schlafbedarf für den Tagesplan – dieselbe Rechnung wie im Plan oben:
// WHOOP-Grundbedarf, für heute Nacht plus höchstens 1 h vom Defizit.
export function sleepNeed(days) {
  const last = days?.[0]?.sleep
  if (!last?.need) return null
  const needLast = last.need.baselineMs + last.need.debtMs + last.need.strainMs + last.need.napMs
  const deficitMs = Math.max(0, needLast - last.durationMs)
  const eff = avg(days.filter((d) => d.sleep).slice(0, 7).map((d) => d.sleep.efficiency)) ?? 90
  return {
    baselineMs: last.need.baselineMs,
    tonightMs: last.need.baselineMs + Math.min(deficitMs, H),
    deficitMs,
    efficiency: eff / 100,
    recovery: days[0].recovery?.score ?? null,
    // Gewohnte Einschlafzeit der letzten 5 Nächte, in Minuten ab Mitternacht
    // des Vortags (02:00 = 1560) – für den Umstellungs-Hinweis im Tagesplan.
    habitualBedMin: (() => {
      const m = median(days.filter((d) => d.sleep).slice(0, 5).map((d) => bedMinutes(d.sleep.bedtime)))
      return m == null ? null : fromBedMinutes(m)
    })()
  }
}

// ---- Der eine Satz: heute besser als gestern ---------------------------------
// Kandidaten mit Gewicht; der größte Hebel gewinnt.
function buildFocus({ yesterday, last, prev, rec, prevRec, base, plan }) {
  const c = []

  if (last && base.bed != null) {
    const lateBy = bedMinutes(last.bedtime) - base.bed
    if (lateBy >= 45) {
      c.push({
        w: lateBy / 30,
        text: `Geh heute bis ${plan?.bedtime ?? clock(fromBedMinutes(base.bed))} ins Bett – letzte Nacht warst du erst um ${clock(localParts(last.bedtime).minutes)} dort, ${dur(lateBy * 60000)} später als sonst.`
      })
    }
  }

  if (rec && prevRec && yesterday?.strain != null && rec.score < prevRec.score - 10 && yesterday.strain >= 14) {
    c.push({
      w: (prevRec.score - rec.score) / 8,
      text: `Halte den Strain heute unter ${rec.score >= 67 ? 14 : rec.score >= 34 ? 12 : 8} – nach ${fmt1(yesterday.strain)} gestern ist deine Recovery von ${prevRec.score} auf ${rec.score} % gefallen.`
    })
  }

  if (plan && plan.deficitMs >= 45 * 60000) {
    c.push({
      w: plan.deficitMs / (30 * 60000),
      text: `Plane heute ${dur(plan.sleepTargetMs)} Schlaf ein und sei um ${plan.bedtime} im Bett – letzte Nacht fehlten dir ${dur(plan.deficitMs)} zu deinem Bedarf.`
    })
  }

  if (last && prev && last.efficiency < prev.efficiency - 5) {
    c.push({
      w: (prev.efficiency - last.efficiency) / 4,
      text: `Mach heute Abend das Handy 30 Minuten vor dem Schlafen weg – deine Schlafeffizienz ist von ${Math.round(prev.efficiency)} auf ${Math.round(last.efficiency)} % gefallen.`
    })
  }

  if (last?.consistency != null && last.consistency < 50) {
    c.push({
      w: (70 - last.consistency) / 15,
      text: `Geh heute zur gleichen Zeit wie an deinen guten Tagen ins Bett (gegen ${clock(fromBedMinutes(base.bed ?? 5 * 60))}) – deine Schlafkonstanz liegt nur bei ${last.consistency} %.`
    })
  }

  if (c.length) return c.sort((a, b) => b.w - a.w)[0].text

  if (rec && prevRec && rec.score >= prevRec.score) {
    return `Wiederhol, was gestern funktioniert hat – deine Recovery ist von ${prevRec.score} auf ${rec.score} % gestiegen.`
  }
  return plan
    ? `Sei heute um ${plan.bedtime} im Bett, dann erreichst du deinen Schlafbedarf von ${dur(plan.sleepTargetMs)}.`
    : null
}
