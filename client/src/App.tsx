import { useMemo, useState } from 'react'
import TopBar from './components/TopBar.tsx'
import Card from './components/Card.tsx'
import MarketsSection from './modules/MarketsSection.tsx'
import { MODULES } from './modules/registry.tsx'
import { useTheme } from './lib/useTheme.ts'

export default function App() {
  const { theme, toggle } = useTheme()
  const [showExperimental, setShowExperimental] = useState(true)

  const modules = useMemo(
    () => MODULES.filter((m) => showExperimental || !m.experimental),
    [showExperimental]
  )

  return (
    <div className="shell">
      <TopBar
        theme={theme}
        onToggleTheme={toggle}
        showExperimental={showExperimental}
        onToggleExperimental={setShowExperimental}
      />

      {/* Featured: Märkte mit echten Kursen + interaktivem Chart */}
      <MarketsSection />

      {/* Übrige Briefing-Karten aus der Registry */}
      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Briefing</h2>
        </div>
        <div className="grid">
          {modules.map((m) => (
            <Card key={m.id} title={m.title} icon={m.icon} experimental={m.experimental}>
              <m.Component />
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
