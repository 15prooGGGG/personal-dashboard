import { exams } from '../data/mock.ts'
import { daysUntil, countdownLabel } from '../lib/time.ts'

export default function ExamsModule() {
  // Nächste Klausuren zuerst.
  const sorted = [...exams].sort((a, b) => +new Date(a.date) - +new Date(b.date))

  return (
    <ul className="list exams">
      {sorted.map((e) => {
        const d = daysUntil(e.date)
        const urgent = d <= 3
        return (
          <li className="exam" key={e.id}>
            <div className="exam__main">
              <span className="row__title">{e.subject}</span>
              {e.topic && <span className="muted exam__topic">{e.topic}</span>}
            </div>
            <span className={`countdown data ${urgent ? 'is-urgent' : ''}`}>
              {countdownLabel(e.date)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
