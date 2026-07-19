import { exams } from '../data/mock.ts'
import { daysUntil, countdownLabel } from '../lib/time.ts'

export default function ExamsModule() {
  const sorted = [...exams].sort((a, b) => +new Date(a.date) - +new Date(b.date))
  return (
    <ul className="list">
      {sorted.map((e) => {
        const urgent = daysUntil(e.date) <= 3
        return (
          <li className="exam" key={e.id}>
            <div className="row__main">
              <span className="row__title">{e.subject}</span>
              {e.topic && <div className="exam__topic">{e.topic}</div>}
            </div>
            <span className={`countdown data ${urgent ? 'is-urgent' : ''}`}>{countdownLabel(e.date)}</span>
          </li>
        )
      })}
    </ul>
  )
}
