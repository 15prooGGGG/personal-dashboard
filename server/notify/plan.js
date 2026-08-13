// ===========================================================================
// Vertretungsplan als Signal-Nachricht.
// ---------------------------------------------------------------------------
// Bewusst so gebaut, dass eine kaputte Anmeldung oder ein geändertes Portal
// SICHTBAR wird. Eine ausbleibende Nachricht sähe genauso aus wie "heute keine
// Vertretung" – und dann verlässt man sich morgens auf eine Stille, die nichts
// bedeutet. Deshalb meldet der Bot Fehler ausdrücklich.
// ===========================================================================
import { config } from '../config.js'
import { fetchSubstitutions, getStatus } from '../integrations/schulportal.js'

// Reihenfolge der Felder in der Nachricht. Was das Portal sonst noch liefert,
// hängen wir hinten an, statt es zu verschlucken.
const ORDER = [
  ['lesson', 'Std.'],
  ['subject', 'Fach'],
  ['className', 'Klasse'],
  ['substitute', 'Vertretung'],
  ['teacher', 'Lehrkraft'],
  ['room', 'Raum'],
  ['kind', 'Art'],
  ['note', 'Hinweis']
]

// Ohne Aufzählungszeichen – das setzt der Aufrufer. Die Änderungsmeldung
// stellt "+"/"−" davor, die Tagesnachricht "•".
export function formatEntry(entry) {
  const used = new Set()
  const parts = []

  for (const [key, label] of ORDER) {
    if (!entry[key]) continue
    used.add(key)
    parts.push(key === 'lesson' ? `${entry[key]}. Std.` : `${label}: ${entry[key]}`)
  }
  for (const [key, value] of Object.entries(entry)) {
    if (!used.has(key) && value) parts.push(`${key}: ${value}`)
  }
  return parts.join(' · ')
}

// Tagesinfos: "Unterrichtsfrei: 6 Std.". Sie stehen im Portal in einer eigenen
// Tabelle neben den Vertretungen und sind oft die wichtigere Nachricht –
// ausfallende Stunden verschieben den ganzen Tag.
export const formatInfo = (info) => [info.title, ...info.lines].filter(Boolean).join(': ')

// Alle Zeilen eines Tages in Lesereihenfolge: erst was den Tag umstellt,
// dann die einzelnen Vertretungen.
export function dayLines(day) {
  return [
    ...(day.infos ?? []).map(formatInfo).filter(Boolean),
    ...(day.entries ?? []).map(formatEntry).filter(Boolean)
  ]
}

export async function buildPlanMessage() {
  const plan = await fetchSubstitutions({ force: true })

  if (plan.state === 'unknown') {
    return (
      'Vertretungsplan: konnte nicht gelesen werden.\n\n' +
      'Das Portal antwortet, liefert aber weder Einträge noch seine Leermeldung – ' +
      'vermutlich hat sich das Markup geändert. Bitte im Dashboard nachsehen.'
    )
  }

  const header = `Vertretungsplan${plan.who ? ` · ${plan.who}` : ''}`

  // Auf days prüfen, nicht auf total: Ein Tag kann "keine Vertretungen" und
  // gleichzeitig "Unterrichtsfrei, 6 Std." melden.
  if (plan.days.length === 0) {
    return `${header}\n\nKeine Vertretungen gemeldet.`
  }

  const lines = [header, '']
  for (const day of plan.days) {
    lines.push(day.week ? `${day.label} · ${day.week}` : day.label)
    for (const line of dayLines(day)) lines.push(`• ${line}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}

// Liefert null, wenn nichts zu melden ist und NOTIFY_PLAN_QUIET=on gesetzt ist.
export async function buildPlanMessageIfRelevant() {
  const status = getStatus()
  if (status.blocked) {
    return `Vertretungsplan: Anmeldung deaktiviert.\n\n${status.blockedReason}\n\nPasswort in der .env prüfen, dann Container neu starten.`
  }

  const plan = await fetchSubstitutions({ force: true })
  // Nur schweigen, wenn wirklich nichts anliegt – Tagesinfos zählen mit.
  if (config.notify.planQuiet && plan.days.length === 0 && plan.state === 'empty') return null
  return buildPlanMessage()
}
