import { calendar } from '../data/mock.ts'
import { formatTime, daysUntil } from '../lib/time.ts'

export default function CalendarModule() {
  return (
    <ul className="list">
      {calendar.map((ev) => {
        const today = daysUntil(ev.start) === 0
        return (
          <li className="row" key={ev.id}>
            <span className="row__time data">
              {ev.allDay ? 'ganztägig' : formatTime(new Date(ev.start))}
              {!today && <span className="muted"> · morgen</span>}
            </span>
            <span className="row__main">
              <span className="row__title">{ev.title}</span>
              {ev.location && <span className="muted"> · {ev.location}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
