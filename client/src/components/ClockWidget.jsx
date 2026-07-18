import Widget from './Widget.jsx'

export default function ClockWidget({ now }) {
  const time = now.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const date = now.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return (
    <Widget title="Uhrzeit" accent>
      <div className="clock__time">{time}</div>
      <div className="clock__date">{date}</div>
    </Widget>
  )
}
