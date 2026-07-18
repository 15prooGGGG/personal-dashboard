import { useEffect, useState } from 'react'
import ClockWidget from './components/ClockWidget.jsx'
import StatusWidget from './components/StatusWidget.jsx'
import PlaceholderWidget from './components/PlaceholderWidget.jsx'

export default function App() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const greeting = getGreeting(now.getHours())

  return (
    <div className="app">
      <header className="app__header">
        <h1>{greeting}</h1>
        <p className="app__subtitle">Dein persönliches Dashboard</p>
      </header>

      <main className="grid">
        {/* Beispiel-Widgets als Grundgerüst. Weitere Inhalte folgen nach der Planung. */}
        <ClockWidget now={now} />
        <StatusWidget />
        <PlaceholderWidget title="Links" hint="Schnellzugriffe kommen hierhin" />
        <PlaceholderWidget title="To-Dos" hint="Aufgabenliste – in Planung" />
        <PlaceholderWidget title="Wetter" hint="Wetter-Widget – in Planung" />
        <PlaceholderWidget title="Notizen" hint="Notizen – in Planung" />
      </main>

      <footer className="app__footer">
        <span>Personal Dashboard · v0.1.0</span>
      </footer>
    </div>
  )
}

function getGreeting(hour) {
  if (hour < 5) return 'Gute Nacht'
  if (hour < 11) return 'Guten Morgen'
  if (hour < 18) return 'Guten Tag'
  return 'Guten Abend'
}
