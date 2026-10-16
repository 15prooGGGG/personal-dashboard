// ===========================================================================
// Klausurtermine aus dem Klausurplan im Second Brain (Obsidian-Vault).
// ---------------------------------------------------------------------------
// Der iCloud-Kalender liefert dem Dashboard nur 14 Tage im Voraus; der
// Klausurplan im Vault enthält dagegen alle Termine des Halbjahres als
// Markdown-Tabelle:  | Fr 23.10.2026 | Mathematik | LK + GK |
// Gelesen wird nur – der Vault ist im Container read-only eingebunden.
// ===========================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VAULT_DIR = process.env.VAULT_DIR || path.resolve(__dirname, '../vault')
const AREA = path.join('03 Bereiche', 'Schule & Abitur')

/** Neueste Notiz „Klausurplan …“ im Schul-Bereich (Fallback: ganzer Vault). */
function findPlan() {
  const dirs = [path.join(VAULT_DIR, AREA), VAULT_DIR]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    const hits = fs
      .readdirSync(dir)
      .filter((f) => /^klausurplan.*\.md$/i.test(f))
      .map((f) => path.join(dir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    if (hits.length) return hits[0]
  }
  return null
}

/** Tabellenzeilen „| Wt TT.MM.JJJJ | Fach (Zusatz) | Kursart |“ → Termine. */
export function parseExamTable(md) {
  const out = []
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*(?:\w{2}\s+)?(\d{2})\.(\d{2})\.(\d{4})\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/)
    if (!m) continue
    const [, dd, mm, yyyy, subjectRaw, kind] = m
    // Keine Klausur: Fristen ohne Kursart („–“), z. B. „Ende der Noteneingabe“.
    if (!kind || /^[–-]$/.test(kind)) continue
    const note = subjectRaw.match(/\(([^)]*)\)/)?.[1] ?? null
    const subject = subjectRaw.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
    out.push({ date: `${yyyy}-${mm}-${dd}`, subject, kind: kind.trim(), note })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export function getExams(now = new Date()) {
  const file = findPlan()
  if (!file) return { configured: false, exams: [] }
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const all = parseExamTable(fs.readFileSync(file, 'utf8'))
  return {
    configured: true,
    source: path.relative(VAULT_DIR, file),
    exams: all.filter((e) => e.date >= today)
  }
}
