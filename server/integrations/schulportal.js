// ===========================================================================
// Schulportal Hessen – persönlicher Vertretungsplan.
// ---------------------------------------------------------------------------
// ACHTUNG, das hier ist etwas anderes als die übrigen Integrationen:
//
//   * Es gibt KEINE offizielle API. Wir melden uns wie ein Browser an und
//     lesen HTML. Ändert das Portal sein Markup, bricht der Parser. Deshalb
//     ist er header-gesteuert (er sucht Spalten anhand ihrer Überschrift,
//     nicht anhand fester Positionen) und meldet Fehler laut, statt still
//     leere Listen zu liefern.
//
//   * Das Passwort ist dasselbe wie für Noten, Nachrichten und Schulmail.
//     Es steht nur in der .env, wird nie geloggt und nie ans Frontend
//     gegeben – aber es ist ein wertvolleres Geheimnis als ein API-Key.
//
//   * BEI FALSCHEN ZUGANGSDATEN WIRD NICHT AUTOMATISCH WIEDERHOLT. Das
//     Portal sperrt Konten nach mehreren Fehlversuchen; ein Cronjob, der
//     alle 15 Minuten ein falsches Passwort probiert, sperrt dich aus. Nach
//     einem Auth-Fehler bleibt die Integration deaktiviert, bis der Server
//     neu startet (also bis du das Passwort korrigiert hast).
//
// Login-Fluss (aus dem Formular von login.schulportal.hessen.de abgeleitet):
//   1. POST login.schulportal.hessen.de/?i=<schoolId>
//      user=<schoolId>.<vorname.nachname>, password=…, stayconnected=1
//   2. Redirects folgen, dabei Cookies einsammeln (u. a. "sid")
//   3. GET connect.schulportal.hessen.de/  -> setzt die Session für
//      start.schulportal.hessen.de
//   4. GET start.schulportal.hessen.de/vertretungsplan.php
// ===========================================================================
import { config } from '../config.js'

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const LOGIN_URL = 'https://login.schulportal.hessen.de/'
const CONNECT_URL = 'https://connect.schulportal.hessen.de/'
const PLAN_URL = 'https://start.schulportal.hessen.de/vertretungsplan.php'
const SCHOOLLIST_URL = 'https://startcache.schulportal.hessen.de/exporteur.php?a=schoollist'

const SESSION_TTL = 20 * 60 * 1000
const PLAN_TTL = 10 * 60 * 1000

export const isConfigured = () =>
  Boolean(config.schulportal.schoolId && config.schulportal.username && config.schulportal.password)

// Ein Auth-Fehler legt die Integration still (siehe Kommentar oben).
let authBlocked = null // { reason, at }
let session = null // { cookies: Map, ts }
let planCache = null // { value, ts }

export function getStatus() {
  return {
    configured: isConfigured(),
    blocked: Boolean(authBlocked),
    blockedReason: authBlocked?.reason ?? null,
    loggedIn: Boolean(session)
  }
}

// Minimaler Cookie-Jar ---------------------------------------------------------
// node-fetch folgt Redirects automatisch, verwirft dabei aber Set-Cookie-Header
// der Zwischenschritte. Deshalb folgen wir manuell und sammeln selbst ein.
function collectCookies(jar, res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : []
  for (const line of raw) {
    const [pair] = line.split(';')
    const idx = pair.indexOf('=')
    if (idx < 1) continue
    const name = pair.slice(0, idx).trim()
    const value = pair.slice(idx + 1).trim()
    // Gelöschte Cookies nicht mitschleppen.
    if (!value || value === 'deleted') jar.delete(name)
    else jar.set(name, value)
  }
}

const cookieHeader = (jar) =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')

async function request(url, { jar, method = 'GET', body, referer } = {}) {
  const headers = {
    'User-Agent': UA,
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'de-DE,de;q=0.9'
  }
  if (jar.size) headers.Cookie = cookieHeader(jar)
  if (referer) headers.Referer = referer
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded'

  const res = await fetch(url, {
    method,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000)
  })
  collectCookies(jar, res)
  return res
}

