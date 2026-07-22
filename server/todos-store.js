// ===========================================================================
// Eigene To-Do-Liste (kein externer Dienst). Speicherung serverseitig als
// JSON-Datei (Docker-Volume) – so ist die Liste auf Handy und Desktop gleich
// und übersteht Neustarts.
//
// Tageslogik: Offene Aufgaben bleiben stehen (auch über Nacht). Erledigte
// Aufgaben werden am Folgetag automatisch entfernt (heute abgehakte bleiben
// bis Tagesende sichtbar).
// ===========================================================================
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data')
const FILE = path.join(DATA_DIR, 'todos.json')

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return []
  }
}

function save(list) {
  ensureDir()
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2))
}

// Entfernt erledigte Aufgaben, die nicht heute abgehakt wurden.
function rollover(list) {
  const today = todayStr()
  return list.filter((t) => !(t.done && t.completedDate && t.completedDate !== today))
}

export function getTodos() {
  const list = load()
  const cleaned = rollover(list)
  if (cleaned.length !== list.length) save(cleaned)
  return cleaned
}

export function addTodo(text) {
  const list = getTodos()
  const todo = {
    id: crypto.randomUUID(),
    text: String(text).trim().slice(0, 200),
    done: false,
    createdDate: todayStr(),
    completedDate: null
  }
  list.push(todo)
  save(list)
  return todo
}

export function setDone(id, done) {
  const list = getTodos()
  const todo = list.find((t) => t.id === id)
  if (!todo) return null
  todo.done = Boolean(done)
  todo.completedDate = todo.done ? todayStr() : null
  save(list)
  return todo
}

export function deleteTodo(id) {
  const list = getTodos().filter((t) => t.id !== id)
  save(list)
}
