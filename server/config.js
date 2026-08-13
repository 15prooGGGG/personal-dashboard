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
  // Kursdaten für die Watchlist. Kostenlosen Key auf finnhub.io/register holen.
  finnhub: {
    apiKey: env('FINNHUB_API_KEY')
  },
  // Schulportal Hessen (persönlicher Vertretungsplan). Das Passwort ist
  // dasselbe wie für Noten und Schulmail – entsprechend behandeln.
  schulportal: {
    schoolId: env('SPH_SCHOOL_ID'),
    username: env('SPH_USERNAME'), // Vorname.Nachname, ohne Schul-ID davor
    password: env('SPH_PASSWORD')
  },
  // Signal-Push (signal-cli-rest-api im Nachbarcontainer).
  signal: {
    apiUrl: env('SIGNAL_API_URL') || 'http://signal:8080',
    number: env('SIGNAL_NUMBER'), // deine eigene Nummer, +49…
    recipient: env('SIGNAL_RECIPIENT') || env('SIGNAL_NUMBER') // Standard: Notiz an mich
  },
  // Wann und worüber der Bot dich anschreibt.
  notify: {
    // Marktbriefing + Kursalarme lassen sich mit NOTIFY_MARKET=off stilllegen,
    // ohne dass der Code verschwindet – ein Wort in der .env schaltet sie
    // wieder ein. Die Watchlist im Dashboard bleibt davon unberührt.
    market: env('NOTIFY_MARKET').toLowerCase() !== 'off',
    digestTime: env('NOTIFY_DIGEST_TIME') || '07:00',
    digestDays: env('NOTIFY_DIGEST_DAYS') || '1,2,3,4,5',
    // Kursalarm ab dieser Tagesbewegung (Prozent, 0 = aus).
    alertPercent: Number(env('NOTIFY_ALERT_PERCENT') || 3),
    alertEveryMinutes: Number(env('NOTIFY_ALERT_INTERVAL_MIN') || 15),
    // Vertretungsplan-Push (unabhängig vom Markt-Schalter oben).
    plan: env('NOTIFY_PLAN').toLowerCase() !== 'off',
    planTime: env('NOTIFY_PLAN_TIME') || '06:45',
    planDays: env('NOTIFY_PLAN_DAYS') || '1,2,3,4,5',
    // "on" = nur schreiben, wenn tatsächlich Vertretungen anliegen.
    planQuiet: env('NOTIFY_PLAN_QUIET').toLowerCase() === 'on',
    // Ständige Überwachung: holt den Plan regelmäßig und meldet Änderungen,
    // statt nur einmal morgens zu schauen. Vertretungen für den Folgetag
    // werden oft nachmittags oder abends eingetragen.
    planWatch: env('NOTIFY_PLAN_WATCH').toLowerCase() !== 'off',
    planWatchMinutes: Number(env('NOTIFY_PLAN_WATCH_INTERVAL_MIN') || 15),
    planWatchFrom: env('NOTIFY_PLAN_WATCH_FROM') || '06:00',
    planWatchTo: env('NOTIFY_PLAN_WATCH_TO') || '20:00',
    // Standard: alle Tage. Der Montagsplan steht oft schon Sonntagabend.
    planWatchDays: env('NOTIFY_PLAN_WATCH_DAYS') || '0,1,2,3,4,5,6'
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
  mail: Boolean(config.mail.username && config.mail.password),
  finnhub: Boolean(config.finnhub.apiKey)
}
