import { useState } from 'react'
import Rail from './components/Rail.tsx'
import TopBar from './components/TopBar.tsx'
import PlaceholderSection from './components/PlaceholderSection.tsx'
import MarketsSection from './modules/MarketsSection.tsx'
import { NAV } from './nav.tsx'
import { useTheme } from './lib/useTheme.ts'
import { useStocks } from './lib/useStocks.ts'

export default function App() {
  const { theme, toggle } = useTheme()
  const stocks = useStocks()
  const [active, setActive] = useState('home')

  const activeItem = NAV.find((n) => n.id === active) ?? NAV[0]

  return (
    <div className="app-layout">
      <Rail items={NAV} activeId={active} onSelect={setActive} />

      <main className="main">
        <div className="shell">
          <TopBar theme={theme} onToggleTheme={toggle} quotes={stocks.quotes} />

          {active === 'home' || active === 'stocks' ? (
            <MarketsSection
              quotes={stocks.quotes}
              loading={stocks.loading}
              error={stocks.error}
              reload={stocks.reload}
            />
          ) : (
            <PlaceholderSection item={activeItem} />
          )}
        </div>
      </main>
    </div>
  )
}