// Redirects manuell verfolgen, damit unterwegs gesetzte Cookies erhalten bleiben.
async function follow(url, jar, maxHops = 8) {
  let current = url
  let res = await request(current, { jar })
  let hops = 0
  while (res.status >= 300 && res.status < 400 && hops < maxHops) {
    const location = res.headers.get('location')
    if (!location) break
    current = new URL(location, current).toString()
    res = await request(current, { jar, referer: url })
    hops++
  }
  return { res, url: current }
}

// Anmeldung --------------------------------------------------------------------
async function login() {
  const { schoolId, username, password } = config.schulportal
  const jar = new Map()

  const entry = `${LOGIN_URL}?i=${encodeURIComponent(schoolId)}`
  // Startseite holen: setzt Vor-Cookies, die der Login erwartet.
  await request(entry, { jar })

  const body = new URLSearchParams({
    user: `${schoolId}.${username}`,
    user2: username,
    password,
    stayconnected: '1',
    skin: 'sp',
    url: ''
  }).toString()

  let res = await request(entry, { jar, method: 'POST', body, referer: entry })

  // Erfolgreicher Login antwortet mit einem Redirect; die Login-Seite selbst
  // kommt nur zurück, wenn die Zugangsdaten nicht stimmen.
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    if (location) await follow(new URL(location, entry).toString(), jar)
  } else {
    const html = await res.text()
    if (html.includes('id="login_form"')) {
      throw Object.assign(new Error('Anmeldung abgelehnt – Benutzername oder Passwort falsch'), {
        auth: true
      })
    }
  }

  // Handshake: holt die Session für start.schulportal.hessen.de.
  await follow(CONNECT_URL, jar)

  if (!jar.has('sid') && !jar.has('SPH-Session')) {
    throw Object.assign(
      new Error('Keine Sitzung erhalten – evtl. Zwei-Faktor-Schutz aktiv oder Anmeldung abgelehnt'),
      { auth: true }
    )
  }

  session = { jar, ts: Date.now() }
  return session
}

async function getSession() {
  if (session && Date.now() - session.ts < SESSION_TTL) return session
  return login()
}

// Vertretungsplan abrufen ------------------------------------------------------
export async function fetchSubstitutionsHtml() {
  if (!isConfigured()) throw new Error('Schulportal ist nicht eingerichtet')
  if (authBlocked) throw new Error(`Anmeldung deaktiviert: ${authBlocked.reason}`)

  try {
    let s = await getSession()
    let { res } = await follow(PLAN_URL, s.jar)
    let html = await res.text()

    // Abgelaufene Sitzung: das Portal schickt zur Anmeldung zurück.
    if (html.includes('id="login_form"') || res.url?.includes('login.')) {
      session = null
      s = await login()
      ;({ res } = await follow(PLAN_URL, s.jar))
      html = await res.text()
    }

    if (html.includes('id="login_form"')) {
      throw Object.assign(new Error('Sitzung ließ sich nicht herstellen'), { auth: true })
    }
    return html
  } catch (err) {
    if (err.auth) {
      // Nicht erneut versuchen – sonst läuft das Konto in die Sperre.
      authBlocked = { reason: err.message, at: new Date().toISOString() }
      console.error('schulportal: Anmeldung deaktiviert –', err.message)
    }
    throw err
  }
}

// Authentifizierter POST gegen das Portal – für die Suche nach einem
// JSON-Endpunkt und zum Nachjustieren, wenn sich das Portal ändert.
export async function probePortal(params, query = '') {
  const s = await getSession()
  const res = await request(PLAN_URL + query, {
    jar: s.jar,
    method: 'POST',
    body: new URLSearchParams(params).toString(),
    referer: PLAN_URL
  })
  return { status: res.status, contentType: res.headers.get('content-type'), body: await res.text() }
}

// HTML-Tabellen auslesen -------------------------------------------------------
// Bewusst ohne Zusatzpaket und bewusst header-gesteuert: Wir suchen die Spalten
// über ihre Überschrift ("Stunde", "Fach", "Raum" …). Verschiebt das Portal die
// Spalten oder ergänzt eine, bleibt die Zuordnung trotzdem richtig.
// Vertretungstexte tippen Lehrkräfte von Hand; darin landen regelmäßig
// benannte Entities (&auml;, &szlig;) statt echter Umlaute. Deshalb ein
// vollständiger Dekodierer statt einer Handvoll Sonderfälle.
const NAMED_ENTITIES = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
  eacute: 'é',
  egrave: 'è',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  bdquo: '„',
  ldquo: '“',
  rdquo: '”',
  sbquo: '‚',
  lsquo: '‘',
  rsquo: '’',
  euro: '€',
  deg: '°'
}

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const value =
        code[1] === 'x' || code[1] === 'X'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : match
    }
    // Groß-/Kleinschreibung zählt bei Entities (&Auml; ≠ &auml;).
    return NAMED_ENTITIES[code] ?? NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}

