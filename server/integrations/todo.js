// To-Do via Notion. Zugangsdaten: interner Integrations-Token + Datenbank-ID.
// Die Notion-Datenbank muss für die Integration freigegeben sein.
// Erwartet: eine Titel-Eigenschaft (Aufgabe), optional Checkbox/Status
// (erledigt) und ein Datum (fällig). Unterstützt die neue Notion-API
// (Data Sources) mit Fallback auf die klassische databases.query.
import { config, isConfigured } from '../config.js'

const TTL = 2 * 60 * 1000
let cache = null

const DONE_WORDS = new Set(['done', 'erledigt', 'fertig', 'abgeschlossen', 'complete', 'completed'])

function mapPage(page) {
  const props = page.properties || {}
  let title = ''
  let done = false
  let due = null

  for (const p of Object.values(props)) {
    if (p.type === 'title') title = (p.title || []).map((t) => t.plain_text).join('')
    else if (p.type === 'checkbox' && p.checkbox) done = true
    else if (p.type === 'status' && DONE_WORDS.has((p.status?.name || '').toLowerCase())) done = true
    else if (p.type === 'date' && !due) due = p.date?.start || null
  }
  if (!title) return null
  return { id: page.id, title, done, due }
}

// Fragt die Datenbank ab – neue API (Data Sources) mit Fallback.
async function queryDatabase(notion, databaseId) {
  try {
    const db = await notion.databases.retrieve({ database_id: databaseId })
    const dataSourceId = db?.data_sources?.[0]?.id
    if (dataSourceId && notion.dataSources?.query) {
      return await notion.dataSources.query({ data_source_id: dataSourceId, page_size: 50 })
    }
  } catch {
    // ignorieren und klassisch versuchen
  }
  return await notion.databases.query({ database_id: databaseId, page_size: 50 })
}

export async function fetchTodos() {
  if (!isConfigured.notion) return { configured: false, tasks: [] }
  if (cache && Date.now() - cache.ts < TTL) return cache.value

  try {
    const { Client } = await import('@notionhq/client')
    const notion = new Client({ auth: config.notion.token })
    const res = await queryDatabase(notion, config.notion.databaseId)
    const tasks = (res.results || []).map(mapPage).filter(Boolean)
    const value = { configured: true, tasks }
    cache = { value, ts: Date.now() }
    return value
  } catch (err) {
    return { configured: true, error: err.message, tasks: [] }
  }
}
