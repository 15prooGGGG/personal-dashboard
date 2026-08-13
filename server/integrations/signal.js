// ===========================================================================
// Signal – Push-Nachrichten aufs Handy.
// ---------------------------------------------------------------------------
// Spricht signal-cli-rest-api an (eigener Container, siehe docker-compose.yml).
// Der läuft im "normal"-Modus als GEKOPPELTES GERÄT deines Signal-Accounts –
// wie Signal Desktop. Deshalb brauchst du keine zweite Rufnummer, und der Bot
// kann dir an "Notiz an mich" schreiben: die Nachricht landet als normale
// Signal-Benachrichtigung auf dem Handy.
//
// Einrichtung (einmalig) steht in CONNECT.md.
// ===========================================================================
import { config } from '../config.js'

export const isConfigured = () =>
  Boolean(config.signal.apiUrl && config.signal.number && config.signal.recipient)

// Signal rendert kein Markdown. Wir bauen die Nachrichten daher aus Text,
// Zeilenumbrüchen und ein paar Symbolen – mehr Formatierung gibt es nicht.
export async function sendSignal(message) {
  if (!isConfigured()) throw new Error('Signal ist nicht eingerichtet')

  const res = await fetch(`${config.signal.apiUrl.replace(/\/$/, '')}/v2/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      number: config.signal.number,
      recipients: [config.signal.recipient]
    }),
    signal: AbortSignal.timeout(15000)
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Signal HTTP ${res.status}${detail ? ': ' + detail.slice(0, 200) : ''}`)
  }
  return true
}

// Kopplungs-QR holen. Läuft über das Dashboard, damit man den Code von einem
// ZWEITEN Gerät aus anzeigen kann – man kann keinen QR-Code mit demselben
// Handy scannen, auf dem er angezeigt wird. Port 8080 des Signal-Containers
// bleibt deshalb auf 127.0.0.1 und muss nicht geöffnet werden.
//
// Der Code ist kurzlebig und so wertvoll wie der Signal-Account selbst –
// deshalb wird er nicht zwischengespeichert und bei jedem Aufruf neu geholt.
export async function fetchLinkQr(deviceName = 'Dashboard') {
  const base = (config.signal.apiUrl || 'http://signal:8080').replace(/\/$/, '')
  const res = await fetch(
    `${base}/v1/qrcodelink?device_name=${encodeURIComponent(deviceName)}`,
    { signal: AbortSignal.timeout(30000) }
  )
  if (!res.ok) {
    throw new Error(`QR-Code fehlgeschlagen: HTTP ${res.status} ${await res.text().catch(() => '')}`)
  }
  return {
    contentType: res.headers.get('content-type') || 'image/png',
    body: Buffer.from(await res.arrayBuffer())
  }
}

// Eingehende Nachrichten abholen und verwerfen.
// ---------------------------------------------------------------------------
// Ein gekoppeltes Gerät MUSS regelmäßig empfangen, sonst staut sich die
// Warteschlange auf dem Server – signal-cli warnt selbst davor, und Signal
// wirft die Kopplung irgendwann ab. Wir wollen die Nachrichten gar nicht
// lesen; es geht allein darum, die Queue zu leeren und die Kopplung am Leben
// zu halten. Der Inhalt wird bewusst verworfen und nie gespeichert.
export async function drainSignal() {
  if (!isConfigured()) return 0
  const base = config.signal.apiUrl.replace(/\/$/, '')
  const res = await fetch(
    `${base}/v1/receive/${encodeURIComponent(config.signal.number)}?timeout=5`,
    { signal: AbortSignal.timeout(30000) }
  )
  if (!res.ok) throw new Error(`Signal receive HTTP ${res.status}`)
  const messages = await res.json()
  return Array.isArray(messages) ? messages.length : 0
}

// Prüft, ob der Container erreichbar und das Gerät gekoppelt ist. Wird für
// /api/services und die Einrichtungsanzeige im Dashboard benutzt.
export async function checkSignal() {
  if (!isConfigured()) return { configured: false, linked: false }
  try {
    // MODE=normal startet für jede Anfrage einen neuen signal-cli-Prozess –
    // allein /v1/accounts braucht dadurch rund 5 s. Ein knapper Timeout würde
    // eine funktionierende Kopplung als "nicht verbunden" anzeigen.
    const res = await fetch(`${config.signal.apiUrl.replace(/\/$/, '')}/v1/accounts`, {
      signal: AbortSignal.timeout(20000)
    })
    if (!res.ok) return { configured: true, linked: false, error: `HTTP ${res.status}` }
    const accounts = await res.json()
    const list = Array.isArray(accounts) ? accounts : []
    // Die API liefert je nach Version Strings oder Objekte mit .number.
    const numbers = list.map((a) => (typeof a === 'string' ? a : a?.number)).filter(Boolean)
    return { configured: true, linked: numbers.includes(config.signal.number), accounts: numbers }
  } catch (err) {
    return { configured: true, linked: false, error: err.message }
  }
}
