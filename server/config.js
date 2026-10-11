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
// Feed-Liste als [{ name, url }]. Aus der .env kommen nur URLs – der Name
// fällt dann auf den Feed-Titel zurück.
const feeds = (key, fallback) => {
  const custom = list(key, [])
  return custom.length
    ? custom.map((url) => ({ name: null, url }))
    : fallback.map(([name, url]) => ({ name, url }))
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
  // Viele unabhängige Redaktionen statt einer: Die Liste wird serverseitig
  // gemischt (Round-Robin), damit kein einzelner Feed alles überdeckt.
  // Eigene Liste per NEWS_FEEDS / FINANCE_FEEDS (kommagetrennte URLs).
  news: {
    world: feeds('NEWS_FEEDS', [
      ['tagesschau', 'https://www.tagesschau.de/index~rss2.xml'],
      ['ZDFheute', 'https://www.zdfheute.de/rss/zdf/nachrichten'],
      ['Deutschlandfunk', 'https://www.deutschlandfunk.de/nachrichten-100.rss'],
      ['SPIEGEL', 'https://www.spiegel.de/schlagzeilen/index.rss'],
      ['ZEIT', 'https://newsfeed.zeit.de/index'],
      ['FAZ', 'https://www.faz.net/rss/aktuell/'],
      ['SZ', 'https://rss.sueddeutsche.de/rss/Topthemen'],
      ['WELT', 'https://www.welt.de/feeds/latest.rss'],
      ['n-tv', 'https://www.n-tv.de/rss'],
      ['DW', 'https://rss.dw.com/rdf/rss-de-all'],
      ['Tagesspiegel', 'https://www.tagesspiegel.de/contentexport/feed/home'],
      ['hessenschau', 'https://www.hessenschau.de/index.rss'],
      ['heise', 'https://www.heise.de/rss/heise-top-atom.xml'],
      ['BBC', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
      ['Guardian', 'https://www.theguardian.com/world/rss']
    ]),
    finance: feeds('FINANCE_FEEDS', [
      ['Handelsblatt', 'https://feeds.cms.handelsblatt.com/finanzen'],
      ['WirtschaftsWoche', 'https://feeds.cms.wiwo.de/rss/schlagzeilen'],
      ['manager magazin', 'https://www.manager-magazin.de/news/index.rss'],
      ['FAZ Finanzen', 'https://www.faz.net/rss/aktuell/finanzen/'],
      ['SPIEGEL Wirtschaft', 'https://www.spiegel.de/wirtschaft/index.rss'],
      ['n-tv Wirtschaft', 'https://www.n-tv.de/wirtschaft/rss'],
      ['tagesschau Wirtschaft', 'https://www.tagesschau.de/wirtschaft/index~rss2.xml'],
      ['MarketWatch', 'https://feeds.content.dowjones.io/public/rss/mw_topstories'],
      ['CNBC', 'https://www.cnbc.com/id/100003114/device/rss/rss.html']
    ])
  }
}

export const isConfigured = {
  calendar: Boolean(config.calendar.username && config.calendar.password),
  mail: Boolean(config.mail.username && config.mail.password),
  finnhub: Boolean(config.finnhub.apiKey)
}
