// ===========================================================================
// Ständige Überwachung des Vertretungsplans.
// ---------------------------------------------------------------------------
// Die Nachricht um 6:45 ist eine Momentaufnahme. Vertretungen werden aber den
// ganzen Tag über eingetragen – gerade die für den Folgetag. Wer nur morgens
// liest, erfährt eine Änderung erst am nächsten Morgen, also zu spät.
//
// Dieser Job holt den Plan regelmäßig und meldet NUR, was sich gegenüber dem
// letzten Stand geändert hat. Drei Entscheidungen, die Fehlalarme vermeiden:
//
//   1. Verglichen wird pro Tag anhand der fertig formatierten Zeilen. Zwei
//      Abrufe mit gleichem Inhalt ergeben identische Zeilen – egal, ob das
//      Portal die Reihenfolge der Tabellenzeilen ändert.
//
//   2. Tage, die aus dem Plan HERAUSFALLEN, lösen keine Meldung aus. Der
//      heutige Tag verschwindet über Nacht; das jedes Mal als "gestrichen" zu
//      melden, wäre reines Rauschen.
//
//   3. Beim allerersten Lauf wird nur gespeichert, nicht gemeldet. Sonst
//      schickt jede Neueinrichtung den kompletten Plan als "alles neu".
//      Der Stand liegt auf Platte, ein Container-Neustart ändert daran nichts.
// ===========================================================================
import { config } from '../config.js'
import { fetchSubstitutions, getStatus } from '../integrations/schulportal.js'
import { getState, patchState } from './scheduler.js'
import { dayLines } from './plan.js'

const SNAPSHOT_KEY = 'plan-watch:snapshot'
const PROBLEM_KEY = 'plan-watch:problem'

// Aus dem Plan wird ein vergleichbarer Stand: Datum -> Zeilen.
export function snapshotPlan(plan) {
  const days = {}
  for (const day of plan.days ?? []) {
    const key = day.date ?? day.label
    days[key] = { label: day.week ? `${day.label} · ${day.week}` : day.label, lines: dayLines(day) }
  }
  return days
}

// "11.08.2026" ist als Zeichenkette nicht sortierbar – umdrehen.
const sortKey = (date) => String(date).split('.').reverse().join('-')

// Vergleich pro Tag. Läuft bewusst nur über die Tage, die JETZT im Plan
// stehen (siehe Punkt 2 oben).
export function diffSnapshots(prev, next) {
  const changes = []

  for (const date of Object.keys(next).sort((a, b) => sortKey(a).localeCompare(sortKey(b)))) {
    const before = prev?.[date]?.lines ?? []
    const after = next[date].lines

    const beforeSet = new Set(before)
    const afterSet = new Set(after)
    const added = after.filter((line) => !beforeSet.has(line))
    // Ein Tag, den wir noch nie gesehen haben, hat nichts "verloren".
    const removed = prev?.[date] ? before.filter((line) => !afterSet.has(line)) : []

    if (added.length || removed.length) changes.push({ date, label: next[date].label, added, removed })
  }

  return changes
}

export function buildChangeMessage(plan, changes) {
  const lines = [`Vertretungsplan geändert${plan.who ? ` · ${plan.who}` : ''}`, '']

  for (const change of changes) {
    lines.push(change.label)
    for (const line of change.added) lines.push(`+ ${line}`)
    // Zurückgenommene Einträge sind genauso wichtig wie neue: Wer sich auf
    // eine ausfallende Stunde eingestellt hat, muss erfahren, dass sie doch
    // stattfindet.
    for (const line of change.removed) lines.push(`− ${line} (nicht mehr im Plan)`)
    lines.push('')
  }

  return lines.join('\n').trim()
}

// Ein Durchlauf. Gibt die zu versendende Nachricht zurück oder null.
// send wird injiziert, damit der Ablauf testbar bleibt.
export async function checkForChanges() {
  const status = getStatus()

  // Bei gesperrter Anmeldung gar nicht erst abrufen – und nur EINMAL melden,
  // nicht alle 15 Minuten. Der Zustand hält bis zum Neustart an.
  if (status.blocked) {
    if (getState()[PROBLEM_KEY] === 'blocked') return null
    patchState({ [PROBLEM_KEY]: 'blocked' })
    return (
      'Vertretungsplan: Anmeldung deaktiviert.\n\n' +
      `${status.blockedReason}\n\n` +
      'Bis das behoben ist, wird der Plan NICHT überwacht. ' +
      'Passwort in der .env prüfen, dann Container neu starten.'
    )
  }

  const plan = await fetchSubstitutions({ force: true })

  // Portal antwortet, ist aber nicht mehr lesbar. Ebenfalls nur einmal melden:
  // Ein kaputter Parser repariert sich nicht von selbst, und eine Meldung alle
  // 15 Minuten macht ihn nicht schneller heil.
  if (plan.state === 'unknown') {
    if (getState()[PROBLEM_KEY] === 'unknown') return null
    patchState({ [PROBLEM_KEY]: 'unknown' })
    return (
      'Vertretungsplan: konnte nicht gelesen werden.\n\n' +
      'Das Portal antwortet, liefert aber weder Einträge noch seine Leermeldung – ' +
      'vermutlich hat sich das Markup geändert. Solange gilt die Überwachung als ' +
      'unzuverlässig: bitte selbst im Portal nachsehen.'
    )
  }

  const next = snapshotPlan(plan)
  const state = getState()
  const prev = state[SNAPSHOT_KEY]

  // Nach einem überstandenen Problem einmal Entwarnung geben – sonst weiß man
  // nie, ob die Stille "alles ruhig" oder "immer noch kaputt" bedeutet.
  const recovered = state[PROBLEM_KEY] ? state[PROBLEM_KEY] : null

  patchState({ [SNAPSHOT_KEY]: next, [PROBLEM_KEY]: null })

  // Erster Lauf: nur merken.
  if (!prev) return recovered ? 'Vertretungsplan ist wieder lesbar.' : null

  const changes = diffSnapshots(prev, next)
  if (changes.length === 0) return recovered ? 'Vertretungsplan ist wieder lesbar.' : null

  const message = buildChangeMessage(plan, changes)
  return recovered ? `Vertretungsplan ist wieder lesbar.\n\n${message}` : message
}

// Fenster und Takt aus der Konfiguration, damit sich das ohne Codeänderung
// nachjustieren lässt.
export const watchWindow = () => ({
  minutes: config.notify.planWatchMinutes,
  from: config.notify.planWatchFrom,
  to: config.notify.planWatchTo,
  days: config.notify.planWatchDays
})
