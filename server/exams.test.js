import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseExamTable } from './exams.js'

test('Klausurplan-Tabelle: Termine, Zusatz in Klammern, Fristen ohne Kursart raus', () => {
  const md = `| Datum | Fach | Kursart |
|---|---|---|
| Fr 02.10.2026 | Deutsch (1./2. Stunde) | GK |
| Fr 23.10.2026 | Mathematik | LK + GK |
| Fr 15.01.2027 | Ende der Noteneingabe | – |`
  assert.deepEqual(parseExamTable(md), [
    { date: '2026-10-02', subject: 'Deutsch', kind: 'GK', note: '1./2. Stunde' },
    { date: '2026-10-23', subject: 'Mathematik', kind: 'LK + GK', note: null }
  ])
})
