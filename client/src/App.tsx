import { useState } from 'react'
import Rail from './components/Rail.tsx'
import TopBar from './components/TopBar.tsx'
import PlaceholderSection from './components/PlaceholderSection.tsx'
import MarketsSection from './modules/MarketsSection.tsx'
import CalendarSection from './modules/CalendarSection.tsx'
import MailSection from './modules/MailSection.tsx'
import NewsSection from './modules/NewsSection.tsx'
import { GlobeIcon, TrendingIcon } from './components/icons.tsx'
import { NAV } from './nav.tsx'
import { useTheme } from './lib/useTheme.ts'
import { useStocks } from './lib/useStocks.ts'

export default function App() {
  const { theme, toggle } = useTheme()
  const stocks = useStocks()
  const [active, setActive] = useState('home')

  const activeItem = NAV.find((n) => n.id === active) ?? NAV[0]

  function renderSection() {
    switch (active) {
      case 'home':
      case 'stocks':
        return (
          <MarketsSection
            quotes={stocks.quotes}
            loading={stocks.loading}
            error={stocks.error}
            reload={stocks.reload}
          />
        )
      case 'calendar':
        return <CalendarSection />
      case 'mail':
        return <MailSection />
      case 'news':
        return <NewsSection type="world" title="News" icon={GlobeIcon} />
      case 'finance':
        return <NewsSection type="finance" title="Finanznews" icon={TrendingIcon} />
      default:
        return <PlaceholderSection item={activeItem} />
    }
  }

  return (
    <div className="app-layout">
      <Rail items={NAV} activeId={active} onSelect={setActive} />

      <main className="main">
        <div className="shell">
          <TopBar theme={theme} onToggleTheme={toggle} quotes={stocks.quotes} />
          {renderSection()}
        </div>
      </main>
    </div>
  )
}
