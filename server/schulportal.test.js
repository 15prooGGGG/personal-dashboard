// ===========================================================================
// Prüft den Vertretungsplan-Parser gegen nachgebautes Portal-Markup.
//
// Warum das hier steht: Der echte Plan ist in den Ferien leer, und wenn er
// gefüllt ist, ist er persönlich – man kann ihn nicht als Testdatei ablegen.
// Diese Fixtures bilden die Struktur nach, die aus dem Portal-Markup und aus
// module/vertretungsplan/js/my.js hervorgeht: bootstrap-table mit
// <th data-field="…"> in <table id="vtable<TT_MM_JJJJ>">.
//
// Ausführen:  node --test server/
// ===========================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePlanHtml } from './integrations/schulportal.js'

const LEER = `<div id="content"><h1>Mein Vertretungsplan</h1>
  <div class="alert alert-warning" role="alert">
    <b>Keine Einträge!</b> Aktuell liegen für die angemeldete Person keine
    Meldungen über Vertretungen vor!
  </div></div>`

// Der Fixture oben stellt die Leermeldung NEBEN die Tabelle – so hatte ich sie
// mir vorgestellt. Das Portal stellt sie in Wahrheit HINEIN, als Zeile mit
// colspan. Dadurch lief der Test jahrelang grün, während in der Praxis aus der
// Leermeldung ein Schein-Eintrag wurde ("Stunde: Keine Einträge! …") und der
// Plan als gefüllt galt. Ab hier deshalb Fixtures, die 1:1 aus dem echten
// Seitenquelltext stammen.
const heute = (inhalt) => `<div id="content"><h1>Mein Vertretungsplan</h1>
<div class="panel panel-primary" style="display: none;" id="tag11_08_2026">
  <div class="panel-heading">
    Dienstag<span class="hidden-xs">, den 11.08.2026</span>
    <span class="badge">heute</span> <span class="badge woche">
                    A-Woche
            </span> </div>
  <div class="panel-body">${inhalt}
    <div class="pull-right"><i>Letzte Aktualisierung: 11.08.2026 um 11:59:56 Uhr</i></div>
  </div>
</div></div>`

// Genau der Aufbau, den das Portal bei "nichts los" ausliefert.
const VTABLE_LEER = `<h3>Vertretungen am 11.08.2026</h3>
<table class="table table-striped" id="vtable11_08_2026" data-classview="no" data-toggle="table">
  <thead><tr>
    <th data-sortable="true" data-field="Stunde" data-cell-style="cellStyle">Stunde</th>
    <th data-sortable="true" data-field="Klasse" data-cell-style="cellStyle">Klasse</th>
    <th data-sortable="true" data-field="Hinweis" data-cell-style="cellStyle">Hinweis</th>
  </tr></thead>
  <tbody><tr><td colspan="11">
    <div class="alert alert-warning" role="alert">
      <b>Keine Eintr&auml;ge!</b> Aktuell liegen f&uuml;r die angemeldete Person keine
      Meldungen &uuml;ber Vertretungen vor!
    </div>
  </td></tr></tbody>
</table>`

// Die zweite Tabelle im Panel: hier stehen Unterrichtsfrei, Klausuren, Aushänge.
const INFOS = `<h3 class="hidden-xs">Informationen zum 11.08.2026</h3>
<table class="table table-hover table-condensed table-striped infos"><tbody>
  <tr class="subheader" style="background-color: #eee;"><td><b>
                    Unterrichtsfrei
            </b></td></tr>
  <tr><td>
                    6 Std.
            </td></tr>
</tbody></table><br/>`

