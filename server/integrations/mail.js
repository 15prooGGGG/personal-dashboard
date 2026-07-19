// iCloud Mail via IMAP (read-only). Es werden nur als "wichtig" markierte
// (geflaggte) Mails aus dem Posteingang gelesen – nicht der ganze Posteingang.
// Zugangsdaten: iCloud-Adresse + app-spezifisches Passwort.
import { config, isConfigured } from '../config.js'

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

    const mails = []
    const lock = await client.getMailboxLock('INBOX')
    try {
      let uids = await client.search({ flagged: true }, { uid: true })
      uids = (uids || []).slice(-10)
      if (uids.length) {
        for await (const msg of client.fetch(uids, { envelope: true, internalDate: true }, { uid: true })) {
          const from = msg.envelope?.from?.[0]
          mails.push({
            id: String(msg.uid),
            sender: from?.name || from?.address || 'Unbekannt',
            subject: msg.envelope?.subject || '(kein Betreff)',
            receivedAt: (msg.internalDate || new Date()).toISOString()
          })
        }
      }
    } finally {
      lock.release()
    }
    await client.logout()

    mails.reverse()
    const value = { configured: true, mails: mails.slice(0, 10) }
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
