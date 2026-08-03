import { useState } from 'react'
import Rail from './components/Rail.tsx'
import TopBar from './components/TopBar.tsx'
import PlaceholderSection from './components/PlaceholderSection.tsx'
import OverviewSection from './modules/OverviewSection.tsx'
import MarketsSection from './modules/MarketsSection.tsx'
import WatchlistSection from './modules/WatchlistSection.tsx'
import CalendarSection from './modules/CalendarSection.tsx'
import MailSection from './modules/MailSection.tsx'
import TodoSection from './modules/TodoSection.tsx'
import VaultSection from './modules/VaultSection.tsx'
import NewsSection from './modules/NewsSection.tsx'
import { GlobeIcon, TrendingIcon } from './components/icons.tsx'
import { NAV } from './nav.tsx'
import { useTheme } from './lib/useTheme.ts'
import { useStocks } from './lib/useStocks.ts'

export default function App() {
  const { theme, toggle } = useTheme()
  const stocks = useStocks()
  const [active, setActive] = useState('home')
  const [collapsed, setCollapsed] = useState(false)

  const activeItem = NAV.find((n) => n.id === active) ?? NAV[0]

  function renderSection() {
    switch (active) {
      case 'home':
        return <OverviewSection quotes={stocks.quotes} onOpen={setActive} />
      case 'stocks':
        return (
          <MarketsSection
            quotes={stocks.quotes}
            loading={stocks.loading}
            error={stocks.error}
            reload={stocks.reload}
          />
        )
      case 'watchlist':
        return <WatchlistSection />
      case 'calendar':
        return <CalendarSection />
      case 'mail':
        return <MailSection />
      case 'news':
        return <NewsSection type="world" title="News" icon={GlobeIcon} />
      case 'finance':
        return <NewsSection type="finance" title="Finanznews" icon={TrendingIcon} />
      case 'vault':
        return <VaultSection />
      case 'todo':
        return <TodoSection />
      default:
        return <PlaceholderSection item={activeItem} />
    }
  }

  return (
    <div className="app">
      <div className="shell">
        <Rail
          items={NAV}
          activeId={active}
          onSelect={setActive}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
        <main className="main">
          <TopBar theme={theme} onToggleTheme={toggle} />
          {renderSection()}
        </main>
      </div>
    </div>
  )
}