const strip = (html) =>
  decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\s+/g, ' ')
    .trim()

// Das Portal rendert den persönlichen Plan als bootstrap-table. Deren
// Kopfzellen tragen den Feldnamen mit: <th data-field="Vertreter">. Daran
// hängen wir uns – das ist stabiler als die sichtbare Überschrift, denn die
// ändert sich mit Sprache und Layout, das data-field nicht.
const FIELD_ALIASES = {
  stunde: 'lesson',
  stunden: 'lesson',
  klasse: 'className',
  klassen: 'className',
  fach: 'subject',
  fachalt: 'subjectOld',
  vertreter: 'substitute',
  lehrer: 'teacher',
  lehrerkuerzel: 'teacher',
  lehrkraft: 'teacher',
  lehrelalt: 'teacherOld',
  raum: 'room',
  raumalt: 'roomOld',
  art: 'kind',
  hinweis: 'note',
  hinweise: 'note',
  bemerkung: 'note',
  vertretungstext: 'note',
  tag: 'day',
  datum: 'date'
}

const normalizeField = (raw) =>
  FIELD_ALIASES[String(raw || '').toLowerCase().replace(/[^a-zäöüß]/g, '')] || null

// Steht KEIN Eintrag an, rendert das Portal seine Leermeldung NICHT etwa
// neben der Tabelle, sondern als Zeile darin:
//   <tr><td colspan="11"><div class="alert alert-warning">Keine Einträge!…
// Ungefiltert wird daraus ein Eintrag mit der Meldung im Feld "Stunde" – der
// Plan sieht dann gefüllt aus, obwohl er leer ist. Genau daran ist der
// Abgleich "sind es heute mehr geworden?" bisher gescheitert.
const isNoticeRow = (rowHtml) =>
  /class=["'][^"']*\balert\b/i.test(rowHtml) || /Keine Eintr[äa]ge/i.test(strip(rowHtml))

function parseTable(tableHtml) {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1])
  if (rows.length === 0) return []

  const cellsOf = (row, tag) =>
    [...row.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map((m) => strip(m[1]))

  // Kopfzeile suchen und dabei bevorzugt data-field auswerten.
  let fields = null
  let bodyStart = 0
  for (let i = 0; i < rows.length; i++) {
    const ths = [...rows[i].matchAll(/<th([^>]*)>([\s\S]*?)<\/th>/gi)]
    if (ths.length === 0) continue

    fields = ths.map(([, attrs, label]) => {
      const dataField = /data-field\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]
      // data-field zuerst, sichtbare Überschrift als Rückfallebene.
      return {
        key: normalizeField(dataField) || normalizeField(strip(label)),
        raw: dataField || strip(label)
      }
    })
    bodyStart = i + 1
    break
  }
  if (!fields || !fields.some((f) => f.key)) return []

  const entries = []
  for (let i = bodyStart; i < rows.length; i++) {
    if (isNoticeRow(rows[i])) continue
    const cells = cellsOf(rows[i], 'td')
    if (cells.length === 0) continue

    const entry = {}
    cells.forEach((value, idx) => {
      const field = fields[idx]
      if (!field || !value) return
      // Unbekannte Spalten unter ihrem Originalnamen behalten, statt sie
      // wegzuwerfen – so geht bei einer Portal-Änderung nichts verloren.
      entry[field.key || field.raw] = value
    })
    if (Object.keys(entry).length) entries.push(entry)
  }
  return entries
}

// Pro Tag rendert das Portal <table id="vtable<TT_MM_JJJJ>"> in einem Panel
// <div class="panel" id="tag<TT_MM_JJJJ>">. Aus der ID kommt das Datum – viel
// verlässlicher als das Herumsuchen nach Wochentagsnamen im Text.
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