const MIT_EINTRAEGEN = `<div id="content"><h1>Mein Vertretungsplan</h1>
<div class="panel" id="tag04_08_2026">
  <table id="vtable04_08_2026" class="table table-striped" data-toggle="table">
    <thead><tr>
      <th data-field="Stunde">Stunde</th>
      <th data-field="Klasse">Klasse</th>
      <th data-field="Vertreter">Vertreter</th>
      <th data-field="Fach">Fach</th>
      <th data-field="Raum">Raum</th>
      <th data-field="Hinweis">Hinweis</th>
    </tr></thead>
    <tbody>
      <tr><td>1 - 2</td><td>E2</td><td>MUE</td><td>MATH</td><td>A203</td><td>Raum&nbsp;getauscht</td></tr>
      <tr><td>5</td><td>E2</td><td></td><td>BIO</td><td></td><td>f&auml;llt aus &#8211; 3.&nbsp;Std. vorgezogen</td></tr>
    </tbody>
  </table>
</div>
<div class="panel" id="tag05_08_2026">
  <table id="vtable05_08_2026" class="table table-striped">
    <thead><tr>
      <th data-field="Stunde">Stunde</th>
      <th data-field="Fach">Fach</th>
      <th data-field="Art">Art</th>
    </tr></thead>
    <tbody><tr><td>3</td><td>ENG</td><td>Vertretung</td></tr></tbody>
  </table>
</div></div>`

test('Leermeldung des Portals wird als "empty" erkannt, nicht als Fehler', () => {
  const r = parsePlanHtml(LEER)
  assert.equal(r.state, 'empty')
  assert.equal(r.total, 0)
  assert.equal(r.days.length, 0)
})

// --- Der Fehler vom 11.08.2026 ---------------------------------------------
// Signal meldete "keine Einträge", im Portal stand "Unterrichtsfrei, 6 Std.".
// Zwei Ursachen, beide hier festgenagelt.

test('Leermeldung INNERHALB der Tabelle wird kein Schein-Eintrag', () => {
  const r = parsePlanHtml(heute(VTABLE_LEER))
  assert.equal(r.total, 0)
  assert.equal(r.state, 'empty')
  // Nicht: [{ lesson: 'Keine Einträge! Aktuell liegen …' }]
  assert.equal(r.days.length, 0)
})

test('Tagesinfos ("Unterrichtsfrei") werden gelesen, nicht übergangen', () => {
  const r = parsePlanHtml(heute(INFOS + VTABLE_LEER))

  assert.equal(r.total, 0, 'es sind wirklich keine Vertretungen')
  assert.equal(r.infoTotal, 1)
  // Entscheidend: Der Tag darf nicht wegfallen, nur weil keine Vertretung
  // ansteht – sonst fehlt genau die Zeile, die den Schultag verschiebt.
  assert.equal(r.days.length, 1)
  assert.deepEqual(r.days[0].infos, [{ title: 'Unterrichtsfrei', lines: ['6 Std.'] }])
})

test('Tag mit Infos gilt als "ok", nicht als leer', () => {
  const r = parsePlanHtml(heute(INFOS + VTABLE_LEER))
  assert.equal(r.state, 'ok')
  // Kein "Keine Vertretungen gemeldet." – es liegt ja etwas an.
  assert.equal(r.note, null)
})

test('Woche und letzte Aktualisierung landen am Tag', () => {
  const [tag] = parsePlanHtml(heute(INFOS + VTABLE_LEER)).days
  assert.equal(tag.week, 'A-Woche')
  assert.equal(tag.updatedAt, '11.08.2026 um 11:59:56 Uhr')
  assert.equal(tag.label, 'Dienstag, 11.08.2026')
})

