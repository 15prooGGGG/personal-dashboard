// ===========================================================================
// Zwei Angaben, die NICHT im Stundenplan-PDF stehen und deshalb hier gepflegt
// werden. Beide bitte einmal prüfen – bei falschen Werten zeigt das Dashboard
// die falsche Stunde an.
// ===========================================================================

// 1) Uhrzeiten der Stunden.
//    Von Lauri angegeben (14.10.2026): 45-Minuten-Stunden, nach jeder Stunde
//    5 min Pause, nach jeder Doppelstunde 15 min. Mittagspause 13:00–14:00.
//    Zwischen 8./9. und 10./11. Stunde keine Pause.
export const PERIOD_TIMES = {
  1: ['07:40', '08:25'],
  2: ['08:30', '09:15'],
  3: ['09:30', '10:15'],
  4: ['10:20', '11:05'],
  5: ['11:20', '12:05'],
  6: ['12:10', '12:55'],
  7: ['13:00', '14:00'], // Mittagspause
  8: ['14:00', '14:45'],
  9: ['14:45', '15:30'],
  10: ['15:45', '16:30'],
  11: ['16:30', '17:15']
}

// 2) A/B-Wochen-Rhythmus.
//    Referenz: Die Kalenderwoche, die dieses Datum enthält, ist die genannte
//    Woche. Daraus wird für jedes andere Datum über die KW-Parität abgeleitet.
//    Auf null setzen, wenn unbekannt – dann zeigt das Dashboard beide Wochen
//    ohne automatische Auswahl.
export const WEEK_REFERENCE = { date: '2026-09-14', week: 'B' }

// 3) Ferien (erster und letzter freier Tag). Der Stundenplan kennt keine
//    Ferien; zusätzlich erkennt der Tagesplan ganztägige Kalendertermine wie
//    „Herbstferien“ oder „Unterrichtsfrei“.
export const SCHOOL_BREAKS = [
  { name: 'Herbstferien', from: '2026-10-05', to: '2026-10-18' }
]

// 4) Morgen an Schultagen (Lauri, 16.10.2026): 70 min vor der ersten Stunde
//    aufstehen – Morgenroutine + Schulweg. Bei Entfall rutscht beides mit.
export const MORNING = { routineMin: 45, commuteMin: 25 }
