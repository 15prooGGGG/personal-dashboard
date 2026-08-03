// ===========================================================================
// Watchlist – serverseitig gespeichert (JSON-Datei im Docker-Volume), damit
// sie auf Handy und Desktop identisch ist und Neustarts übersteht. Gleiches
// Muster wie todos-store.js.
//
// Gespeichert wird nur die Auswahl (Symbol, Name, Typ) – niemals Kurse. Die
// holt integrations/finnhub.js frisch, sonst zeigt das Dashboard alte Stände.
// ===========================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data')
const FILE = path.join(DATA_DIR, 'watchlist.json')

// Deckelt die Kursabrufe: Free-Tier erlaubt 60 Anfragen/Minute, ein Abruf je
// Symbol. 25 Einträge bei 20 s Cache bleiben deutlich darunter.
const MAX_ENTRIES = 25

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function load() {
  try {
    const list = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function save(list) {
  ensureDir()
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2))
}

export function getWatchlist() {
  return load()
}

// Fügt ein Symbol hinzu. Bereits vorhandene Symbole bleiben unverändert –
// doppelte Einträge würden nur doppelte Kursabrufe kosten.
export function addSymbol({ symbol, name, type }) {
  const sym = String(symbol || '').trim().toUpperCase()
  if (!sym) return { error: 'Symbol fehlt' }

  const list = load()
  const existing = list.find((e) => e.symbol === sym)
  if (existing) return { entry: existing, added: false }
  if (list.length >= MAX_ENTRIES) {
    return { error: `Watchlist ist voll (max. ${MAX_ENTRIES} Werte)` }
  }

  const entry = {
    symbol: sym,
    name: String(name || sym).trim().slice(0, 120),
    type: String(type || '').trim().slice(0, 40),
    addedAt: new Date().toISOString()
  }
  list.push(entry)
  save(list)
  return { entry, added: true }
}

export function removeSymbol(symbol) {
  const sym = String(symbol || '').trim().toUpperCase()
  const list = load()
  const next = list.filter((e) => e.symbol !== sym)
  if (next.length !== list.length) save(next)
  return next
}
