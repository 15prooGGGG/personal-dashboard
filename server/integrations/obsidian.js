// ===========================================================================
// Obsidian-Vault (per Syncthing vom Mac gespiegelt, nur lesend).
// Liest Markdown-Dateien und zieht daraus:
//   - offene Aufgaben ("- [ ]") samt Herkunftsnotiz
//   - Projekte (Ordner "02 Projekte" bzw. Frontmatter tags: projekt)
//   - Bereiche/Ressourcen für den Überblick
// Bewusst strukturunabhängig: alles, was fehlt, wird einfach übersprungen –
// so wächst das Modul mit dem Vault mit, ohne Anpassung.
// ===========================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VAULT_DIR = process.env.VAULT_DIR || path.resolve(__dirname, '../../vault')

const TTL = 60 * 1000
const MAX_TASKS = 60
let cache = null

// Nicht durchsuchen: Obsidian-Interna, Syncthing-Marker, Werkzeug-Ordner.
const SKIP = /^(\.|node_modules$)/

function walk(dir, out = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (SKIP.test(e.name)) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) out.push(full)
  }
  return out
}

// Genügsamer YAML-Leser für den Frontmatter-Block (tags/status/erstellt).
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return {}
  const body = m[1]
  const out = {}

  const tagLine = /^tags:\s*(.*)$/m.exec(body)
  if (tagLine) {
    const inline = tagLine[1]
      .replace(/[[\]"']/g, '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const listed = [...body.matchAll(/^\s+-\s*(.+)$/gm)].map((x) => x[1].trim().replace(/^["']|["']$/g, ''))
    out.tags = [...new Set([...inline, ...listed])].filter(Boolean)
  }
  const status = /^status:\s*(.+)$/m.exec(body)
  if (status) out.status = status[1].trim()
  const created = /^erstellt:\s*(.+)$/m.exec(body)
  if (created) out.created = created[1].trim()
  return out
}

// Aufgaben-Text aufräumen: Wiki-Links, Markdown-Links und Tags lesbar machen.
function cleanTask(s) {
  return s
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, (_, a, b) => (b ? b.slice(1) : a))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .trim()
}

function readVault() {
  if (!fs.existsSync(VAULT_DIR)) return { configured: false, reason: 'missing' }

  const files = walk(VAULT_DIR)
  if (files.length === 0) return { configured: false, reason: 'empty' }

  const notes = []
  const tasks = []

  for (const file of files) {
    let text
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const rel = path.relative(VAULT_DIR, file)
    const title = path.basename(file, '.md')
    const folder = path.dirname(rel) === '.' ? '' : path.dirname(rel)
    const fm = parseFrontmatter(text)

    const open = [...text.matchAll(/^[ \t]*[-*]\s\[ \]\s*(.+)$/gm)].map((m) => cleanTask(m[1]))
    const done = (text.match(/^[ \t]*[-*]\s\[[xX]\]/gm) || []).length

    for (const t of open) {
      if (t) tasks.push({ text: t, note: title, folder })
    }

    notes.push({
      title,
      folder,
      path: rel,
      tags: fm.tags || [],
      status: fm.status || null,
      created: fm.created || null,
      openTasks: open.length,
      doneTasks: done,
      modified: (() => {
        try {
          return fs.statSync(file).mtime.toISOString()
        } catch {
          return null
        }
      })()
    })
  }

  // Projekte: alles im Projekt-Ordner oder mit Tag "projekt".
  const isProject = (n) =>
    /(^|\/)0?2[ ._-]*Projekte(\/|$)/i.test(n.folder) || n.tags.includes('projekt')

  const projects = notes
    .filter(isProject)
    .sort((a, b) => b.openTasks - a.openTasks || a.title.localeCompare(b.title, 'de'))
    .map(({ title, path: p, status, tags, created, openTasks, doneTasks }) => ({
      title,
      path: p,
      status,
      tags,
      created,
      openTasks,
      doneTasks
    }))

  const recent = [...notes]
    .filter((n) => n.modified)
    .sort((a, b) => new Date(b.modified) - new Date(a.modified))
    .slice(0, 5)
    .map(({ title, folder, modified }) => ({ title, folder, modified }))

  return {
    configured: true,
    counts: {
      notes: notes.length,
      projects: projects.length,
      openTasks: tasks.length
    },
    projects,
    tasks: tasks.slice(0, MAX_TASKS),
    recent
  }
}

export function getVault() {
  if (cache && Date.now() - cache.ts < TTL) return cache.value
  const value = readVault()
  cache = { value, ts: Date.now() }
  return value
}
