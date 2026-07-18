import { importantMails } from '../data/mock.ts'
import { relativeTime } from '../lib/time.ts'

export default function MailModule() {
  return (
    <ul className="list">
      {importantMails.map((mail) => (
        <li className="mail" key={mail.id}>
          <div className="mail__top">
            <span className="mail__sender">{mail.sender}</span>
            <span className="muted data">{relativeTime(mail.receivedAt)}</span>
          </div>
          <p className="mail__subject">{mail.subject}</p>
          <p className="muted mail__preview">{mail.preview}</p>
        </li>
      ))}
    </ul>
  )
}