test('mehrere Info-Blöcke werden ihren Überschriften zugeordnet', () => {
  const mehrere = `<h3>Informationen zum 11.08.2026</h3>
    <table class="table infos"><tbody>
      <tr class="subheader"><td><b>Unterrichtsfrei</b></td></tr>
      <tr><td>6 Std.</td></tr>
      <tr class="subheader"><td><b>Klausur</b></td></tr>
      <tr><td>Q1</td><td>3. - 5. Std.</td></tr>
      <tr><td>Raum A203</td></tr>
    </tbody></table>`
  const [tag] = parsePlanHtml(heute(mehrere + VTABLE_LEER)).days

  assert.deepEqual(tag.infos, [
    { title: 'Unterrichtsfrei', lines: ['6 Std.'] },
    // Mehrspaltige Zeilen werden zu einer lesbaren Zeile zusammengezogen.
    { title: 'Klausur', lines: ['Q1 · 3. - 5. Std.', 'Raum A203'] }
  ])
})

test('unbekanntes Markup wird als "unknown" gemeldet statt still zu schlucken', () => {
  const r = parsePlanHtml('<div id="content"><h1>Mein Vertretungsplan</h1></div>')
  assert.equal(r.state, 'unknown')
  assert.match(r.note, /Markup/)
})

test('Einträge werden pro Tag aus den vtable-IDs gelesen', () => {
  const r = parsePlanHtml(MIT_EINTRAEGEN)
  assert.equal(r.state, 'ok')
  assert.equal(r.total, 3)
  assert.equal(r.days.length, 2)

  assert.equal(r.days[0].date, '04.08.2026')
  // 4.8.2026 ist ein Dienstag – Wochentag wird aus dem Datum berechnet.
  assert.equal(r.days[0].label, 'Dienstag, 04.08.2026')
  assert.equal(r.days[1].date, '05.08.2026')
})

test('Spalten landen über data-field auf den richtigen Feldern', () => {
  const [erster] = parsePlanHtml(MIT_EINTRAEGEN).days[0].entries
  assert.deepEqual(erster, {
    lesson: '1 - 2',
    className: 'E2',
    substitute: 'MUE',
    subject: 'MATH',
    room: 'A203',
    note: 'Raum getauscht' // &nbsp; wurde zu einem normalen Leerzeichen
  })
})

test('leere Zellen und HTML-Entities werden sauber behandelt', () => {
  const [, zweiter] = parsePlanHtml(MIT_EINTRAEGEN).days[0].entries
  // benannte (&auml;), numerische (&#8211;) und &nbsp;-Entities gemischt
  assert.equal(zweiter.note, 'fällt aus – 3. Std. vorgezogen')
  assert.equal(zweiter.subject, 'BIO')
  // Leere Zellen tauchen gar nicht erst auf, statt als "" mitzureisen.
  assert.ok(!('substitute' in zweiter))
  assert.ok(!('room' in zweiter))
})

test('Fußzeilen-Layouttabellen erzeugen keine Einträge', () => {
  const r = parsePlanHtml(
    LEER + '<table width="100%"><tr><td>Datenschutz</td><td>Impressum</td></tr></table>'
  )
  assert.equal(r.total, 0)
  assert.equal(r.state, 'empty')
})

test('sichtbare Überschriften greifen, wenn data-field fehlt', () => {
  const ohneDataField = `<table id="vtable06_08_2026">
    <thead><tr><th>Stunde</th><th>Fach</th><th>Raum</th></tr></thead>
    <tbody><tr><td>2</td><td>PH</td><td>B12</td></tr></tbody></table>`
  const r = parsePlanHtml(ohneDataField)
  assert.equal(r.total, 1)
  assert.deepEqual(r.days[0].entries[0], { lesson: '2', subject: 'PH', room: 'B12' })
})

test('unbekannte Spalten gehen nicht verloren', () => {
  const neueSpalte = `<table id="vtable07_08_2026">
    <thead><tr><th data-field="Stunde">Stunde</th><th data-field="Irgendwas">Neu</th></tr></thead>
    <tbody><tr><td>4</td><td>Wert</td></tr></tbody></table>`
  const eintrag = parsePlanHtml(neueSpalte).days[0].entries[0]
  assert.equal(eintrag.lesson, '4')
  assert.equal(eintrag.Irgendwas, 'Wert')
})
