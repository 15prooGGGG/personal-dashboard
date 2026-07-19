import { calendar } from '../data/mock.ts'
import { formatTime, daysUntil } from '../lib/time.ts'

export default function CalendarModule() {
  return (
    <ul className="list">
      {calendar.map((ev) => (
        <li className="row" key={ev.id}>
          <span className="row__time data">
            {formatTime(ev.start)}
            {daysUntil(ev.start) > 0 && <span className="muted"> morgen</span>}
          </span>
          <span className="row__main">
            <span className="row__title">{ev.title}</span>
            {ev.location && <span className="muted"> · {ev.location}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
