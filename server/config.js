// ===========================================================================
// Zentrale Konfiguration – liest alle Zugangsdaten aus Umgebungsvariablen.
// Secrets stehen ausschließlich in der .env (Projektwurzel, NICHT in Git) bzw.
// werden von docker-compose per env_file gesetzt. Nichts davon erreicht je das
// Frontend.
// ===========================================================================
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// .env aus der Projektwurzel laden (für lokale Entwicklung). Im Docker-Betrieb
// kommen die Werte über env_file direkt in process.env.
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const env = (key) => (process.env[key] || '').trim()
const list = (key, fallback) => {
  const arr = env(key)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return arr.length ? arr : fallback
}

export const config = {
  calendar: {
    username: env('ICLOUD_CALDAV_USERNAME'),
    password: env('ICLOUD_CALDAV_APP_PASSWORD'),
    calendarName: env('ICLOUD_CALENDAR_NAME')
  },
  mail: {
    username: env('ICLOUD_IMAP_USERNAME'),
    password: env('ICLOUD_IMAP_APP_PASSWORD')
  },
  news: {
    world: list('NEWS_FEEDS', ['https://www.tagesschau.de/index~rss2.xml']),
    finance: list('FINANCE_FEEDS', [
      'https://www.handelsblatt.com/contentexport/feed/finanzen',
      'https://www.tagesschau.de/wirtschaft/index~rss2.xml'
    ])
  }
}

export const isConfigured = {
  calendar: Boolean(config.calendar.username && config.calendar.password),
  mail: Boolean(config.mail.username && config.mail.password)
}
