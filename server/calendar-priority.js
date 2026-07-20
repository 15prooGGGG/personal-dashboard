// ===========================================================================
// Priorisierung der Kalender-Ereignisse.
// Reihenfolge: 1) Schule  2) wiederkehrende Termine  3) einmalige Termine.
// Innerhalb jeder Stufe wird nach Dringlichkeit (nächster Termin zuerst)
// sortiert. Schul-Stichwörter sind tunbar – ergänze deine Fächer/Kürzel.
// ===========================================================================

export const SCHOOL_KEYWORDS = [
  'schule',
  'gymnasium',
  'klausur',
  'klausuren',
  'klassenarbeit',
  'abitur',
  'elternabend',
  'unterricht',
  'vertretung',
  'prüfung',
  'oberstufe',
  'zeugnis',
  'referat',
  'präsentation',
  'wandertag',
  'studienfahrt',
  'klassenfahrt',
  ' lk ',
  ' gk ',
  'leistungskurs',
  'grundkurs'
]

export function isSchoolEvent(title = '', location = '') {
  const hay = ` ${title} ${location} `.toLowerCase()
  return SCHOOL_KEYWORDS.some((k) => hay.includes(k))
}

// Weist Priorität + Label zu. ev: { school, recurring }
export function classify(ev) {
  if (ev.school) return { priority: 1, priorityLabel: 'Schule' }
  if (ev.recurring) return { priority: 2, priorityLabel: 'Wiederkehrend' }
  return { priority: 3, priorityLabel: 'Termin' }
}

// Sortierung: erst Priorität (1→3), dann Dringlichkeit (nächster Start zuerst).
export function byPriorityThenUrgency(a, b) {
  if (a.priority !== b.priority) return a.priority - b.priority
  return new Date(a.start) - new Date(b.start)
}
