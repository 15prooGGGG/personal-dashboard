// ===========================================================================
// Baut aus den Stundenplan-PDFs im Obsidian-Vault eine strukturierte JSON.
//
// WARUM EINMALIG PER SKRIPT (statt im Server zur Laufzeit):
// Die PDFs sind Text-PDFs, aber das Auslesen braucht `pdftotext` (poppler),
// das im schlanken Alpine-Container nicht steckt. Ein Stundenplan ändert sich
// pro Halbjahr einmal – dasselbe Muster wie beim Lösungsbuch-Index.
//
// Neu bauen nach Plan-Wechsel:
//   node scripts/build-stundenplan.js
// ===========================================================================
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const VAULT = process.env.VAULT_DIR || path.join(ROOT, 'vault')
const OUT = path.join(process.env.DATA_DIR || path.join(ROOT, 'data'), 'stundenplan.json')

const SOURCES = [
  { week: 'A', file: '07 Anhänge/Stundenplan A-Woche Q1 2026-27.pdf' },
  { week: 'B', file: '07 Anhänge/Stundenplan B-Woche Q1 2026-27.pdf' }
]
const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']

// Alle zusammenhängenden Textstücke einer Zeile mit ihrer Mitte.
function runs(line) {
  return [...line.matchAll(/\S+(?: \S+)*?(?=\s{2,}|$)/g)]
    .filter((m) => m[0].trim())
    .map((m) => ({ text: m[0].trim(), center: m.index + m[0].length / 2 }))
}

function parse(text) {
  const lines = text.split('\n')
  const headerIdx = lines.findIndex((l) => l.includes('Montag') && l.includes('Freitag'))
  if (headerIdx === -1) throw new Error('Kopfzeile mit Wochentagen nicht gefunden')

  // Spaltenmitten aus der Kopfzeile – die Zellen sind darunter zentriert.
  const centers = DAYS.map((d) => {
    const i = lines[headerIdx].indexOf(d)
    return { day: d, center: i + d.length / 2 }
  })
  const firstDayCenter = centers[0].center

  // Zeilen nach Stunden-Blöcken gruppieren.
  // ACHTUNG: Der Fachname steht im PDF EINE ZEILE ÜBER der Stundennummer.
  // Deshalb nicht ab der Nummer schneiden, sondern an den Leerzeilen: Jeder
  // zusammenhängende Block gehört zu genau einer Stunde.
  const blocks = []
  let chunk = []
  const flush = () => {
    if (chunk.length === 0) return
    const all = chunk.flatMap(runs)
    const num = all.find((x) => /^\d{1,2}$/.test(x.text) && x.center < firstDayCenter - 5)
    if (num) blocks.push({ period: Number(num.text), runs: all.filter((x) => x !== num) })
    chunk = []
  }
  for (const line of lines.slice(headerIdx + 1)) {
    if (line.includes('Wochenstunden:')) break
    if (line.trim() === '') flush()
    else chunk.push(line)
  }
  flush()

  // Textstücke der jeweils nächstgelegenen Tagesspalte zuordnen.
  const grid = {}
  for (const b of blocks) {
    const cells = Object.fromEntries(DAYS.map((d) => [d, []]))
    for (const x of b.runs) {
      const best = centers.reduce((a, c) =>
        Math.abs(c.center - x.center) < Math.abs(a.center - x.center) ? c : a
      )
      cells[best.day].push(x.text)
    }
    grid[b.period] = Object.fromEntries(
      DAYS.map((d) => [d, toLesson(cells[d])])
    )
  }
  return grid
}

// Aus den Textstücken einer Zelle eine Stunde bauen.
function toLesson(parts) {
  const clean = parts.filter((p) => p && p !== '–' && p !== '-')
  if (clean.length === 0) return null
  if (clean.some((p) => /Mittagspause/i.test(p))) return { type: 'break', subject: 'Mittagspause' }

  const lesson = { type: 'lesson', subject: null, course: null, teacher: null, room: null, note: null }
  for (const p of clean) {
    if (p.includes('·')) {
      const [course, teacher, room] = p.split('·').map((s) => s.trim())
      lesson.course = course || null
      lesson.teacher = teacher || null
      lesson.room = room || null
    } else if (/^nur\b/i.test(p)) {
      lesson.note = p
    } else if (!lesson.subject) {
      lesson.subject = p
    }
  }
  return lesson.subject || lesson.course ? lesson : null
}

const weeks = {}
let meta = null
for (const src of SOURCES) {
  const file = path.join(VAULT, src.file)
  if (!fs.existsSync(file)) throw new Error(`PDF fehlt: ${file}`)
  const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' })
  weeks[src.week] = parse(text)
  if (!meta) {
    meta = {
      title: (text.split('\n')[1] || '').trim(),
      source: src.file.replace(/A-Woche/, '(A/B)')
    }
  }
  const footer = text.split('\n').find((l) => l.includes('Schulschluss:'))
  if (footer) weeks[src.week].__footer = footer.trim()
}

const out = {
  generatedAt: new Date().toISOString(),
  meta,
  days: DAYS,
  weeks
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 2))

const count = (w) =>
  Object.entries(weeks[w])
    .filter(([k]) => k !== '__footer')
    .reduce((n, [, row]) => n + Object.values(row).filter((c) => c && c.type === 'lesson').length, 0)
console.log(`geschrieben: ${OUT}`)
console.log(`  A-Woche: ${count('A')} Stunden | B-Woche: ${count('B')} Stunden`)
