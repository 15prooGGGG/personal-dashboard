// iCloud Mail via IMAP (read-only). Zeigt nur Mails, die zu einem definierten
// Thema passen (siehe mail-filters.js) oder manuell geflaggt sind – niemals den
// ganzen Posteingang. Zugangsdaten: iCloud-Adresse + app-spezifisches Passwort.
import { config, isConfigured } from '../config.js'
import { matchTopic, INCLUDE_FLAGGED, SCAN_RECENT } from '../mail-filters.js'

const TTL = 5 * 60 * 1000
let cache = null

export async function fetchImportantMails() {
  if (!isConfigured.mail) return { configured: false, mails: [] }
  if (cache && Date.now() - cache.ts < TTL) return cache.value

  let client
  try {
    const { ImapFlow } = await import('imapflow')
    client = new ImapFlow({
      host: 'imap.mail.me.com',
      port: 993,
      secure: true,
      auth: { user: config.mail.username, pass: config.mail.password },
      logger: false
    })
    await client.connect()

    const matched = []
    const lock = await client.getMailboxLock('INBOX')
    try {
      const total = client.mailbox.exists || 0
      if (total > 0) {
        const start = Math.max(1, total - (SCAN_RECENT - 1))
        for await (const msg of client.fetch(
          `${start}:*`,
          { envelope: true, internalDate: true, flags: true },
          { uid: false }
        )) {
          const from = msg.envelope?.from?.[0]
          const fromAddress = from?.address || ''
          const fromName = from?.name || ''
          const subject = msg.envelope?.subject || ''
          const flagged = INCLUDE_FLAGGED && msg.flags?.has('\\Flagged')

          const topic = matchTopic(subject, fromAddress, fromName)
          if (!topic && !flagged) continue

          matched.push({
            id: String(msg.uid || msg.seq),
            sender: fromName || fromAddress || 'Unbekannt',
            subject: subject || '(kein Betreff)',
            receivedAt: (msg.internalDate || new Date()).toISOString(),
            topic: topic || 'Wichtig'
          })
        }
      }
    } finally {
      lock.release()
    }
    await client.logout()

    matched.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
    const value = { configured: true, mails: matched.slice(0, 15) }
    cache = { value, ts: Date.now() }
    return value
  } catch (err) {
    try {
      await client?.logout()
    } catch {
      // ignore
    }
    return { configured: true, error: err.message, mails: [] }
  }
}
