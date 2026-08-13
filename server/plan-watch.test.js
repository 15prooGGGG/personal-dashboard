// ===========================================================================
// Prüft die Änderungserkennung des Vertretungsplans.
//
// Der Kern ist die Frage "was ist anders als beim letzten Mal?" – und vor
// allem, was KEINE Meldung auslösen darf. Ein Wächter, der jeden Tagwechsel
// als Änderung meldet, wird nach drei Tagen weggeklickt und ist damit
// nutzlos.
//
// Ausführen:  node --test server/*.test.js
// ===========================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { snapshotPlan, diffSnapshots, buildChangeMessage } from './notify/plan-watch.js'

const tag = (date, { entries = [], infos = [], week = null } = {}) => ({
  label: `Dienstag, ${date}`,
  date,
  week,
  updatedAt: null,
  infos,
  entries
})

const plan = (days) => ({ who: 'Stenger, Lauri Elijah (Q1-VOG)', days })

test('gleicher Plan zweimal gelesen ergibt keine Änderung', () => {
  const p = plan([tag('11.08.2026', { entries: [{ lesson: '3', subject: 'MATH' }] })])
  assert.deepEqual(diffSnapshots(snapshotPlan(p), snapshotPlan(p)), [])
})

test('neuer Eintrag wird als Zugang gemeldet', () => {
  const vorher = snapshotPlan(plan([tag('11.08.2026', { entries: [{ lesson: '3', subject: 'MATH' }] })]))
  const nachher = snapshotPlan(
    plan([
      tag('11.08.2026', {
        entries: [
          { lesson: '3', subject: 'MATH' },
          { lesson: '5', subject: 'BIO', note: 'fällt aus' }
        ]
      })
    ])
  )

  const [change] = diffSnapshots(vorher, nachher)
  assert.equal(change.date, '11.08.2026')
  assert.equal(change.added.length, 1)
  assert.match(change.added[0], /BIO/)
  assert.deepEqual(change.removed, [])
})

test('zurückgenommener Eintrag wird als Abgang gemeldet', () => {
  const vorher = snapshotPlan(
    plan([tag('11.08.2026', { entries: [{ lesson: '5', subject: 'BIO', note: 'fällt aus' }] })])
  )
  const nachher = snapshotPlan(
    plan([tag('11.08.2026', { entries: [{ lesson: '3', subject: 'MATH' }] })])
  )

  const [change] = diffSnapshots(vorher, nachher)
  assert.equal(change.removed.length, 1)
  assert.match(change.removed[0], /BIO/)
})

// Das ist der Fall, der eine Überwachung sonst unbrauchbar macht.
test('ein Tag, der aus dem Plan fällt, löst KEINE Meldung aus', () => {
  const vorher = snapshotPlan(
    plan([
      tag('11.08.2026', { entries: [{ lesson: '3', subject: 'MATH' }] }),
      tag('12.08.2026', { entries: [{ lesson: '1', subject: 'ENG' }] })
    ])
  )
  // Am nächsten Morgen ist der 11.08. verschwunden – das ist normal, keine
  // Änderung am Plan.
  const nachher = snapshotPlan(
    plan([tag('12.08.2026', { entries: [{ lesson: '1', subject: 'ENG' }] })])
  )

  assert.deepEqual(diffSnapshots(vorher, nachher), [])
})

test('ein neu hinzukommender Tag wird vollständig gemeldet', () => {
  const vorher = snapshotPlan(plan([tag('12.08.2026', { entries: [{ lesson: '1', subject: 'ENG' }] })]))
  const nachher = snapshotPlan(
    plan([
      tag('12.08.2026', { entries: [{ lesson: '1', subject: 'ENG' }] }),
      tag('13.08.2026', { entries: [{ lesson: '2', subject: 'PH' }] })
    ])
  )

  const changes = diffSnapshots(vorher, nachher)
  assert.equal(changes.length, 1)
  assert.equal(changes[0].date, '13.08.2026')
  assert.equal(changes[0].added.length, 1)
  // Ein noch nie gesehener Tag hat nichts verloren.
  assert.deepEqual(changes[0].removed, [])
})

test('geänderte Tagesinfos schlagen an', () => {
  const vorher = snapshotPlan(plan([tag('11.08.2026', { infos: [] , entries: [{ lesson: '3' }] })]))
  const nachher = snapshotPlan(
    plan([
      tag('11.08.2026', {
        infos: [{ title: 'Unterrichtsfrei', lines: ['6 Std.'] }],
        entries: [{ lesson: '3' }]
      })
    ])
  )

  const [change] = diffSnapshots(vorher, nachher)
  assert.deepEqual(change.added, ['Unterrichtsfrei: 6 Std.'])
})

test('umsortierte Tabellenzeilen sind keine Änderung', () => {
  const a = { lesson: '3', subject: 'MATH' }
  const b = { lesson: '5', subject: 'BIO' }
  const vorher = snapshotPlan(plan([tag('11.08.2026', { entries: [a, b] })]))
  const nachher = snapshotPlan(plan([tag('11.08.2026', { entries: [b, a] })]))

  assert.deepEqual(diffSnapshots(vorher, nachher), [])
})

test('Tage werden chronologisch gemeldet, nicht alphabetisch', () => {
  const nachher = snapshotPlan(
    plan([
      tag('02.09.2026', { entries: [{ lesson: '1' }] }),
      tag('11.08.2026', { entries: [{ lesson: '2' }] })
    ])
  )
  const changes = diffSnapshots({}, nachher)
  assert.deepEqual(
    changes.map((c) => c.date),
    ['11.08.2026', '02.09.2026']
  )
})

test('Nachricht kennzeichnet Zugänge und Abgänge unterscheidbar', () => {
  const vorher = snapshotPlan(plan([tag('11.08.2026', { entries: [{ lesson: '5', subject: 'BIO' }] })]))
  const nachher = snapshotPlan(
    plan([tag('11.08.2026', { week: 'A-Woche', entries: [{ lesson: '3', subject: 'MATH' }] })])
  )

  const text = buildChangeMessage(plan([]), diffSnapshots(vorher, nachher))
  assert.match(text, /Vertretungsplan geändert/)
  assert.match(text, /\+ 3\. Std\. · Fach: MATH/)
  assert.match(text, /− 5\. Std\. · Fach: BIO \(nicht mehr im Plan\)/)
})
