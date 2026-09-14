// ===========================================================================
// Mathe-Lösungsbuch (Scan als PDF + per OCR gebauter Index Seite/Aufgabe →
// PDF-Seite, siehe scripts/build-loesungsbuch-index.js). Die Buchseiten sind
// nicht linear in der PDF sortiert (nach Kapitel gruppiert), deshalb reicht
// keine einfache Formel – der Index wird einmalig aus den OCR-Kopfzeilen
// ("Seite 39 | Aufgabe 3") gebaut und hier nur nachgeschlagen.
// ===========================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data')

export const PDF_PATH = path.join(DATA_DIR, 'loesungsbuch.pdf')
const INDEX_PATH = path.join(DATA_DIR, 'loesungsbuch-index.json')

let cache = null

function load() {
  if (cache) return cache
  if (!fs.existsSync(INDEX_PATH)) return null
  cache = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'))
  return cache
}

export function isConfigured() {
  return fs.existsSync(PDF_PATH) && fs.existsSync(INDEX_PATH)
}

// Sucht Seite+Aufgabe im Index. Exakter Treffer, sonst Fallback auf die
// PDF-Seite, auf der die Buchseite zuerst beginnt (falls die Aufgaben-Nummer
// per OCR mal nicht sauber erkannt wurde).
export function search(seite, nr) {
  const idx = load()
  if (!idx) return null

  // Jede PDF-Seite ist eine gedruckte Doppelseite; `half` sagt, auf welcher
  // Hälfte (links/rechts) die Buchseite gedruckt ist – für den zugeschnittenen
  // Handy-Viewer (siehe PdfPageViewer.tsx).
  const half = idx.halves?.[seite] === 'right' ? 'right' : 'left'

  const exactPage = idx.tasks?.[seite]?.[nr]
  if (exactPage) return { pdfPage: exactPage, exact: true, half }

  const fallbackPage = idx.pages?.[seite]
  if (fallbackPage) return { pdfPage: fallbackPage, exact: false, half }

  return null
}
