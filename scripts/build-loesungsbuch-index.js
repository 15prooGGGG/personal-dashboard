#!/usr/bin/env node
// ===========================================================================
// Baut data/loesungsbuch-index.json aus data/loesungsbuch.pdf.
//
// Die PDF ist ein Scan (kein Text eingebettet) – jede PDF-Seite ist eine
// gedruckte Doppelseite mit zwei Buchseiten nebeneinander, und die
// Buchseiten-Nummern laufen nicht linear durch die PDF (nach Kapitel
// gruppiert). Deshalb: jede Seite rendern, per OCR die blauen Kopfzeilen
// ("Seite 293 | Aufgabe 1") erkennen und daraus einen Index
// Seite+Aufgabe → PDF-Seite (+ links/rechts-Hälfte fürs Handy) bauen.
//
// Voraussetzungen (einmalig): sudo apt-get install -y poppler-utils
// tesseract-ocr tesseract-ocr-deu
//
// Aufruf: node scripts/build-loesungsbuch-index.js
// (nimmt data/loesungsbuch.pdf, schreibt data/loesungsbuch-index.json;
// Pfade per Argument überschreibbar: <pdf> <out> <tmpdir>)
// ===========================================================================
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../data')

const PDF_PATH = process.argv[2] || path.join(DATA_DIR, 'loesungsbuch.pdf')
const OUT_FILE = process.argv[3] || path.join(DATA_DIR, 'loesungsbuch-index.json')
const TMP_DIR = process.argv[4] || fs.mkdtempSync(path.join(os.tmpdir(), 'loesungsbuch-ocr-'))

if (!fs.existsSync(PDF_PATH)) {
  console.error(`PDF nicht gefunden: ${PDF_PATH}`)
  process.exit(1)
}

console.log(`1/3 Rendere Seiten nach ${TMP_DIR} …`)
execFileSync('pdftoppm', ['-r', '200', '-png', PDF_PATH, path.join(TMP_DIR, 'page')], {
  stdio: 'inherit'
})

const pngFiles = fs.readdirSync(TMP_DIR).filter((f) => /^page-\d+\.png$/.test(f)).sort()
console.log(`2/3 OCR (mit Positionsdaten) über ${pngFiles.length} Seiten …`)
for (const f of pngFiles) {
  const base = f.replace(/\.png$/, '')
  execFileSync(
    'tesseract',
    [path.join(TMP_DIR, f), path.join(TMP_DIR, `${base}-tsv`), '-l', 'deu', 'tsv'],
    { stdio: 'ignore' }
  )
}

console.log('3/3 Baue Index aus den Kopfzeilen …')
const tasks = {} // { [seite]: { [aufgabe]: pdfPage } }
const seitePages = {} // { [seite]: firstPdfPage } -- Fallback, falls Aufgabe unklar
const halves = {} // { [seite]: 'left' | 'right' } -- für den Handy-Zuschnitt
let totalMatches = 0
const unmatchedLines = []

const tsvFiles = fs.readdirSync(TMP_DIR).filter((f) => /^page-\d+-tsv\.tsv$/.test(f)).sort()

for (const file of tsvFiles) {
  const pdfPage = parseInt(file.match(/^page-(\d+)-tsv\.tsv$/)[1], 10)
  const rows = fs
    .readFileSync(path.join(TMP_DIR, file), 'utf8')
    .split('\n')
    .map((l) => l.split('\t'))

  let pageWidth = null
  const lineGroups = new Map() // `${block}.${par}.${line}` -> Wörter mit x-Position

  for (const row of rows) {
    if (row.length < 12) continue
    if (row[0] === '1') {
      pageWidth = parseInt(row[8], 10)
      continue
    }
    if (row[0] !== '5') continue // nur Wort-Ebene
    const [, , block, par, line, , left, , , , , ...textParts] = row
    const text = textParts.join('\t').trim()
    if (!text) continue
    const key = `${block}.${par}.${line}`
    if (!lineGroups.has(key)) lineGroups.set(key, [])
    lineGroups.get(key).push({ left: parseInt(left, 10), text })
  }

  for (const words of lineGroups.values()) {
    const lineText = words.map((w) => w.text).join(' ')
    const m = lineText.match(/^Seite\s+(\d{1,4})\s*[|\]I!]+\s*(.*)$/i)
    if (!m) continue
    const seite = parseInt(m[1], 10)
    const rest = m[2].trim()
    const half = pageWidth && words[0].left >= pageWidth / 2 ? 'right' : 'left'

    if (!(seite in seitePages)) {
      seitePages[seite] = pdfPage
      halves[seite] = half
    }

    let aufgabe = null
    if (/einstieg/i.test(rest)) {
      aufgabe = 0
    } else {
      const numMatch = rest.match(/^\S*\s*:?\s*(\d{1,3})/) || rest.match(/(\d{1,3})/)
      if (numMatch) aufgabe = parseInt(numMatch[1], 10)
    }

    if (aufgabe === null) {
      unmatchedLines.push(`page-${String(pdfPage).padStart(3, '0')}: "${lineText}"`)
      continue
    }

    if (!tasks[seite]) tasks[seite] = {}
    if (!(aufgabe in tasks[seite])) {
      tasks[seite][aufgabe] = pdfPage
      totalMatches++
    }
  }
}

fs.writeFileSync(OUT_FILE, JSON.stringify({ tasks, pages: seitePages, halves }, null, 0))
fs.rmSync(TMP_DIR, { recursive: true, force: true })

console.log(`\nFertig: ${OUT_FILE}`)
console.log(`  ${totalMatches} (Seite, Aufgabe)-Einträge über ${Object.keys(tasks).length} Seiten`)
console.log(`  ${Object.keys(seitePages).length} Seiten mit bekannter Startseite/Hälfte (Fallback)`)
if (unmatchedLines.length) {
  console.log(`  ${unmatchedLines.length} Kopfzeilen ohne erkennbare Aufgaben-Nummer (Seite bleibt per Fallback trotzdem auffindbar):`)
  unmatchedLines.forEach((l) => console.log('    ' + l))
}
