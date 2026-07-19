// ===========================================================================
// Themen-Filter für "Wichtige Mails".
// Eine Mail wird angezeigt, wenn sie zu einem Thema passt (Stichwort im Betreff
// ODER Absender-Treffer) – oder wenn sie in Mail geflaggt wurde.
// Themen/Stichwörter verfeinern wir gemeinsam (Schule ist vorbelegt,
// Newsletter noch offen).
// ===========================================================================

export const MAIL_TOPICS = [
  {
    id: 'schule',
    label: 'Schule',
    keywords: [
      'schule',
      'gymnasium',
      'vertretung',
      'vertretungsplan',
      'klausur',
      'klausuren',
      'stundenplan',
      'elternabend',
      'zeugnis',
      'unterricht',
      'schulleitung',
      'sekretariat',
      'oberstufe',
      'studienfahrt',
      'klassenfahrt',
      'wandertag',
      'abitur',
      'hausaufgabe',
      'schulportal',
      'iserv',
      'moodle'
    ],
    // Später: konkrete Absender/Domain der Schule, z. B. 'gymnasium-xy.de'
    senders: []
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    // Später gemeinsam festlegen (welche Newsletter sind dir wichtig?).
    keywords: [],
    senders: []
  }
]

// Zusätzlich zu den Themen immer auch manuell geflaggte Mails zeigen.
export const INCLUDE_FLAGGED = true

// Wie viele der neuesten Posteingang-Nachrichten durchsucht werden.
export const SCAN_RECENT = 80

// Ordnet einer Mail ein Thema zu (oder null). subject/from = Strings.
export function matchTopic(subject, fromAddress, fromName) {
  const hay = `${subject} ${fromName} ${fromAddress}`.toLowerCase()
  for (const topic of MAIL_TOPICS) {
    if (topic.keywords.some((k) => hay.includes(k.toLowerCase()))) return topic.label
    if (topic.senders.some((s) => fromAddress.toLowerCase().includes(s.toLowerCase()))) return topic.label
  }
  return null
}
