import PageSection from '../components/PageSection.tsx'
import NotConnected from '../components/NotConnected.tsx'
import { MailIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'
import { relativeTime } from '../lib/time.ts'
import type { MailItem } from '../types.ts'

interface MailResponse {
  configured: boolean
  mails: MailItem[]
  error?: string
}

export default function MailSection() {
  const { data, loading, error } = useApi<MailResponse>('/api/mail', 5 * 60 * 1000)

  let body
  if (loading) body = <div className="state">Lädt …</div>
  else if (error) body = <div className="state">{error}</div>
  else if (!data?.configured || data.error)
    body = (
      <NotConnected
        name="iCloud Mail"
        errorDetail={data?.error}
        steps={[
          'appleid.apple.com → App-spezifisches Passwort erzeugen (oder das vom Kalender wiederverwenden).',
          'iCloud-Adresse und Passwort unten eintragen.',
          'In Mail wichtige Nachrichten mit der Flagge markieren – nur diese werden gezeigt.'
        ]}
        envVars={['ICLOUD_IMAP_USERNAME', 'ICLOUD_IMAP_APP_PASSWORD']}
      />
    )
  else if (data.mails.length === 0)
    body = <div className="state">Keine als wichtig markierten Mails.</div>
  else
    body = (
      <div className="card">
        <ul className="list">
          {data.mails.map((mail) => (
            <li className="mail" key={mail.id}>
              <div className="mail__top">
                <span className="mail__sender">
                  {mail.topic && <span className="tag mail__tag">{mail.topic}</span>}
                  {mail.sender}
                </span>
                <span className="muted data">{relativeTime(mail.receivedAt)}</span>
              </div>
              <p className="mail__subject">{mail.subject}</p>
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <PageSection title="Wichtige Mails" icon={MailIcon} note="iCloud · nur geflaggte">
      {body}
    </PageSection>
  )
}