function labelForDate(dateStr) {
  const [d, m, y] = dateStr.split('.').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${WEEKDAYS[date.getUTCDay()]}, ${dateStr}`
}

// Neben den Vertretungen steht pro Tag eine zweite Tabelle im Panel:
//
//   <h3>Informationen zum 11.08.2026</h3>
//   <table class="… infos">
//     <tr class="subheader"><td><b>Unterrichtsfrei</b></td></tr>
//     <tr><td>6 Std.</td></tr>
//   </table>
//
// Hier landen Unterrichtsfrei, Klausuren und Aushänge – also genau die Sachen,
// die den Schultag verschieben. Sie tauchen NIE in der Vertretungstabelle auf.
// Wer nur vtable liest, meldet "keine Einträge", während im Portal steht, dass
// sechs Stunden ausfallen.
//
// Aufbau: <tr class="subheader"> eröffnet einen Block, die folgenden Zeilen
// gehören dazu, bis der nächste subheader kommt.
function parseInfos(dayHtml) {
  const blocks = []

  for (const t of dayHtml.matchAll(/<table[^>]*class=["'][^"']*\binfos\b[^"']*["'][^>]*>[\s\S]*?<\/table>/gi)) {
    for (const row of t[0].matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi)) {
      const [, attrs, inner] = row
      const cells = [...inner.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => strip(m[1]))
      const text = cells.filter(Boolean).join(' · ')
      if (!text) continue

      if (/\bsubheader\b/i.test(attrs)) blocks.push({ title: text, lines: [] })
      else if (blocks.length) blocks[blocks.length - 1].lines.push(text)
      // Ohne vorangehenden subheader: als eigener Block ohne Überschrift.
      else blocks.push({ title: null, lines: [text] })
    }
  }

  return blocks
}

// A-/B-Woche steht als Abzeichen in der Panel-Überschrift.
function parseWeek(dayHtml) {
  const m = /<span[^>]*class=["'][^"']*\bwoche\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(dayHtml)
  return m ? strip(m[1]) || null : null
}

// Das Portal schreibt unter jeden Tag, wann der Plan zuletzt gepflegt wurde.
// Für die Überwachung wertvoll: ändert sich dieser Zeitstempel, hat jemand am
// Plan gearbeitet – auch wenn das Ergebnis für uns gleich aussieht.
const parseUpdatedAt = (dayHtml) =>
  /Letzte Aktualisierung:\s*([^<]+)/i.exec(dayHtml)?.[1].trim().replace(/\s+/g, ' ') || null

// Das Portal gibt die Tage hintereinander als
//   <div class="panel panel-primary" id="tagTT_MM_JJJJ"> … </div>
// aus. Verschachtelte <div> lassen sich mit einem regulären Ausdruck nicht
// zuverlässig klammern, deshalb schneiden wir an den Panel-IDs: Jeder
// Abschnitt reicht bis zum Beginn des nächsten. Das genügt, weil alles zu
// einem Tag zwischen dessen Marke und der nächsten steht.
function splitDaySections(html) {
  const marks = [...html.matchAll(/id=["']tag(\d{2}_\d{2}_\d{4})["']/gi)]

  return marks.map((m, i) => ({
    date: m[1].replace(/_/g, '.'),
    html: html.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : html.length)
  }))
}

function parseByDay(html) {
  const days = []

  for (const section of splitDaySections(html)) {
    const table = /<table[^>]*id=["']vtable\d{2}_\d{2}_\d{4}["'][^>]*>[\s\S]*?<\/table>/i.exec(
      section.html
    )
    const entries = table ? parseTable(table[0]) : []
    const infos = parseInfos(section.html)

    // Ein Tag ohne Vertretungen, aber mit "Unterrichtsfrei", muss durch.
    if (entries.length === 0 && infos.length === 0) continue

    days.push({
      label: labelForDate(section.date),
      date: section.date,
      week: parseWeek(section.html),
      updatedAt: parseUpdatedAt(section.html),
      infos,
      entries
    })
  }

  if (days.length) return days

  // Rückfallebene: irgendeine Tabelle mit erkennbaren Spalten. Greift, falls
  // das Portal die Panel- oder vtable-IDs einmal umbenennt.
  for (const t of html.matchAll(/<table[^>]*>[\s\S]*?<\/table>/gi)) {
    const entries = parseTable(t[0])
    if (entries.length)
      days.push({ label: 'Aktuell', date: null, week: null, updatedAt: null, infos: [], entries })
  }
  return days
}

// Das Portal sagt selbst, wenn nichts anliegt:
//   <div class="alert alert-warning"><b>Keine Einträge!</b> …
// Diesen Marker zu erkennen ist wichtig, um "heute nichts" von "Parser kaputt"
// unterscheiden zu können.
// Auf dem gestrippten Text prüfen, nicht auf dem rohen HTML: dort steht der
// Satz über mehrere Zeilen verteilt und je nach Laune des Portals mit
// &auml; statt ä. Beides ließe die Leermeldung durchrutschen – und eine nicht
// erkannte Leermeldung meldet sich als "Markup kaputt", also als Fehlalarm.
function hasEmptyMarker(html) {
  const text = strip(html)
  return /Keine Eintr[äa]ge/i.test(text) || /keine Meldungen über Vertretungen/i.test(text)
}

// Wer ist angemeldet? Bestätigt beim Einrichten, dass der richtige Plan kommt.
// Steht im Benutzermenü der Navigation als "Nachname, Vorname (Klasse)".
function parseWho(html) {
  const m = /<i class="fa[^"]*"><\/i>\s*([^<>]{3,80}?\([^)<]{1,20}\))\s*(?:<span|<\/a)/i.exec(html)
  return m ? strip(m[1]) : null
}

// Ausgelagert und exportiert, damit der Parser gegen gespeichertes HTML
// geprüft werden kann, ohne sich anzumelden (siehe server/schulportal.test.js).
export function parsePlanHtml(html) {
  const days = parseByDay(html)
  const total = days.reduce((sum, d) => sum + d.entries.length, 0)
  const infoTotal = days.reduce((sum, d) => sum + d.infos.length, 0)
  const empty = hasEmptyMarker(html)

  // Drei Fälle sauber auseinanderhalten:
  //   ok      – es gibt etwas zu zeigen (Vertretungen und/oder Tagesinfos)
  //   empty   – das Portal meldet selbst, dass nichts anliegt
  //   unknown – weder noch: dann hat sich vermutlich das Markup geändert
  //
  // Die Leermeldung des Portals bezieht sich AUSSCHLIESSLICH auf Vertretungen.
  // Ein Tag kann gleichzeitig "keine Vertretungen" und "Unterrichtsfrei,
  // 6 Std." melden – dann ist der Plan alles andere als leer, und genau diese
  // Zeile will man morgens lesen. "empty" gilt deshalb erst, wenn auch keine
  // Tagesinfos dastehen.
  const state = total > 0 || infoTotal > 0 ? 'ok' : empty ? 'empty' : 'unknown'

  const value = {
    configured: true,
    fetchedAt: new Date().toISOString(),
    who: parseWho(html),
    state,
    days,
    total,
    infoTotal,
    note:
      state === 'empty'
        ? 'Keine Vertretungen gemeldet.'
        : state === 'unknown'
          ? 'Weder Einträge noch die Leermeldung des Portals gefunden – vermutlich hat sich das Markup geändert. /api/substitutions/raw ansehen.'
          : null
  }

  return value
}

export async function fetchSubstitutions({ force = false } = {}) {
  if (!force && planCache && Date.now() - planCache.ts < PLAN_TTL) return planCache.value

  const value = parsePlanHtml(await fetchSubstitutionsHtml())
  planCache = { value, ts: Date.now() }
  return value
}

// Hilfe bei der Einrichtung: Schul-ID suchen -----------------------------------
let schoolCache = null

export async function findSchools(query) {
  const q = String(query || '').trim().toLowerCase()
  if (q.length < 2) return []

  if (!schoolCache) {
    const res = await fetch(SCHOOLLIST_URL, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`Schulliste HTTP ${res.status}`)
    const regions = await res.json()
    schoolCache = regions.flatMap((r) =>
      (r.Schulen || []).map((s) => ({ id: s.Id, name: s.Name, city: s.Ort, region: r.Name }))
    )
  }

  return schoolCache
    .filter((s) => `${s.name} ${s.city}`.toLowerCase().includes(q))
    .slice(0, 15)
}
