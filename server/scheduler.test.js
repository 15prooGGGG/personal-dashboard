// ===========================================================================
// Prüft das Nachhol-Verhalten des Zeitplaners.
//
// Hintergrund: Ein täglicher Job muss nach einem Neustart kurz nach der
// Uhrzeit noch nachgeholt werden – aber nicht mehr Stunden später. Ein
// Morgen-Briefing, das um 14 Uhr eintrifft, liest man als aktuellen Stand.
//
// Ausführen:  npm test -w server
// ===========================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { berlinNow } from './notify/scheduler.js'

// Die Entscheidung aus tick() nachgebildet: lohnt ein Nachholen noch?
function shouldRun({ nowHour, nowMinute, jobHour, jobMinute, grace = 120, alreadyRan = false }) {
  if (alreadyRan) return 'skip'
  const delay = nowHour * 60 + nowMinute - (jobHour * 60 + jobMinute)
  if (delay < 0) return 'wait'
  return delay <= grace ? 'run' : 'expire'
}

test('läuft pünktlich zur eingestellten Zeit', () => {
  assert.equal(shouldRun({ nowHour: 6, nowMinute: 45, jobHour: 6, jobMinute: 45 }), 'run')
})

test('wartet, solange die Zeit noch nicht erreicht ist', () => {
  assert.equal(shouldRun({ nowHour: 6, nowMinute: 30, jobHour: 6, jobMinute: 45 }), 'wait')
})

test('holt nach einem Neustart kurz danach noch nach', () => {
  // Container startet 7:10 neu – das 6:45-Briefing ist noch relevant.
  assert.equal(shouldRun({ nowHour: 7, nowMinute: 10, jobHour: 6, jobMinute: 45 }), 'run')
})

test('holt Stunden später NICHT mehr nach', () => {
  // Genau der Fall, der beim Einrichten auftrat: Neustart um 9:35.
  assert.equal(shouldRun({ nowHour: 9, nowMinute: 35, jobHour: 6, jobMinute: 45 }), 'expire')
  assert.equal(shouldRun({ nowHour: 14, nowMinute: 0, jobHour: 6, jobMinute: 45 }), 'expire')
})

test('genau an der Grenze wird noch ausgeführt', () => {
  assert.equal(shouldRun({ nowHour: 8, nowMinute: 45, jobHour: 6, jobMinute: 45 }), 'run')
  assert.equal(shouldRun({ nowHour: 8, nowMinute: 46, jobHour: 6, jobMinute: 45 }), 'expire')
})

test('läuft pro Tag nur einmal', () => {
  assert.equal(
    shouldRun({ nowHour: 6, nowMinute: 50, jobHour: 6, jobMinute: 45, alreadyRan: true }),
    'skip'
  )
})

test('berlinNow rechnet unabhängig von der Container-Zeitzone', () => {
  // 3.8.2026, 18:45 UTC ist in Berlin (Sommerzeit, UTC+2) der 3.8. um 20:45.
  const n = berlinNow(new Date('2026-08-03T18:45:00Z'))
  assert.equal(n.hour, 20)
  assert.equal(n.minute, 45)
  assert.equal(n.date, '2026-08-03')
  assert.equal(n.weekday, 1) // Montag

  // Im Winter gilt UTC+1: 3.1.2026, 18:45 UTC -> 19:45 Berliner Zeit.
  const w = berlinNow(new Date('2026-01-03T18:45:00Z'))
  assert.equal(w.hour, 19)
  assert.equal(w.date, '2026-01-03')
})
