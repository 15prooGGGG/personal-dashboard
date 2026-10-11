import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCoaching, clock, dur } from './whoop-coach.js'

const H = 3600000
// Eine Nacht: Einschlafen/Aufwachen als UTC-ISO (Berlin = UTC+2 im Sommer).
function day({ bed, wake, rec = 70, hrv = 100, rhr = 55, strain = 10, eff = 92, cons = 80, sleepH = 8, steps = 9000, workouts = [], resp = 13 }) {
  return {
    start: bed,
    end: null,
    sleep: {
      bedtime: bed,
      wake,
      durationMs: sleepH * H,
      inBedMs: sleepH * H * 1.08,
      awakeMs: 0.5 * H,
      lightMs: sleepH * H * 0.5,
      deepMs: sleepH * H * 0.2,
      remMs: sleepH * H * 0.3,
      disturbances: 10,
      performance: 85,
      efficiency: eff,
      consistency: cons,
      respiratoryRate: resp,
      need: { baselineMs: 8 * H, debtMs: 0.5 * H, strainMs: 0.2 * H, napMs: 0 }
    },
    recovery: { score: rec, hrv, restingHr: rhr },
    strain,
    steps,
    workouts,
    naps: []
  }
}

// Sieben normale Nächte: 23:00 → 07:00 Ortszeit.
function history() {
  const out = []
  for (let i = 1; i <= 8; i++) {
    const d = new Date(Date.UTC(2026, 8, 25 - i, 21, 0))
    out.push(day({ bed: d.toISOString(), wake: new Date(d.getTime() + 8 * H).toISOString() }))
  }
  return out
}

test('Zeitformat', () => {
  assert.equal(clock(-30), '23:30')
  assert.equal(clock(1470), '00:30')
  assert.equal(dur(1.5 * H), '1h 30')
  assert.equal(dur(45 * 60000), '45 min')
})

test('rote Recovery nach hartem Tag → aktive Erholung + Strain-Fokus', () => {
  const past = history()
  past[0] = { ...past[0], strain: 17.5, recovery: { score: 75, hrv: 100, restingHr: 55 } }
  const today = day({
    bed: '2026-09-25T21:10:00Z',
    wake: '2026-09-26T05:10:00Z',
    rec: 28,
    hrv: 70,
    rhr: 62
  })
  const r = buildCoaching({ days: [today, ...past], now: new Date('2026-09-26T08:00:00Z') })
  const load = r.recommendations.find((x) => x.id === 'load')
  assert.match(load.title, /Aktive Erholung/)
  assert.ok(r.recommendations.some((x) => x.id === 'stress'), 'HRV-Abfall erkannt')
  assert.match(r.focus, /Strain heute unter 8/)
})

test('spät ins Bett → Fokus auf Zubettgehzeit, Klausur morgen fließt ein', () => {
  const today = day({ bed: '2026-09-25T23:47:00Z', wake: '2026-09-26T09:00:00Z', cons: 30 })
  const r = buildCoaching({
    days: [today, ...history()],
    events: [{ title: 'Klausur: Deutsch (GK)', start: '2026-09-26T22:00:00.000Z', allDay: true }],
    now: new Date('2026-09-26T08:00:00Z')
  })
  assert.match(r.focus, /01:47/)
  const bed = r.recommendations.find((x) => x.id === 'bedtime')
  assert.match(bed.detail, /Klausur/)
  assert.ok(r.recommendations.some((x) => x.id === 'late'))
  assert.ok(r.recommendations.some((x) => x.id === 'rhythm'))
})

test('Zubettgehzeit = Aufwachen − Bedarf/Effizienz, höchstens 1 h vor der Gewohnheit', () => {
  const r = buildCoaching({ days: history(), now: new Date('2026-09-24T08:00:00Z') })
  // Rechnerisch 07:00 − 8h42/0,92 = 21:33 – gewohnt ist 23:00, also 22:00.
  assert.equal(r.plan.wake, '07:00')
  assert.equal(r.plan.bedtime, '22:00')
  assert.equal(dur(r.plan.expectedSleepMs), '8h 17')
})

test('Wochenende: höchstens 2 h später aufstehen als an Schultagen', () => {
  // Wochenend-Nächte im Verlauf: bis 12:00 Ortszeit geschlafen.
  const days = history().map((d) => {
    const wd = new Date(d.sleep.wake).getUTCDay()
    if (wd !== 0 && wd !== 6) return d
    const wake = new Date(d.sleep.wake)
    wake.setUTCHours(10)
    return { ...d, sleep: { ...d.sleep, wake: wake.toISOString() } }
  })
  // Samstag-Nacht: 03:00 → 13:00 Ortszeit.
  days.unshift(day({ bed: '2026-09-26T01:00:00Z', wake: '2026-09-26T11:00:00Z', sleepH: 9.5 }))
  const r = buildCoaching({ days, now: new Date('2026-09-26T12:00:00Z') })
  assert.equal(r.plan.wakeKind, 'Wochenende')
  assert.equal(r.plan.wake, '09:00')
  // 09:00 − 8h/0,92 = 00:18 → gekappt auf gewohnte 23:00 + 1 h.
  assert.equal(r.plan.bedtime, '00:00')
})
