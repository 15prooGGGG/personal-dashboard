// ===========================================================================
// Zwei Angaben, die NICHT im Stundenplan-PDF stehen und deshalb hier gepflegt
// werden. Beide bitte einmal prüfen – bei falschen Werten zeigt das Dashboard
// die falsche Stunde an.
// ===========================================================================

// 1) Uhrzeiten der Stunden.
//    ACHTUNG: Das sind vorläufige Annahmen (übliches hessisches Modell mit
//    Doppelstunden), NICHT die verifizierten Zeiten der Einhardschule.
export const PERIOD_TIMES = {
  1: ['07:45', '08:30'],
  2: ['08:30', '09:15'],
  3: ['09:35', '10:20'],
  4: ['10:20', '11:05'],
  5: ['11:25', '12:10'],
  6: ['12:10', '12:55'],
  7: ['12:55', '13:40'], // Mittagspause
  8: ['13:40', '14:25'],
  9: ['14:25', '15:10'],
  10: ['15:20', '16:05'],
  11: ['16:05', '16:50']
}

// 2) A/B-Wochen-Rhythmus.
//    Referenz: Die Kalenderwoche, die dieses Datum enthält, ist die genannte
//    Woche. Daraus wird für jedes andere Datum über die KW-Parität abgeleitet.
//    Auf null setzen, wenn unbekannt – dann zeigt das Dashboard beide Wochen
//    ohne automatische Auswahl.
export const WEEK_REFERENCE = { date: '2026-09-14', week: 'A' }
