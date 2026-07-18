import { useEffect, useState } from 'react'
import Widget from './Widget.jsx'

// Demonstriert die End-to-End-Verbindung Frontend -> Express-Backend (/api/health).
export default function StatusWidget() {
  const [state, setState] = useState({ status: 'loading', time: null })

  useEffect(() => {
    let active = true
    const load = () =>
      fetch('/api/health')
        .then((r) => r.json())
        .then((data) => active && setState(data))
        .catch(() => active && setState({ status: 'offline', time: null }))

    load()
    const t = setInterval(load, 15000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [])

  const online = state.status === 'ok'

  return (
    <Widget title="Backend-Status">
      <div className={`status ${online ? 'status--ok' : 'status--down'}`}>
        <span className="status__dot" />
        <span>{online ? 'Online' : state.status === 'loading' ? 'Verbinde…' : 'Offline'}</span>
      </div>
      {state.time && (
        <div className="status__meta">
          Letzter Ping: {new Date(state.time).toLocaleTimeString('de-DE')}
        </div>
      )}
    </Widget>
  )
}
