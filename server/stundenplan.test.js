import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getStundenplan, weekFor } from './stundenplan.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hasPlan = fs.existsSync(path.join(process.env.DATA_DIR || path.resolve(__dirname, '../data'), 'stundenplan.json'))

test('upcoming: heute, solange noch Unterricht kommt', { skip: !hasPlan }, () => {
  const morning = getStundenplan(new Date('2026-10-14T07:00:00'))
  assert.equal(morning.upcoming.inDays, 0)
  assert.equal(morning.upcoming.day, 'Mittwoch')
})

test('upcoming: nach Schulschluss der nächste Schultag', { skip: !hasPlan }, () => {
  const afternoon = getStundenplan(new Date('2026-10-14T18:00:00'))
  assert.equal(afternoon.upcoming.inDays, 1)
  assert.equal(afternoon.upcoming.day, 'Donnerstag')
  assert.equal(afternoon.upcoming.week, weekFor(new Date('2026-10-15T12:00:00')))
})

test('upcoming: über das Wochenende mit wechselnder A/B-Woche', { skip: !hasPlan }, () => {
  const friday = getStundenplan(new Date('2026-10-16T18:00:00'))
  assert.equal(friday.upcoming.day, 'Montag')
  assert.equal(friday.upcoming.inDays, 3)
  assert.equal(friday.upcoming.date, '2026-10-19')
  assert.notEqual(friday.upcoming.week, weekFor(new Date('2026-10-16T12:00:00')))
})
